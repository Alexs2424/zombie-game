"""Original high-roller poker furniture; authored/exported in installed Blender.
Blender -b --factory-startup --threads 2 --python tools/poker-assets/generate_poker_blender.py
"""
import bpy,math,json,argparse,sys
from pathlib import Path
from mathutils import Vector
PROJECT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--docs-dir',type=Path,default=PROJECT/'docs'/'poker-assets');p.add_argument('--model-path',type=Path,default=PROJECT/'public'/'models'/'poker-table.glb');p.add_argument('--no-render',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else [])
OUT=args.docs_dir.resolve();OUT.mkdir(parents=True,exist_ok=True);MODEL=args.model_path.resolve();MODEL.parent.mkdir(parents=True,exist_ok=True);REG=json.loads((OUT/'atlas-regions.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.unit_settings.system='METRIC';s.unit_settings.scale_length=1;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=12;s.cycles.use_denoising=True;s.cycles.max_bounces=4;s.cycles.diffuse_bounces=2;s.cycles.glossy_bounces=2;s.render.threads_mode='FIXED';s.render.threads=2;s.render.image_settings.file_format='PNG';s.render.film_transparent=False;s.view_settings.view_transform='AgX'
try:s.view_settings.look='AgX - Medium High Contrast'
except:pass
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.18,.22,.19,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.30
source=bpy.data.collections.new('SOURCE • detailed poker table');s.collection.children.link(source);current=source;parts=[]
def image(name):
 im=bpy.data.images.load(str(OUT/name));im.pack();return im
woodim=image('poker-walnut.png');feltim=image('poker-felt.png');atlas=image('poker-deck-atlas.png')
def material(name,color,metal=0,rough=.5,im=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 if im:
  t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;m.node_tree.links.new(t.outputs['Color'],bs.inputs['Base Color'])
 return m
M={'wood':material('01 Polished walnut',(.22,.08,.025),.015,.28,woodim),'brass':material('02 Aged satin brass',(.57,.36,.12),.80,.28),'leather':material('03 Burgundy padded leather',(.115,.011,.025),.025,.45),'felt':material('04 Original high-roller baize',(.035,.17,.10),0,.96,feltim),'black':material('05 Ebony recesses',(.009,.013,.011),.04,.48),'steel':material('06 Cupholder brushed steel',(.38,.44,.41),.88,.27),'ivory':material('07 Ivory clay and card edges',(.89,.83,.66),.015,.43),'atlas':material('08 Original card backs and chip crests',(.90,.80,.60),.01,.46,atlas),'green':material('09 Emerald clay chips',(.018,.18,.085),.015,.52),'blue':material('10 Navy clay chips',(.015,.05,.145),.015,.52)}
def own(o,name,mat):
 o.name=name
 for c in list(o.users_collection):c.objects.unlink(o)
 current.objects.link(o);o.data.materials.append(mat);parts.append(o);return o

def proj(o):
 mesh=o.data;uv=mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
 for face in mesh.polygons:
  axis=max(range(3),key=lambda i:abs(face.normal[i]));ab=[i for i in range(3) if i!=axis]
  for li in face.loop_indices:
   v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v[ab[0]]*.72,v[ab[1]]*3.1)

def bevel(o,width=.004,segments=2):
 if width:
  b=o.modifiers.new('Furniture edge bevel','BEVEL');b.width=width;b.segments=1 if width<=.005 else segments;b.limit_method='ANGLE';b.harden_normals=True
 for f in o.data.polygons:f.use_smooth=True
 n=o.modifiers.new('Weighted furniture normals','WEIGHTED_NORMAL');n.keep_sharp=True
 return o

def mesh_obj(name,verts,faces,mat,uvs=None,smooth=False,normals=None):
 me=bpy.data.meshes.new(name+' mesh');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);current.objects.link(o);me.materials.append(mat);parts.append(o)
 if uvs:
  uv=me.uv_layers.new(name='UVMap')
  for f in me.polygons:
   for li in f.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
 elif mat==M['wood']:proj(o)
 for f in me.polygons:f.use_smooth=smooth
 if normals:me.normals_split_custom_set_from_vertices(normals)
 return o

def box(name,loc,size,mat,edge=.005,segments=2,rotation=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);own(o,name,mat)
 if rotation:o.rotation_euler=rotation
 proj(o);bevel(o,edge,segments);return o

def cyl(name,p1,p2,r,mat,n=20,edge=.001):
 p1=Vector(p1);p2=Vector(p2);bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=(p2-p1).length,location=(p1+p2)/2);o=bpy.context.object;o.rotation_euler=(p2-p1).to_track_quat('Z','Y').to_euler();own(o,name,mat);proj(o);bevel(o,edge,1);return o

def line(name,points,r,mat,closed=False):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=r;cu.bevel_resolution=1;sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
 for p,v in zip(sp.points,points):p.co=(*v,1)
 sp.use_cyclic_u=closed;o=bpy.data.objects.new(name,cu);current.objects.link(o);cu.materials.append(mat);parts.append(o);return o

def capsule(radius,n=48,straight=.7):
 return [(cx+radius*math.cos(a),radius*math.sin(a)) for cx,start in [(straight,-math.pi/2),(-straight,math.pi/2)] for a in [start+j*math.pi/n for j in range(n+1)]]

def slab(name,r,z0,z1,mat,edge=.004,straight=.7):
 q=capsule(r,48,straight);n=len(q);v=[(x,y,z) for z in [z0,z1] for x,y in q];f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];o=mesh_obj(name,v,f,mat);bevel(o,edge,2);return o

def ring(name,outer,inner,z0,z1,mat):
 q=capsule(outer);r=capsule(inner);n=len(q);v=[(x,y,z) for path,z in [(q,z0),(q,z1),(r,z0),(r,z1)] for x,y in path];f=[]
 for i in range(n):
  j=(i+1)%n;f.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(n+i,n+j,3*n+j,3*n+i),(i,2*n+i,2*n+j,j)])
 return mesh_obj(name,v,f,mat)

def lathe(name,profile,mat,center=(0,0),scale=(1,1),n=48,flute=0):
 v=[]
 for r,z in profile:
  for i in range(n):
   a=i*math.tau/n;rr=r*(1+flute*math.cos(a*16));v.append((center[0]+rr*math.cos(a)*scale[0],center[1]+rr*math.sin(a)*scale[1],z))
 f=[]
 for j in range(len(profile)-1):
  for i in range(n):k=(i+1)%n;f.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
 return mesh_obj(name,v,f,mat,smooth=True)

def circle_art(name,center,r,region,n=32):
 x,y,z=center;verts=[center]+[(x+r*math.cos(i*math.tau/n),y+r*math.sin(i*math.tau/n),z) for i in range(n)];rx,ry,rw,rh=REG[region];uv=[((rx+rw/2)/1024,1-(ry+rh/2)/1024)]
 # Printed tops read from the +Blender-Y / -world-Z player side.
 for i in range(n):
  aa=i*math.tau/n;uv.append(((rx+rw*(.5-.5*math.cos(aa)))/1024,1-(ry+rh*(.5+.5*math.sin(aa)))/1024))
 return mesh_obj(name,verts,[(0,1+i,1+(i+1)%n) for i in range(n)],M['atlas'],uv)

# Sculpted central pedestal, stepped walnut plinth and brass footrest.
slab('Broad pedestal bottom molding',.515,.012,.079,M['wood'],.012,straight=.54)
slab('Plinth brass bead',.519,.067,.084,M['brass'],.003,straight=.54)
slab('Pedestal upper plinth',.490,.08,.148,M['wood'],.014,straight=.50)
for x in [-.68,.68]:
 for y in [-.30,.30]:cyl('Brass leveling feet',(x,y,0),(x,y,.045),.056,M['brass'],20,.004)
lathe('Turned and fluted walnut pedestal',[(0,.145),(.40,.145),(.435,.17),(.39,.207),(.32,.267),(.285,.32),(.278,.45),(.32,.53),(.42,.603),(.47,.647),(.47,.705),(0,.705)],M['wood'],scale=(1.45,1),n=64,flute=.013)
for r,z0,z1 in [(.437,.168,.182),(.292,.31,.326),(.285,.446,.457),(.422,.601,.615),(.479,.66,.685)]:lathe('Turned pedestal brass collar',[(r,z0),(r,z1)],M['brass'],scale=(1.45,1),n=64)
for i in range(8):
 a=i*math.tau/8
 line('Pedestal carved gold flute',[(.292*math.cos(a)*1.45,.292*math.sin(a),.34),(.285*math.cos(a)*1.45,.285*math.sin(a),.44)],.003,M['brass'])
footpath=[(1.047*math.cos(i*math.tau/96),.59*math.sin(i*math.tau/96),.193) for i in range(96)];line('Oval brass footrest',footpath,.022,M['brass'],True)
for sign in [-1,1]:
 for ysign in [-1,1]:
  line('Footrest walnut support',[(sign*.33,ysign*.17,.175),(sign*.74,ysign*.42,.182)],.036,M['wood'])
  cyl('Footrest metal saddle',(sign*.74,ysign*.42,.169),(sign*.74,ysign*.42,.208),.031,M['brass'],16,.002)
# Layered top and apron; all below the leather rail's 0.95m maximum.
slab('Walnut structural poker top',1.164,.700,.823,M['wood'],.008)
slab('Lower carved apron molding',1.177,.691,.718,M['wood'],.008)
for r,z in [(1.174,.720),(1.175,.811)]:line('Apron brass stringing',[(x,y,z) for x,y in capsule(r)],.004,M['brass'],True)
# Gold lozenges and fine framed marquetry on the two player-facing apron panels.
for sign in [-1,1]:
 for x in [-.43,0,.43]:
  box('Inset apron walnut panel',(x,sign*1.166,.765),(.381,.015,.067),M['black'],.008,2)
  box('Raised walnut apron veneer',(x,sign*1.176,.765),(.351,.008,.048),M['wood'],.004,2)
  line('Apron gold diamond',[(x,sign*1.182,.786),(x+.034,sign*1.182,.765),(x,sign*1.182,.744),(x-.034,sign*1.182,.765)],.002,M['brass'],True)
# Real wooden racetrack with boolean-cut recesses for eight cupholders.
race=ring('Polished walnut drink racetrack',.969,.785,.826,.872,M['wood'])
cups=[(x,y) for y in [-.856,.856] for x in [-.68,0,.68]]+[(-1.556,0),(1.556,0)]
for i,(x,y) in enumerate(cups):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.0545,depth=.20,location=(x,y,.86));cut=bpy.context.object;cut.name='Cupholder cutter '+str(i)
 for c in list(cut.users_collection):c.objects.unlink(cut)
 source.objects.link(cut);cut.hide_render=True;cut.hide_set(True);cut.display_type='WIRE'
 mod=race.modifiers.new('Actual recessed cupholder '+str(i),'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut
 lathe('Recessed brushed-metal cup liner',[(0,.836),(.044,.836),(.050,.841),(.052,.867),(.056,.874),(.061,.878),(.065,.875),(.063,.870)],M['steel'],center=(x,y),n=32)
 cyl('Dark cupholder interior',(x,y,.8365),(x,y,.8374),.043,M['black'],24,0)
 for aa in [-.8,.8]:
  xx=x+.061*math.cos(aa);yy=y+.061*math.sin(aa);cyl('Cup rim fastener',(xx,yy,.875),(xx,yy,.878),.0026,M['brass'],8,0)
bevel(race,.002,2)
line('Inner walnut race gold reveal',[(x,y,.870) for x,y in capsule(.791)],.0024,M['brass'],True)
# Baize, with UVs reading from the runtime player approach at world -Z.
q=capsule(.782,72);v=[(x,y,.865) for x,y in q];uv=[((1.482-x)/2.964,(.782-y)/1.564) for x,y in q];mesh_obj('Original high-roller printed green baize',v,[tuple(range(len(q)))],M['felt'],uv)
# Smooth, individually sewn padded rail sections.
raw=capsule(1.065,120);closed=raw+[raw[0]];distances=[0.0]
for u,v in zip(closed,closed[1:]):distances.append(distances[-1]+math.dist(u,v))
path=[]
for i in range(240):
 d=distances[-1]*i/240;j=next(j for j in range(len(distances)-1) if distances[j]<=d<distances[j+1]);t=(d-distances[j])/(distances[j+1]-distances[j]);path.append(Vector((closed[j][0]*(1-t)+closed[j+1][0]*t,closed[j][1]*(1-t)+closed[j+1][1]*t,0)))
rail_normals=[]
for k in range(12):
 vs=[];ns=[];fs=[]
 for q in range(21):
  idx=(k*20+q)%240;p=path[idx].copy();tangent=(path[(idx+1)%240]-path[(idx-1)%240]).normalized();out=Vector((tangent.y,-tangent.x,0));p+=tangent*(.0012 if q==0 else -.0012 if q==20 else 0)
  for j in range(12):
   aa=j*math.tau/12;vs.append(p+out*(.1345*math.cos(aa))+Vector((0,0,.887+.063*math.sin(aa))));ns.append((out*(math.cos(aa)/.1345)+Vector((0,0,math.sin(aa)/.063))).normalized())
 for q in range(20):
  for j in range(12):jj=(j+1)%12;fs.append((q*12+j,(q+1)*12+j,(q+1)*12+jj,q*12+jj))
 mesh_obj('Burgundy upholstered rail section '+str(k+1),vs,fs,M['leather'],smooth=True,normals=ns)
# True geometric double saddle stitching, batched to one editable mesh.
vs=[];fs=[]
for offset in [-.088,.088]:
 zz=.887+.063*math.sqrt(1-(offset/.1345)**2)+.0008
 for i in range(240):
  p=path[i];t=(path[(i+1)%240]-path[(i-1)%240]).normalized();out=Vector((t.y,-t.x,0));c=p+out*offset+Vector((0,0,zz));up=Vector((0,0,1));base=len(vs)
  for along in [-.007,.007]:
   for j in range(4):aa=j*math.tau/4;vs.append(c+t*along+out*(math.cos(aa)*.00065)+up*(math.sin(aa)*.00065))
  for j in range(4):jj=(j+1)%4;fs.append((base+j,base+4+j,base+4+jj,base+jj))
mesh_obj('Double saddle-stitched rail thread',vs,fs,M['brass'],smooth=True)
# Detailed clay chips, kept outside the clear near-player five-card zone.
def chipstack(name,x,y,count,color,r=.036):
 for i in range(count):
  z=.865+i*.0085
  lathe(name+' layered clay chip',[(0,z),(r-.001,z),(r,z+.001),(r,z+.007),(r-.001,z+.008),(0,z+.008)],color,center=(x,y),n=16)
  for j in range(6):
   aa=j*math.tau/6;aa0=aa-.12;aa1=aa+.12;rr=r+.00012;vs=[(x+rr*math.cos(a),y+rr*math.sin(a),zz) for a,zz in [(aa0,z+.0015),(aa1,z+.0015),(aa1,z+.0065),(aa0,z+.0065)]];mesh_obj('Clay chip ivory edge insert',vs,[(0,1,2,3)],M['ivory'])
 circle_art('Chip denomination crest',(x,y,.865+count*.0085-.0002),r*.55,'chip25' if color==M['leather'] else 'chip100',20)
# Far-side chip rack: channels, raised brass edges and six ordered stacks.
box('Dealer walnut chip bank',(-.20,-.659,.879),(.76,.186,.028),M['wood'],.013,3)
box('Dealer tray ebony liner',(-.20,-.659,.896),(.71,.155,.008),M['black'],.004,2)
for yy in [-.746,-.572]:cyl('Dealer rack brass lip',(-.565,yy,.904),(.165,yy,.904),.006,M['brass'],14,.001)
for j,color in enumerate([M['ivory'],M['leather'],M['green'],M['blue'],M['leather'],M['ivory']]):
 x=-.505+j*.122
 for yy in [-.704,-.617]:
  # Use lower chip rows, still comfortably below rail height.
  before=len(parts);chipstack('Dealer bank',x,yy,4 if j%2 else 3,color,.028)
  for obj in parts[before:]:obj.location.z+=.038
 if j<5:box('Dealer bank channel divider',(x+.061,-.659,.914),(.005,.158,.026),M['brass'],.001,1)
for x,y,c,n in [(-1.11,.27,M['leather'],6),(-1.20,.13,M['ivory'],3),(-1.05,.08,M['green'],4),(1.10,.27,M['blue'],5),(1.19,.12,M['green'],4),(1.04,.09,M['ivory'],3),(-1.02,-.35,M['blue'],4),(1.07,-.32,M['leather'],4)]:chipstack('Player chip stack',x,y,n,c)
# The detailed dealer deck is face-down; it does not pretend to be a dealt hand.
for i in range(26):
 box('Layered deck paper edges',(.465,-.620,.867+i*.001),(.104,.149,.0008),M['ivory'],.0003,1)
box('Card deck dark core',(.465,-.620,.877),(.101,.146,.020),M['ivory'],.004,2)
x,y,w,h=REG['card_back'];vs=[(.413,-.6945,.8935),(.517,-.6945,.8935),(.517,-.5455,.8935),(.413,-.5455,.8935)];uv=[((x+w)/1024,1-y/1024),(x/1024,1-y/1024),(x/1024,1-(y+h)/1024),((x+w)/1024,1-(y+h)/1024)];mesh_obj('Original face-down deck back',vs,[(0,1,2,3)],M['atlas'],uv)
cyl('Ivory dealer button',(.734,-.535,.865),(.734,-.535,.878),.045,M['ivory'],32,.002);circle_art('Dealer button inscription',(.734,-.535,.879),.040,'dealer',40)
# Export evaluated meshes, discard collapsed bevel triangles and batch by material.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();groups={};source_count=len(parts)
for obj in list(parts):
 ev=obj.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=deps);me.calc_loop_triangles();matrix=obj.matrix_world;normalmatrix=matrix.to_3x3().inverted().transposed();uvlayer=me.uv_layers.active;mat=me.materials[0];group=groups.setdefault(mat.name,{'material':mat,'verts':[],'normals':[],'uvs':[],'faces':[]})
 for tri in me.loop_triangles:
  positions=[matrix@me.vertices[i].co for i in tri.vertices]
  if (positions[1]-positions[0]).cross(positions[2]-positions[0]).length<1e-10:continue
  base=len(group['verts'])
  for pos,li in zip(positions,tri.loops):
   group['verts'].append(pos);group['normals'].append((normalmatrix@me.corner_normals[li].vector).normalized());group['uvs'].append(tuple(uvlayer.data[li].uv) if uvlayer else (0,0))
  group['faces'].append((base,base+1,base+2))
 bpy.data.meshes.remove(me)
# Losslessly share identical position/normal/UV corners within each material batch.
for group in groups.values():
 cache={};verts=[];normals=[];uvs=[];indices=[]
 for pos,norm,uv in zip(group['verts'],group['normals'],group['uvs']):
  key=tuple(pos)+tuple(norm)+tuple(uv)
  index=cache.get(key)
  if index is None:index=len(verts);cache[key]=index;verts.append(pos);normals.append(norm);uvs.append(uv)
  indices.append(index)
 group['verts']=verts;group['normals']=normals;group['uvs']=uvs;group['faces']=[tuple(indices[i] for i in face) for face in group['faces']]
export=bpy.data.collections.new('EXPORT • material batches');s.collection.children.link(export);current=export;parts=[];root=bpy.data.objects.new('PokerTable',None);export.objects.link(root);root['coordinate_system']='metres, +Y up after glTF export';root['felt_y']=.865;root['clear_card_region']='world-relative x [-.78,.78], z [-.55,-.16] at Y .865'
for name,g in groups.items():
 o=mesh_obj('poker-table | '+name,g['verts'],g['faces'],g['material'],g['uvs'],smooth=True,normals=g['normals']);o.parent=root
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(MODEL),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_normals=True,export_texcoords=True,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False,export_extras=True)
allv=[v for g in groups.values() for v in g['verts']];mn=[min(v[i] for v in allv) for i in range(3)];mx=[max(v[i] for v in allv) for i in range(3)];triangles=sum(len(g['faces']) for g in groups.values());export.hide_render=True;export.hide_viewport=True
stat={'file':'poker-table.glb','blender_version':bpy.app.version_string,'triangles':triangles,'materials':len(groups),'mesh_batches':len(groups),'source_objects':source_count,'bytes':MODEL.stat().st_size,'gltf_bounds_min':[mn[0],mn[2],-mx[1]],'gltf_bounds_max':[mx[0],mx[2],-mn[1]],'dimensions_XYZ':[mx[0]-mn[0],mx[2]-mn[2],mx[1]-mn[1]],'felt_Y':.865,'card_plane_Y':.870,'recommended_card_size_XZ':[.22,.31],'recommended_card_centers_world_relative':[[x,.870,-.36] for x in [-.56,-.28,0,.28,.56]],'clear_card_region_world_relative':{'x':[-.78,.78],'z':[-.55,-.16]},'provenance':'Original Blender-authored geometry, original Pillow baize/card artwork and analytic walnut; no imported game art or static face-up hand cards.'}
(OUT/'asset-manifest.json').write_text(json.dumps(stat,indent=2));print('POKER_ASSET_EXPORTED '+json.dumps(stat),flush=True)
# Low-cost CPU studio view of the editable source (not a generated concept image).
studio=bpy.data.collections.new('STUDIO • excluded from GLB');s.collection.children.link(studio);current=studio;parts=[]
mat=material('STUDIO slate',(.027,.039,.033),.05,.68);box('Studio floor',(0,0,-.034),(80,80,.05),mat,0)
def area(name,loc,power,size,color):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.6))-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm softbox',(-3,4,6),670,4,(1,.86,.68));area('Soft ivory fill',(4,3,4),460,3.5,(.76,.88,1));area('Rear brass rim',(-1,-4,5),700,3,(1,.79,.5))
d=bpy.data.cameras.new('Poker table showcase');cam=bpy.data.objects.new('Poker table showcase',d);studio.objects.link(cam);s.camera=cam;cam.location=(4.2,6.2,4.5);cam.rotation_euler=(Vector((0,0,.58))-cam.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=4.70;s.render.resolution_x=1150;s.render.resolution_y=830;s.render.resolution_percentage=100
s['authorship']='Original casino furniture authored in installed Blender with packed original textures';s['render_settings']='Cycles CPU, 2 threads, 12 samples'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'poker-table.blend'),compress=True)
if not args.no_render:
 s.render.filepath=str(OUT/'poker-table-preview.png');bpy.ops.render.render(write_still=True)
 cam.location=(0,2.6,5.5);cam.rotation_euler=(Vector((0,0,.78))-cam.location).to_track_quat('-Z','Y').to_euler();d.ortho_scale=4.30;s.render.resolution_x=1120;s.render.resolution_y=780;s.render.filepath=str(OUT/'poker-table-top-preview.png');bpy.ops.render.render(write_still=True)
(OUT/'blender-source-validation.json').write_text(json.dumps({'blender_version':bpy.app.version_string,'source_objects':source_count,'packed_images':[{'name':im.name,'size':list(im.size),'packed':im.packed_file is not None} for im in bpy.data.images if im.source=='FILE'],'render_device':'CPU','threads':2,'samples':12},indent=2))
print('FINISHED POKER ASSET',flush=True)
