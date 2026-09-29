"""Original marble/bronze hotel entrance and matching purchase grille.

Blender --background --factory-startup --python tools/hotel-assets/build_entry.py
Local game coordinates: X right, Y up, Z into hotel. The existing 4.8 m clear
foyer and 3.07 m gate opening are retained. All textures and geometry are local.
"""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Matrix, Vector
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models';DOC=ROOT/'docs/hotel-assets/entry';DOC.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'assets/source/hotel-entry.blend'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
PARTS={'portal':[],'gate':[]};GROUP='portal';LETTERS=[]
def xyz(p):return (p[0],-p[2],p[1])
def mat(name,color,rough=.4,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m
MARBLE=mat('Entry ivory marble',(.78,.74,.64),.25)
STONE=mat('Entry carved limestone',(.64,.59,.48),.45)
BRONZE=mat('Entry aged bronze',(.31,.19,.072),.34,.78)
GOLD=mat('Entry burnished gold',(.61,.42,.16),.26,.74)
GREEN=mat('Entry bottle green enamel',(.023,.065,.047),.27,.12)
OPAL=mat('Entry warm opal',(.93,.78,.47),.3,0,.7)
# Seeded mineral veins are embedded in the GLB, with no external texture fetches.
n=512;v,u=np.mgrid[0:n,0:n]/n
vein=np.abs(np.sin(u*15+v*5+np.sin(v*23)*.7))**60
value=.87-.20*vein+np.random.default_rng(1896).normal(0,.004,(n,n))
pixels=np.ones((n,n,4),np.float32);pixels[:,:,:3]=np.stack([value,value*.965,value*.885],axis=2)
im=bpy.data.images.new('Entry original ivory mineral veining',width=n,height=n);im.pixels.foreach_set(pixels.ravel());im.pack()
tex=MARBLE.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
MARBLE.node_tree.links.new(tex.outputs['Color'],MARBLE.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
def register(o,name,m,edge=0):
    o.name=name;o['assembly']=GROUP;o.data.materials.append(m);PARTS[GROUP].append(o)
    if o.type=='MESH':
        if edge:
            b=o.modifiers.new('Machined edge radius','BEVEL');b.width=edge;b.segments=3
            b=o.modifiers.new('Weighted architectural normals','WEIGHTED_NORMAL');b.keep_sharp=True
        uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
        for face in o.data.polygons:
            axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=[i for i in range(3) if i!=axis]
            for li in face.loop_indices:
                co=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(co[axes[0]]*.5,co[axes[1]]*.5)
    return o
def box(name,p,size,m=MARBLE,edge=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object;o.scale=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return register(o,name,m,edge)
def rod(name,a,b,r,m=GOLD):
    a,b=Vector(xyz(a)),Vector(xyz(b));bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    for f in o.data.polygons:f.use_smooth=True
    return register(o,name,m,.002)
def line(name,points,r=.012,m=GOLD):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=2;c.use_fill_caps=True
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*xyz(co),1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);return register(o,name,m)
def text(name,label,p,size,m=GOLD):
    c=bpy.data.curves.new(name,'FONT');c.body=label;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.0015;c.bevel_depth=.0006;c.resolution_u=3
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=xyz(p);o.rotation_euler=(math.pi/2,0,math.pi)
    LETTERS.append(o.name);return register(o,name,m)
def border(name,x,y,z,w,h,r=.012,m=GOLD):
    return line(name,[(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z),(x-w/2,y-h/2,z)],r,m)
for side in [-1,1]:
    x=side*2.67
    box('Solid marble door pier',(x,1.535,0),(.54,3.07,.82))
    box('Marble plinth block',(x,.11,-.015),(.54,.22,.90),MARBLE,.018)
    box('Bronze floor shoe',(x,.026,-.026),(.54,.052,.91),BRONZE,.005)
    for y,h in [(.28,.055),(3.105,.07),(3.21,.09)]:box('Pier carved collar',(x,y,-.04),(.54,h,.90),STONE,.007)
    box('Fluted pier inset',(x,1.69,-.427),(.38,2.62,.025),STONE,.004)
    for dx in [-.125,-.0625,0,.0625,.125]:rod('Pier bronze flute',(x+dx,.48,-.452),(x+dx,2.94,-.452),.010,BRONZE)
    border('Pier fine gold bead',x,1.70,-.453,.42,2.69,.008)
    # A compact original lantern stays entirely inside the pier footprint.
    box('Lantern mounting escutcheon',(x,2.30,-.487),(.22,.52,.045),BRONZE,.024)
    box('Lantern opal diffuser',(x,2.30,-.55),(.16,.36,.09),OPAL,.026)
    for dx in [-.073,0,.073]:rod('Lantern bronze cage',(x+dx,2.115,-.605),(x+dx,2.485,-.605),.008,BRONZE)
    for y in [2.11,2.49]:box('Lantern stepped cap',(x,y,-.55),(.21,.045,.13),GOLD,.009)
box('Structural marble lintel',(0,3.865,0),(5.88,1.59,.82),MARBLE,.018)
for y,w,h,d,m in [(3.105,5.90,.07,.87,STONE),(3.20,5.95,.07,.94,GOLD),(4.60,5.94,.09,.91,STONE),(4.70,6.02,.11,1.02,MARBLE),(4.82,6.14,.10,1.08,MARBLE)]:
    box('Continuous entrance cornice',(0,y,-.035),(w,h,d),m,.012)
box('Recessed green hotel name',(0,3.90,-.432),(4.80,.69,.046),GREEN,.023)
border('Nameplate double bronze border',0,3.90,-.462,4.77,.66,.018,BRONZE)
border('Nameplate gilt fillet',0,3.90,-.481,4.63,.54,.008,GOLD)
text('Raised Grand Hotel lettering','GRAND HOTEL',(0,3.90,-.485),.32)
for side in [-1,1]:
    for i in range(5):
        a=i*.32
        line('Carved fan relief',[(side*(2.47+.035*i),3.49,-.446),(side*(2.40+.075*i),3.77,-.446),(side*(2.35+.12*i),4.26,-.446)],.011,GOLD)
for x in np.arange(-2.72,2.73,.17):box('Cornice carved dentil',(float(x),4.51,-.457),(.075,.09,.09),STONE,.005)

GROUP='gate'
for x in [-2.355,2.355,-.028,.028]:box('Grille vertical stile',(x,1.54,0),(.05,2.99,.105),BRONZE,.009)
for y in [.115,3.018]:box('Grille outer horizontal rail',(0,y,0),(4.76,.065,.105),BRONZE,.009)
for x in np.linspace(-2.19,2.19,19):
    rod('Turned grille upright',(float(x),.15,0),(float(x),2.99,0),.015,GOLD)
    for y in [.37,1.23,2.29]:rod('Grille bar collar',(float(x),y-.025,0),(float(x),y+.025,0),.025,BRONZE)
for side in [-1,1]:
    center=side*1.19
    points=[(center+math.cos(a)*.97,2.00+math.sin(a)*.91,-.025) for a in np.linspace(0,math.pi,41)]
    line('Grille arched fanlight',points,.023,BRONZE)
    for a in np.linspace(.22,math.pi-.22,7):line('Grille fanlight spoke',[(center,2.00,-.025),(center+math.cos(a)*.97,2.00+math.sin(a)*.91,-.025)],.010,GOLD)
    border('Grille lower inset',center,.77,-.014,2.18,1.01,.014,GOLD)
    box('Gate lock escutcheon',(side*.14,1.45,-.072),(.15,.30,.04),BRONZE,.025)
    line('Gate rounded pull',[(side*.14,1.35,-.092),(side*.14,1.37,-.145),(side*.14,1.53,-.145),(side*.14,1.55,-.092)],.015,GOLD)
box('Purchase plaque enamel backing',(0,1.86,-.105),(3.2,.46,.035),GREEN,.018)
border('Purchase plaque bronze rim',0,1.86,-.126,3.15,.405,.015,GOLD)

# Save named editable originals before generating reflected material batches.
bpy.context.scene['authorship']='Original map-polish marble/bronze entrance; generated locally'
bpy.context.scene['clear_opening']='4.8m wide, 3.07m high; follows existing foyer collision'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
reports=[];reflection=Matrix.Diagonal((-1.,1.,1.,1.))
def reverse(me):
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
for kind,objects in PARTS.items():
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();groups={}
    for original in objects:
        me=bpy.data.meshes.new_from_object(original.evaluated_get(deps),depsgraph=deps)
        if original.type=='FONT':me.transform(reflection);reverse(me)
        me.transform(reflection@original.matrix_world);reverse(me)
        copy=bpy.data.objects.new(original.name+' export',me);bpy.context.collection.objects.link(copy)
        groups.setdefault(original.data.materials[0].name,[]).append(copy)
    exported=[]
    for name,obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]
        if len(obs)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name='Entry '+kind+' / '+name;exported.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in exported:o.select_set(True)
    bpy.context.view_layer.objects.active=exported[0]
    path=OUT/('hotel-entry-'+kind+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
    triangles=0
    for o in exported:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    reports.append({'asset':path.name,'triangles':triangles,'meshes':len(exported),'bytes':path.stat().st_size})
    for o in exported:bpy.data.objects.remove(o,do_unlink=True)
(DOC/'asset-report.json').write_text(json.dumps(reports,indent=2)+'\n')

# Architectural study shows the two aligned assemblies; staging is not exported.
GROUP='portal'
box('Preview floor',(0,-.04,0),(30,.06,30),STONE,0)
for name,position,power,size in [('Key',(-4,7,-6),1800,7),('Fill',(5,4,-4),1200,6),('Rim',(0,6,4),1800,5)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(o);o.location=xyz(position)
    o.rotation_euler=(Vector(xyz((0,2,0)))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=xyz((7,5.5,-12)));camera=bpy.context.object
camera.rotation_euler=(Vector(xyz((0,2.4,0)))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=8.2
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.world.color=(.12,.12,.12)
scene.render.filepath=str(DOC/'preview.png');scene.render.image_settings.file_format='PNG';bpy.ops.render.render(write_still=True)
print('ENTRY_COMPLETE',json.dumps(reports))
