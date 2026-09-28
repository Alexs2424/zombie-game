"""Original Blender props for interactive craps and The Velvet Hour.
Run with Blender --background --python tools/casino-assets/generate_casino.py.
All helpers take game coordinates X/right, Y/up, Z/front; exports are meter scale.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models';DOC=ROOT/'docs/casino-assets';DOC.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
FONT=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
def mat(name,color,metal=0,rough=.4,glow=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=glow
    return m
M={
 'gold':mat('Brushed champagne gold',(.65,.37,.1),.8,.24),
 'green':mat('Deep emerald enamel',(.012,.085,.049),.3,.24),
 'black':mat('Obsidian lacquer',(.008,.016,.018),.3,.22),
 'cream':mat('Warm ivory',(.83,.73,.52),0,.6),
 'red':mat('Oxblood velvet',(.2,.008,.018),0,.85),
 'felt':mat('Midnight green baize',(.008,.055,.035),0,.97),
 'wood':mat('Smoked walnut',(.07,.026,.012),0,.42),
 'light':mat('Amber marquee',(.95,.5,.14),.2,.25,2),
 'white':mat('Card stock',(.91,.86,.7),0,.8),
}
current=None;assets={}
def coord(p):return (p[0],-p[2],p[1])
def own(o,name,m):
    o.name=name
    for c in list(o.users_collection):c.objects.unlink(o)
    current.objects.link(o);o.data.materials.append(M[m]);return o
def box(name,pos,size,m,bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1,location=coord(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);own(o,name,m)
    if bevel:
        b=o.modifiers.new('Soft crafted edge','BEVEL');b.width=bevel;b.segments=2
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def cyl(name,pos,r,depth,m):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=depth,location=coord(pos));o=own(bpy.context.object,name,m)
    b=o.modifiers.new('Edge bevel','BEVEL');b.width=min(.003,depth*.2);b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def text(name,value,pos,size,m,flat=False):
    cu=bpy.data.curves.new(name,'FONT');cu.body=value;cu.font=FONT;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.extrude=.0007;cu.resolution_u=4
    o=bpy.data.objects.new(name,cu);current.objects.link(o);o.data.materials.append(M[m]);o.location=coord(pos)
    if not flat:o.rotation_euler=(math.pi/2,0,0)
    return o
def start(name):
    global current
    current=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(current);assets[name]=current
def export(name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in current.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),use_selection=True,export_format='GLB',export_apply=True)

start('casino-chip')
cyl('Green ceramic chip',(0,0,0),.07,.014,'green');cyl('Gold rim',(0,.008,0),.066,.002,'gold');cyl('Ivory inset',(0,.01,0),.047,.002,'cream')
for i in range(12):
    a=i*math.tau/12;o=box('Edge inlay',(.061*math.cos(a),.009,.061*math.sin(a)),(.012,.004,.01),'white',.001);o.rotation_euler.z=-a
text('Denomination','25',(0,.012,0),.044,'green',True);export('casino-chip')

start('crooked-cards')
box('Battered evidence tray',(0,-.005,0),(1.75,.035,.65),'wood');box('Velvet insert',(0,.018,0),(1.65,.009,.55),'red')
for i,(n,suit) in enumerate([('7','♠'),('4','♥'),('9','♣'),('2','♦')]):
    x=(i-1.5)*.37;box('Fixed card '+n+suit,(x,.027,0),(.3,.008,.43),'white',.008)
    color='red' if i%2 else 'black';text('Card value '+n,n,(x-.085,.033,.13),.08,color,True);text('Card suit '+suit,suit,(x,.033,-.015),.15,color,True)
    cyl('Brass tamper pin',(x+.1,.038,-.16),.008,.008,'gold')
text('Clue inscription','LEFT TO RIGHT  /  SUIT THEN NUMBER',(0,.022,.29),.048,'cream',True);export('crooked-cards')

start('secret-portrait')
box('Portrait frame',(0,0,0),(1.8,2.0,.14),'gold',.035);box('Black inner frame',(0,0,.08),(1.63,1.83,.05),'black');box('Painted panel',(0,0,.111),(1.48,1.68,.025),'green')
# Sculpted Art Deco portrait: abstract jazz singer, halo, fan rays.
for i in range(11):
    a=(i-5)*.14;o=box('Sunburst gilding',(.55*math.sin(a),.45+.45*math.cos(a),.133),(.018,.6,.01),'gold',.003);o.rotation_euler.y=-a
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=1,location=coord((0,.2,.16)));o=own(bpy.context.object,'Portrait face','cream');o.scale=(.25,.027,.34)
box('Portrait hair',(-.11,.4,.19),(.3,.21,.04),'black',.09);box('Velvet dress',(0,-.48,.17),(.68,.62,.04),'red',.12)
text('Portrait signature','THE VELVET HOUR',(0,-.77,.145),.083,'gold');export('secret-portrait')

start('secret-keypad')
box('Recessed keypad',(0,1.96,-.02),(1.48,1.65,.13),'black',.045)
for i,k in enumerate(['♠','♥','♣','♦','1','2','3','4','5','6','7','8','9','0','↺']):
    x=(i%4-1.5)*.32;y=2.55-(i//4)*.32
    box('Shoot button '+k,(x,y,.06),(.25,.25,.075),'gold',.025);box('Button enamel',(x,y,.1),(.21,.21,.015),'green',.018)
    text('Key '+k,k,(x,y,.114),.155,'cream')
text('Lock label','SUIT • NUMBER',(0,1.32,.06),.105,'light');export('secret-keypad')

start('betting-layout')
box('Place bet baize',(0,-.004,0),(4.8,.018,1.25),'felt',.012)
for i,n in enumerate([4,5,6,8,9,10]):
    x=(i-2.5)*.8
    for dx in [-.38,.38]:box('Box edge',(x+dx,.008,0),(.008,.005,1.2),'cream',.001)
    text('Place '+str(n),str(n),(x,.015,0),.27,'cream',True)
    text('Place payout', '9:5' if n in [4,10] else '7:5' if n in [5,9] else '7:6',(x,.015,-.4),.085,'gold',True)
export('betting-layout')

start('mystery-slot')
box('Plinth',(0,.12,0),(1.45,.24,.92),'black',.06);box('Gold plinth rim',(0,.25,0),(1.42,.06,.9),'gold')
box('Emerald cabinet',(0,1.11,0),(1.27,1.7,.75),'green',.08)
for x in [-.58,.58]:box('Stepped gold column',(x,1.5,.41),(.095,2.45,.12),'gold',.02)
box('Marquee crown',(0,2.4,.08),(1.43,.52,.79),'gold',.065);box('Marquee glass',(0,2.4,.49),(1.25,.34,.024),'black')
text('Marquee title','VELVET FORTUNE',(0,2.43,.51),.135,'light');text('Marquee subtitle','THE HOUSE HAS SECRETS',(0,2.29,.51),.051,'cream')
box('Reel bezel',(0,1.78,.42),(1.11,.6,.1),'gold',.045);box('Reel glass',(0,1.78,.48),(1,.48,.02),'black')
for i in range(3):
    x=(i-1)*.31;box('Reel '+str(i),(x,1.78,.5),(.27,.39,.06),'cream',.025);text('Reel face '+str(i),['♠','?','♠'][i],(x,1.78,.538),.22,'green')
box('Sloping control deck',(0,1.23,.47),(1.2,.18,.4),'black',.045)
text('Odds plate','400 CHIPS  /  50% WIN',(0,1.05,.422),.078,'gold')
text('Prize plate','SPECIAL WEAPON OR NOTHING',(0,.89,.423),.051,'cream')
box('Coin return',(0,.56,.42),(.5,.17,.1),'gold',.025);box('Coin return dark',(0,.57,.48),(.39,.085,.02),'black')
for x in [-.65,.65]:
    for j in range(8):cyl('Marquee bulbs',(x,2.04+j*.073,.44),.021,.02,'light').rotation_euler.x=math.pi/2
box('Lever stem',(.81,1.56,0),(.045,.75,.045),'gold')
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.085,location=coord((.81,1.96,0)));own(bpy.context.object,'Lever knob','red')
export('mystery-slot')

start('speakeasy-decor')
box('Velvet rug',(0,.01,0),(7,.025,17),'red',.06)
for x in [-3.4,3.4]:box('Rug gold border',(x,.024,0),(.03,.01,16.6),'gold',.002)
for z in [-8.3,8.3]:box('Rug gold border',(0,.024,z),(6.8,.01,.03),'gold',.002)
box('Private bar',(3.8,.57,3),(1.3,1.14,8),'wood',.055);box('Marble bar top',(3.8,1.18,3),(1.5,.12,8.2),'black',.04)
for z in [0,2,4,6]:
    cyl('Stool foot',(2.3,.08,z),.3,.1,'gold');cyl('Stool stem',(2.3,.42,z),.055,.7,'gold');cyl('Velvet stool',(2.3,.82,z),.34,.14,'red')
for z in [-8,7]:
    box('Banquette seat',(-3,.4,z),(1.25,.5,3),'red',.13);box('Banquette back',(-3.5,.9,z),(.25,1.05,3),'red',.1)
    cyl('Cocktail table foot',(-1.55,.12,z),.34,.09,'gold');cyl('Cocktail table stem',(-1.55,.5,z),.055,.7,'gold');cyl('Cocktail table top',(-1.55,.95,z),.56,.08,'black')
for x in [-4.6,4.6]:
    for z in [-9,-2,5,10]:box('Deco wall pilaster',(x,2.3,z),(.075,4.3,.12),'gold')
text('Back wall name','THE VELVET HOUR',(0,3.1,-11.7),.54,'light')
text('Back wall subtitle','NO GUEST LIST. NO SECOND CHANCES.',(0,2.6,-11.69),.14,'cream')
export('speakeasy-decor')

# Keep each prop editable in its own collection. Stage a source-file preview.
positions={'casino-chip':(-1.6,0,1.1),'crooked-cards':(-1.8,0,-.4),'secret-portrait':(-2.5,1.5,-1.5),'secret-keypad':(2.3,0,-1.5),'betting-layout':(0,0,-3.4),'mystery-slot':(0,0,0),'speakeasy-decor':(0,-10,0)}
for name,col in assets.items():
    for o in col.objects:o.location+=Vector(coord(positions[name]));o.hide_render=name=='speakeasy-decor'
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.device='CPU'
scene.world.color=(.1,.1,.1)
for loc,power,size in [((1,-5,7),1500,5),((-5,-2,4),1100,4),((3,4,5),1800,4)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(7,-11,8));o=bpy.context.object;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler();o.data.type='ORTHO';o.data.ortho_scale=8.5;scene.camera=o
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(DOC/'velvet-hour.blend'))
scene.render.filepath=str(DOC/'assets-preview.png');bpy.ops.render.render(write_still=True)
