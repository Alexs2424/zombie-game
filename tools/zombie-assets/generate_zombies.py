"""Original casino undead: sculpted profiles, tailored cloth and portable surface detail.

Blender --background --factory-startup --python tools/zombie-assets/generate_zombies.py
Add -- --no-render to skip studio previews. All geometry and textures are original.
Helpers use game coordinates: X right, Y up, Z forward, in meters.
"""
import argparse
import json
import math
import struct
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector, noise

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
SOURCE = ROOT / 'docs/zombie-assets'
TEXTURES = ROOT / 'public/textures/zombies'
SOURCE.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

COLORS = {'skin': '#a7aa8d', 'suit': '#48514c', 'shirt': '#b2a48a',
          'dark': '#292b2a', 'hair': '#37352e', 'blood': '#55282a',
          'teeth': '#b5a57a', 'eye': '#f5d77d', 'socket': '#242623', 'gold': '#9e8052'}
PALETTES = [dict(suit='#48514c', skin='#a7aa8d'),
            dict(suit='#594448', skin='#b5ae93'),
            dict(suit='#404b59', skin='#9eaeaa')]
PIVOTS = {'body': (0, 0, 0), 'head': (0, 1.48, 0), 'jaw': (0, 1.61, .035),
          'leftArm': (-.3, 1.36, 0), 'rightArm': (.3, 1.36, 0),
          'leftForearm': (-.3, 1.08, 0), 'rightForearm': (.3, 1.08, 0),
          'leftLeg': (-.11, .8, 0), 'rightLeg': (.11, .8, 0)}
NAMES = ['Pit Boss', 'Crooked Dealer', 'Last Showman']
SURFACES = {'skin': 'skin', 'suit': 'cloth', 'shirt': 'cloth', 'dark': 'cloth',
            'hair': 'leather', 'blood': 'skin', 'teeth': 'leather'}
ROUGHNESS = {'skin': .76, 'suit': .95, 'shirt': .94, 'dark': .9, 'hair': .84,
             'blood': .58, 'teeth': .69, 'eye': .3, 'socket': .98, 'gold': .48}


def rgb(h):
    def linear(v):
        return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return tuple(linear(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5))


def coord(v):
    return (v[0], -v[2], v[1])


materials = []
for variant in range(3):
    mats = {}
    for name, base in COLORS.items():
        m = bpy.data.materials.new(f'{NAMES[variant]} • {name}')
        m.diffuse_color = (*rgb(PALETTES[variant].get(name, base)), 1)
        m.use_nodes = True
        nodes, links = m.node_tree.nodes, m.node_tree.links
        bs = nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value = ROUGHNESS[name]
        if name == 'gold':
            bs.inputs['Metallic'].default_value = .5
        vc = nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Patina'
        tint = nodes.new('ShaderNodeMixRGB'); tint.blend_type = 'MULTIPLY'
        tint.inputs[0].default_value = 1
        tint.inputs[1].default_value = m.diffuse_color
        links.new(vc.outputs['Color'], tint.inputs[2])
        color_out = tint.outputs['Color']
        surface = SURFACES.get(name)
        if surface:
            for channel in ['color', 'normal', 'roughness']:
                file = TEXTURES / f'{surface}-{channel}.png'
                if not file.exists():
                    continue
                tex = nodes.new('ShaderNodeTexImage')
                tex.image = bpy.data.images.load(str(file), check_existing=True)
                tex.image.pack()
                if channel != 'color':
                    tex.image.colorspace_settings.name = 'Non-Color'
                if channel == 'color':
                    mul = nodes.new('ShaderNodeMixRGB'); mul.blend_type = 'MULTIPLY'
                    mul.inputs[0].default_value = 1
                    links.new(color_out, mul.inputs[1]); links.new(tex.outputs['Color'], mul.inputs[2])
                    color_out = mul.outputs['Color']
                elif channel == 'normal':
                    nm = nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = .8 if name == 'skin' else .38
                    links.new(tex.outputs['Color'], nm.inputs['Color']); links.new(nm.outputs[0], bs.inputs['Normal'])
                else:
                    links.new(tex.outputs['Color'], bs.inputs['Roughness'])
        links.new(color_out, bs.inputs['Base Color'])
        if name == 'eye':
            bs.inputs['Emission Color'].default_value = (*rgb('#ffe1a0'), 1)
            bs.inputs['Emission Strength'].default_value = 1.6
        mats[name] = m
    materials.append(mats)

objects = []
variant = 0
collection = None


def patina(p, material, factor=1):
    x, y, z = p
    n = noise.noise_vector(Vector((x * 28 + variant * 7, y * 28, z * 28)))[0]
    fine = noise.noise_vector(Vector((x * 135, y * 135, z * 135)))[1]
    value = (.83 + n * .22 + fine * .065) * factor
    color = [value] * 3
    if material == 'skin':
        bruise = max(0, noise.noise_vector(Vector((x * 23 + variant * 3, y * 23, z * 23)))[2] + .12)
        color = [value * (1 - bruise * .24), value * (1 - bruise * .55), value * (1 - bruise * .37)]
        if y > 1.59 and z > .035:
            # Bruised orbital rims and hollow cheeks, baked into the exported vertex color.
            for side in [-1, 1]:
                orbital = math.exp(-((x - side * .064) / .051) ** 2 - ((y - 1.737) / .035) ** 2)
                cheek = math.exp(-((x - side * .09) / .037) ** 2 - ((y - 1.657) / .034) ** 2)
                shade = 1 - orbital * .53 - cheek * .28
                color = [c * shade for c in color]
    elif material in ('suit', 'dark', 'shirt'):
        dirt = max(0, math.sin(x * 25 + y * 11) * math.sin(y * 30 + z * 9))
        value *= 1 - dirt * .30
        if material == 'shirt': value *= .83
        color = [value, value * .98, value * .94]
    return tuple(max(.07, min(1, c)) for c in color) + (1,)


def mesh(name, part, verts, faces, material, uvs=None, factor=1, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([coord(p) for p in verts], [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); collection.objects.link(o)
    o['part'] = part; o['surface'] = material
    me.materials.append(materials[variant][material])
    uv = me.uv_layers.new(name='UVMap')
    color = me.color_attributes.new(name='Patina', type='FLOAT_COLOR', domain='CORNER')
    for f in me.polygons:
        f.use_smooth = smooth
        for li in f.loop_indices:
            vi = me.loops[li].vertex_index
            p = verts[vi]
            uv.data[li].uv = uvs[vi] if uvs else (p[0] * 3 + p[2] * 2, p[1] * 3)
            color.data[li].color = patina(p, material, factor)
    # UVs and colors belong to face corners: welding positions keeps the UV seam
    # while allowing the normals to smooth continuously across each ring closure.
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000001)
    if name.startswith('Gaunt cranial'):
        # Conform the orbital boundary to an ellipse after removing the interior
        # faces. Leaving it on the ring grid creates visibly stair-stepped holes.
        boundary={v for e in bm.edges if e.is_boundary for v in e.verts}
        for v in boundary:
            x,y,z=v.co.x,v.co.z,-v.co.y
            for side in [-1,1]:
                dx=(x-side*.064)/.032;dy=(y-1.739)/.017
                r=math.hypot(dx,dy)
                if .5<r<1.9 and z>.025:
                    v.co.x=side*.064+dx/r*.032
                    v.co.z=1.739+dy/r*.017
                    v.co.y-=.0015
                    break
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    for f in me.polygons:
        if len(f.vertices) > 4: f.use_smooth = False
    objects.append(o)
    return o


def ellipsoid(name, part, center, size, material, segments=16, rings=10, factor=1):
    verts, faces, uvs = [], [], []
    for j in range(rings + 1):
        phi = math.pi * max(.001, min(.999, j / rings))
        for i in range(segments + 1):
            theta = i * 2 * math.pi / segments
            verts.append((center[0] + size[0] / 2 * math.sin(phi) * math.sin(theta),
                          center[1] + size[1] / 2 * math.cos(phi),
                          center[2] + size[2] / 2 * math.sin(phi) * math.cos(theta)))
            uvs.append((i / segments, j / rings))
    for j in range(rings):
        for i in range(segments):
            a = j * (segments + 1) + i
            faces.append((a, a + 1, a + segments + 2, a + segments + 1))
    return mesh(name, part, verts, faces, material, uvs, factor)


def loft(name, part, profile, material, x=0, z=0, sides=20, folds=0, ragged=0, deform=None, factor=1, cutout=None):
    """Profile rings are (height, half-width, half-depth, optional forward offset)."""
    verts, faces, uvs = [], [], []
    for j, row in enumerate(profile):
        h, rx, rz = row[:3]; oz = row[3] if len(row) > 3 else 0
        for i in range(sides + 1):
            a = i * math.tau / sides
            wrinkle = folds * (math.sin(a * 7 + h * 32) * .58 + math.sin(a * 11 - h * 43) * .32)
            px = x + (rx + wrinkle) * math.sin(a)
            py = h + (ragged * (math.sin(a * 7 + .8) + math.sin(a * 13) * .5) if j == 0 else 0)
            pz = z + oz + (rz + wrinkle) * math.cos(a)
            if deform:
                px, py, pz = deform(px, py, pz, a)
            verts.append((px, py, pz)); uvs.append((i / sides * 2, h * 3))
    for j in range(len(profile) - 1):
        for i in range(sides):
            a = j * (sides + 1) + i
            if cutout and cutout(verts[a], verts[a + sides + 2]):
                continue
            faces.append((a, a + 1, a + sides + 2, a + sides + 1))
    # Ragged cloth has an open hem; a nonplanar closing n-gon gives inverted corners.
    if not ragged: faces.append(tuple(range(sides - 1, -1, -1)))
    faces.append(tuple((len(profile) - 1) * (sides + 1) + i for i in range(sides)))
    o = mesh(name, part, verts, faces, material, uvs, factor)
    for f in o.data.polygons:
        if len(f.vertices) > 4: f.use_smooth = False
    return o


def tube(name, part, points, radii, material, sides=8, factor=1):
    verts, faces, uvs = [], [], []
    for j, p in enumerate(points):
        tangent = Vector(points[min(j + 1, len(points) - 1)]) - Vector(points[max(0, j - 1)])
        tangent.normalize()
        u = tangent.cross(Vector((0, 0, 1)))
        if u.length < .01: u = tangent.cross(Vector((0, 1, 0)))
        u.normalize(); v = tangent.cross(u).normalized()
        for i in range(sides + 1):
            a = math.tau * i / sides
            q = Vector(p) + radii[j] * (math.cos(a) * u + math.sin(a) * v)
            verts.append(tuple(q)); uvs.append((i / sides, j / max(1, len(points) - 1)))
    for j in range(len(points) - 1):
        for i in range(sides):
            a = j * (sides + 1) + i
            faces.append((a, a + 1, a + sides + 2, a + sides + 1))
    faces += [tuple(range(sides - 1, -1, -1)), tuple((len(points) - 1) * (sides + 1) + i for i in range(sides))]
    return mesh(name, part, verts, faces, material, uvs, factor)


def panel(name, part, points, material, thickness=.004, factor=1):
    n = len(points)
    vs = list(points) + [(x, y, z - thickness) for x, y, z in points]
    fs = [tuple(range(n)), tuple(range(n, n * 2))]
    fs += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return mesh(name, part, vs, fs, material, factor=factor, smooth=False)


def skull_deform(x, y, z, a):
    front = max(0, math.cos(a)) ** 4
    hollow = 0
    for side in [-1, 1]:
        hollow += .041 * math.exp(-((x - side * .064) / .044) ** 2 - ((y - 1.737) / .029) ** 2)
        hollow += .027 * math.exp(-((x - side * .086) / .033) ** 2 - ((y - 1.658) / .030) ** 2)
    z -= hollow * front
    for side in [-1,1]:
        z += front * .012 * math.exp(-((x-side*.065)/.045)**2-((y-1.767)/.013)**2)
        z += front * .011 * math.exp(-((x-side*.093)/.033)**2-((y-1.692)/.016)**2)
    z += front * .008 * math.sin(x * 63 + y * 51 + variant) * math.exp(-((y - 1.76) / .15) ** 2)
    x += .003 * math.sin(y * 44 + variant) * front
    return x, y, z


def facial_opening(a,b):
    x=(a[0]+b[0])/2;y=(a[1]+b[1])/2;z=(a[2]+b[2])/2
    mouth=y<1.628 and abs(x)<.053 and z>.046
    orbit=((abs(x)-.064)/.032)**2+((y-1.739)/.017)**2 < 1 and z>.025
    return mouth or orbit


def build_head():
    skull = [(1.60, .062, .064, .022), (1.62, .078, .079, .018),
             (1.645, .104, .097, .005), (1.667, .119, .111, -.008),
             (1.69, .124, .12, -.009), (1.715, .125, .12, -.01),
             (1.737, .128, .122, -.011), (1.758, .13, .128, -.016),
             (1.78, .133, .128, -.02), (1.81, .128, .124, -.024),
             (1.84, .112, .105, -.025), (1.861, .087, .081, -.026),
             (1.875, .05, .048, -.026), (1.88, .012, .014, -.027)]
    dense=[]
    for a,b in zip(skull,skull[1:]):
        for j in range(3): dense.append(tuple(aa+(bb-aa)*j/3 for aa,bb in zip(a,b)))
    dense.append(skull[-1])
    loft('Gaunt cranial planes and hollow cheeks', 'head', dense, 'skin', sides=64, deform=skull_deform,cutout=facial_opening)
    for side in [-1, 1]:
        sx = side * .064
        ellipsoid('Recessed orbital shadow', 'head', (sx, 1.739, .052), (.072, .041, .031), 'socket', 16, 8)
        ellipsoid('Small clouded amber eye', 'head', (sx, 1.739, .070), (.020, .014, .013), 'eye', 12, 8)
        ellipsoid('Thin ear helix', 'head', (side * .132, 1.718, -.005), (.043, .09, .04), 'skin', 12, 8)
        ellipsoid('Ear concha', 'head', (side * .139, 1.719, .015), (.021, .053, .009), 'skin', 12, 6, .47)
        tube('Sternomastoid neck tendon', 'body', [(side * .053, 1.557, -.012), (side * .039, 1.49, .042), (side * .012, 1.439, .075)], [.012, .009, .005], 'skin')
        # Nasolabial fold with irregular healed damage on one cheek.
        tube('Sunken nasolabial crease', 'head', [(side * .028, 1.687, .104), (side * .047, 1.658, .087), (side * .056, 1.63, .078)], [.0012, .0015, .001], 'skin', factor=.62)
    nose = [(-.014, 1.779, .111), (.014, 1.779, .111), (-.012, 1.711, .152), (.014, 1.710, .151),
            (-.023, 1.689, .13), (.024, 1.687, .13), (.008, 1.69, .18), (-.008, 1.691, .174),
            (-.01, 1.678, .133), (.012, 1.677, .133)]
    mesh('Crooked nasal bridge', 'head', nose, [(0,1,3,2),(2,3,6,7),(2,7,4),(3,5,6),(4,7,8),(7,6,9,8),(6,5,9)], 'skin')
    for side in [-1, 1]:
        ellipsoid('Nostril', 'head', (side * .014, 1.685, .145), (.016, .011, .009), 'socket', 10, 6)
    ellipsoid('Dark open mouth', 'head', (0, 1.605, .051), (.119, .055, .032), 'socket', 18, 10)
    loft('Angular hanging mandible', 'jaw', [(1.538,.036,.035,.027),(1.548,.062,.058,.017),
         (1.565,.076,.069,.009),(1.585,.077,.061,.006),(1.597,.065,.044,.006)], 'skin', sides=24)
    tube('Lower withered lip', 'jaw', [(-.05,1.59,.051),(0,1.584,.073),(.05,1.59,.051)], [.002,.003,.002], 'skin', factor=.57)
    for i in range(8):
        px = (i - 3.5) * .0135
        if i != (variant + 1):
            ellipsoid('Worn upper tooth', 'head', (px,1.62 - abs(px)*.10,.085 - abs(px)*.16), (.010,.014 + (i%3)*.003,.009), 'teeth', 8, 6)
        if i not in (variant + 2, 6):
            ellipsoid('Chipped lower tooth', 'jaw', (px,1.584 + abs(px)*.10,.075 - abs(px)*.12), (.010,.014,.011), 'teeth', 8, 6)
    # A restrained torn cheek scar and a few dark stubble marks.
    side = -1 if variant == 2 else 1
    panel('Healed cheek split', 'head', [(side*.10,1.689,.069),(side*.094,1.667,.065),(side*.103,1.65,.061),(side*.111,1.678,.058)], 'blood', .002, .65)
    if variant == 0:
        loft('Receding slicked hair', 'head', [(1.821,.133,.126,-.03),(1.85,.117,.108,-.029),(1.876,.078,.073,-.029),(1.893,.008,.009,-.027)], 'hair', sides=32, folds=.001,
             deform=lambda x,y,z,a: (x,y+.023*math.cos(a)*max(0,(1.89-y)/.07),z))
        for i in range(7):
            x = (i-3)*.025
            tube('Combed strands', 'head', [(x,1.839,.062),(x*.88,1.862,.02),(x*.7,1.866,-.045)], [.0018,.002,.001], 'hair', 5, 1.12)
        tube('Cigar stump', 'jaw', [(.048,1.586,.092),(.063,1.59,.157)], [.013,.012], 'hair', 10)
        ellipsoid('Cigar ash', 'jaw', (.064,1.59,.16), (.025,.022,.008), 'shirt', 10, 6, .53)
    elif variant == 1:
        loft('Dealer visor band', 'head', [(1.805,.14,.133,-.022),(1.833,.135,.129,-.024)], 'suit', sides=28)
        panel('Curved worn visor brim', 'head', [(-.128,1.81,.025),(-.135,1.801,.10),(-.099,1.795,.18),(0,1.792,.20),(.102,1.795,.176),(.134,1.801,.098),(.128,1.81,.025)], 'dark', .007)
        loft('Sparse hair under visor', 'head', [(1.831,.132,.125,-.025),(1.858,.108,.101,-.028),(1.884,.043,.04,-.029),(1.889,.008,.008,-.029)], 'hair', sides=28, folds=.001)
    else:
        loft('Warped oval top hat brim', 'head', [(1.867,.178,.157,-.025),(1.879,.18,.16,-.025)], 'dark', sides=32, folds=.002)
        loft('Dented showman top hat', 'head', [(1.877,.124,.115,-.025),(1.9,.124,.114,-.025),
             (1.954,.113,.109,-.030),(2.009,.122,.114,-.034),(2.025,.116,.109,-.037)], 'dark', sides=28, folds=.003)
        loft('Frayed oxblood hat ribbon', 'head', [(1.886,.127,.119,-.025),(1.917,.121,.115,-.027)], 'blood', sides=28)


def build_clothes():
    loft('Connected dinner jacket with asymmetric worn hem', 'body',
         [(.818,.202,.122),(.85,.211,.135),(.92,.204,.142),(.99,.184,.132),
          (1.07,.189,.126),(1.15,.209,.138),(1.24,.23,.143),(1.31,.247,.137),
          (1.365,.257,.117),(1.402,.223,.096),(1.431,.131,.075)],
         'suit', sides=32, folds=.0037, ragged=.019)
    loft('Seat and waistband', 'body', [(.745,.168,.117),(.79,.185,.126),(.85,.185,.124),(.89,.172,.116)], 'dark', sides=24, folds=.0018)
    loft('Wasted neck', 'body', [(1.423,.061,.059),(1.46,.057,.055),(1.51,.052,.051),(1.56,.061,.05)], 'skin', sides=20)
    # A gridded shirt follows the chest; a nonplanar n-gon cuts through the jacket.
    vs=[];fs=[]
    for y,width,depth,torso_width in [(1.071,.05,.148,.189),(1.15,.064,.157,.209),
            (1.24,.082,.161,.23),(1.31,.094,.154,.247),(1.368,.087,.126,.254),(1.431,.059,.087,.131)]:
        for j in range(7):
            x=width*(j/3-1)
            vs.append((x,y,depth*math.sqrt(1-(x/torso_width)**2)))
    for j in range(5):
        for i in range(6):
            a=j*7+i;fs.append((a,a+1,a+8,a+7))
    mesh('Stained shirt front','body',vs,fs,'shirt')
    for side in [-1,1]:
        panel('Folded shirt collar', 'body', [(side*.008,1.435,.08),(side*.062,1.442,.063),
              (side*.095,1.374,.122),(side*.045,1.354,.137)], 'shirt', .007, 1.12)
        panel('Notched silk lapel', 'body', [(side*.063,1.431,.092),(side*.179,1.381,.113),
              (side*.123,1.314,.145),(side*.151,1.307,.141),(side*.044,1.103,.151),
              (side*.085,1.314,.157)], 'suit', .009, .71)
        tube('Lapel rolled edge', 'body', [(side*.062,1.428,.097),(side*.083,1.326,.159),(side*.044,1.106,.157)], [.0025,.0028,.002], 'suit', 6, 1.12)
        panel('Welt pocket', 'body', [(side*.103,1.034,.115),(side*.187,1.063,.09),
              (side*.19,1.045,.095),(side*.104,1.017,.12)], 'suit', .006, .64)
        # Long jacket seams and a few raised fold crests.
        tube('Tailored side seam', 'body', [(side*.221,1.304,-.042),(side*.184,1.081,-.054),(side*.203,.864,-.065)], [.0018]*3, 'suit', 5, .69)
        for j in range(3):
            y = .95 + j*.115
            tube('Diagonal cloth tension fold', 'body', [(side*.105,y,.12),(side*.145,y+.035,.118),(side*.174,y+.044,.089)], [.001,.003,.001], 'suit', 5, 1.02)
    if variant != 2:
        panel('Hanging silk tie', 'body', [(-.019,1.371,.146),(.019,1.371,.146),(.027,1.301,.164),(.012,1.145,.16),(-.009,1.123,.16),(-.028,1.15,.16),(-.019,1.301,.164)], 'blood', .008)
    else:
        for side in [-1,1]:
            panel('Crumpled bow tie', 'body', [(0,1.387,.138),(side*.060,1.413,.133),(side*.054,1.36,.153)], 'gold', .014)
    for j in range(3):
        ellipsoid('Tarnished jacket button', 'body', (.017,1.076-j*.071,.143), (.013,.014,.008), 'gold', 10, 6)
    if variant == 0:
        panel('Frayed pocket square', 'body', [(-.132,1.308,.129),(-.162,1.343,.113),(-.166,1.32,.118),(-.187,1.334,.102),(-.183,1.297,.108)], 'shirt')
        tube('Watch chain', 'body', [(.032,1.02,.145),(.065,.957,.143),(.13,.966,.128),(.163,1.027,.105)], [.0022]*4, 'gold', 6)
    # Small backing patches and irregular strips give damaged cloth depth without excess gore.
    for x,y,z in [(-.157,.887,.095),(.171,1.21,.102)]:
        panel('Dark ragged cloth opening', 'body', [(x-.023,y+.039,z),(x+.016,y+.027,z+.012),(x+.029,y-.028,z),(x-.007,y-.041,z+.011)], 'dark', .003)
        for j in range(3):
            tube('Loose cloth thread', 'body', [(x-.018+j*.013,y-.018,z+.013),(x-.015+j*.013,y-.046-j*.009,z+.016)], [.0015,.0007], 'suit', 5)


def build_limbs():
    for i, side in enumerate([-1,1]):
        arm, fore, leg = ['leftArm','rightArm'][i], ['leftForearm','rightForearm'][i], ['leftLeg','rightLeg'][i]
        x = side*.3
        loft('Shaped jacket sleeve', arm, [(1.071,.068,.066),(1.106,.074,.077),(1.159,.075,.081),
             (1.218,.078,.085),(1.277,.085,.088),(1.331,.095,.098),(1.375,.084,.083),(1.398,.045,.047)],
             'suit', x=x, sides=20, folds=.003, ragged=.011)
        loft('Forearm sleeve with torn cuff', fore, [(.83,.046,.05),(.877,.053,.055),(.934,.064,.066),
             (.989,.071,.071),(1.041,.07,.069),(1.085,.065,.061),(1.101,.052,.049)],
             'suit', x=x, sides=18, folds=.004, ragged=.019 if i==variant%2 else .009)
        loft('Exposed wrist and hand tendons', fore, [(.724,.047,.023,.008),(.755,.046,.025,.008),(.794,.037,.029),
             (.839,.031,.034),(.868,.035,.037)], 'skin', x=x, sides=16)
        for f in range(4):
            dx = (f-1.5)*.023
            length = [.085,.107,.099,.077][f]
            base = .723 + abs(f-1.5)*.006
            pts=[(x+dx,base,.010),(x+dx*1.10,base-length*.42,.020),
                 (x+dx*1.16,base-length*.81,.038),(x+dx*1.1,base-length,.061)]
            tube('Articulated bony finger', fore, pts, [.011,.0095,.008,.005], 'skin', 8)
            ellipsoid('Small cracked fingernail', fore, (pts[-1][0],pts[-1][1]+.003,pts[-1][2]+.003), (.008,.016,.004), 'teeth', 8, 4, .6)
            tube('Hand extensor tendon', fore, [(x+dx*.65,.797,.027),(x+dx,.75,.03),(x+dx,base,.03)], [.0017,.0022,.002], 'skin', 5, 1.04)
        tube('Opposed bent thumb', fore, [(x+side*.044,.771,.008),(x+side*.069,.736,.019),(x+side*.067,.71,.047)], [.017,.011,.007], 'skin', 10)
        for j in range(3):
            y=.913+j*.049
            tube('Sleeve crushed fold', fore, [(x-.044,y,.043),(x+.002,y+.011,.071),(x+.046,y+.004,.044)], [.001,.003,.001], 'suit', 5, 1.03)
        # One continuous trouser silhouette, with narrower calves and knee folds.
        lx=side*.11
        loft('Tailored worn trousers', leg, [(.135,.067,.069),(.184,.068,.066),(.24,.062,.066),
             (.319,.064,.067),(.39,.072,.069),(.441,.076,.076),(.486,.078,.079),
             (.559,.083,.087),(.639,.091,.098),(.72,.091,.102),(.8,.087,.103),(.833,.078,.093)],
             'dark', x=lx, sides=22, folds=.0035, ragged=.01)
        tube('Trouser pressed crease', leg, [(lx,.72,.103),(lx+.005,.554,.091),(lx-.005,.431,.081),(lx,.233,.071)], [.0018,.002,.002,.0014], 'dark', 5, 1.2)
        if i == (variant+1)%2:
            ellipsoid('Exposed knee through torn cloth', leg, (lx+.014,.447,.072), (.06,.09,.023), 'skin', 14, 8, .75)
            for j in range(3):
                panel('Ragged knee cloth edge',leg,[(lx-.03+j*.02,.494,.077),(lx-.01+j*.02,.485,.082),(lx-.027+j*.02,.467-j*.005,.089)],'dark',.003)
        # A low, angular shoe last and separate sole silhouette.
        loft('Worn leather oxford', leg, [(.035,.08,.133,.043),(.065,.082,.135,.041),(.091,.076,.12,.029),
             (.127,.065,.097,.009),(.156,.062,.065,-.012),(.174,.056,.056,-.016)], 'hair', x=lx, sides=24, folds=.001)
        loft('Welted shoe sole', leg, [(.016,.082,.138,.04),(.039,.084,.138,.04)], 'dark', x=lx, sides=24)
        for j in range(3):
            tube('Shoe laces',leg,[(lx-.025,.137-j*.01,.052+j*.018),(lx+.025,.137-j*.01,.052+j*.018)],[.0018,.0018],'dark',5)


def build_damage():
    centers={'body':(0,1.18,.161),'head':(-.085,1.68,.099),'leftArm':(-.3,1.23,.088),
             'rightArm':(.3,1.23,.088),'leftLeg':(-.11,.56,.093),'rightLeg':(.11,.56,.093)}
    for part,c in centers.items():
        verts=[c]
        for j in range(12):
            a=math.tau*j/12; r=.032*(1+.3*math.sin(j*5))
            verts.append((c[0]+math.cos(a)*r,c[1]+math.sin(a)*r*1.45,c[2]+.004))
        mesh('Impact discoloration', 'wound_'+part, verts, [(0,j+1,(j+1)%12+1) for j in range(12)], 'blood')
        if part not in ('body','head'):
            cap=(-.3 if part=='leftArm' else .3,1.36,0) if 'Arm' in part else (-.11 if part=='leftLeg' else .11,.8,0)
            ellipsoid('Severed stump cap','stump_'+part,cap,(.147,.043,.143),'blood',16,6)
            ellipsoid('Small exposed bone','stump_'+part,(cap[0],cap[1]-.02,0),(.031,.018,.03),'teeth',10,6)


def export_variant():
    groups={}
    for o in objects:
        groups.setdefault((o['part'],o['surface']),[]).append(o)
        o.hide_render=o['part'].startswith(('wound_','stump_'))
    meshes=[]
    for (part,material), members in groups.items():
        pivot_part=part.removeprefix('wound_') if part.startswith('wound_') else 'body' if part.startswith('stump_') else part
        pivot=PIVOTS[pivot_part]
        positions=[]; normals=[]; colors=[]; uvs=[]; indices=[]; lookup={}
        for o in members:
            me=o.data; me.calc_loop_triangles()
            color=me.color_attributes['Patina']; uv=me.uv_layers.active
            # Corner-normal indexing preserves authored smoothing and UV seams.
            for tri in me.loop_triangles:
                ids=[]
                for li in tri.loops:
                    vi=me.loops[li].vertex_index; w=o.matrix_world @ me.vertices[vi].co
                    n=me.corner_normals[li].vector
                    p=(round(w.x-pivot[0],5),round(w.z-pivot[1],5),round(-w.y-pivot[2],5))
                    normal=(round(n.x,5),round(n.z,5),round(-n.y,5))
                    tc=tuple(round(t,5) for t in uv.data[li].uv)
                    vc=tuple(round(c,4) for c in color.data[li].color)
                    key=p+normal+tc+vc
                    if key not in lookup:
                        lookup[key]=len(positions)//3
                        positions.extend(p); normals.extend(normal); uvs.extend(tc); colors.extend(vc)
                    ids.append(lookup[key])
                a,b,c=[Vector(positions[j*3:j*3+3]) for j in ids]
                if (b-a).cross(c-a).length > 1e-11:
                    indices.extend(reversed(ids))
        meshes.append(dict(part=part,material=material,positions=positions,normals=normals,uvs=uvs,colors=colors,indices=indices))
    return dict(name=NAMES[variant],palette=PALETTES[variant],meshes=meshes)


variants=[]
for variant in range(3):
    collection=bpy.data.collections.new(NAMES[variant]);scene.collection.children.link(collection)
    objects=[]
    build_clothes(); build_head(); build_limbs(); build_damage()
    for o in objects:
        if o['part'] in ('head','jaw','wound_head'):
            for v in o.data.vertices: v.co.z -= .025
    bpy.context.view_layer.update()
    variants.append(export_variant())
    for o in objects:
        o.location.x += (variant-1)*.95

asset=dict(version=2,colors=COLORS,surfaces=SURFACES,roughness=ROUGHNESS,variants=variants)
(OUT/'zombies.json').write_text(json.dumps(asset,separators=(',',':')))
report={'source':'Blender original authored geometry','variants':[]}
for v in variants:
    report['variants'].append(dict(name=v['name'],vertices=sum(len(m['positions'])//3 for m in v['meshes']),
       triangles=sum(len(m['indices'])//3 for m in v['meshes']),groups=len(v['meshes']),
       visibleGroups=sum(not m['part'].startswith(('wound_','stump_')) for m in v['meshes'])))
(SOURCE/'validation-report.json').write_text(json.dumps(report,indent=2)+'\n')

# The .blend preserves individually named editable parts; the portable GLB is batched.
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'casino-undead.blend'))
export_collection=bpy.data.collections.new('TEMP • batched export');scene.collection.children.link(export_collection)
export_groups={}
for col in [bpy.data.collections[n] for n in NAMES]:
    for o in col.objects:
        if o.hide_render: continue
        clone=o.copy();clone.data=o.data.copy();export_collection.objects.link(clone)
        export_groups.setdefault((col.name,o['part'],o['surface']),[]).append(clone)
for key,members in export_groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in members: o.select_set(True)
    bpy.context.view_layer.objects.active=members[0]
    if len(members)>1: bpy.ops.object.join()
    bpy.context.object.name=' / '.join(key)
bpy.ops.object.select_all(action='DESELECT')
for o in export_collection.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'casino-undead.glb'),export_format='GLB',use_selection=True,
                         export_materials='EXPORT',export_vertex_color='ACTIVE')
for o in list(export_collection.objects): bpy.data.objects.remove(o,do_unlink=True)
bpy.data.collections.remove(export_collection)
# Blender's exporter follows texture nodes through layered tint/Patina mixing but
# omits the constant tint. Restore that explicit glTF factor, keeping neutral COLOR_0.
glb=OUT/'casino-undead.glb';raw=glb.read_bytes()
json_size=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+json_size])
for m in gltf['materials']:
    model,surface=m['name'].split(' • ',1)
    base=PALETTES[NAMES.index(model)].get(surface,COLORS[surface])
    m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[*rgb(base),1]
    m['doubleSided']=False
encoded=json.dumps(gltf,separators=(',',':')).encode()
encoded+=b' '*((-len(encoded))%4)
tail=raw[20+json_size:]
glb.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+
                struct.pack('<I4s',len(encoded),b'JSON')+encoded+tail)

if not args.no_render:
    studio=bpy.data.collections.new('STUDIO • preview only');scene.collection.children.link(studio)
    def to_studio(o):
        for c in list(o.users_collection): c.objects.unlink(o)
        studio.objects.link(o)
    world=scene.world or bpy.data.worlds.new('World');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.045,.043,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.35
    for loc,power,size,color in [((-3,-4,4),440,3,(.77,.86,1)),((3,-2,3),300,2,(1,.79,.58)),((1,2,3),650,2,(.65,.83,.84))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;to_studio(o)
        o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color
        o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));floor=bpy.context.object;to_studio(floor)
    floor.name='Studio floor'
    fm=bpy.data.materials.new('Studio charcoal');fm.diffuse_color=(.035,.042,.039,1);fm.use_nodes=True
    fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=fm.diffuse_color
    fm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.95
    floor.data.materials.append(fm)
    bpy.ops.object.camera_add(location=(2.3,-7,2.65));camera=bpy.context.object;to_studio(camera)
    camera.rotation_euler=(Vector((0,0,1.03))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=3.7;scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(SOURCE/'lineup.png')
    bpy.ops.render.render(write_still=True)
    camera.location=(1.12,-3,1.86)
    camera.rotation_euler=(Vector((0,-.015,1.66))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=.73
    scene.render.resolution_x=1100;scene.render.resolution_y=1100
    scene.render.filepath=str(SOURCE/'face-detail.png');bpy.ops.render.render(write_still=True)
    # Save a review-ready source with the studio camera; exports above exclude the studio.
    camera.location=(2.3,-7,2.65)
    camera.rotation_euler=(Vector((0,0,1.03))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=3.7
    scene.render.resolution_x=1600;scene.render.resolution_y=1100
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'casino-undead.blend'))
print(json.dumps(report,indent=2))
