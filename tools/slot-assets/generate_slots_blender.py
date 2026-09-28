"""Blender 5.2 original Art Deco slot-machine authoring, export and CPU preview.
Run: /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python generate_slots_blender.py
The PNG atlas is created first by make_textures.py with the system Python/Pillow.
"""
import bpy, math, json, os, sys, argparse
from pathlib import Path
from mathutils import Vector, Matrix
parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=Path(__file__).resolve().parent);parser.add_argument('--no-render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ROOT=args.output_dir.resolve();ROOT.mkdir(parents=True,exist_ok=True)
REGIONS=json.loads((ROOT/'atlas-regions.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for datablock in list(bpy.data.materials):bpy.data.materials.remove(datablock)
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12
scene.cycles.use_denoising=True;scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=2;scene.cycles.glossy_bounces=2;scene.cycles.transmission_bounces=1
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=980;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.world.color=(.11,.11,.11)
scene.view_settings.view_transform='AgX'
try:scene.view_settings.look='AgX - Medium High Contrast'
except:pass
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.15,.19,.17,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.28

atlas=bpy.data.images.load(str(ROOT/'slot-atlas.png'));atlas.name='Original slot artwork atlas';atlas.pack()
wood=bpy.data.images.load(str(ROOT/'slot-walnut.png'));wood.name='Original analytic walnut grain';wood.pack()
def material(name,color,metal=0,rough=.4,image=None,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if image:
  t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image;t.interpolation='Linear';m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
  if emission:m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=emission
 return m
M={
'wood':material('01 Polished walnut veneer',(.18,.07,.025),.015,.31,wood),
'brass':material('03 Aged satin brass',(.58,.36,.115),.8,.29),
'steel':material('04 Polished coin mechanism steel',(.42,.49,.48),.88,.24),
'ebony':material('05 Black enamel and rubber',(.009,.016,.014),.14,.30),
'graphics':material('06 Ivory printed mechanical reels',(.9,.85,.69),.025,.45,atlas),
'lit':material('07 Illuminated glass artwork',(.85,.79,.60),.04,.32,atlas,.48),
'red':material('08 Oxblood Bakelite control',(.38,.017,.027),.02,.3),
}
PAINT={'emerald':material('02 Emerald lacquer',(.012,.085,.052),.28,.27),'burgundy':material('02 Oxblood lacquer',(.155,.015,.03),.22,.3)}
collections={};current=None;objects=[]
def link(obj,name,mat):
 global current,objects
 obj.name=name
 for c in list(obj.users_collection):c.objects.unlink(obj)
 current.objects.link(obj);obj.data.materials.append(mat);objects.append(obj);return obj

def uv_project(obj):
 if obj.type!='MESH':return
 mesh=obj.data;uv=mesh.uv_layers.new(name='UVMap') if not mesh.uv_layers else mesh.uv_layers.active
 for p in mesh.polygons:
  axis=max(range(3),key=lambda i:abs(p.normal[i]));ab=[i for i in range(3) if i!=axis]
  for li in p.loop_indices:
   v=mesh.vertices[mesh.loops[li].vertex_index].co
   uv.data[li].uv=(v[ab[0]]*.9,v[ab[1]]*3.8)

def bevel(obj,width=.006,segments=2,smooth=True):
 if width:
  mod=obj.modifiers.new('Crafted softened edges','BEVEL');mod.width=width;mod.segments=1 if width<.009 else min(segments,2);mod.limit_method='ANGLE';mod.harden_normals=True
 if smooth:
  for p in obj.data.polygons:p.use_smooth=True
  mod=obj.modifiers.new('Weighted furniture normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50
 return obj

def box(name,loc,size,mat,edge=.006,segments=2,rotation=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if rotation:o.rotation_euler=rotation
 link(o,name,mat);uv_project(o);bevel(o,edge,segments);return o

def profile(name,width,poly,mat,x=0,edge=.006,segments=2):
 n=len(poly);verts=[(x+s*width/2,y,z) for s in [-1,1] for y,z in poly]
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new(name+' mesh');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);current.objects.link(o);objects.append(o);mesh.materials.append(mat);uv_project(o);bevel(o,edge,segments);return o

def cylinder(name,point1,point2,r,mat,vertices=24,edge=.002):
 a=Vector(point1);b=Vector(point2);vec=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=min(vertices,20),radius=r,depth=vec.length,location=(a+b)/2)
 o=bpy.context.object;o.rotation_euler=vec.to_track_quat('Z','Y').to_euler();link(o,name,mat);uv_project(o);bevel(o,edge,2);return o

def sphere(name,loc,r,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=r,location=loc);o=bpy.context.object;link(o,name,mat)
 for p in o.data.polygons:p.use_smooth=True
 return o

def curve_bar(name,points,r,mat):
 # Actual round extruded metalwork remains an editable curve in the native blend.
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=r;cu.bevel_resolution=1;cu.resolution_u=1
 sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
 for p,v in zip(sp.points,points):p.co=(*v,1)
 o=bpy.data.objects.new(name,cu);current.objects.link(o);cu.materials.append(mat);objects.append(o);return o

def quad(name,center,right,up,width,height,region,mat):
 c=Vector(center);r=Vector(right)*width/2;u=Vector(up)*height/2;v=[c-r-u,c+r-u,c+r+u,c-r+u]
 mesh=bpy.data.meshes.new(name+' mesh');mesh.from_pydata(v,[],[(0,1,2,3)]);mesh.update();o=bpy.data.objects.new(name,mesh);current.objects.link(o);objects.append(o);mesh.materials.append(mat)
 x,y,w,h=REGIONS[region];uv=mesh.uv_layers.new(name='UVMap');coords=[(x/2048,1-(y+h)/2048),((x+w)/2048,1-(y+h)/2048),((x+w)/2048,1-y/2048),(x/2048,1-y/2048)]
 for li in range(4):uv.data[li].uv=coords[li]
 return o

def front_art(name,center,w,h,region,mat=None):return quad(name,center,(1,0,0),(0,0,1),w,h,region,mat or M['graphics'])

def frame(name,x,y,z,w,h,t,mat,depth=.022,edge=.003):
 for sg in [-1,1]:
  box(name+' vertical',(x+sg*(w-t)/2,y,z),(t,depth,h),mat,edge,2)
  box(name+' horizontal',(x,y,z+sg*(h-t)/2),(w-t*2,depth,t),mat,edge,2)

def screw(name,x,y,z,axis='front',r=.0043):
 normal=Vector((0,-1,0) if axis=='front' else (0,1,0) if axis=='back' else (1,0,0));c=Vector((x,y,z));cylinder(name+' screw',c,c+normal*.0025,r,M['brass'],12,.0007)
 if axis=='front':box(name+' screw slot',(x,y-.0028,z),(r*1.25,.0006,.0012),M['ebony'],.0002,1)
 elif axis=='back':box(name+' screw slot',(x,y+.0028,z),(r*1.25,.0006,.0012),M['ebony'],.0002,1)
 else:box(name+' screw slot',(x+.0028,y,z),(.0006,r*1.25,.0012),M['ebony'],.0002,1)

def reel(index,x):
 # Full 64-sided physical drum, axis X; artwork wraps one revolution in eight frames.
 radius=.175;yc=-.268;zc=1.331;n=64;width=.164;verts=[];uvs=[]
 rx,ry,rw,rh=REGIONS[f'reel{index}'];start=-math.pi+math.pi/8
 for i in range(n+1):
  a=start+i*math.tau/n;y=yc-radius*math.cos(a);z=zc+radius*math.sin(a)
  for sx in [-1,1]:
   verts.append((x+sx*width/2,y,z));uvs.append(((rx+(0 if sx<0 else rw))/2048,1-(ry+(1-i/n)*rh)/2048))
 faces=[]
 for i in range(n):faces.append((2*i,2*i+1,2*i+3,2*i+2))
 mesh=bpy.data.meshes.new('Mechanical reel curved strip');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Mechanical reel '+str(index+1),mesh);current.objects.link(o);objects.append(o);mesh.materials.append(M['graphics']);uv=mesh.uv_layers.new(name='UVMap')
 for p in mesh.polygons:
  p.use_smooth=True
  for li in p.loop_indices:uv.data[li].uv=uvs[mesh.loops[li].vertex_index]
 for side in [-1,1]:
  # Slim physical rim and black backing disk, behind the ivory reel strip.
  cylinder('Reel side disk',(x+side*.083,yc,zc),(x+side*.087,yc,zc),.171,M['ebony'],40,.0008)
  cylinder('Reel axle',(x+side*.087,yc,zc),(x+side*.104,yc,zc),.017,M['steel'],16,.001)

THETA=math.atan(.145/.32);DN=Vector((0,-math.sin(THETA),math.cos(THETA)));DU=Vector((0,math.cos(THETA),math.sin(THETA)))
def deck_height(y):return .87+(y+.61)*(.145/.32)
def button(name,x,r,color):
 base=Vector((x,-.548,deck_height(-.548)))+DN*.003
 cylinder(name+' brass collar',base,base+DN*.014,r+.009,M['brass'],28,.002)
 cylinder(name+' dark gasket',base+DN*.014,base+DN*.020,r+.002,M['ebony'],28,.001)
 cylinder(name+' Bakelite cap',base+DN*.019,base+DN*.040,r,color,28,.004)
 if name=='SPIN':
  # Circular printed ivory button cap using the same packed original atlas.
  c=base+DN*.043;bpy.ops.mesh.primitive_circle_add(vertices=32,radius=r*.82,fill_type='NGON',location=c);o=bpy.context.object;o.rotation_euler=DN.to_track_quat('Z','Y').to_euler();link(o,'SPIN engraved cap',M['graphics']);uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
  ax,ay,aw,ah=REGIONS['button']
  for li in o.data.polygons[0].loop_indices:
   v=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=((ax+(v.x/(2*r*.82)+.5)*aw)/2048,1-(ay+(.5-v.y/(2*r*.82))*ah)/2048)

def build_variant(kind):
 global current,objects
 current=bpy.data.collections.new('SOURCE • '+kind.upper());scene.collection.children.link(current);collections[kind]=current;objects=[];paint=PAINT[kind]
 poly=[(-.42,.115),(.39,.115),(.39,1.701),(-.174,1.701),(-.269,1.551),(-.309,.997),(-.607,.853),(-.538,.778),(-.418,.686)]
 profile('Cabinet solid walnut carcass',.794,poly,M['wood'],edge=.011,segments=3)
 # Broad beveled side cheeks and inset lacquer panels.
 for sign in [-1,1]:
  profile('Sculpted walnut side cheek',.035,poly,M['wood'],x=sign*.413,edge=.007,segments=3)
  sidepoly=[(-.331,.281),(.278,.281),(.278,1.559),(-.146,1.559),(-.215,1.047),(-.431,.859)]
  profile('Inset side lacquer field',.010,sidepoly,paint,x=sign*.433,edge=.004,segments=2)
  # A raised six-sided thin brass perimeter traces the walnut/paint transition.
  coords=[(sign*.441,y,z) for y,z in sidepoly]+[(sign*.441,*sidepoly[0])]
  curve_bar('Side brass inlay outline',coords,.0035,M['brass'])
  # Ornamental fan rays and a round textured plaque.
  for j in range(-3,4):
   yy=.011+j*.050
   curve_bar('Art Deco side fan',[(sign*.446,.011,1.04),(sign*.446,yy,1.276+abs(j)*.035)],.0026,M['brass'])
  cylinder('Round side crest bezel',(sign*.442,.025,.99),(sign*.448,.025,.99),.100,M['brass'],32,.002)
  # Side plaque is an opaque circle, trimmed from original atlas region.
  bpy.ops.mesh.primitive_circle_add(vertices=40,radius=.09,fill_type='NGON',location=(sign*.449,.025,.99));o=bpy.context.object;o.rotation_euler=Vector((sign,0,0)).to_track_quat('Z','Y').to_euler();link(o,'Last Jackpot side medallion',M['graphics']);uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap');rx,ry,rw,rh=REGIONS['medallion']
  for li in o.data.polygons[0].loop_indices:
   v=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=((rx+(v.x/.18+.5)*rw)/2048,1-(ry+(.5-v.y/.18)*rh)/2048)
  for z in [.36,1.48]:cylinder('Side brass rivet',(sign*.44,.219,z),(sign*.45,.219,z),.005,M['brass'],12,.001)
 # Plinth sits on four feet and provides a stable <=.98m footprint.
 box('Recessed black toe kick',(0,-.035,.059),(.867,.98,.09),M['ebony'],.015,2)
 box('Walnut plinth',(0,-.035,.110),(.950,1.045,.108),M['wood'],.019,3)
 box('Plinth brass upper bead',(0,-.035,.160),(.939,1.035,.014),M['brass'],.005,2)
 for x in [-.338,.338]:
  for y in [-.36,.29]:cylinder('Cast brass foot',(x,y,0),(x,y,.054),.044,M['brass'],20,.006)
 # Forward-painted door is inset within layered walnut and brass moldings.
 box('Lower lacquer access door',(0,-.431,.515),(.702,.033,.555),paint,.012,3)
 frame('Lower door brass pinstripe',0,-.451,.536,.633,.435,.008,M['brass'],.006,.002)
 box('Payout dark throat',(0,-.456,.393),(.524,.018,.136),M['ebony'],.009,2)
 frame('Payout opening brass lip',0,-.468,.392,.557,.165,.018,M['brass'],.024,.004)
 # Real open payout tray, with floor, sides and upturned metal front edge.
 box('Payout tray floor',(0,-.563,.308),(.576,.218,.024),M['steel'],.006,2)
 box('Payout tray front rolled lip',(0,-.661,.340),(.599,.030,.079),M['brass'],.010,3)
 for sg in [-1,1]:box('Payout tray sidewalls',(sg*.282,-.566,.344),(.023,.190,.070),M['brass'],.007,2)
 box('Payout tray interior',(0,-.563,.321),(.525,.168,.006),M['ebony'],.002,1)
 # A few original coins add scale and silhouette without cluttering the tray.
 for x,y,z in [(-.08,-.545,.329),(.04,-.565,.329),(.049,-.561,.334)]:cylinder('Payout token',(x,y,z),(x,y,z+.004),.018,M['brass'],18,.0008)
 # Lower door Art Deco chevrons and key cylinder.
 for j in range(3):
  z=.66+j*.029
  curve_bar('Front decorative chevron',[(-.192,-.454,z+.051),(0,-.454,z),(.192,-.454,z+.051)],.004,M['brass'])
 cylinder('Front door lock',( .257,-.451,.616),(.257,-.467,.616),.018,M['steel'],20,.002)
 box('Keyhole slot',(.257,-.468,.614),(.004,.002,.017),M['ebony'],.001,2)
 for x in [-.31,.31]:
  for z in [.29,.754]:screw('Access door',x,-.452,z)
 # Sloping control deck has real beveled walnut, brass outline and enamel inset.
 deckpoly=[(-.614,.868),(-.292,1.015),(-.278,.977),(-.59,.825)]
 profile('Sloping walnut control deck',.808,deckpoly,M['wood'],edge=.010,segments=3)
 for x in [-.394,.394]:curve_bar('Control deck brass side',( (x,-.610,.877),(x,-.295,1.021)),.005,M['brass'])
 cylinder('Control deck front brass lip',(-.395,-.610,.878),(.395,-.610,.878),.007,M['brass'],16,.001)
 center=Vector((0,-.444,deck_height(-.444)))+DN*.009
 quad('Printed enamel control labels',center,(1,0,0),DU,.686,.169,'deck',M['graphics'])
 button('BET',-.235,.031,M['red']);button('COLLECT',0,.031,M['ebony']);button('SPIN',.235,.043,paint)
 # Front vent flutes are individual shaded recesses under the controls.
 for sg in [-1,1]:
  for j in range(5):box('Front louver recess',(sg*(.238+j*.022),-.456,.796),(.011,.006,.073),M['ebony'],.002,1)
 # Recessed mechanical reel chamber: open frame, no solid faux display plane.
 box('Reel chamber shadow back',(0,-.20,1.337),(.739,.039,.442),M['ebony'],.008,2)
 for x in [-.374,.374]:box('Reel chamber lacquer pillar',(x,-.341,1.338),(.050,.260,.443),paint,.011,3)
 for i,x in enumerate([-.206,0,.206]):reel(i,x)
 # Each reel window has a visible brass bezel and a dark gasket around its genuine opening.
 for x in [-.206,0,.206]:
  frame('Reel black gasket',x,-.451,1.333,.195,.346,.012,M['ebony'],.025,.002)
  frame('Reel brass window bezel',x,-.465,1.333,.204,.365,.011,M['brass'],.027,.003)
 # Top/bottom cover bars hide cylinder portions outside the windows.
 box('Reel upper occlusion fascia',(0,-.451,1.554),(.744,.045,.076),paint,.007,2)
 box('Reel lower occlusion fascia',(0,-.459,1.104),(.744,.049,.080),paint,.007,2)
 cylinder('Reel surround left post',(-.37,-.46,1.132),(-.37,-.46,1.567),.007,M['brass'],16,.001)
 cylinder('Reel surround right post',(.37,-.46,1.132),(.37,-.46,1.567),.007,M['brass'],16,.001)
 # Paytable and illuminated credit meter use packed, original artwork.
 box('Paytable enamel housing',(0,-.355,1.622),(.749,.048,.123),M['ebony'],.008,2)
 front_art('Original mechanical paytable',(0,-.382,1.624),.706,.087,'paytable',M['lit'])
 frame('Paytable aged-brass bezel',0,-.384,1.624,.744,.124,.011,M['brass'],.014,.003)
 assembly_start=len(objects)
 box('Credit meter frame',(.132,-.443,1.099),(.329,.056,.090),M['brass'],.007,2)
 front_art('Illuminated mechanical credit meter',(.132,-.473,1.100),.300,.070,'meter',M['lit'])
 # Coin mechanism with physical steel bezel, black slit, return button and screw heads.
 box('Coin acceptor steel plate',(-.249,-.452,1.090),(.149,.044,.143),M['steel'],.009,3)
 box('Coin slit black opening',(-.270,-.477,1.103),(.008,.005,.047),M['ebony'],.002,2)
 frame('Coin slit bright lip',-.270,-.478,1.103,.022,.061,.004,M['brass'],.006,.001)
 cylinder('Coin return button',(-.221,-.475,1.081),(-.221,-.491,1.081),.013,M['brass'],20,.002)
 front_art('Coin slot engraved legend',(-.25,-.476,1.136),.127,.019,'coin_label')
 for x in [-.307,-.191]:
  for z in [1.036,1.144]:screw('Coin acceptor',x,-.476,z,r=.0032)
 for obj in objects[assembly_start:]:obj.location.y-=.04
 # Layered Art Deco crown frames a wide illuminated marquee.
 box('Walnut upper pediment',(0,-.017,1.741),(.811,.612,.191),M['wood'],.012,3)
 box('Topper lacquer housing',(0,-.202,1.793),(.792,.271,.201),paint,.016,3)
 box('Marquee dark glass backing',(0,-.344,1.793),(.717,.018,.163),M['ebony'],.008,3)
 front_art('Illuminated LAST JACKPOT marquee',(0,-.355,1.793),.697,.143,'marquee',M['lit'])
 frame('Marquee deep brass bezel',0,-.359,1.793,.742,.189,.016,M['brass'],.032,.004)
 for i,(w,z) in enumerate([(.812,1.692),(.759,1.881),(.664,1.899),(.526,1.913)]):box('Stepped Art Deco crown',(0,-.138,z),(w,.425,.014),M['brass'],.003,2)
 for x in [-.391,.391]:
  box('Crown vertical brass pilaster',(x,-.281,1.795),(.017,.09,.185),M['brass'],.004,2)
  for j in [-1,0,1]:box('Crown recessed flutes',(x+j*.004,-.33,1.790),(.0016,.003,.133),M['ebony'],.0003,1)
 # Solid mechanical pull lever stays within the .98m width contract.
 cylinder('Pull lever axle',(.427,-.087,1.096),(.466,-.087,1.096),.047,M['brass'],24,.004)
 cylinder('Pull lever axle center',(.465,-.087,1.096),(.475,-.087,1.096),.027,M['steel'],20,.002)
 curve_bar('Pull lever polished stem',[(.457,-.087,1.096),(.457,-.121,1.211),(.451,-.266,1.428)],.011,M['steel'])
 sphere('Pull lever oxblood knob',(.451,-.266,1.446),.036,M['red'])
 cylinder('Pull lever knob collar',(.451,-.259,1.413),(.451,-.267,1.430),.016,M['brass'],18,.001)
 # Rear service panel, repeated actual vents, socket and fasteners.
 box('Rear service metal panel',(0,.399,.919),(.674,.027,1.10),M['ebony'],.007,2)
 for z0 in [.40,1.10]:
  for j in range(7):box('Rear horizontal cooling vent',(0,.416,z0+j*.037),(.45,.013,.014),M['steel'],.003,1)
 for x in [-.302,.302]:
  for z in [.414,1.414]:screw('Rear panel',x,.417,z,'back')
 box('Rear power socket',(0,.418,.468),(.066,.021,.052),M['ebony'],.007,2)
 for x in [-.012,.012]:box('Power socket prongs',(x,.431,.471),(.004,.003,.014),M['steel'],.001,1)
 # Small frame screws break up otherwise broad manufactured metal surfaces.
 for x in [-.361,.361]:
  for z in [1.203,1.487,1.621]:screw('Front fascia',x,-.481 if z<1.55 else -.393,z,r=.0036)
 return list(objects)

all_sources={kind:build_variant(kind) for kind in ['emerald','burgundy']}
# Bake evaluated geometry for runtime while preserving modifiers/editable source in the blend.
def export_variant(kind,source):
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();outcol=bpy.data.collections.new('EXPORT CACHE • '+kind);scene.collection.children.link(outcol);copies=[]
 for obj in source:
  evaluated=obj.evaluated_get(deps)
  if obj.type not in {'MESH','CURVE'}:continue
  mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=deps)
  dup=bpy.data.objects.new(obj.name+' baked',mesh);outcol.objects.link(dup);dup.matrix_world=obj.matrix_world.copy();copies.append(dup)
 # All geometry, including handle and tray, participates in floor/footprint centering.
 coords=[o.matrix_world@v.co for o in copies for v in o.data.vertices];mn=Vector(tuple(min(v[i] for v in coords) for i in range(3)));mx=Vector(tuple(max(v[i] for v in coords) for i in range(3)));offset=Vector(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))
 for obj in copies:obj.location-=offset
 root=bpy.data.objects.new('SlotMachine_'+kind,None);outcol.objects.link(root);root['front']='glTF +Z';root['units']='metres';root['variant']=kind
 # Join fixed geometry once per material, dramatically reducing runtime mesh count.
 groups={}
 for obj in copies:
  assert len(obj.data.materials)==1,(obj.name,len(obj.data.materials))
  groups.setdefault(obj.data.materials[0].name,[]).append(obj)
 batches=[]
 for matname,group in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();joined=bpy.context.object;joined.name=kind+' | '+matname;joined.parent=root;batches.append(joined)
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in batches:o.select_set(True)
 bpy.context.view_layer.objects.active=root
 path=ROOT/f'slot-machine-{kind}.glb'
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False,export_extras=True)
 triangles=0
 for o in batches:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
 dimensions=mx-mn
 stat={'file':path.name,'triangles':triangles,'material_batches':len(batches),'native_dimensions_XYZ':[float(v) for v in dimensions],'gltf_dimensions_XYZ':[dimensions.x,dimensions.z,dimensions.y],'blender_to_origin_translation':[-float(v) for v in offset],'source_objects':len(source),'bytes':path.stat().st_size}
 # Keep baked material batches as hidden reference, not as render duplicates.
 outcol.hide_render=True;outcol.hide_viewport=True
 return stat
stats=[export_variant(kind,source) for kind,source in all_sources.items()]
# Place editable source variants side by side for the actual Blender studio render.
for kind,source in all_sources.items():
 shift=-.565 if kind=='emerald' else .565
 for o in source:o.location.x+=shift
studio=bpy.data.collections.new('STUDIO • render only');scene.collection.children.link(studio);current=studio;objects=[]
floor_mat=material('STUDIO matte charcoal',(.025,.036,.031),.1,.6)
box('Studio floor',(0,0,-.036),(200,200,.05),floor_mat,.0,1)
def area(name,loc,power,size,color,target=(0,0,1)):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color;obj=bpy.data.objects.new(name,data);studio.objects.link(obj);obj.location=loc;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler();return obj
area('Large warm softbox',(-3,-4,5),530,3.2,(1,.80,.59))
area('Cool frontal fill',(3,-4,2.8),280,2.4,(.66,.82,1))
area('Soft rear rim',(1.8,2.2,4.8),650,2.5,(1,.79,.44))
area('Front reflection card',(-.7,-3.8,1.8),110,1.8,(.83,1,.90))
camdata=bpy.data.cameras.new('Slots showcase camera');cam=bpy.data.objects.new('Slots showcase camera',camdata);studio.objects.link(cam);scene.camera=cam;cam.location=(3.4,-6.9,3.18);target=Vector((0,-.02,.985));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=2.70;camdata.lens=55
scene['asset_provenance']='Original Blender-modeled casino cabinet and original Pillow artwork. No imported art, game models, or logos.'
scene['asset_front']='Blender -Y becomes glTF +Z; table-floor origin is applied to GLB exports.'
scene['preview_render']='Cycles CPU; 2 threads; 12 samples; 980x900 hero; 720x760 detail.'
# Save a fully editable native file with packed bitmap dependencies before rendering.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'last-jackpot-slot-machines.blend'),compress=True)
(ROOT/'asset-manifest.json').write_text(json.dumps({'generator':'Installed Blender '+bpy.app.version_string,'blender_executable':bpy.app.binary_path,'coordinate_system':'glTF metres, +Y up, FRONT +Z; origin center of complete footprint at floor','limits_m':{'width_X':.98,'height_Y':1.92,'depth_Z':1.30},'assets':stats,'textures':{'slot-atlas.png':[2048,2048],'slot-walnut.png':[1024,512]},'render':{'engine':'Cycles','device':'CPU','threads':2,'samples':12,'hero_size':[980,900],'detail_size':[720,760]},'provenance':'Original bevelled Blender geometry; original Pillow symbols/type/layout and algorithmic walnut; no third-party game art, brands or models.'},indent=2))
print('ASSET_EXPORT_STATS '+json.dumps(stats),flush=True)
if args.no_render:
 print('FINISHED: Blender exports and compressed packed native source; renders skipped.',flush=True);sys.exit(0)
scene.render.filepath=str(ROOT/'slots-blender-preview.png');bpy.ops.render.render(write_still=True)
# Modest close-up of the emerald cabinet demonstrates genuine mechanical drum curvature.
collections['burgundy'].hide_render=True
cam.location=(1.25,-4.6,2.27);target=Vector((-.565,-.26,1.18));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.ortho_scale=1.62
scene.render.resolution_x=720;scene.render.resolution_y=760;scene.render.filepath=str(ROOT/'slots-blender-detail.png');bpy.ops.render.render(write_still=True)
print('FINISHED: Blender exports, packed native source, and two CPU renders.',flush=True)
