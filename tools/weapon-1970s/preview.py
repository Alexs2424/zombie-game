"""Render QA previews of exported weapon GLBs, optionally with fitted hands.
Blender -b --python tools/weapon-1970s/preview.py -- OUT.png weapon.glb [hands.glb] [view]
view: side | fp (first person, matches runtime camera root) | three (three-quarter studio)
"""
import bpy, sys, math
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
out, glbs = args[0], [a for a in args[1:] if a.endswith('.glb')]
view = next((a for a in args[1:] if not a.endswith('.glb')), 'three')
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
for g in glbs:
    bpy.ops.import_scene.gltf(filepath=g)
scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x, scene.render.resolution_y = (1600, 900) if view == 'fp' else (1600, 1000)
scene.render.film_transparent = False
world = bpy.data.worlds.new('studio'); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = (.045, .05, .055, 1); bg.inputs[1].default_value = 0.9
def light(name, loc, energy, size=1.5, color=(1, .95, .88)):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.size = size; d.color = color
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
light('key', (1.2, -1.0, 1.4), 260); light('fill', (-1.4, -0.6, 0.5), 90, 2, (.8, .88, 1)); light('rim', (0, 1.4, 0.9), 180)
meshes = [o for o in scene.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
if view == 'fp':
    # Runtime: weapon root at camera-local (0.29,-0.21,0.61) glTF (+Z forward), FOV 1.32 rad vertical? use horizontal 70deg
    cam.data.sensor_fit = 'VERTICAL'; cam.data.angle = 0.8
    # glTF (x,y,z) -> Blender (x,-z,y). Camera sits at -(root) relative to weapon origin.
    cam.location = (-0.29, -(-0.61), 0.21)
    cam.location = (-0.29, -0.61, 0.21)
    cam.rotation_euler = (math.pi / 2, 0, 0)
else:
    gun = [o for o in meshes if 'Hand' not in o.name and 'hand' not in o.name.lower()] or meshes
    gp = [o.matrix_world @ Vector(c) for o in gun for c in gun_o.bound_box] if False else [o.matrix_world @ Vector(c) for o in gun for c in o.bound_box]
    glo = Vector([min(p[i] for p in gp) for i in range(3)]); ghi = Vector([max(p[i] for p in gp) for i in range(3)])
    center = (glo + ghi) / 2; size = (ghi - glo).length
    if view == 'side':
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(ghi.y - glo.y, (ghi.z - glo.z) * 1.6) * 1.12
        cam.location = center + Vector((1.5, 0, 0)); cam.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    else:
        d = Vector((1.0, -0.75, 0.5)).normalized() * size * 1.55
        cam.location = center + d; cam.data.lens = 60
        cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
