"""Independent geometry, silhouette, floor origin and packed-image GLB audit."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('asset_glb_audit', ROOT / 'tools/couch-assets/validate_couch.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
require = audit.require
path = ROOT / 'public/models/casino-planter.glb'
raw = path.read_bytes()
gltf, blob = audit.parse_glb(raw)
accessors = audit.Accessors(gltf, blob)
for index in range(len(gltf['accessors'])):
    accessors.get(index)
require(not gltf.get('skins') and not gltf.get('animations'), 'Planter must be a static asset')
require(not gltf.get('cameras') and not gltf.get('extensions', {}).get('KHR_lights_punctual'),
        'Studio objects must not enter the runtime export')
worlds = {}


def walk(index, parent):
    require(index not in worlds, 'Invalid node hierarchy')
    node = gltf['nodes'][index]
    world = parent @ audit.node_transform(node)
    worlds[index] = world
    for child in node.get('children', []):
        walk(child, world)


for root in gltf['scenes'][gltf.get('scene', 0)]['nodes']:
    walk(root, np.eye(4))
positions = []
triangles = degenerate = winding = batches = 0
material_stats = []
for index, world in worlds.items():
    node = gltf['nodes'][index]
    if 'mesh' not in node:
        continue
    for primitive in gltf['meshes'][node['mesh']]['primitives']:
        require(primitive.get('mode', 4) == 4, 'Expected triangular geometry')
        attrs = primitive['attributes']
        vertices = accessors.get(attrs['POSITION'])
        normals = accessors.get(attrs['NORMAL'])
        require(normals.shape == vertices.shape, 'Normals do not match vertices')
        require(np.allclose(np.linalg.norm(normals, axis=1), 1, atol=5e-4), 'Non-unit normals')
        indices = accessors.get(primitive['indices']).ravel()
        require(len(indices) % 3 == 0 and indices.max() < len(vertices), 'Invalid triangle indices')
        faces = indices.reshape(-1, 3)
        cross = np.cross(vertices[faces[:, 1]] - vertices[faces[:, 0]],
                         vertices[faces[:, 2]] - vertices[faces[:, 0]])
        area = np.linalg.norm(cross, axis=1)
        degenerate += int((area < 1e-13).sum())
        alignment = np.einsum('ij,ij->i', cross, normals[faces].mean(1))
        winding += int(((alignment < -1e-10) & (area > 1e-13)).sum())
        world_vertices = vertices @ world[:3, :3].T + world[:3, 3]
        positions.append(world_vertices)
        mat = gltf['materials'][primitive['material']]
        require(mat.get('alphaMode', 'OPAQUE') == 'OPAQUE', 'Foliage must use geometry rather than opacity cards')
        for slot, info in audit.texture_slots(mat):
            require('TEXCOORD_' + str(info.get('texCoord', 0)) in attrs, f'Missing blade UVs for {slot}')
        triangles += len(faces)
        batches += 1
        material_stats.append({'name': mat['name'], 'triangles': len(faces),
                               'bounds_min': world_vertices.min(0).tolist(),
                               'bounds_max': world_vertices.max(0).tolist(),
                               'base_color': mat.get('pbrMetallicRoughness', {}).get('baseColorFactor')})
vertices = np.concatenate(positions)
minimum, maximum = vertices.min(0), vertices.max(0)
dimensions = maximum - minimum
require(abs(minimum[1]) < 1e-5 and abs(maximum[1] - 2.35) < 1e-5, 'Incorrect floor contact or Y-up height')
require(np.all(np.abs(vertices[:, [0, 2]]) <= .60001), 'Foliage exceeds the 1.2 m mounting envelope')
require(np.all(dimensions[[0, 2]] > 1.0), 'Planter foliage envelope is unexpectedly narrow')
require(triangles < 65000 and batches == 7 and len(gltf['materials']) == 7, 'Asset budget exceeded')
require(degenerate == 0, f'Zero-area triangles: {degenerate}')
require(winding == 0, f'Winding disagreements: {winding}')
images = []
for image in gltf.get('images', []):
    require('uri' not in image, 'All texture images must be packed')
    view = accessors.view(image['bufferView'])
    offset = view.get('byteOffset', 0)
    picture = Image.open(io.BytesIO(blob[offset:offset + view['byteLength']]))
    size = list(picture.size)
    rgb = np.asarray(picture.convert('RGB'), dtype=float).mean((0, 1))
    require(rgb[1] > rgb[0] and rgb[1] > rgb[2], 'Original leaf color must remain green after export')
    images.append({'name': image.get('name'), 'size': size, 'embedded': True})
require(len(images) == 2 and all(image['size'] == [512, 512] for image in images),
        'Expected two packed original blade images')
for mat in gltf['materials']:
    if 'palm blade' in mat['name'].lower() or 'green blade' in mat['name'].lower():
        pbr = mat['pbrMetallicRoughness']
        require('baseColorTexture' in pbr, 'Leaf shader image did not survive glTF export')
report = {
    'status': 'passed', 'file': path.name, 'sha256': hashlib.sha256(raw).hexdigest(),
    'bytes': len(raw), 'triangles': triangles, 'materials': len(gltf['materials']), 'material_draw_calls': batches,
    'bounds_min': minimum.tolist(), 'bounds_max': maximum.tolist(), 'dimensions_XYZ': dimensions.tolist(),
    'origin': 'Y-up, floor contact Y=0, planting centered at X=Z=0',
    'opaque_leaf_geometry': True, 'finite_arrays': True, 'unit_normals': True, 'indices_valid': True,
    'degenerate_triangles': degenerate, 'winding_mismatches': winding,
    'embedded_images': images, 'material_geometry': material_stats,
}
(ROOT / 'docs/planter-assets/validation-report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
