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
PARTS={'portal':[],'gate':[],'wall-west':[],'wall-east':[]};GROUP='portal';LETTERS=[]
def xyz(p):return (p[0],-p[2],p[1])
def mat(name,color,rough=.4,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m
def linear_hex(value):
    channels=[int(value[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in channels)

MARBLE=mat('Entry ivory marble',(.78,.74,.64),.25)
STONE=mat('Entry carved limestone',(.64,.59,.48),.45)
BRONZE=mat('Entry aged bronze',(.31,.19,.072),.34,.78)
GOLD=mat('Entry champagne brass',linear_hex('#C2A574'),.30,.72)
OXBLOOD=mat('Entry smoky oxblood lacquer',linear_hex('#5B3038'),.39,.08)
WALNUT=mat('Entry dark walnut',linear_hex('#3B2923'),.48)
PLASTER=mat('Entry deep oxblood reveals',linear_hex('#40252A'),.74)
OPAL=mat('Entry warm opal',(.93,.78,.47),.3,0,.7)
# Seeded mineral veins are embedded in the GLB, with no external texture fetches.
n=512;v,u=np.mgrid[0:n,0:n]/n
# Fine irregular mineral seams, not the former broad repeating sine stripes.
flow=u*9+v*4+np.sin(v*19+u*5)*.7+np.sin(v*43-u*17)*.13
vein=np.exp(-((np.sin(flow)/.045)**2))
cloud=np.sin(u*17+v*11)*np.sin(v*29-u*7)
value=.84-.055*vein+.012*cloud+np.random.default_rng(1896).normal(0,.003,(n,n))
pixels=np.ones((n,n,4),np.float32);pixels[:,:,:3]=np.stack([value,value*.965,value*.885],axis=2)
im=bpy.data.images.new('Entry original ivory mineral veining',width=n,height=n);im.pixels.foreach_set(pixels.ravel());im.pack()
tex=MARBLE.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
MARBLE.node_tree.links.new(tex.outputs['Color'],MARBLE.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# Original fine walnut grain: subtle enough to read as timber, not stripes.
grain=np.sin(u*250+np.sin(v*12)*2+np.sin(v*29)*.45)*.025
pores=np.sin(u*610+np.sin(v*17))**12*.035
wood=np.array([59,41,35])/255
wood_pixels=np.ones((n,n,4),np.float32)
wood_pixels[:,:,:3]=np.clip(wood[None,None,:]*(1+grain[:,:,None]-pores[:,:,None]),0,1)
wood_image=bpy.data.images.new('Entry original walnut grain',width=n,height=n)
wood_image.pixels.foreach_set(wood_pixels.ravel());wood_image.pack()
wood_tex=WALNUT.node_tree.nodes.new('ShaderNodeTexImage');wood_tex.image=wood_image
WALNUT.node_tree.links.new(wood_tex.outputs['Color'],WALNUT.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

def register(o,name,m,edge=0,segments=3):
    o.name=name;o['assembly']=GROUP;o.data.materials.append(m);PARTS[GROUP].append(o)
    if o.type=='MESH':
        if edge:
            b=o.modifiers.new('Machined edge radius','BEVEL');b.width=edge;b.segments=segments
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
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=1;c.use_fill_caps=True
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*xyz(co),1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);return register(o,name,m)
def text(name,label,p,size,m=GOLD):
    c=bpy.data.curves.new(name,'FONT');c.body=label;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.0015;c.bevel_depth=.0006;c.resolution_u=3
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=xyz(p);o.rotation_euler=(math.pi/2,0,math.pi)
    LETTERS.append(o.name);return register(o,name,m)
def border(name,x,y,z,w,h,r=.012,m=GOLD):
    return line(name,[(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z),(x-w/2,y-h/2,z)],r,m)
def stepped_border(name,x,y,z,w,h,step=.14,r=.013,m=GOLD):
    # Re-entrant corners echo a skyscraper crown rather than rounded rococo trim.
    a,b=w/2,h/2;t=step
    coords=[(-a+t,-b),(a-t,-b),(a-t,-b+t),(a,-b+t),(a,b-t),(a-t,b-t),(a-t,b),
            (-a+t,b),(-a+t,b-t),(-a,b-t),(-a,-b+t),(-a+t,-b+t),(-a+t,-b)]
    return line(name,[(x+dx,y+dy,z) for dx,dy in coords],r,m)
def relief(name,coords,z,depth=.018,m=GOLD):
    # A closed, beveled casting, not a texture decal or floating line drawing.
    count=len(coords);vertices=[xyz((x,y,z+dz)) for dz in [0,depth] for x,y in coords]
    faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return register(o,name,m,.003,1)
def cast_fan(name,x,y,z,radius=.78,height=.76):
    for i,a in enumerate(np.linspace(.08,math.pi-.08,11)):
        da=.052;outer=1 if i%2==0 else .88
        coords=[(x+math.cos(a-da)*radius*.16,y+math.sin(a-da)*height*.16),
                (x+math.cos(a-da)*radius*outer,y+math.sin(a-da)*height*outer),
                (x+math.cos(a+da)*radius*outer,y+math.sin(a+da)*height*outer),
                (x+math.cos(a+da)*radius*.16,y+math.sin(a+da)*height*.16)]
        relief(name+' cast blade',coords,z,.018,GOLD if i%2==0 else BRONZE)
    for scale in [1.05,1.13]:
        line(name+' scalloped crown',[(x+math.cos(a)*radius*scale,y+math.sin(a)*height*scale,z+.004) for a in np.linspace(0,math.pi,31)],.012,GOLD)

for side in [-1,1]:
    x=side*2.67
    box('Solid marble door pier',(x+side*.015,1.535,0),(.51,3.07,.82))
    box('Marble plinth block',(x+side*.005,.11,-.015),(.53,.22,.90),MARBLE,.018)
    box('Bronze floor shoe',(x,.026,-.026),(.54,.052,.91),BRONZE,.005)
    for y,h in [(.28,.055),(3.105,.07),(3.21,.09)]:box('Pier carved collar',(x+side*.005,y,-.04),(.53,h,.90),STONE,.007)
    box('Fluted pier inset',(x,1.69,-.427),(.38,2.62,.025),STONE,.004)
    for dx in [-.125,-.0625,0,.0625,.125]:rod('Pier bronze flute',(x+dx,.48,-.452),(x+dx,2.94,-.452),.010,BRONZE)
    border('Pier fine gold bead',x,1.70,-.453,.42,2.69,.008)
    # A compact original lantern stays entirely inside the pier footprint.
    box('Lantern mounting escutcheon',(x,2.30,-.487),(.22,.52,.045),BRONZE,.024)
    box('Lantern opal diffuser',(x,2.30,-.55),(.16,.36,.09),OPAL,.026)
    for dx in [-.073,0,.073]:rod('Lantern bronze cage',(x+dx,2.115,-.605),(x+dx,2.485,-.605),.008,BRONZE)
    for y in [2.11,2.49]:box('Lantern stepped cap',(x,y,-.55),(.21,.045,.13),GOLD,.009)
box('Structural marble lintel',(0,3.865,0),(5.88,1.59,.82),MARBLE,.018)
for y,w,h,d,m in [(3.12,5.90,.07,.87,STONE),(3.20,5.95,.07,.94,GOLD),(4.60,5.94,.09,.91,STONE),(4.70,6.02,.11,1.02,MARBLE),(4.82,6.14,.10,1.08,MARBLE)]:
    box('Continuous entrance cornice',(0,y,-.035),(w,h,d),m,.012)
box('Recessed oxblood hotel name',(0,3.90,-.432),(4.80,.69,.046),OXBLOOD,.023)
border('Nameplate double bronze border',0,3.90,-.462,4.77,.66,.018,BRONZE)
border('Nameplate gilt fillet',0,3.90,-.481,4.63,.54,.008,GOLD)
text('Raised Grand Hotel lettering','GRAND HOTEL',(0,3.90,-.485),.32)
for side in [-1,1]:
    for i in range(5):
        a=i*.32
        line('Carved fan relief',[(side*(2.47+.035*i),3.49,-.446),(side*(2.40+.075*i),3.77,-.446),(side*(2.35+.12*i),4.26,-.446)],.011,GOLD)
for x in np.arange(-2.72,2.73,.17):box('Cornice carved dentil',(float(x),4.51,-.457),(.075,.09,.09),STONE,.005)


# Full-height attic joins the 6.8m casino ceiling and the adjacent wall crown.
# Its inset fan is sculpted geometry; every reveal has a real shadow edge.
box('Attic stone backing',(0,5.675,.10),(5.88,1.61,.62),STONE,.012)
box('Attic recessed oxblood field',(0,5.64,-.225),(5.34,1.40,.045),PLASTER,.008)
border('Attic stepped stone bead',0,5.64,-.266,5.47,1.48,.024,STONE)
border('Attic fine bronze inlay',0,5.64,-.295,5.20,1.23,.009,GOLD)
for side in [-1,1]:
    for i in range(4):
        box('Attic vertical reed',(side*(2.57+i*.065),5.65,-.277),(.018,1.38,.032),GOLD,.004)
cast_fan('Portal sunrise',0,5.16,-.319,1.04,.90)
stepped_border('Attic stepped gilt frame',0,5.64,-.300,4.96,1.13,.12,.012,GOLD)
for side in [-1,1]:
    for y,w in [(5.22,1.1),(5.39,.86),(5.56,.62)]:
        box('Attic wing chevron',(side*1.72,y,-.285),(w,.018,.025),GOLD,.004)
for y,h,d,m in [(6.43,.10,.82,STONE),(6.53,.10,.92,MARBLE),(6.62,.06,.98,GOLD),(6.73,.14,1.04,STONE)]:
    box('Ceiling meeting crown',(0,y,-.01),(6.14,h,d),m,.01)

# Nine evenly sized bays per wing. All panels meet the jamb and room corners;
# unlike the old fixed-step decorations there are no truncated edge panels.
for side,kind in [(-1,'wall-west'),(1,'wall-east')]:
    GROUP=kind
    start,end=2.94,30.225
    span=end-start; step=span/9; center=side*(start+end)/2
    box('North wall structural backing',(center,3.4,-.25),(span,6.8,.45),PLASTER,0)
    for y,h,depth,m in [(.10,.20,.51,STONE),(.245,.07,.55,MARBLE),(1.32,.085,.53,WALNUT),(1.40,.045,.55,GOLD),(6.30,.12,.52,STONE),(6.43,.10,.56,STONE),(6.53,.10,.66,MARBLE),(6.62,.06,.72,GOLD),(6.73,.14,.78,STONE)]:
        box('Continuous wall course',(center,y,-.25),(span,h,depth),m,.006)
    for i in range(9):
        x=side*(start+(i+.5)*step)
        box('Walnut dado field',(x,.79,-.495),(step-.12,.94,.06),WALNUT,.008)
        border('Dado raised bronze panel',x,.79,-.538,step-.38,.70,.010,BRONZE)
        box('Inset oxblood wall panel',(x,3.84,-.491),(step-.34,4.59,.04),OXBLOOD,.005)
        border('Panel limestone surround',x,3.84,-.521,step-.33,4.60,.023,STONE)
        border('Panel gilt inner bead',x,3.84,-.544,step-.48,4.43,.008,GOLD)
        cast_fan('Wall fan',x,5.02,-.555,.74,.74)
        stepped_border('Stepped lower wall panel',x,3.16,-.539,step-.74,2.62,.16,.012,GOLD)
        # A geometric pendant gives each panel a clear secondary focal point.
        for offset in [-.15,0,.15]:
            top=4.29-abs(offset)*1.4;bottom=2.49+abs(offset)*1.4
            relief('Deco pendant reed',[(x+offset-.019,bottom),(x+offset+.019,bottom),
                (x+offset+.019,top-.10),(x+offset,top),(x+offset-.019,top-.10)],-.557,.018,BRONZE)
        for y,scale in [(4.04,.24),(3.86,.17),(2.73,.17)]:
            line('Pendant chevron',[(x-scale,y+.11,-.562),(x,y,-.562),(x+scale,y+.11,-.562)],.013,GOLD)
        for side_x in [-1,1]:
            relief('Dado corner inlay',[(x+side_x*(step/2-.27),.52),
                (x+side_x*(step/2-.27),1.06),(x+side_x*(step/2-.40),1.06),
                (x+side_x*(step/2-.40),.64),(x+side_x*(step/2-.62),.64),
                (x+side_x*(step/2-.62),.52)],-.551,.010,BRONZE)
        for px in [x-step/2+.055,x+step/2-.055]:
            box('Wall fluted stile',(px,3.83,-.513),(.075,4.61,.075),STONE,.008)
            box('Wall stile bronze reed',(px,3.83,-.558),(.014,4.47,.018),BRONZE,.003)

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
    stepped_border('Gate stepped lower escutcheon',center,.77,-.042,1.94,.83,.13,.011,BRONZE)
    box('Gate lock escutcheon',(side*.14,1.45,-.072),(.15,.30,.04),BRONZE,.025)
    line('Gate rounded pull',[(side*.14,1.35,-.092),(side*.14,1.37,-.145),(side*.14,1.53,-.145),(side*.14,1.55,-.092)],.015,GOLD)
# Hinges and shoe rails give the closed grille a credible fitted frame.
for side in [-1,1]:
    for y in [.43,1.53,2.68]:
        rod('Gate barrel hinge',(side*2.37,y-.085,.012),(side*2.37,y+.085,.012),.037,BRONZE)
    for x in np.linspace(.25,2.13,7):
        x=float(x)*side
        line('Gate lower diamond',[(x,.37,-.021),(x+.10,.58,-.021),(x,.79,-.021),(x-.10,.58,-.021),(x,.37,-.021)],.010,BRONZE)
box('Purchase plaque enamel backing',(0,1.86,-.105),(3.2,.46,.035),OXBLOOD,.018)
border('Purchase plaque bronze rim',0,1.86,-.126,3.15,.405,.015,GOLD)

# Save the same aligned placement in the editable source and the exports.
for o in PARTS['portal']:o.location.y+=.13
# Save named editable originals before generating reflected material batches.
bpy.context.scene['authorship']='Original full-height smoky oxblood, limestone and champagne brass hotel facade; generated locally'
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

# Architectural study shows aligned assemblies; staging is not exported.
GROUP='portal'
box('Preview floor',(0,-.04,0),(30,.06,30),STONE,0)
for name,position,power,size in [('Key',(-4,7,-6),1800,7),('Fill',(5,4,-4),1200,6),('Rim',(0,6,4),1800,5)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(o);o.location=xyz(position)
    o.rotation_euler=(Vector(xyz((0,2,0)))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=xyz((10,7.0,-18)));camera=bpy.context.object
camera.rotation_euler=(Vector(xyz((0,3.4,0)))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=16.5
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.world.color=(.12,.12,.12)
scene.render.filepath=str(DOC/'preview.png');scene.render.image_settings.file_format='PNG';bpy.ops.render.render(write_still=True)
print('ENTRY_COMPLETE',json.dumps(reports))
