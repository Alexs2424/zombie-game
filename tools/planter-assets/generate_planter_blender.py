"""Original feather palm in a fluted ceramic and brass casino planter.

Blender --background --factory-startup --python tools/planter-assets/generate_planter_blender.py
Use -- --no-render to skip the Cycles studio preview. No external assets.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs/planter-assets'
DOCS.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
source = bpy.data.collections.new('SOURCE — Individual palm leaflets and ceramic planter')
studio = bpy.data.collections.new('STUDIO — excluded from export')
scene.collection.children.link(source)
scene.collection.children.link(studio)
parts, foliage, materials = [], [], []
rng = random.Random(934)


def material(name, color, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    materials.append(mat)
    return mat


ceramic = material('01 Deep green glazed ceramic', (.055, .105, .086), .26)
ceramic.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value = .28
brass = material('02 Aged brushed brass bands', (.49, .31, .10), .33, .65)
soil = material('03 Earth and mineral drainage', (.075, .049, .026), .96)
stem = material('04 Fibrous olive palm stems', (.22, .25, .074), .7)
leaf = material('05 Mature green palm blade', (.15, .28, .080), .53)
young = material('06 Younger olive green blade', (.22, .34, .100), .51)
vein = material('07 Raised leaf midrib', (.27, .36, .11), .66)

# Original subtle blade color variation. The mapped central vein and secondary
# ribs supplement the real longitudinal fold without alpha cards or opacity.
size = 512
variation = []
for y in range(size):
    t = y / (size - 1)
    for x in range(size):
        u = x / (size - 1)
        center = math.exp(-((u - .5) / .025) ** 2)
        ribs = math.sin(t * 124 + abs(u - .5) * 19) * .025
        edge = abs(u - .5) * .085
        value = .83 + center * .14 + ribs - edge + .025 * math.sin(t * 5)
        variation.append(value)
for mat, tint in ((leaf, (.15, .28, .080, 1)), (young, (.22, .34, .10, 1))):
    pixels = []
    for value in variation:
        pixels.extend((value * tint[0], value * tint[1], value * tint[2], 1))
    texture = bpy.data.images.new(mat.name + ' — original 512 square blade image', width=size, height=size)
    texture.pixels.foreach_set(pixels)
    texture.pack()
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = texture
    mat.node_tree.links.new(tex.outputs['Color'], mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])


def link(obj, name, mat, collection=source, is_foliage=False):
    obj.name = name
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if collection == source:
        parts.append(obj)
        if is_foliage:
            foliage.append(obj)
    return obj


def mesh(name, vertices, faces, mat, uv=None, is_foliage=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    source.objects.link(obj)
    data.materials.append(mat)
    parts.append(obj)
    if is_foliage:
        foliage.append(obj)
    for polygon in data.polygons:
        polygon.use_smooth = True
    if uv:
        layer = data.uv_layers.new(name='BladeUV')
        for loop in data.loops:
            layer.data[loop.index].uv = uv[loop.vertex_index]
    return obj


def lathe(name, profile, mat, flutes=0, sides=96):
    vertices, faces = [], []
    for radius, z in profile:
        for i in range(sides):
            angle = math.tau * i / sides
            amount = flutes * (.6 + .4 * math.sin(z * 5)) * math.cos(angle * 24)
            r = radius + amount
            vertices.append((math.cos(angle) * r, math.sin(angle) * r, z))
    for j in range(len(profile)):
        for i in range(sides):
            a = j * sides + i
            b = j * sides + (i + 1) % sides
            next_a = ((j + 1) % len(profile)) * sides + i
            next_b = ((j + 1) % len(profile)) * sides + (i + 1) % sides
            faces.append((a, b, next_b, next_a))
    return mesh(name, vertices, faces, mat)


def tube(name, points, radius, mat, sides=8, taper=.15, is_foliage=True):
    points = [Vector(point) for point in points]
    vertices, faces = [], []
    for j, point in enumerate(points):
        tangent = points[min(j + 1, len(points) - 1)] - points[max(j - 1, 0)]
        tangent.normalize()
        across = tangent.cross(Vector((0, 0, 1)))
        if across.length < .001:
            across = tangent.cross(Vector((0, 1, 0)))
        across.normalize()
        up = tangent.cross(across).normalized()
        r = radius * (1 - (1 - taper) * j / (len(points) - 1))
        for step in range(sides):
            a = math.tau * step / sides
            vertices.append(tuple(point + r * (math.cos(a) * across + math.sin(a) * up)))
    for j in range(len(points) - 1):
        for i in range(sides):
            a = j * sides + i
            b = j * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(points) - 1) * sides + i for i in range(sides)))
    return mesh(name, vertices, faces, mat, is_foliage=is_foliage)


# A real hollow urn: inset soil lies below the rounded ceramic lip.
lathe('Fluted ceramic urn — hollow rim and shaped foot', [
    (.19, 0), (.22, .018), (.25, .047), (.25, .082), (.219, .12),
    (.224, .18), (.259, .34), (.292, .535), (.302, .580),
    (.302, .612), (.287, .640), (.269, .638), (.253, .609),
    (.25, .556), (.218, .35), (.19, .15),
], ceramic, flutes=.004)
lathe('Brass foot ferrule', [(.228, .018), (.254, .038), (.264, .055), (.264, .074), (.258, .084)], brass)
lathe('Narrow shoulder brass reveal', [(.297, .567), (.308, .579), (.308, .593), (.304, .600)], brass)
lathe('Inner rolled rim highlight', [(.271, .634), (.281, .646), (.286, .644), (.287, .638)], brass)
lathe('Inset soil bed', [(.006, .575), (.245, .575), (.247, .585), (.238, .598), (.005, .596)], soil, sides=64)
for i in range(28):
    angle = rng.uniform(0, math.tau)
    radius = rng.uniform(.07, .23)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1,
        location=(radius * math.cos(angle), radius * math.sin(angle), .599))
    pebble = link(bpy.context.object, 'Individual soil clod and drainage pebble', soil)
    pebble.scale = (rng.uniform(.008, .018), rng.uniform(.009, .020), rng.uniform(.003, .009))
    pebble.rotation_euler = (rng.random(), rng.random(), rng.random())

# The bundled basal sheaths remain visible between the rim and the crown.
for i in range(5):
    angle = i * 2.4
    origin = Vector((.042 * math.cos(angle), .042 * math.sin(angle), .583))
    points = [origin + Vector((.025 * math.sin(angle) * t, .025 * math.cos(angle) * t, .28 * t))
              for t in (0, .2, .4, .6, .8, 1)]
    tube('Overlapping basal palm sheath', points, .030, stem, sides=9, taper=.24)


def blade(name, base, direction, length, half_width, droop, mat):
    base, direction = Vector(base), Vector(direction).normalized()
    across = Vector((-direction.y, direction.x, 0)).normalized()
    # Every leaflet is a closed, curved lance shape, not an intersecting card.
    # A raised center ridge gives the leaf its subtle folded cross-section.
    rows = [.08, .20, .34, .49, .64, .78, .90]
    def center(t):
        return base + direction * (length * t) + Vector((0, 0, .018 * math.sin(math.pi * t) - droop * t * t))
    vertices, uv, faces = [], [], []
    for underside in (False, True):
        offset = len(vertices)
        vertices.append(tuple(base + Vector((0, 0, -.00055 if underside else .00055))))
        uv.append((.5, 0))
        for t in rows:
            width = half_width * math.sin(math.pi * t) ** .72
            for side in (-1, 0, 1):
                fold = .0033 * (1 - abs(side)) * math.sin(math.pi * t)
                vertices.append(tuple(center(t) + across * side * width +
                                      Vector((0, 0, fold + (-.00055 if underside else .00055)))))
                uv.append(((side + 1) / 2, t))
        tip = len(vertices)
        vertices.append(tuple(center(1) + Vector((0, 0, -.00055 if underside else .00055))))
        uv.append((.5, 1))
        faces.extend([(offset, offset + 1, offset + 2), (offset, offset + 2, offset + 3)])
        for j in range(len(rows) - 1):
            a = offset + 1 + j * 3
            faces.extend([(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)])
        last = offset + 1 + (len(rows) - 1) * 3
        faces.extend([(last, tip, last + 1), (last + 1, tip, last + 2)])
    stride = 2 + len(rows) * 3
    perimeter = [0] + [1 + j * 3 for j in range(len(rows))] + [stride - 1] + [3 + j * 3 for j in reversed(range(len(rows)))]
    for j, a in enumerate(perimeter):
        b = perimeter[(j + 1) % len(perimeter)]
        faces.append((a, b, b + stride, a + stride))
    mesh(name, vertices, faces, mat, uv, is_foliage=True)
    centerline = [center(t) + Vector((0, 0, .004 * math.sin(math.pi * t) + .0007))
                  for t in (0, .14, .28, .42, .56, .70, .84, .96)]
    tube(name + ' • modeled midrib', centerline, .0014, vein, sides=4, taper=.12)


frond_count = 11
leaflet_count = 0
for i in range(frond_count):
    angle = i * 2.39996 + .18
    radial = Vector((math.cos(angle), math.sin(angle), 0))
    lateral = Vector((-math.sin(angle), math.cos(angle), 0))
    crown = 1.66 + .045 * (i % 4)
    rise = .32 + .024 * (i % 3)
    reach = .49 + .024 * (i % 3)
    fall = -.30 + .026 * (i % 4)
    if i in (3, 8):
        crown, rise, reach, fall = 1.86, .39, .33, -.035
    origin = Vector((.044 * math.cos(angle + .5), .044 * math.sin(angle + .5), .595))
    start = radial * .045 + Vector((0, 0, crown))
    stem_points = []
    for j in range(16):
        t = j / 15
        stem_points.append(origin * (1 - t) + start * t + radial * (.015 * math.sin(math.pi * t)))
    tube(f'Palm {i + 1:02d} • individual arched petiole', stem_points, .011 + .001 * (i % 2), stem, taper=.42)

    def rachis(t):
        return radial * (.045 + reach * t) + lateral * (.018 * math.sin(t * math.pi) * math.sin(i)) + \
            Vector((0, 0, crown + rise * math.sin(math.pi * t) + fall * t))

    tube(f'Frond {i + 1:02d} • continuous curved rachis', [rachis(j / 20) for j in range(21)], .006, stem, taper=.14)
    pairs = 8 if i in (3, 8) else 10
    for pair in range(pairs):
        t = .11 + pair * .83 / (pairs - 1)
        for sign in (-1, 1):
            # Alternating insertions and unequal lengths avoid a flat mirror fan.
            offset = .018 if sign > 0 else 0
            tt = min(.965, t + offset)
            base = rachis(tt)
            length = (.10 + .115 * math.sin(math.pi * tt) ** .8) * rng.uniform(.89, 1.08)
            if i in (3, 8):
                length *= .76
            direction = (lateral * sign * .88 + radial * (.38 + .32 * tt)).normalized()
            droop = length * (.29 + .18 * tt)
            blade(f'Frond {i + 1:02d} • leaflet {pair + 1:02d} {"L" if sign < 0 else "R"}',
                  base, direction, length, .020 * (.80 + .35 * math.sin(math.pi * tt)),
                  droop, young if i in (3, 8) or (i + pair) % 6 == 0 else leaf)
            leaflet_count += 1
    blade(f'Frond {i + 1:02d} • terminal spear', rachis(.94), radial, .10, .016, .042, young)
    leaflet_count += 1

# Standardize the botanical envelope without changing the planter. Small global
# adjustments of living growth preserve each leaflet's modeled curvature.
all_foliage = [obj.matrix_world @ vertex.co for obj in foliage for vertex in obj.data.vertices]
radius = max(max(abs(vertex.x), abs(vertex.y)) for vertex in all_foliage)
top = max(vertex.z for vertex in all_foliage)
horizontal = .6 / radius
vertical = (2.35 - .595) / (top - .595)
for obj in foliage:
    for vertex in obj.data.vertices:
        vertex.co.x *= horizontal
        vertex.co.y *= horizontal
        vertex.co.z = .595 + (vertex.co.z - .595) * vertical

# Named editable parts remain separate. Exported material batches have transforms
# baked to a shared floor-centered origin so runtime bounds remain accurate.
deps = bpy.context.evaluated_depsgraph_get()
export_collection = bpy.data.collections.new('EXPORT — seven material batches')
scene.collection.children.link(export_collection)
batches = []
for mat in materials:
    duplicates = []
    for obj in parts:
        if obj.data.materials[0] != mat:
            continue
        data = bpy.data.meshes.new_from_object(obj.evaluated_get(deps), depsgraph=deps)
        dup = bpy.data.objects.new(obj.name + ' export', data)
        export_collection.objects.link(dup)
        dup.matrix_world = obj.matrix_world.copy()
        duplicates.append(dup)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in duplicates:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = duplicates[0]
    if len(duplicates) > 1:
        bpy.ops.object.join()
    merged = bpy.context.object
    merged.name = mat.name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(merged.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.delete(bm, geom=[face for face in bm.faces if face.calc_area() < 1e-13], context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(merged.data)
    bm.free()
    batches.append(merged)
bpy.ops.object.select_all(action='DESELECT')
for obj in batches:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/models/casino-planter.glb'),
    export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
    export_normals=True, export_texcoords=True, export_materials='EXPORT',
    export_cameras=False, export_lights=False)
for obj in batches:
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.data.collections.remove(export_collection)

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.render.resolution_x = 1100
scene.render.resolution_y = 1400
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.17, .19, .16, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
scene.view_settings.view_transform = 'AgX'
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except TypeError:
    pass
floor = material('Studio warm limestone', (.23, .22, .185), .94)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001))
link(bpy.context.object, 'Studio floor', floor, studio)
for name, location, energy, color, light_size in [
    ('Soft warm key', (-3, -4, 5), 900, (1, .89, .72), 3),
    ('Cool leaf fill', (3, -2, 3.5), 550, (.78, .86, 1), 3),
    ('Leaf rim window', (1, 3, 4), 800, (1, .95, .75), 2.5),
]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.shape, data.size = energy, color, 'DISK', light_size
    obj = bpy.data.objects.new(name, data)
    studio.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, 1.25)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(3, -5, 2.55))
camera = link(bpy.context.object, 'Planter hero camera', None, studio)
camera.rotation_euler = (Vector((0, 0, 1.18)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 2.85
scene.camera = camera
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_distance = 3.7
            area.spaces.active.region_3d.view_location = (0, 0, 1.2)
            area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
            area.spaces.active.shading.type = 'MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/source/casino-planter.blend'))
manifest = {
    'name': 'Casino feather palm in glazed ceramic and brass urn',
    'authoring': 'Original procedural Blender geometry and blade texture; no downloaded assets',
    'blender': bpy.app.version_string, 'source_objects': len(parts),
    'fronds': frond_count, 'individual_leaflets': leaflet_count,
    'native': 'assets/source/casino-planter.blend', 'runtime': 'public/models/casino-planter.glb',
    'coordinates': 'Blender Z-up to glTF Y-up; floor-centered origin; rotational planting variation allowed',
    'target_height': 2.35, 'maximum_horizontal_extent_from_origin': .6,
    'casino_scaling': {'horizontal': 1 / 1.2, 'vertical': 1.8 / 2.35},
    'features': ['Closed curved individual feather leaflets', 'Modeled midribs and embedded vein image',
                 'Staggered leaf insertions and varied arching rachises', 'Individual petioles and basal sheaths',
                 'Fluted hollow glazed ceramic urn', 'Aged brass foot and rolled rim bands',
                 'Recessed soil and individual drainage pebbles'],
}
(DOCS / 'asset-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
if not args.no_render:
    scene.render.filepath = str(DOCS / 'planter-blender-preview.png')
    bpy.ops.render.render(write_still=True)
print('CASINO_PLANTER_EXPORT_COMPLETE', flush=True)
