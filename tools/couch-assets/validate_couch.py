"""Audit the runtime couch GLB independently of Blender (requires NumPy/Pillow).

Run from any directory: python tools/couch-assets/validate_couch.py
The JSON report records geometry, embedded textures, material use, and bounds.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
import sys

import numpy as np
from PIL import Image


PROJECT = Path(__file__).resolve().parents[2]
COMPONENTS = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def at(items, index, label):
    require(isinstance(index, int) and 0 <= index < len(items), f"Invalid {label} reference: {index}")
    return items[index]


def reject_nonfinite(value):
    raise ValueError(f"Non-finite JSON number: {value}")


def parse_glb(raw):
    require(len(raw) >= 28, "Truncated GLB header")
    magic, version, total = struct.unpack_from("<4sII", raw)
    require(magic == b"glTF" and version == 2 and total == len(raw), "Invalid GLB 2 header/length")
    chunks = []
    offset = 12
    while offset < len(raw):
        require(offset + 8 <= len(raw), "Truncated GLB chunk header")
        size, kind = struct.unpack_from("<I4s", raw, offset)
        require(size % 4 == 0 and offset + 8 + size <= len(raw), "Invalid GLB chunk alignment/length")
        chunks.append((kind, raw[offset + 8:offset + 8 + size]))
        offset += 8 + size
    require([kind for kind, _ in chunks] == [b"JSON", b"BIN\0"], "Expected one JSON and one BIN chunk")
    gltf = json.loads(chunks[0][1], parse_constant=reject_nonfinite)
    require(gltf.get("asset", {}).get("version") == "2.0", "Asset is not glTF 2.0")
    buffers = gltf.get("buffers", [])
    require(len(buffers) == 1 and "uri" not in buffers[0], "Asset must contain one embedded buffer")
    length = buffers[0]["byteLength"]
    blob = chunks[1][1]
    require(0 <= len(blob) - length <= 3, "BIN length differs from declared buffer beyond padding")
    require(not any(blob[length:]), "Nonzero BIN padding")
    return gltf, blob[:length]


class Accessors:
    def __init__(self, gltf, blob):
        self.gltf, self.blob, self.cache = gltf, blob, {}
        for index, view in enumerate(gltf.get("bufferViews", [])):
            start, length = view.get("byteOffset", 0), view["byteLength"]
            require(view.get("buffer", 0) == 0, f"View {index} references external buffer")
            require(start >= 0 and length > 0 and start + length <= len(blob), f"View {index} exceeds buffer")

    def view(self, index):
        return at(self.gltf.get("bufferViews", []), index, "bufferView")

    def get(self, index):
        if index in self.cache:
            return self.cache[index]
        accessor = at(self.gltf.get("accessors", []), index, "accessor")
        require("sparse" not in accessor, f"Accessor {index}: sparse data is not supported by this asset audit")
        require(accessor.get("componentType") in COMPONENTS, f"Accessor {index}: unsupported component type")
        require(accessor.get("type") in WIDTHS, f"Accessor {index}: invalid accessor type")
        dtype = np.dtype(COMPONENTS[accessor["componentType"]])
        width = WIDTHS[accessor["type"]]
        # Matrix byte padding rules are unnecessary for this static, unskinned asset.
        require(not accessor["type"].startswith("MAT"), f"Accessor {index}: unexpected matrix accessor")
        count = accessor["count"]
        require(isinstance(count, int) and count > 0, f"Accessor {index}: empty or invalid count")
        view = self.view(accessor.get("bufferView"))
        relative_offset = accessor.get("byteOffset", 0)
        offset = view.get("byteOffset", 0) + relative_offset
        stride = view.get("byteStride", width * dtype.itemsize)
        require(relative_offset >= 0 and offset % dtype.itemsize == 0, f"Accessor {index}: misaligned offset")
        require(stride >= width * dtype.itemsize and stride % dtype.itemsize == 0, f"Accessor {index}: invalid stride")
        require(relative_offset + (count - 1) * stride + width * dtype.itemsize <= view["byteLength"],
                f"Accessor {index} exceeds bufferView")
        array = np.ndarray((count, width), dtype=dtype, buffer=self.blob, offset=offset,
                           strides=(stride, dtype.itemsize))
        require(np.isfinite(array).all(), f"Accessor {index}: non-finite values")
        for key, calculated in (("min", array.min(0)), ("max", array.max(0))):
            if key in accessor:
                declared = np.asarray(accessor[key])
                require(declared.shape == (width,) and np.isfinite(declared).all(), f"Accessor {index}: invalid {key}")
                require(np.allclose(declared, calculated, rtol=1e-5, atol=1e-6), f"Accessor {index}: incorrect {key}")
        if accessor.get("normalized"):
            require(dtype.kind in "iu", f"Accessor {index}: floating point data cannot be normalized")
            array = array.astype(np.float64) / np.iinfo(dtype).max
            if dtype.kind == "i":
                array = np.maximum(array, -1)
        self.cache[index] = array
        return array


def node_transform(node):
    if "matrix" in node:
        require(not any(k in node for k in ("rotation", "translation", "scale")), "Node mixes matrix and TRS")
        matrix = np.asarray(node["matrix"], dtype=float).reshape(4, 4).T
    else:
        quaternion = np.asarray(node.get("rotation", [0, 0, 0, 1]), dtype=float)
        require(quaternion.shape == (4,) and np.isclose(np.linalg.norm(quaternion), 1, atol=1e-5), "Non-unit node quaternion")
        x, y, z, w = quaternion
        rotation = np.array([
            [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)],
            [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)],
            [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)],
        ])
        matrix = np.eye(4)
        matrix[:3, :3] = rotation @ np.diag(node.get("scale", [1, 1, 1]))
        matrix[:3, 3] = node.get("translation", [0, 0, 0])
    require(np.isfinite(matrix).all() and np.allclose(matrix[3], [0, 0, 0, 1]), "Invalid node transform")
    require(abs(np.linalg.det(matrix[:3, :3])) > 1e-12, "Node has singular transform")
    return matrix


def texture_slots(value, path=""):
    """Find standard and extension material texture-info objects."""
    if not isinstance(value, dict):
        return
    for key, child in value.items():
        child_path = f"{path}.{key}" if path else key
        if key.endswith("Texture") and isinstance(child, dict):
            yield child_path, child
        else:
            yield from texture_slots(child, child_path)


def validate(path, triangle_budget, draw_call_budget):
    raw = path.read_bytes()
    gltf, blob = parse_glb(raw)
    accessors = Accessors(gltf, blob)
    for index in range(len(gltf.get("accessors", []))):
        accessors.get(index)
    require(not gltf.get("skins") and not gltf.get("animations"), "Couch must be a static asset")
    supported_required = {"KHR_materials_emissive_strength", "KHR_mesh_quantization"}
    require(set(gltf.get("extensionsRequired", [])) <= supported_required, "Unexpected required glTF extension")

    images = []
    for index, image in enumerate(gltf.get("images", [])):
        require("uri" not in image, f"Image {index} is not embedded")
        view = accessors.view(image.get("bufferView"))
        offset = view.get("byteOffset", 0)
        data = blob[offset:offset + view["byteLength"]]
        require(image.get("mimeType") in ("image/png", "image/jpeg"), f"Image {index}: unsupported format")
        with Image.open(io.BytesIO(data)) as picture:
            require(picture.format == {"image/png": "PNG", "image/jpeg": "JPEG"}[image["mimeType"]],
                    f"Image {index}: MIME type does not match contents")
            size = picture.size
            require(max(size) <= 4096 and min(size) > 0, f"Image {index}: unreasonable dimensions")
            picture.verify()
        images.append({"name": image.get("name", f"image-{index}"), "size": list(size),
                       "mimeType": image["mimeType"], "bytes": len(data), "embedded": True})

    textures = gltf.get("textures", [])
    for index, texture in enumerate(textures):
        at(images, texture.get("source"), f"texture {index} source image")
        if "sampler" in texture:
            at(gltf.get("samplers", []), texture["sampler"], f"texture {index} sampler")
    materials = gltf.get("materials", [])
    require(materials, "No couch materials")
    material_slots = {}
    for index, material in enumerate(materials):
        require(material.get("alphaMode", "OPAQUE") == "OPAQUE", f"Material {index} must be opaque")
        slots = list(texture_slots(material))
        for slot, info in slots:
            at(textures, info.get("index"), f"material {index} {slot}")
        material_slots[index] = slots
    require(images and any(material_slots.values()), "Couch must include embedded surface textures")

    worlds = {}
    nodes = gltf.get("nodes", [])

    def walk(index, parent):
        node = at(nodes, index, "node")
        require(index not in worlds, f"Node {index} is cyclic or has multiple parents")
        world = parent @ node_transform(node)
        worlds[index] = world
        for child in node.get("children", []):
            walk(child, world)

    scene = at(gltf.get("scenes", []), gltf.get("scene", 0), "scene")
    for index in scene.get("nodes", []):
        walk(index, np.eye(4))

    positions = []
    stats = []
    triangles = degenerate = winding = draw_calls = 0
    for node_index, world in worlds.items():
        node = nodes[node_index]
        if "mesh" not in node:
            continue
        require("skin" not in node, f"Node {node_index} is skinned")
        mesh = at(gltf.get("meshes", []), node["mesh"], "mesh")
        for primitive in mesh["primitives"]:
            require(primitive.get("mode", 4) == 4, "Couch primitive must use triangles")
            require(not primitive.get("targets"), "Unexpected morph targets")
            attributes = primitive["attributes"]
            require("POSITION" in attributes and "NORMAL" in attributes, "Missing positions or normals")
            vertices, normals = accessors.get(attributes["POSITION"]), accessors.get(attributes["NORMAL"])
            require(vertices.shape[1] == 3 and normals.shape == vertices.shape, "Invalid position/normal shape")
            require(np.allclose(np.linalg.norm(normals, axis=1), 1, atol=5e-4), "Non-unit vertex normals")
            for semantic, accessor_index in attributes.items():
                values = accessors.get(accessor_index)
                require(len(values) == len(vertices), f"{semantic} length does not match positions")
                if semantic.startswith("TEXCOORD_"):
                    require(values.shape[1] == 2, f"{semantic} must have two components")
                elif semantic == "TANGENT":
                    require(values.shape[1] == 4 and np.allclose(np.linalg.norm(values[:, :3], axis=1), 1, atol=5e-4),
                            "Invalid tangents")
                    require(np.all(np.isclose(np.abs(values[:, 3]), 1)), "Invalid tangent handedness")
            index_accessor = at(gltf.get("accessors", []), primitive.get("indices"), "index accessor")
            require(index_accessor["type"] == "SCALAR" and index_accessor["componentType"] in (5121, 5123, 5125)
                    and not index_accessor.get("normalized"), "Invalid index component type")
            indices = accessors.get(primitive["indices"]).ravel()
            require(len(indices) % 3 == 0 and indices.max() < len(vertices), "Triangle index is out of bounds")
            faces = indices.reshape(-1, 3)
            material_index = primitive.get("material")
            material = at(materials, material_index, "material")
            uv_stats = {}
            for slot, info in material_slots[material_index]:
                uv_index = info.get("extensions", {}).get("KHR_texture_transform", {}).get("texCoord", info.get("texCoord", 0))
                semantic = f"TEXCOORD_{uv_index}"
                require(semantic in attributes, f"Material {material_index} {slot} references missing {semantic}")
                uv = accessors.get(attributes[semantic])
                uv_stats[semantic] = {"minimum": uv.min(0).tolist(), "maximum": uv.max(0).tolist()}
            positions.append(vertices @ world[:3, :3].T + world[:3, 3])
            geometric = np.cross(vertices[faces[:, 1]] - vertices[faces[:, 0]],
                                 vertices[faces[:, 2]] - vertices[faces[:, 0]])
            area = np.linalg.norm(geometric, axis=1)
            degenerate += int((area < 1e-13).sum())
            alignment = np.einsum("ij,ij->i", geometric, normals[faces].mean(1))
            winding += int(((alignment < -1e-10) & (area > 1e-13)).sum())
            triangles += len(faces)
            draw_calls += 1
            stats.append({"node": node.get("name", str(node_index)), "material": material.get("name", str(material_index)),
                          "triangles": len(faces), "vertices": len(vertices), "texture_slots": [s for s, _ in material_slots[material_index]],
                          "uv_ranges": uv_stats})
    require(positions, "Default scene contains no mesh geometry")
    vertices = np.concatenate(positions)
    minimum, maximum = vertices.min(0), vertices.max(0)
    dimensions = maximum - minimum
    require(np.isfinite(vertices).all(), "Transformed vertices contain non-finite values")
    require(np.all(dimensions <= np.array([5, 1.22, 1.1]) + 1e-5), f"Couch exceeds runtime bounds: {dimensions.tolist()}")
    require(np.all(dimensions >= [4.5, 1.0, 0.85]), f"Couch scale or Y-up orientation is incorrect: {dimensions.tolist()}")
    require(abs(minimum[1]) <= 2e-4, f"Floor origin is incorrect: minimum Y={minimum[1]}")
    require(triangles <= triangle_budget, f"Triangle budget exceeded: {triangles} > {triangle_budget}")
    require(draw_calls <= draw_call_budget, f"Draw call budget exceeded: {draw_calls} > {draw_call_budget}")
    require(len(materials) <= draw_call_budget, "Material budget exceeded")
    require(degenerate / triangles < 0.005, f"Degenerate triangle ratio exceeds 0.5%: {degenerate}/{triangles}")
    require(winding == 0, f"Triangle winding disagrees with normals: {winding}")
    notes = []
    if degenerate:
        notes.append(f"{degenerate} non-rasterizing zero-area triangles ({100 * degenerate / triangles:.3f}%).")
    return {
        "status": "passed_with_notes" if notes else "passed", "notes": notes, "file": path.name,
        "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "triangles": triangles,
        "triangle_budget": triangle_budget, "materials": len(materials), "material_draw_calls": draw_calls,
        "draw_call_budget": draw_call_budget, "bounds_min": minimum.tolist(), "bounds_max": maximum.tolist(),
        "dimensions_XYZ": dimensions.tolist(), "origin": "Y-up, feet on Y=0",
        "expected_front_axis": "+Z (requires visual verification)",
        "finite_arrays": True, "unit_normals": True, "indices_valid": True, "texture_references_valid": True,
        "degenerate_triangles": degenerate, "winding_mismatches": winding, "images": images,
        "material_geometry": stats, "required_extensions": gltf.get("extensionsRequired", []),
        "generator": gltf["asset"].get("generator"),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-path", type=Path, default=PROJECT / "public/models/vip-couch.glb")
    parser.add_argument("--report-dir", type=Path, default=PROJECT / "docs/couch-assets")
    parser.add_argument("--max-triangles", type=int, default=120000)
    parser.add_argument("--max-draw-calls", type=int, default=12)
    args = parser.parse_args()
    try:
        report = validate(args.model_path.resolve(), args.max_triangles, args.max_draw_calls)
    except (ValueError, KeyError, IndexError, TypeError, OSError, struct.error) as error:
        report = {"status": "failed", "file": args.model_path.name, "error": str(error)}
    args.report_dir.mkdir(parents=True, exist_ok=True)
    (args.report_dir / "validation-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 1 if report["status"] == "failed" else 0


if __name__ == "__main__":
    sys.exit(main())
