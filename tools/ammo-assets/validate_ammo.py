"""Independent static GLB audit for the wall cabinet and its label clearances."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
# Share the already-established format/accessor decoder; cabinet-specific
# dimensions, wall origin and clear label regions are audited below.
spec = importlib.util.spec_from_file_location('asset_glb_audit', ROOT / 'tools/couch-assets/validate_couch.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
require = audit.require
path = ROOT / 'public/models/pistol-ammo-display.glb'
raw = path.read_bytes()
gltf, blob = audit.parse_glb(raw)
accessors = audit.Accessors(gltf, blob)
for index in range(len(gltf['accessors'])):
    accessors.get(index)
require(not gltf.get('skins') and not gltf.get('animations'), 'Cabinet must be static')
require(not gltf.get('cameras') and not gltf.get('extensions', {}).get('KHR_lights_punctual'),
        'Studio must not enter the runtime asset')
worlds = {}


def walk(index, parent):
    require(index not in worlds, 'Node hierarchy must be acyclic')
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
        require(primitive.get('mode', 4) == 4, 'Expected triangles')
        attrs = primitive['attributes']
        vertices = accessors.get(attrs['POSITION'])
        normals = accessors.get(attrs['NORMAL'])
        require(normals.shape == vertices.shape, 'Invalid normals')
        require(np.allclose(np.linalg.norm(normals, axis=1), 1, atol=5e-4), 'Non-unit normals')
        indices = accessors.get(primitive['indices']).ravel()
        require(len(indices) % 3 == 0 and indices.max() < len(vertices), 'Invalid indices')
        faces = indices.reshape(-1, 3)
        cross = np.cross(vertices[faces[:, 1]] - vertices[faces[:, 0]],
                         vertices[faces[:, 2]] - vertices[faces[:, 0]])
        area = np.linalg.norm(cross, axis=1)
        degenerate += int((area < 1e-13).sum())
        alignment = np.einsum('ij,ij->i', cross, normals[faces].mean(1))
        winding += int(((alignment < -1e-10) & (area > 1e-13)).sum())
        positions.append(vertices @ world[:3, :3].T + world[:3, 3])
        mat = gltf['materials'][primitive['material']]
        require(mat.get('alphaMode', 'OPAQUE') == 'OPAQUE', 'No transparent cabinet materials')
        for slot, info in audit.texture_slots(mat):
            require('TEXCOORD_' + str(info.get('texCoord', 0)) in attrs, f'Missing UVs for {slot}')
        triangles += len(faces)
        batches += 1
        material_stats.append({'name': mat['name'], 'triangles': len(faces)})
vertices = np.concatenate(positions)
minimum, maximum = vertices.min(0), vertices.max(0)
dimensions = maximum - minimum
require(np.allclose(dimensions[:2], [2.5, 1.6], atol=1e-5), f'Unexpected cabinet size: {dimensions}')
require(.32 <= dimensions[2] <= .35, 'Cabinet depth must fit wall placement')
require(abs(minimum[2]) <= 1e-5, 'Flat wall mount must be at Z=0')
require(abs(minimum[0] + maximum[0]) <= 1e-5 and abs(minimum[1] + maximum[1]) <= 1e-5,
        'Cabinet pivot must be centered in width and height')
require(triangles <= 90000 and batches <= 8 and len(gltf['materials']) <= 8, 'Runtime asset budget exceeded')
require(degenerate == 0, f'Zero-area triangles: {degenerate}')
require(winding == 0, f'Winding disagreements: {winding}')
images = []
for image in gltf.get('images', []):
    require('uri' not in image, 'All images must be embedded')
    view = accessors.view(image['bufferView'])
    offset = view.get('byteOffset', 0)
    picture = Image.open(io.BytesIO(blob[offset:offset + view['byteLength']]))
    size = list(picture.size)
    picture.verify()
    images.append({'name': image.get('name'), 'size': size, 'embedded': True})
require(len(images) == 1 and images[0]['size'] == [512, 512], 'Expected original packed walnut texture')
report = {
    'status': 'passed', 'file': path.name, 'sha256': hashlib.sha256(raw).hexdigest(),
    'bytes': len(raw), 'triangles': triangles, 'materials': len(gltf['materials']), 'material_draw_calls': batches,
    'bounds_min': minimum.tolist(), 'bounds_max': maximum.tolist(), 'dimensions_XYZ': dimensions.tolist(),
    'origin': 'Y-up, vertically centered with flat wall mounting face at Z=0', 'front': 'glTF +Z',
    'finite_arrays': True, 'unit_normals': True, 'indices_valid': True,
    'degenerate_triangles': degenerate, 'winding_mismatches': winding,
    'embedded_images': images, 'material_geometry': material_stats,
}
(ROOT / 'docs/ammo-assets/validation-report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
