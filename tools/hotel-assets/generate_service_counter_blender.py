"""Original Grand Dining Room service counter, metres, Blender +Y faces guests.

Run Blender --background --factory-startup --threads 2 --python this_file.py.
Individual named construction parts remain in the editable source; GLB is
batched by material. All geometry and seeded textures are authored here.
"""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/hotel-assets'
OUT = ROOT / 'public/models/hotel-service-counter.glb'
PARTS = []
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = 'METRIC'


def texture(name, marble=False):
    n = 512
    y, x = np.mgrid[0:n, 0:n]
    noise = np.random.default_rng(480).normal(0, .006, (n, n))
    if marble:
        vein = np.abs(np.sin(x * .019 + y * .007 + np.sin(y * .026) * 1.8)) ** 46
        fine = np.abs(np.sin(x * .048 - y * .012 + np.sin(y * .017))) ** 75
        base = .91 - vein * .21 - fine * .075 + noise
        rgb = np.dstack([base, base * .964, base * .868])
    else:
        grain = np.sin(x * .31 + np.sin(y * .021) * 2.6 + np.sin(y * .053) * .9)
        base = .8 + grain * .10 + np.sin(x * .93 + y * .009) * .025 + noise
        rgb = np.dstack([base * .25, base * .106, base * .036])
    image = bpy.data.images.new(name, n, n)
    image.pixels.foreach_set(np.dstack([np.clip(rgb, 0, 1), np.ones((n, n))]).astype(np.float32).ravel())
    image.pack()
    return image


def material(name, color, rough=.4, metal=0, tex=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if tex:
        t = m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image = tex
        m.node_tree.links.new(t.outputs['Color'], p.inputs['Base Color'])
    return m


M = {
    'wood': material('Bookmatched French walnut', (.25, .1, .032), .32, tex=texture('dining-walnut')),
    'dark': material('Carved ebony walnut', (.044, .022, .012), .35),
    'stone': material('Honed ivory marble', (.88, .84, .74), .22, tex=texture('dining-marble', True)),
    'gold': material('Champagne brass inlay', (.65, .43, .16), .29, .78),
    'silver': material('Polished service silver', (.64, .69, .68), .19, .94),
    'china': material('Ivory porcelain', (.89, .85, .74), .23),
    'green': material('Forest green service leather', (.025, .09, .064), .64),
    'glass': material('Smoke green stemware', (.32, .48, .39), .15, .3),
    'recess': material('Cabinet interior shadow', (.013, .015, .012), .9),
}


def finish(o, name, mat, edge=0, smooth=False):
    o.name = name
    o.data.materials.append(M[mat])
    PARTS.append(o)
    if o.type == 'MESH':
        uv = o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
        for f in o.data.polygons:
            axes = [i for i in range(3) if i != max(range(3), key=lambda i: abs(f.normal[i]))]
            for li in f.loop_indices:
                p = o.data.vertices[o.data.loops[li].vertex_index].co
                uv.data[li].uv = (p[axes[0]] * .67, p[axes[1]] * .93)
            f.use_smooth = smooth or edge > 0
        if edge:
            b = o.modifiers.new('Softened crafted edges', 'BEVEL')
            b.width = edge
            b.segments = 3
            b.harden_normals = True
            n = o.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
            n.keep_sharp = True
    return o


def box(name, p, size, mat='wood', edge=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p)
    o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, mat, min(edge, min(size) * .22))


def lathe(name, x, y, profile, mat='silver', n=32):
    vertices = [(x + r * math.cos(i * math.tau / n), y + r * math.sin(i * math.tau / n), z)
                for r, z in profile for i in range(n)]
    faces = [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i)
             for j in range(len(profile)-1) for i in range(n)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(vertices, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat, smooth=True)


def rod(name, a, b, r, mat='gold', n=16):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=(b-a).length, location=(a+b)/2)
    o = bpy.context.object
    o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return finish(o, name, mat, smooth=True)


def wire(name, points, r=.006, mat='gold'):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = r
    curve.bevel_resolution = 1
    s = curve.splines.new('POLY')
    s.points.add(len(points)-1)
    for p, v in zip(s.points, points):
        p.co = (*v, 1)
    o = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat)


def frame(name, x, y, z, w, h, mat='gold', r=.007):
    wire(name, [(x-w/2,y,z-h/2),(x+w/2,y,z-h/2),(x+w/2,y,z+h/2),
                (x-w/2,y,z+h/2),(x-w/2,y,z-h/2)], r, mat)


# Low, substantial buffet joinery leaves room for equipment inside the shared
# 1.45 m fixture height. Rear drawers and shelves make either approach credible.
box('Recessed stone toe plinth', (0,0,.065), (6.22,1.12,.13), 'dark', .025)
box('Brass plinth ribbon', (0,.005,.143), (6.24,1.135,.022), 'gold', .004)
box('Walnut carcass', (0,-.095,.568), (6.18,.87,.826), 'wood', .026)
box('Front shadow recess', (0,.418,.566), (6.11,.08,.77), 'recess')
box('Lower molded apron', (0,.012,.224), (6.29,1.20,.11), 'wood', .027)
box('Upper carved cornice', (0,0,.927), (6.31,1.21,.09), 'dark', .021)
box('Fine gilt cornice', (0,0,.978), (6.32,1.225,.018), 'gold', .003)
box('Overhanging ivory marble slab', (0,0,1.025), (6.4,1.3,.078), 'stone', .019)
box('Marble edge highlight', (0,.633,1.021), (6.27,.019,.032), 'china', .007)

for x in [-3.04, -1.67, 0, 1.67, 3.04]:
    box('Pilaster base', (x,.513,.292), (.16,.17,.13), 'dark')
    box('Fluted walnut pilaster', (x,.50,.60), (.13,.14,.58), 'wood')
    for dx in [-.038, 0, .038]:
        rod('Pilaster gilt flute', (x+dx,.578,.366), (x+dx,.578,.835), .005)
    box('Pilaster carved capital', (x,.521,.867), (.19,.18,.088), 'dark')
    box('Pilaster gilt abacus', (x,.535,.911), (.18,.16,.014), 'gold', .003)

for x, w in [(-.83,1.46),(.83,1.46)]:
    box('Bookmatched raised panel', (x,.49,.576), (w,.105,.54), 'wood', .023)
    frame('Carved bolection frame', x,.549,.576,w-.08,.47,'dark',.022)
    frame('Fine brass panel inlay', x,.568,.576,w-.17,.385)
    for side in [-1,1]:
        points=[]
        for i in range(34):
            t=i/33*math.pi*2.1
            radius=.087*(1-i/38)
            points.append((x+side*(.25+radius*math.cos(t)),.576,.576+radius*math.sin(t)))
        wire('Raised scrolling brass marquetry', points, .006)
    for side in [-1,1]:
        wire('Deco central diamond', [(x,.578,.49),(x+side*.065,.578,.578),(x,.578,.666)], .007)

# Fitted open side niches, with real shelves and porcelain stored in depth.
for x in [-2.36, 2.36]:
    box('Niche back', (x,.385,.584), (1.11,.075,.54), 'dark')
    for z in [.337,.604,.855]:
        box('Niche walnut shelf', (x,.475,z), (1.11,.26,.025), 'wood', .006)
        box('Niche brass shelf lip', (x,.607,z+.009), (1.08,.014,.021), 'gold', .003)
    for z in [.354,.62]:
        for dx in [-.28,.28]:
            for i in range(4):
                zz=z+i*.022
                lathe('Stacked sideboard porcelain',x+dx,.477,[(0,zz),(.087,zz),(.123,zz+.015),(.124,zz+.021),(.095,zz+.021),(0,zz+.012)],'china',24)
    frame('Recessed service niche frame',x,.608,.596,1.16,.535,'gold',.005)

for x in [-2.28,-.76,.76,2.28]:
    box('Rear drawer face',(x,-.553,.81),(1.36,.055,.15),'wood')
    frame('Rear drawer brass outline',x,-.586,.81,1.24,.105,'gold',.004)
    rod('Rear drawer handle',(x-.12,-.593,.81),(x+.12,-.593,.81),.012)
    for dx in [-.12,.12]:rod('Handle standoff',(x+dx,-.574,.81),(x+dx,-.612,.81),.011)
    box('Rear cupboard door',(x,-.553,.50),(1.36,.055,.40),'wood',.018)

# Paired silver coffee urns with taps, handles, domed lids and black drip trays.
for x in [2.02,2.62]:
    box('Coffee urn drip tray',(x,-.11,1.083),(.42,.39,.025),'dark',.013)
    for xx in np.linspace(x-.17,x+.17,8):rod('Drip tray grille',(xx,-.26,1.1),(xx,.05,1.1),.004,'silver',8)
    lathe('Silver coffee urn',x,-.25,[(0,1.098),(.135,1.098),(.145,1.125),(.10,1.15),(.134,1.17),(.134,1.335),(.11,1.36),(0,1.36)])
    lathe('Domed urn lid',x,-.25,[(0,1.36),(.142,1.36),(.125,1.377),(.07,1.403),(0,1.409)])
    lathe('Urn finial',x,-.25,[(0,1.404),(.016,1.404),(.024,1.42),(.016,1.443),(0,1.45)],'gold',20)
    rod('Coffee tap neck',(x,-.119,1.226),(x,.047,1.226),.017,'silver')
    rod('Coffee tap spout',(x,.047,1.226),(x,.047,1.183),.013,'silver')
    rod('Tap lever',(x,-.008,1.244),(x,-.008,1.285),.01,'dark')
    for side in [-1,1]:
        wire('Coffee urn handle',[(x+side*.12,-.25,1.30),(x+side*.19,-.25,1.30),(x+side*.2,-.25,1.235),(x+side*.12,-.25,1.22)],.01,'silver')

# Stemware tray, folded service napkins, stacked dinnerware, and a cloche.
box('Inset leather service mat',(-1.96,-.03,1.073),(1.12,.86,.016),'green',.018)
for x in [-2.28,-1.99,-1.7]:
    for y in [-.24,.15]:
        lathe('Crystal coupe',x,y,[(0,1.084),(.06,1.084),(.066,1.093),(.014,1.101),(.012,1.207),(.037,1.219),(.075,1.259),(.08,1.275),(.071,1.275),(.043,1.238),(.012,1.224)],'glass',24)
        lathe('Coupe gilt rim',x,y,[(.078,1.271),(.078,1.28)],'gold',24)

box('Silver serving salver',(.68,-.02,1.08),(1.11,.87,.024),'silver',.02)
lathe('Silver serving cloche',.68,-.02,[(0,1.095),(.33,1.095),(.336,1.12),(.31,1.16),(.27,1.215),(.19,1.26),(.085,1.287),(0,1.29)],'silver',48)
lathe('Cloche gilt finial',.68,-.02,[(0,1.29),(.026,1.29),(.035,1.31),(.022,1.34),(0,1.34)],'gold',20)
for x in [-.84,-.24]:
    for i in range(6):
        z=1.071+i*.019
        lathe('Stacked dinner plate',x,-.02,[(0,z),(.14,z),(.214,z+.014),(.224,z+.023),(.197,z+.028),(.145,z+.014),(0,z+.011)],'china',32)
        lathe('Dinner plate gilt rim',x,-.02,[(.219,z+.021),(.219,z+.027)],'gold',32)
for i in range(3):
    box('Folded linen napkin',(1.43,.25,1.075+i*.014),(.25,.30,.013),'china',.003)
rod('Silver service spoon',(1.25,-.13,1.11),(1.49,-.08,1.11),.013,'silver')

# Save editable source before making the runtime material batches.
source = DOC / 'hotel-service-counter.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
groups = {}
for o in PARTS:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(deps), depsgraph=deps)
    me.transform(o.matrix_world)
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    copied = bpy.data.objects.new(o.data.materials[0].name, me)
    bpy.context.collection.objects.link(copied)
    groups.setdefault(o.data.materials[0].name, []).append(copied)
exports = []
for name, objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1: bpy.ops.object.join()
    objects[0].name = name
    exports.append(objects[0])
bpy.ops.object.select_all(action='DESELECT')
for o in exports: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True,
    export_yup=True, export_apply=False, export_materials='EXPORT',
    export_cameras=False, export_lights=False)
triangles=0
points=[]
for o in exports:
    o.data.calc_loop_triangles()
    triangles += len(o.data.loop_triangles)
    points.extend((v.co.x,v.co.z,-v.co.y) for v in o.data.vertices)
    o.hide_render=True
    o.hide_set(True)
v=np.array(points)
report=dict(file=OUT.name,bytes=OUT.stat().st_size,triangles=triangles,
    mesh_nodes=len(exports),material_batches=len(exports),bounds=[v.min(0).tolist(),v.max(0).tolist()],
    expected_fixture=[6.4,1.3,1.45],source=source.name,
    provenance='Original procedural Blender geometry and seeded packed PBR textures; no downloaded assets.')
(DOC/'service-counter-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print('ASSET_DONE '+json.dumps(report),flush=True)

# Oblique frontal preview exposes joinery, shelves and the equipment placement.
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=20
scene.cycles.use_denoising=True
scene.cycles.max_bounces=4
scene.render.threads_mode='FIXED'
scene.render.threads=2
scene.render.resolution_x=1500
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18)
scene.view_settings.view_transform='AgX'
box('Preview floor',(0,0,-.065),(100,100,.1),'stone',0)
for name,pos,power,size in [('Key',(-3,4,5),1300,5),('Fill',(4,3,4),900,5),('Rim',(-2,-3,4),950,4)]:
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.size=size
    o=bpy.data.objects.new(name,data)
    scene.collection.objects.link(o)
    o.location=pos
    o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(4,7,3.5))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,.75))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=7.6
scene.camera=camera
scene.render.filepath=str(DOC/'hotel-service-counter-preview.png')
bpy.ops.render.render(write_still=True)
