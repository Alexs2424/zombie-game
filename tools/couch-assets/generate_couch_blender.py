"""Original High Roller Club banquette, authored in Blender. No external assets.
Run Blender --background --factory-startup --python this_file.py [-- --no-render].
Textures: run make_textures.py first. Native parts stay editable; GLB is batched by material.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

P=Path(__file__).resolve().parents[2]
A=P/'assets/source/couch'; D=P/'docs/couch-assets'; D.mkdir(parents=True,exist_ok=True)
ap=argparse.ArgumentParser(); ap.add_argument('--no-render',action='store_true');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene; scene.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0
source=bpy.data.collections.new('SOURCE • HIGH ROLLER OXBLOOD COUCH');scene.collection.children.link(source)
studio=bpy.data.collections.new('STUDIO • excluded from game export');scene.collection.children.link(studio)
parts=[]
def material(name,color,rough,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
leather=material('01 Oxblood leather • pebbled grain',(.16,.026,.034),.46)
p=leather.node_tree.nodes.get('Principled BSDF');p.inputs['Coat Weight'].default_value=.12;p.inputs['Coat Roughness'].default_value=.4
for suffix,inputname in [('color','Base Color'),('roughness','Roughness'),('normal','Normal')]:
 im=bpy.data.images.load(str(A/f'couch-leather-{suffix}.png'));im.pack()
 if suffix!='color':im.colorspace_settings.name='Non-Color'
 t=leather.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;t.label='Packed original '+suffix
 if suffix=='normal':
  nm=leather.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.65;leather.node_tree.links.new(t.outputs['Color'],nm.inputs['Color']);leather.node_tree.links.new(nm.outputs['Normal'],p.inputs[inputname])
 else:leather.node_tree.links.new(t.outputs['Color'],p.inputs[inputname])
cord=material('02 Rolled leather welt',(.105,.017,.021),.42)
thread=material('03 Saddle stitch • warm oxblood',(.22,.088,.065),.76)
wood=material('04 Hand finished walnut',(.085,.028,.013),.32)
im=bpy.data.images.load(str(A/'couch-walnut-color.png'));im.pack();t=wood.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;wood.node_tree.links.new(t.outputs['Color'],wood.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
brass=material('05 Antique brass • feet and nailheads',(.39,.23,.079),.3,.78)
black=material('06 Shadow fabric underneath',(.009,.006,.006),.9)

def link(o,name,mat,collection=source):
 o.name=name
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o)
 if mat:o.data.materials.append(mat)
 if collection==source:parts.append(o)
 return o

def mesh(name,verts,faces,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
 o=bpy.data.objects.new(name,me);source.objects.link(o);me.materials.append(mat);parts.append(o)
 uv=me.uv_layers.new(name='UVMap')
 for f in me.polygons:
  f.use_smooth=True;axis=max(range(3),key=lambda i:abs(f.normal[i]));ab=[i for i in range(3) if i!=axis]
  for li in f.loop_indices:
   v=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(v[ab[0]]/.52,v[ab[1]]/.52)
 return o

def cube(name,loc,size,mat,edge=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);link(o,name,mat)
 mod=o.modifiers.new('Soft furniture edges','BEVEL');mod.width=edge;mod.segments=4
 mod=o.modifiers.new('Weighted joinery normals','WEIGHTED_NORMAL');mod.keep_sharp=True
 for f in o.data.polygons:f.use_smooth=True
 return o

def softbox(name,loc,size,r,mat,counts=(22,14,8),sculpt=False):
 h=[a/2 for a in size];vs=[];fs=[];dedup={}
 def vertex(v):
  key=tuple(round(a,7) for a in v)
  if key in dedup:return dedup[key]
  nearest=Vector([max(-h[i]+r,min(h[i]-r,v[i])) for i in range(3)])
  q=Vector(v)-nearest;co=nearest+q.normalized()*r
  if sculpt:
   top=max(0,(co.z/h[2]))**3
   co.z-=top*.012*math.exp(-((co.x/(h[0]*.8))**4+(co.y/(h[1]*.8))**4))
   edgeX=math.exp(-((abs(co.x)-h[0]+.075)/.043)**2)
   edgeY=math.exp(-((abs(co.y)-h[1]+.073)/.04)**2)
   wrinkle=(edgeX*math.sin(co.y*94+loc[0]*11)+edgeY*math.sin(co.x*87+loc[0]*19))*.0035*top
   co.z+=wrinkle
  idx=len(vs);vs.append(tuple(co+Vector(loc)));dedup[key]=idx;return idx
 for axis in range(3):
  ab=[i for i in range(3) if i!=axis];n,m=counts[ab[0]],counts[ab[1]]
  for sign in [-1,1]:
   grid=[]
   for j in range(m+1):
    row=[]
    for i in range(n+1):
     v=[0.,0.,0.];v[axis]=h[axis]*sign;v[ab[0]]=-h[ab[0]]+2*h[ab[0]]*i/n;v[ab[1]]=-h[ab[1]]+2*h[ab[1]]*j/m;row.append(vertex(v))
    grid.append(row)
   for j in range(m):
    for i in range(n):fs.append((grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i]))
 return mesh(name,vs,fs,mat)

def tube(name,pts,r,mat,closed=False,sides=6):
 # Mesh tube uses local parallel frames; merged export eliminates per-stitch draws.
 vs=[];fs=[];n=len(pts)
 for i,p in enumerate(pts):
  tangent=Vector(pts[(i+1)%n])-Vector(pts[(i-1)%n]) if closed or 0<i<n-1 else Vector(pts[1])-Vector(pts[0]) if i==0 else Vector(pts[-1])-Vector(pts[-2])
  tangent.normalize();u=tangent.cross(Vector((0,0,1)))
  if u.length<.001:u=tangent.cross(Vector((0,1,0)))
  u.normalize();v=tangent.cross(u).normalized()
  for k in range(sides):vs.append(tuple(Vector(p)+r*(math.cos(k*math.tau/sides)*u+math.sin(k*math.tau/sides)*v)))
 for i in range(n if closed else n-1):
  for k in range(sides):fs.append((i*sides+k,i*sides+(k+1)%sides,((i+1)%n)*sides+(k+1)%sides,((i+1)%n)*sides+k))
 if not closed:fs.extend([tuple(reversed(range(sides))),tuple((n-1)*sides+k for k in range(sides))])
 return mesh(name,vs,fs,mat)

def rounded_path(cx,cy,hx,hy,r,z,steps=9):
 pts=[]
 for x,y,start in [(hx-r,hy-r,0),(-hx+r,hy-r,90),(-hx+r,-hy+r,180),(hx-r,-hy+r,270)]:
  for k in range(steps+1):
   a=math.radians(start+k*90/steps);pts.append((cx+x+r*math.cos(a),cy+y+r*math.sin(a),z))
 return pts

def cylinder(name,a,b,r1,r2,mat,n=24):
 v=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r1,radius2=r2,depth=v.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();link(o,name,mat)
 bevel=o.modifiers.new('Polished edges','BEVEL');bevel.width=.003;bevel.segments=2
 o.modifiers.new('Turned normals','WEIGHTED_NORMAL')
 for f in o.data.polygons:f.use_smooth=True
 return o

def stud(name,loc,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=loc);o=bpy.context.object;o.scale=scale;link(o,name,mat)
 for f in o.data.polygons:f.use_smooth=True
 return o

# Open undercarriage: turned legs make contact with the floor at Z=0.
for x in [-2.18,-.73,.73,2.18]:
 for y in [-.35,.35]:
  cylinder('Brass ferrule • floor contact',(x,y,.0),(x,y,.045),.051,.046,brass)
  cylinder('Tapered walnut leg',(x,y,.042),(x,y,.245),.043,.071,wood)
  cylinder('Turned leg collar',(x,y,.197),(x,y,.226),.071,.073,wood)
  cylinder('Leg brass ring',(x,y,.193),(x,y,.206),.073,.073,brass)
cube('Walnut floating plinth',(0,0,.265),(4.72,.955,.115),wood,.025)
cube('Lower brass reveal',(0,0,.227),(4.68,.929,.012),brass,.005)
cube('Upper brass reveal',(0,0,.310),(4.70,.947,.010),brass,.004)
cube('Underside dust cover',(0,0,.235),(4.4,.80,.022),black,.015)
softbox('Padded apron under loose cushions',(0,-.015,.384),(4.49,.94,.145),.055,leather,counts=(60,10,4))
tube('Apron tailored lower welt',rounded_path(0,-.015,2.234,.457,.055,.355),.004,cord,True)
# Solid upholstered rear, gently reclined tuft field in front.
softbox('Curved upholstered outer back',(0,.462,.840),(4.59,.141,.710),.068,leather,counts=(90,6,18))

def tuft_y(x,z):
 u=x/.34;v=(z-.62)/.17;q1=(u+v)/2;q2=(u-v)/2
 s=abs(math.sin(math.pi*q1)*math.sin(math.pi*q2))
 # Rounded crease profile avoids a derivative singularity and diagonal aliasing.
 puff=((math.sqrt(s*s+.0225)-.15)/(math.sqrt(1.0225)-.15))**.72
 fade=min(1,max(0,(2.255-abs(x))/.065),max(0,(z-.538)/.045),max(0,(1.177-z)/.035))
 return .273+(z-.55)*.14-.051*puff*fade
vs=[];fs=[];nx=220;nz=44
for j in range(nz+1):
 z=.54+j*.637/nz
 for i in range(nx+1):
  x=-2.255+i*4.51/nx;vs.append((x,tuft_y(x,z),z))
for j in range(nz):
 for i in range(nx):
  a=j*(nx+1)+i;fs.append((a,a+1,a+nx+2,a+nx+1))
# Close the tuft panel against its rear shell, including the narrow upholstered crown.
perimeter=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,nz+1)]+[nz*(nx+1)+i for i in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(nz-1,0,-1)]
rear=[]
for vi in perimeter:
 x,y,z=vs[vi];rear.append(len(vs));vs.append((x,.465,z))
for i,vi in enumerate(perimeter):
 nxt=(i+1)%len(perimeter);fs.append((vi,perimeter[nxt],rear[nxt],rear[i]))
fs.append(tuple(reversed(rear)))
back=mesh('Hand pulled diamond tuft upholstery',vs,fs,leather)
# Texture projects continuously along the tuft face.
uv=back.data.uv_layers.active
for f in back.data.polygons:
 for li in f.loop_indices:
  v=back.data.vertices[back.data.loops[li].vertex_index].co;uv.data[li].uv=(v.x/.52,v.z/.52)
for row,z in enumerate([.62,.79,.96,1.13]):
 for k in range(-6,7):
  if (k-row)%2:continue
  x=k*.34
  if abs(x)>2.16:continue
  y=tuft_y(x,z)-.008
  stud('Recessed leather covered tuft button',(x,y,z),(.019,.011,.019),cord)
  # Tiny radial pull creases emerge from the button. Sculpted field already supplies deep diamonds.
  for sg in [-1,1]:
   pts=[]
   for t in range(6):
    xx=x+sg*(.017+t*.005);zz=z+.009+t*.003
    pts.append((xx,tuft_y(xx,zz)-.001,zz))
   tube('Fine gathered button fold',pts,.0012,cord,sides=4)
# Rolled top and rear seams finish the silhouette.
tube('Crown continuous leather piping',[(-2.245+i*4.49/130,.357,1.179) for i in range(131)],.005,cord,sides=8)
tube('Rear horizontal saddle seam',[(-2.18+i*4.36/120,.530,1.10) for i in range(121)],.0025,cord)
# Five individually sculpted loose seat cushions, with compression and small edge wrinkles.
for i in range(5):
 x=(i-2)*.873
 softbox(f'Loose seat cushion {i+1} • compressed leather',(x,-.102,.537),(.856,.756,.226),.078,leather,counts=(24,22,8),sculpt=True)
 tube(f'Cushion {i+1} upper piped seam',rounded_path(x,-.102,.409,.359,.060,.621),.0036,cord,True,sides=8)
 tube(f'Cushion {i+1} lower piped seam',rounded_path(x,-.102,.415,.365,.066,.465),.003,cord,True,sides=6)
 # Discrete stitch geometry follows the front edge, with just enough contrast at close range.
 for k in range(48):
  xx=x-.366+k*.0154
  tube('Twin saddle stitch • seat front',[(xx,-.472,.590),(xx+.006,-.472,.590)],.00095,thread,sides=4)
# Rounded arms: substantial leather rolls, curved front caps, nailhead border.
for sign in [-1,1]:
 x=sign*2.31
 softbox('Upholstered arm body',(x,.005,.662),(.315,.98,.525),.12,leather,counts=(10,26,16))
 softbox('Full rolled arm cushion',(x,-.001,.962),(.336,1.058,.278),.132,leather,counts=(14,32,12))
 # Finished front oval follows the roll's pillowed end.
 pts=[(x+.137*math.cos(a*math.tau/64),-.493-.011*math.sin(a*math.tau/64),.954+.111*math.sin(a*math.tau/64)) for a in range(64)]
 tube('Rolled arm front welt',pts,.0038,cord,True,sides=8)
 for k in range(17):
  a=k*math.tau/17
  stud('Antique brass arm tack',(x+.119*math.cos(a),-.500,.954+.09*math.sin(a)),(.0055,.0035,.0055),brass)
 # Shaped side panel visible above the wooden chassis.
 tube('Arm front vertical tailoring',[(x-sign*.107,-.461,.46),(x-sign*.122,-.475,.55),(x-sign*.123,-.477,.69),(x-sign*.118,-.484,.82)],.004,cord,sides=8)
 for k in range(8):
  stud('Arm apron brass tack',(x,-.488,.465+k*.042),(.005,.0035,.005),brass)
# Brass pinheads on the restrained walnut front rail.
for x in [-2.21,2.21]:stud('Plinth brass joinery pin',(x,-.479,.268),(.009,.003,.009),brass)

# Native editable scene with studio lighting, packed material maps and named parts.
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=40;scene.cycles.use_denoising=True;scene.cycles.max_bounces=6
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.render.resolution_x=1500;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.14,.18,.20,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.38
scene.view_settings.view_transform='AgX'
try:scene.view_settings.look='AgX - Medium High Contrast'
except:pass
floor=material('Studio stone',(.047,.057,.06),.84)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.007));link(bpy.context.object,'Studio floor',floor,studio)
def area(name,loc,power,color,size,target=(0,0,.5)):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);studio.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Large warm key',(-3,-4,5),1050,(1,.83,.69),4)
area('Soft frontal fill',(3,-2.5,3),700,(.76,.85,1),3)
area('Long warm rim',(1,3,4.2),1400,(1,.67,.39),3)
bpy.ops.object.camera_add(location=(6.1,-8.6,4.1));cam=bpy.context.object;link(cam,'Couch hero camera',None,studio);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=6.25
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat('-Z','Y').to_euler()
# Open the native file already framed on the sofa.
for screen in bpy.data.screens:
 for ar in screen.areas:
  if ar.type=='VIEW_3D':
   ar.spaces.active.region_3d.view_distance=6.4;ar.spaces.active.region_3d.view_location=(0,0,.62);ar.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion();ar.spaces.active.shading.type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=back
native=P/'assets/source/vip-couch.blend';bpy.ops.wm.save_as_mainfile(filepath=str(native))

# Evaluate modifiers, merge by material into only six draw calls, preserve source meshes.
export_collection=bpy.data.collections.new('EXPORT • material batches');scene.collection.children.link(export_collection)
batches=[];deps=bpy.context.evaluated_depsgraph_get()
for mat in [leather,cord,thread,wood,brass,black]:
 duplicates=[]
 for o in parts:
  if o.data.materials[0]!=mat:continue
  me=bpy.data.meshes.new_from_object(o.evaluated_get(deps),depsgraph=deps);dup=bpy.data.objects.new(o.name+' export',me);export_collection.objects.link(dup);dup.matrix_world=o.matrix_world.copy();duplicates.append(dup)
 bpy.ops.object.select_all(action='DESELECT')
 for o in duplicates:o.select_set(True)
 bpy.context.view_layer.objects.active=duplicates[0];bpy.ops.object.join();merged=bpy.context.object;merged.name=mat.name
 # UVs in legacy primitives are already valid; most leather surfaces use metric UVs.
 batches.append(merged)
bpy.ops.object.select_all(action='DESELECT')
for o in batches:o.select_set(True)
export=P/'public/models/vip-couch.glb'
bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
for o in batches:bpy.data.objects.remove(o,do_unlink=True)
bpy.data.collections.remove(export_collection)
manifest={'name':'High Roller Club oxblood banquette','authoring':'Original Blender geometry and procedural material maps; no third-party assets','native':'assets/source/vip-couch.blend','runtime':'public/models/vip-couch.glb','source_objects':len(parts),'blender':bpy.app.version_string,'coordinates':'Blender Z up, front -Y; glTF Y up, front +Z; floor-centred pivot','features':['Physically sculpted diamond tufting','Five softly compressed loose cushions','Modeled seat piping and front saddle stitches','Covered tuft buttons and gathered folds','Rolled arms and antique brass tacks','Walnut plinth, eight turned legs, brass ferrules'],'render':{'engine':'Cycles CPU','samples':40},'textures':[{'name':im.name,'size':list(im.size),'packed':bool(im.packed_file)} for im in bpy.data.images if im.source=='FILE']}
(D/'asset-manifest.json').write_text(json.dumps(manifest,indent=2))
if not args.no_render:
 scene.render.filepath=str(D/'couch-blender-preview.png');bpy.ops.render.render(write_still=True)
 cam.location=(2.4,-3.5,2.05);cam.rotation_euler=(Vector((1.47,-.07,.77))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.3
 scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.filepath=str(D/'couch-blender-detail.png');bpy.ops.render.render(write_still=True)
print('COUCH_AUTHORING_EXPORT_COMPLETE',flush=True)
