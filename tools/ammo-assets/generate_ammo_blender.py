"""Original casino wall ammunition cabinet; no external models or textures.

Blender --background --factory-startup --python tools/ammo-assets/generate_ammo_blender.py
Pass -- --no-render to skip the studio preview. Native source preserves named parts.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs/ammo-assets'
SOURCE = ROOT / 'assets/source'
DOCS.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
source = bpy.data.collections.new('SOURCE — Casino ammunition cabinet')
studio = bpy.data.collections.new('STUDIO — excluded from runtime export')
scene.collection.children.link(source)
scene.collection.children.link(studio)
parts = []
materials = []


def material(name, color, roughness, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    materials.append(mat)
    return mat


walnut = material('01 Walnut cabinet — original packed grain', (.23, .085, .032), .36)
green = material('02 Racing green enamel', (.027, .11, .084), .34)
felt = material('03 Oxblood felt liner', (.18, .033, .047), .88)
brass = material('04 Brushed antique brass', (.60, .39, .13), .35, .64)
cream = material('05 Ivory lettering and carton paper', (.78, .71, .51), .65)
cardboard = material('06 Reserve ammunition carton', (.24, .29, .21), .69)
copper = material('07 Copper cartridge jacket', (.51, .21, .082), .31, .60)
black = material('08 Dark steel and shadowed seams', (.015, .024, .022), .44, .30)

# A small deterministic original walnut image survives glTF export and travels
# packed in both deliverables. No non-exportable procedural shader dependency.
rng = random.Random(1205)
size = 512
pixels = []
for v in range(size):
    for u in range(size):
        flow = u + 6 * math.sin(v / 77) + 2 * math.sin(v / 23)
        grain = .055 * math.sin(flow * .21) + .022 * math.sin(flow * 1.63)
        grain += .012 * math.sin(flow * 3.73) + rng.uniform(-.007, .007)
        band = .024 * math.sin((u / 26 + .7 * math.sin(v / 129)) * math.pi)
        value = max(.12, min(.37, .255 + grain + band))
        pixels.extend((value, value * .405, value * .176, 1))
image = bpy.data.images.new('Original walnut grain — 512 square', width=size, height=size)
image.pixels.foreach_set(pixels)
image.pack()
node = walnut.node_tree.nodes.new('ShaderNodeTexImage')
node.image = image
walnut.node_tree.links.new(node.outputs['Color'], walnut.node_tree.nodes['Principled BSDF'].inputs['Base Color'])


def link(obj, name, mat, collection=source):
    obj.name = name
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if collection == source:
        parts.append(obj)
    return obj


def box(name, location, dimensions, mat, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    link(obj, name, mat)
    if bevel:
        modifier = obj.modifiers.new('Hand finished edge radius', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        obj.modifiers.new('Weighted cabinet normals', 'WEIGHTED_NORMAL')
    return obj


def cylinder(name, location, radius, depth, mat, vertices=16, axis='Z'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = link(bpy.context.object, name, mat)
    if axis == 'Y':
        obj.rotation_euler.x = math.pi / 2
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    obj.modifiers.new('Weighted turned normals', 'WEIGHTED_NORMAL')
    return obj


def lettering(name, body, location, text_size, mat, max_width=None):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = text_size
    curve.extrude = .0003
    curve.resolution_u = 3
    obj = bpy.data.objects.new(name, curve)
    source.objects.link(obj)
    obj.location = location
    obj.rotation_euler.x = math.pi / 2
    curve.materials.append(mat)
    bpy.context.view_layer.update()
    if max_width and obj.dimensions.x > max_width:
        obj.scale.x *= max_width / obj.dimensions.x
    parts.append(obj)
    return obj


def screw(x, z):
    cylinder('Countersunk brass cabinet screw', (x, -.309, z), .013, .004, brass, axis='Y')
    slot = box('Recessed screw slot', (x, -.312, z), (.015, .001, .002), black, .0005)
    slot.rotation_euler.y = .35


# Mounting face is Blender Y=0, front is -Y. Export maps front to glTF +Z.
# A symmetrical width/height keeps the center-origin easy to place on a wall.
box('Walnut back panel — flush mounting face', (0, -.025, 0), (2.50, .05, 1.60), walnut)
for x in (-1.19, 1.19):
    box('Deep shaped cabinet side', (x, -.17, 0), (.12, .32, 1.60), walnut, .016)
    box('Side brass inset', (x, -.333, 0), (.025, .008, 1.49), brass, .004)
for z in (-.744, .744):
    box('Stepped walnut cornice', (0, -.17, z), (2.50, .32, .112), walnut, .012)
    box('Fine cornice brass reveal', (0, -.335, z), (2.36, .008, .016), brass, .003)
box('Green interior back', (0, -.060, -.025), (2.24, .022, .82), green, .006)
box('Oxblood recessed display liner', (0, -.076, -.023), (2.16, .013, .73), felt, .004)

# Two blank cartouches receive the game's live header and price labels.
for z, height, width in ((.55, .33, 2.18), (-.595, .27, 2.03)):
    box('Brass cartouche border', (0, -.252, z), (width + .038, .024, height + .038), brass, .012)
    box('Green cartouche — runtime label reserved', (0, -.268, z), (width, .013, height), green, .006)
    for x in (-width / 2 + .028, width / 2 - .028):
        cylinder('Cartouche rivet', (x, -.278, z), .006, .005, brass, vertices=12, axis='Y')

for z in (-.385, -.038, .330):
    box('Walnut display shelf', (0, -.185, z), (2.20, .260, .035), walnut, .005)
    box('Brass shelf nosing', (0, -.318, z + .002), (2.20, .009, .018), brass, .003)
for x in (-.37, .37):
    box('Green cabinet compartment divider', (x, -.164, -.026), (.030, .215, .682), green, .005)
    box('Vertical divider brass reveal', (x, -.277, -.026), (.012, .006, .658), brass, .002)
for x in (-1.19, 1.19):
    for z in (-.60, 0, .60):
        screw(x, z)


def carton(x, y, z, number, rotated=False):
    # Each carton has a separate folded lid, wraparound band and face label.
    box('Folded reserve cartridge carton', (x, y, z + .086), (.245, .155, .172), cardboard, .008)
    box('Carton folded top lip', (x, y - .003, z + .172), (.248, .157, .013), cream, .002)
    box('Ivory cartridge label', (x, y - .080, z + .091), (.213, .004, .110), cream, .002)
    box('Green label rule', (x, y - .083, z + .094), (.197, .002, .006), green, .0008)
    # Caliber and quantity survive normal play distance; tiny three-line
    # microprint undersamples to speckles in the game. Give the paper and type
    # distinct depths as well, so their surfaces remain separate at distance.
    lettering('Carton caliber', '9 MM', (x, y - .088, z + .122), .050, green, .19)
    lettering('Carton stock quantity', '50 ROUNDS', (x, y - .088, z + .060), .027, green, .193)
    box('Carton lid seal', (x + .078, y, z + .180), (.021, .151, .002), green, .0005)


for center in (-.745, .745):
    for shelf, serial in ((-.365, 1), (-.017, 7)):
        for index, offset in enumerate((-.139, .139)):
            carton(center + offset, -.189, shelf, serial + index + (4 if center > 0 else 0))


def cartridge(x, y, bottom):
    # A turned profile gives each round its rim, extractor groove and ogive.
    rings = [(0, .013), (.004, .013), (.006, .010), (.009, .010), (.011, .012), (.046, .0115)]
    vertices, faces = [], []
    sides = 16
    for height, radius in rings:
        for step in range(sides):
            angle = math.tau * step / sides
            vertices.append((x + math.cos(angle) * radius, y + math.sin(angle) * radius, bottom + height))
    for ring in range(len(rings) - 1):
        for step in range(sides):
            a = ring * sides + step
            b = ring * sides + (step + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.extend((tuple(reversed(range(sides))), tuple((len(rings) - 1) * sides + k for k in range(sides))))
    mesh = bpy.data.meshes.new('Turned brass cartridge case')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Brass case — rim and extractor groove', mesh)
    source.objects.link(obj)
    obj.data.materials.append(brass)
    parts.append(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    # Closed tapered copper jacket; hemispherical nose smoothly changes radius.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1, location=(x, y, bottom + .048))
    tip = link(bpy.context.object, 'Copper round nose cartridge jacket', copper)
    tip.scale = (.0115, .0115, .022)
    for polygon in tip.data.polygons:
        polygon.use_smooth = True


for bottom, title in ((-.365, 'RESERVE'), (-.017, '9 MM')):
    box('Recessed cartridge tray', (0, -.19, bottom + .024), (.616, .204, .048), green, .008)
    box('Cartridge tray felt bed', (0, -.19, bottom + .051), (.583, .179, .011), felt, .004)
    for row in range(3):
        for column in range(12):
            cartridge(-.254 + column * .046, -.244 + row * .048, bottom + .055)
    box('Small compartment identification plate', (0, -.302, bottom + .026), (.44, .009, .054), brass, .004)
    lettering('Compartment engraved title', title, (0, -.314, bottom + .026), .044, black, .41)

# Decorative stock ledger below the case, away from the price plaque.
for x in (-1.065, 1.065):
    for offset in (-.038, 0, .038):
        box('Deco corner flute', (x + offset, -.286, -.59), (.012, .017, .18 - abs(offset)), brass, .003)

# Keep materials in eight batches for the single game cabinet.
deps = bpy.context.evaluated_depsgraph_get()
export_collection = bpy.data.collections.new('EXPORT — eight material batches')
scene.collection.children.link(export_collection)
batches = []
for mat in materials:
    duplicates = []
    for obj in parts:
        if obj.data.materials[0] != mat:
            continue
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(deps), depsgraph=deps)
        dup = bpy.data.objects.new(obj.name + ' export', mesh)
        export_collection.objects.link(dup)
        dup.matrix_world = obj.matrix_world.copy()
        duplicates.append(dup)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in duplicates:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = duplicates[0]
    bpy.ops.object.join()
    merged = bpy.context.object
    merged.name = mat.name
    # Bake each material batch to the shared mounting origin. This avoids
    # oversized transformed AABBs inherited from whichever small part was active.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Font conversion can leave collapsed triangles around narrow glyph joins.
    # Triangulate explicitly, then remove non-rasterizing faces in the export.
    bm = bmesh.new()
    bm.from_mesh(merged.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    collapsed = [face for face in bm.faces if face.calc_area() < 1e-13]
    bmesh.ops.delete(bm, geom=collapsed, context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(merged.data)
    bm.free()
    batches.append(merged)
bpy.ops.object.select_all(action='DESELECT')
for obj in batches:
    obj.select_set(True)
runtime = ROOT / 'public/models/pistol-ammo-display.glb'
bpy.ops.export_scene.gltf(filepath=str(runtime), export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_texcoords=True, export_normals=True,
                          export_materials='EXPORT', export_cameras=False, export_lights=False)
for obj in batches:
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.data.collections.remove(export_collection)

# Native scene opens ready to inspect and render; studio never enters the GLB.
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.18, .21, .20, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45
scene.view_settings.view_transform = 'AgX'
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except TypeError:
    pass
wallmat = material('Studio limestone wall', (.27, .29, .25), .9)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, .005, 0), rotation=(math.pi / 2, 0, 0))
link(bpy.context.object, 'Studio wall', wallmat, studio)
for name, location, power, color, area_size in [
    ('Warm window key', (-2.5, -4, 4), 650, (1, .84, .66), 3),
    ('Broad cool fill', (3, -3, 1), 380, (.78, .86, 1), 3),
    ('Brass edge light', (1.5, -1.5, 3), 220, (1, .90, .72), 2),
]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.color, light.shape, light.size = power, color, 'DISK', area_size
    obj = bpy.data.objects.new(name, light)
    studio.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (-obj.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(2.2, -5.2, 1.75))
camera = link(bpy.context.object, 'Ammo cabinet hero camera', None, studio)
camera.rotation_euler = (Vector((0, -.13, 0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 3.20
scene.camera = camera
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_distance = 3.6
            area.spaces.active.region_3d.view_location = (0, -.13, 0)
            area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
            area.spaces.active.shading.type = 'MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'pistol-ammo-display.blend'))
manifest = {
    'name': 'Grand Casino pistol ammunition cabinet',
    'authoring': 'Original Blender geometry, text and deterministic walnut image; no third-party assets',
    'blender': bpy.app.version_string, 'source_objects': len(parts),
    'native': 'assets/source/pistol-ammo-display.blend',
    'runtime': 'public/models/pistol-ammo-display.glb',
    'coordinates': 'Blender Z up/front -Y/back Y=0; glTF Y up/front +Z/back Z=0; vertically centered pivot',
    'label_mounts': {'header': {'x': 0, 'y': .55, 'z': .28, 'width': 2.08, 'height': .30},
                     'price': {'x': 0, 'y': -.595, 'z': .28, 'width': 1.90, 'height': .24}},
    'features': ['Walnut molded carcass and packed original grain', 'Racing green enamel compartments',
                 'Antique brass reveals and countersunk screws', 'Eight folded and labeled reserve cartons',
                 'Seventy-two individually turned rimmed cartridges with copper jackets',
                 'Oxblood felt trays and engraved compartment plates',
                 'Blank header and price cartouches for live game labels'],
}
(DOCS / 'asset-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
if not args.no_render:
    scene.render.filepath = str(DOCS / 'ammo-blender-preview.png')
    bpy.ops.render.render(write_still=True)
print('AMMO_CABINET_EXPORT_COMPLETE', flush=True)
