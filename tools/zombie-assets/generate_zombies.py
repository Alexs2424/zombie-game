"""Original casino undead, authored in Blender. Run Blender --background --python this_file.
Exports editable .blend, GLB, and compact rigid mesh data used by the browser's shared pose rig.
Coordinates in modeling helpers are game coordinates (X right, Y up, Z forward).
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
SOURCE = ROOT / 'docs/zombie-assets'
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

COLORS = {'skin': '#849574', 'suit': '#364e49', 'shirt': '#c0b38c', 'dark': '#1d2427',
          'hair': '#34302b', 'blood': '#651822', 'teeth': '#dfc590', 'eye': '#e4b74c',
          'socket': '#282326', 'gold': '#b58a45'}
def rgb(h):
    def linear(v): return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
    return tuple(linear(int(h[i:i+2], 16)/255) for i in (1,3,5))
mats = {}
for name, color in COLORS.items():
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb(color), 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = m.diffuse_color
    bs.inputs['Roughness'].default_value = .85 if name != 'blood' else .38
    mats[name] = m

def coord(v): return (v[0], -v[2], v[1])
objects = []
def shape(name, part, center, size, material, box=False, tilt=0):
    if box: bpy.ops.mesh.primitive_cube_add(size=1, location=coord(center))
    else: bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=.5, location=coord(center))
    o = bpy.context.object; o.name = name
    o.scale = (size[0], size[2], size[1]); o.rotation_euler[1] = -tilt
    o.data.materials.append(mats[material]); o['part'] = part
    for p in o.data.polygons: p.use_smooth = not box
    objects.append(o)
    return o

variants = []
for variant in range(3):
    objects = []
    name = ['Pit Boss', 'Crooked Dealer', 'Last Showman'][variant]
    shape('Tapered dinner jacket', 'body', (0,1.15,0), (.51,.64,.32), 'suit')
    shape('Waistcoat', 'body', (0,1.16,.158), (.29,.43,.05), 'shirt')
    shape('Pelvis', 'body', (0,.81,0), (.37,.24,.28), 'dark')
    shape('Neck', 'body', (0,1.48,0), (.15,.19,.16), 'skin')
    for side in [-1,1]:
        shape('Pointed lapel', 'body', (side*.13,1.32,.178), (.085,.29,.035), 'dark', True, side*.25)
    shape('Loose tie', 'body', (.015,1.19,.2), (.06,.3,.025), 'blood', True, -.14)
    for i in range(3): shape('Brass button', 'body', (.09,1.17-i*.1,.19), (.025,.025,.015), 'gold')
    shape('Sunken skull', 'head', (0,1.7,.015), (.35,.4,.32), 'skin')
    for side in [-1,1]:
        shape('Sharp cheekbone', 'head', (side*.125,1.64,.14), (.11,.105,.09), 'skin')
        shape('Ear', 'head', (side*.176,1.7,0), (.06,.11,.065), 'skin')
        shape('Deep eye socket', 'head', (side*.078,1.74,.155), (.125,.073,.045), 'socket')
        shape('Clouded amber eye', 'head', (side*.079,1.742,.18), (.063,.036 if variant != 1 or side < 0 else .015,.025), 'eye')
        shape('Pinpoint pupil', 'head', (side*.08,1.742,.194), (.012,.028,.007), 'dark')
        shape('Scowling brow', 'head', (side*.08,1.785,.161), (.139,.038,.055), 'skin', False, side * [.3,-.22,.1][variant])
    shape('Broken nose', 'head', (.01,1.691,.192), (.073,.117,.09), 'skin')
    shape('Mouth cavity', 'head', (0,1.592,.151), (.205,.13,.06), 'socket')
    shape('Hanging jaw', 'jaw', (0,1.55,.09), (.24,.12,.22), 'skin')
    for i in range(7):
        shape('Uneven upper tooth', 'head', ((i-3)*.025,1.625,.184), (.021,.025+(i%3)*.006,.026), 'teeth', True)
        if i != variant+1: shape('Lower tooth', 'jaw', ((i-3)*.024,1.583,.185), (.018,.025,.024), 'teeth', True)
    shape('Matted hair', 'head', (0,1.863,-.035), (.355,.14,.27), 'hair')
    if variant == 0:
        shape('Cigar stump', 'jaw', (.11,1.589,.23), (.045,.04,.14), 'hair')
        shape('Gold pocket square', 'body', (-.16,1.3,.184), (.085,.053,.015), 'gold', True)
    elif variant == 1:
        shape('Dealer visor', 'head', (0,1.864,.045), (.39,.045,.34), 'suit')
        shape('Visor brim', 'head', (0,1.849,.18), (.39,.025,.26), 'dark')
        shape('Split cheek scar', 'head', (.137,1.665,.185), (.029,.14,.017), 'blood', True, -.32)
    else:
        shape('Top hat brim', 'head', (0,1.89,0), (.47,.045,.4), 'dark')
        shape('Crushed top hat', 'head', (.025,2.0,-.015), (.32,.23,.28), 'dark', True, .12)
        shape('Hat ribbon', 'head', (.018,1.928,.005), (.33,.035,.29), 'blood', True)
        for side in [-1,1]: shape('Bow tie', 'body', (side*.053,1.415,.17), (.11,.065,.035), 'gold')
    for i, side in enumerate([-1,1]):
        arm, fore, leg = ['leftArm','rightArm'][i], ['leftForearm','rightForearm'][i], ['leftLeg','rightLeg'][i]
        shape('Torn upper sleeve', arm, (side*.3,1.22,0), (.175,.32,.18), 'suit')
        shape('Exposed elbow', fore, (side*.3,1.055,0), (.135,.115,.14), 'skin')
        shape('Forearm', fore, (side*.3,.92,0), (.12,.28,.13), 'skin')
        shape('Ragged cuff', fore, (side*.3,.98,-.005), (.145,.16,.145), 'suit')
        shape('Bony palm', fore, (side*.3,.739,.015), (.13,.17,.08), 'skin')
        for finger in range(4):
            shape('Claw finger', fore, (side*.3+(finger-1.5)*.029,.633+(finger%3)*.008,.046), (.025,.115,.032), 'skin')
            shape('Black nail', fore, (side*.3+(finger-1.5)*.029,.592+(finger%3)*.008,.064), (.023,.028,.014), 'dark')
        shape('Thumb', fore, (side*.375,.74,.032), (.044,.1,.05), 'skin')
        shape('Trouser thigh', leg, (side*.11,.61,0), (.19,.4,.22), 'dark')
        shape('Shin', leg, (side*.11,.28,0), (.15,.38,.16), 'dark')
        shape('Scuffed shoe', leg, (side*.11,.085,.065), (.19,.16,.32), 'dark')
        shape('Torn knee', leg, (side*.11,.44,.093), (.09,.12,.035), 'skin')
    # Separate stains and stump caps remain toggleable after rigid mesh merging.
    centers = {'body':(0,1.18,.184), 'head':(-.1,1.68,.182), 'leftArm':(-.3,1.23,.089),
               'rightArm':(.3,1.23,.089), 'leftLeg':(-.11,.56,.112), 'rightLeg':(.11,.56,.112)}
    for part,c in centers.items():
        for j in range(5):
            shape('Impact stain', 'wound_'+part, (c[0]+math.sin(j*7)*.047,c[1]+(j-2)*.035,c[2]+.003), (.07+(j%2)*.05,.07,.018), 'blood')
        if part not in ('body','head'):
            cap = (-.3 if part=='leftArm' else .3,1.36,0) if 'Arm' in part else (-.11 if part=='leftLeg' else .11,.8,0)
            shape('Severed stump', 'stump_'+part, cap, (.15,.065,.15), 'blood')
            shape('Bone core', 'stump_'+part, (cap[0],cap[1]-.035,0), (.052,.04,.052), 'teeth')
    pivots = {'body':(0,0,0), 'head':(0,1.48,0), 'jaw':(0,1.61,.035),
              'leftArm':(-.3,1.36,0), 'rightArm':(.3,1.36,0),
              'leftForearm':(-.3,1.08,0), 'rightForearm':(.3,1.08,0),
              'leftLeg':(-.11,.8,0), 'rightLeg':(.11,.8,0)}
    groups = {}
    for o in objects: groups.setdefault((o['part'],o.data.materials[0].name), []).append(o)
    meshes = []
    for (part,material), members in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in members: o.select_set(True)
        bpy.context.view_layer.objects.active = members[0]
        if len(members)>1: bpy.ops.object.join()
        o = bpy.context.object; o.name = part+'_'+material
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pivot_part = part.removeprefix('wound_') if part.startswith('wound_') else 'body' if part.startswith('stump_') else part
        pivot = pivots[pivot_part]
        vertices=[]
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            vertices.extend([round(w.x-pivot[0],5),round(w.z-pivot[1],5),round(-w.y-pivot[2],5)])
        o.data.calc_loop_triangles()
        # Babylon's left-handed winding uses the reverse of Blender's triangle order.
        indices=[i for tri in o.data.loop_triangles for i in reversed(tri.vertices)]
        meshes.append({'part':part,'material':material,'positions':vertices,'indices':indices})
        o.hide_render = part.startswith(('wound_','stump_'))
    variants.append({'name':name,'meshes':meshes})
    # Each variant gets its own editable collection, with neutral modeling pose.
    collection=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(collection)
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o.name not in {x.name for c in bpy.data.collections if c!=collection and c.name in ['Pit Boss','Crooked Dealer','Last Showman'] for x in c.objects}:
            for c in list(o.users_collection): c.objects.unlink(o)
            collection.objects.link(o)
            o.location.x += (variant-1)*1.35

(OUT/'zombies.json').write_text(json.dumps({'colors':COLORS,'variants':variants},separators=(',',':')))
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'casino-undead.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'casino-undead.glb'),export_format='GLB')
# Preview the actual Blender meshes, with three distinct faces and clothing silhouettes.
world=bpy.context.scene.world or bpy.data.worlds.new('World'); bpy.context.scene.world=world
world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.045,.06,.055,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
for loc,power,size in [((1,-4,5),650,5),((-4,-1,3),450,4),((2,3,4),850,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.1,-7,3.0)); camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.05))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=4.8
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.filepath=str(SOURCE/'lineup.png');bpy.ops.render.render(write_still=True)
