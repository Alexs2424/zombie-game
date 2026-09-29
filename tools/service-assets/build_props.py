"""Build the original casino loading/service corridor props in Blender 5.x.

Run: blender --background --python tools/service-assets/build_props.py
All dimensions use game metres (X, Y-up, Z); Blender=(x,-z,y). The export
reflects X for Babylon's default left-handed glTF conversion root. Keep that
root when loading. The source retains editable objects; export joins material
batches. Preview shell, camera, and lights are excluded from the runtime GLB.
"""
from pathlib import Path
import bpy, bmesh, math, json, random, os, subprocess
import numpy as np
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
# Read the same wall faces used by the renderer, keeping fixtures attached when
# the room dimensions change. NODE_BINARY may select a Node 22.13+ installation.
MOUNTS = json.loads(subprocess.check_output([
    os.environ.get('NODE_BINARY', 'node'), '--experimental-strip-types', '--input-type=module', '-e',
    "import { SERVICE_ASSET_MOUNTS } from './lib/game/service-layout.ts'; console.log(JSON.stringify(SERVICE_ASSET_MOUNTS));",
], cwd=ROOT, text=True))
SOURCE = ROOT/'assets/source/service-props.blend'
EXPORT = ROOT/'public/models/service-props.glb'
DOCS = ROOT/'docs/service-assets'
for p in [SOURCE.parent, EXPORT.parent, DOCS]: p.mkdir(parents=True, exist_ok=True)
random.seed(918)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
ASSETS = bpy.data.collections.get('Collection'); ASSETS.name = 'SERVICE — editable original props'
STAGE = bpy.data.collections.new('PREVIEW ONLY — excluded from GLB'); bpy.context.scene.collection.children.link(STAGE)
GROUP='unassigned'; PI=math.pi

def xyz(p): return (p[0], -p[2], p[1])
def register(o,name,mat,stage=False):
    o.name=name; o['assembly']=GROUP; o['authorship']='Original Blender service corridor asset'
    if mat:o.data.materials.append(mat)
    for c in list(o.users_collection):c.objects.unlink(o)
    (STAGE if stage else ASSETS).objects.link(o)
    return o
def material(name,color,metal=0,rough=.5,emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*color,1); return m
STEEL=material('01 — satin galvanized steel',(.29,.36,.37),.75,.37)
DARK=material('02 — charcoal rubber and markings',(.019,.027,.030),0,.79)
TEAL=material('03 — petrol blue powder coat',(.075,.19,.19),.45,.37)
ORANGE=material('04 — safety ochre enamel',(.88,.32,.055),.3,.38)
CARD=material('05 — kraft cardboard',(.47,.28,.12),0,.84)
PALECARD=material('06 — light kraft cardboard',(.65,.45,.25),0,.83)
TAPE=material('07 — brown packing tape',(.60,.36,.14),.05,.36)
WOOD=material('08 — sawn pallet timber',(.40,.25,.115),0,.86)
PAPER=material('09 — aged white printed labels',(.78,.79,.68),0,.81)
YELLOW=material('10 — faded safety yellow',(.70,.55,.14),.07,.66)
RED=material('11 — fire equipment enamel',(.54,.032,.019),.34,.31)
BLUE=material('12 — blue polypropylene tote',(.055,.14,.24),0,.51)
LIT=material('13 — fluorescent opal diffuser',(.78,.92,1),0,.3,2.4)
RUST=material('14 — restrained oxidized hardware',(.25,.12,.045),.35,.82)

# Small original mathematical grain maps are embedded, avoiding external assets.
def grain(mat,kind):
    n=256; v,u=np.mgrid[0:n,0:n].astype(np.float32)/n
    rng=np.random.default_rng(271 if kind=='card' else 817)
    noise=(rng.random((n,n))-.5)*.027
    if kind=='wood':
        stripe=np.sin((v+.009*np.sin(u*13))*680)*.019 + np.sin(v*173+np.sin(u*9))*.02
        base=np.array([.40,.25,.115]); variation=noise+stripe
    else:
        base=np.array([.47,.28,.12]) if mat==CARD else np.array([.65,.45,.25]);variation=noise+np.sin(v*710)*.007
    pix=np.ones((n,n,4),np.float32);pix[:,:,:3]=np.clip(base[None,None,:]+variation[:,:,None],0,1)
    im=bpy.data.images.new('Service original '+kind+' grain '+mat.name,width=n,height=n,alpha=True)
    im.pixels.foreach_set(pix.reshape(-1));im.pack()
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
    mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for m,k in [(CARD,'card'),(PALECARD,'card'),(WOOD,'wood')]:grain(m,k)

def bevel(o,w=.012,segments=2):
    if w:
        mod=o.modifiers.new('Manufactured softened edges','BEVEL');mod.width=w;mod.segments=segments
        mod=o.modifiers.new('Face weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    return o
def cube(name,loc,size,mat,b=.01,stage=False):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(loc))
    o=register(bpy.context.object,name,mat,stage);o.scale=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return bevel(o,b)
def rod(name,a,b,r,mat,vertices=12):
    av,bv=Vector(xyz(a)),Vector(xyz(b)); d=bv-av
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(av+bv)/2)
    o=register(bpy.context.object,name,mat);o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    for p in o.data.polygons:p.use_smooth=True
    return o
def tube(name,points,r,mat):
    crv=bpy.data.curves.new(name,'CURVE');crv.dimensions='3D';crv.resolution_u=1
    spl=crv.splines.new('POLY');spl.points.add(len(points)-1)
    for p,co in zip(spl.points,points):p.co=(*xyz(co),1)
    crv.bevel_depth=r;crv.bevel_resolution=1
    o=bpy.data.objects.new(name,crv);ASSETS.objects.link(o);o['assembly']=GROUP;crv.materials.append(mat);return o
def text(name,txt,loc,size,mat,front=1):
    crv=bpy.data.curves.new(name,'FONT');crv.body=txt;crv.size=size;crv.align_x='CENTER';crv.align_y='CENTER';crv.resolution_u=2
    crv.extrude=.0005
    o=bpy.data.objects.new(name,crv);ASSETS.objects.link(o);o.location=xyz(loc);o.rotation_euler=(PI/2,0,0 if front==1 else PI)
    crv.materials.append(mat);o['assembly']=GROUP;return o
def bolt(name,x,y,z,front=1,r=.012):return rod(name,(x,y,z),(x,y,z+front*.011),r,STEEL,6)
def disk(name,x,y,z,r,depth,mat):return rod(name,(x,y-depth/2,z),(x,y+depth/2,z),r,mat,20)

def pallet(name,x,z,w=1.5,d=1.45,y=0):
    # Three skids, nine spacer blocks, five top boards, and visible nail heads.
    for dx in [-w*.38,0,w*.38]:
        cube(name+' lower runner',(x+dx,y+.025,z),(w*.16,.05,d),WOOD,.007)
        for dz in [-d*.37,0,d*.37]:cube(name+' spacer block',(x+dx,y+.092,z+dz),(w*.16,.084,d*.15),WOOD,.009)
    for i in range(6):
        dz=-d/2+d/12+i*d/6
        cube(name+' individual deck board',(x,y+.157,z+dz),(w,.048,d*.137),WOOD,.007)
        for dx in [-w*.38,w*.38]:
            disk(name+' flush iron deck nail',x+dx,y+.182,z+dz,.006,.002,DARK)
    for dx in [-w*.46,w*.46]:
        for dz in [-d*.36,d*.30]:cube(name+' timber end scuff',(x+dx,y+.153,z+dz),(.045,.021,.0018),PALECARD,.001)

def carton(name,x,y,z,w,h,d,light=False,front=1,number=1):
    # y is the bottom, separated flaps/tape are modeled, not a plain cube.
    m=PALECARD if light else CARD
    cube(name+' corrugated body',(x,y+h/2,z),(w,h,d),m,.015)
    # Top flap seam and narrow folded lower seam.
    cube(name+' center top seam',(x,y+h+.0008,z),(.006,.002,d-.02),DARK,.0006)
    cube(name+' folded lid left',(x-w*.25,y+h+.003,z),(w*.5-.012,.005,d-.028),m,.001)
    cube(name+' folded lid right',(x+w*.25,y+h+.003,z),(w*.5-.012,.005,d-.028),m,.001)
    cube(name+' sealing tape',(x,y+h+.008,z),(.084,.004,d+.004),TAPE,.001)
    for side in [-1,1]:
        zz=z+side*(d/2+.002)
        cube(name+' tape folded down',(x,y+h-.07,zz),(.084,.15,.004),TAPE,.001)
        cube(name+' end fold lower',(x,y+.055,zz),(w-.05,.008,.002),TAPE,.001)
    fz=z+front*(d/2+.006)
    # Cream shipping label with barcode, ruled destination blocks, corner mark.
    lx=x+w*.10;ly=y+h*.44;lw=min(.25,w*.49);lh=min(.17,h*.39)
    cube(name+' shipping paper',(lx,ly,fz),(lw,lh,.002),PAPER,.0008)
    for i in range(15):
        bw=.0022 if i%3 else .0045
        cube(name+' barcode %02d'%i,(lx-lw*.40+i*lw*.054,ly-lh*.18,fz+front*.002),(bw,lh*.36,.001),DARK,0)
    for i in range(3):cube(name+' address rule',(lx-lw*.07,ly+lh*(.22-i*.09),fz+front*.002),(lw*(.70-i*.08),.004,.001),DARK,0)
    # Paired upright arrows, clear printed handling marks near opposite corner.
    for dx in [-w*.33,-w*.25]:
        cube(name+' up arrow shaft',(x+dx,y+h*.48,fz),(.006,.052,.002),DARK,0)
        for s in [-1,1]:
            o=cube(name+' up arrow tip',(x+dx+s*.008,y+h*.503+.012,fz),(.021,.005,.002),DARK,0);o.rotation_euler.y=s*PI/4
    cube(name+' fragile underline',(x-w*.29,y+h*.365,fz),(w*.18,.005,.002),DARK,0)

# MAIN DELIVERY STACK — deliberately leaves the central route open.
GROUP='delivery_pallet'
pallet('Delivery timber pallet',14.5,5.45,1.62,1.94)
for layer in range(2):
    for ix in range(2):
        for iz in range(2):
            carton('Delivery carton %d%d%d'%(layer,ix,iz),14.5+(ix-.5)*.76,.183+layer*.535,5.45+(iz-.5)*.86,.72,.51,.82,light=(layer+ix+iz)%3==0,front=1)
carton('Top shallow carton',14.12,1.253,5.02,.71,.36,.78,True)
carton('Top service carton',14.87,1.253,5.48,.70,.50,.78,False)
# Non-crossing straps visually bind a believable shipment.
for x in [14.05,14.95]:
    for z in [4.475,6.425]:cube('Pallet corner inspection sticker',(x,.138,z),(.14,.035,.003),PAPER,.001)

# INDUSTRIAL SHELF — folded steel posts, punched slots, cross bracing, totes.
GROUP='storage_shelf'
sx,sz=6.5,11.25
for x in [5.245,7.755]:
    for z in [10.78,11.72]:
        cube('Shelf upright folded face',(x,1.355,z),(.058,2.65,.052),TEAL,.005)
        cube('Shelf upright return flange',(x+.029,1.355,z+.022),(.057,2.65,.015),TEAL,.003)
        cube('Shelf bolted floor plate',(x,.025,z),(.17,.045,.15),STEEL,.005)
        for y in np.arange(.19,2.6,.20):cube('Shelf punched adjustment slot',(x,y,z-.028),(.016,.044,.002),DARK,.004)
        for dx in [-.05,.05]:disk('Shelf floor anchor bolt',x+dx,.052,z,.012,.015,STEEL)
for y in [.20,1.02,1.83,2.61]:
    cube('Shelf folded shelf pan',(sx,y,sz),(2.59,.055,1.00),STEEL,.007)
    for z in [10.738,11.762]:cube('Shelf safety orange beam',(sx,y-.036,z),(2.62,.075,.035),ORANGE,.004)
    cube('Shelf front readable capacity tab',(7.35,y-.037,10.715),(.20,.04,.003),PAPER,.002)
for y in [.4,1.3]:
    tube('Shelf diagonal rear brace',[(5.24,y,11.756),(7.75,y+1.10,11.756)],.013,STEEL)
    tube('Shelf opposing rear brace',[(7.75,y,11.765),(5.24,y+1.10,11.765)],.013,STEEL)
for x in [5.60,6.40,7.20]:carton('Shelf lower bulk carton',x,.234,11.24,.69,.61,.82,light=x>6.5,front=-1)
carton('Shelf mid stores carton',5.60,1.052,11.26,.66,.57,.80,True,-1)
carton('Shelf upper stores carton',5.64,1.862,11.22,.72,.54,.78,False,-1)
carton('Shelf upper paper carton',6.45,1.862,11.26,.72,.48,.82,True,-1)
def tote(name,x,y,z,w=.62):
    cube(name+' recessed shadow interior',(x,y+.145,z),(w-.04,.25,.70),DARK,.018)
    cube(name+' base',(x,y+.025,z),(w,.05,.74),BLUE,.015)
    for dz in [-.345,.345]:
        cube(name+' wall',(x,y+.16,z+dz),(w,.27,.045),BLUE,.013)
        cube(name+' rolled upper rim',(x,y+.30,z+dz),(w+.035,.035,.062),BLUE,.008)
    for dx in [-w/2+.019,w/2-.019]:cube(name+' end wall',(x+dx,y+.16,z),(.045,.27,.72),BLUE,.011)
    cube(name+' inset carry grip',(x,y+.237,z-.371),(.21,.060,.004),DARK,.018)
    for dx in [-w*.34,-w*.16,w*.16,w*.34]:cube(name+' molded stiffening rib',(x+dx,y+.12,z-.374),(.021,.16,.015),BLUE,.004)
    cube(name+' contents label',(x,y+.094,z-.381),(.14,.049,.002),PAPER,.002)
tote('Middle shelf tote',6.45,1.05,11.25)
tote('Middle shelf tools tote',7.20,1.05,11.25)
tote('Upper shelf tote',7.27,1.86,11.25,.52)
text('Shelf stores identification','STORES / 02',(6.5,2.62,10.711),.095,DARK,-1)

# PALLET JACK — low cargo, twin forks, castors, hydraulic barrel, loop handle.
GROUP='pallet_jack'
px,pz=13.9,10.95
# Overall intended envelope x12.55..15.25,z10.30..11.60.
for z in [pz-.34,pz+.34]:
    cube('Jack long forged lifting fork',(13.57,.138,z),(1.82,.12,.22),ORANGE,.032)
    cube('Jack black fork tip',(12.69,.105,z),(.16,.045,.18),DARK,.016)
    for x in [12.80,13.12]:rod('Jack front load roller',(x,.074,z-.105),(x,.074,z+.105),.065,DARK,20)
cube('Jack fork cross member',(14.39,.22,pz),(.25,.25,.92),ORANGE,.025)
cube('Jack rounded pump housing',(14.56,.30,pz),(.37,.40,.40),ORANGE,.038)
rod('Jack hydraulic piston',(14.59,.34,pz),(14.59,.65,pz),.048,STEEL,16)
for z in [pz-.22,pz+.22]:
    rod('Jack steering wheel',(14.66,.115,z-.045),(14.66,.115,z+.045),.112,DARK,24)
    rod('Jack wheel inset hub',(14.66,.115,z-.05),(14.66,.115,z+.05),.046,STEEL,16)
tube('Jack raked handle stem',[(14.59,.57,pz),(14.89,1.02,pz),(14.98,1.11,pz)],.033,DARK)
tube('Jack oval loop handle',[(14.90,1.04,pz-.22),(15.05,1.26,pz-.22),(15.10,1.29,pz-.15),(15.10,1.29,pz+.15),(15.05,1.26,pz+.22),(14.90,1.04,pz+.22),(14.90,1.04,pz-.22)],.035,DARK)
rod('Jack handle release lever',(14.99,1.14,pz-.14),(14.99,1.14,pz+.14),.018,STEEL)
cube('Jack chassis serial plate',(14.762,.34,pz),(.003,.12,.21),PAPER,.003)
pallet('Jack cargo pallet',13.38,pz,1.30,1.10,.16)
for ix in range(2):
    carton('Jack cargo taped carton',13.06+ix*.63,.343,pz,.59,.52,1.02,ix==1,-1)
carton('Jack upper flat carton',13.37,.873,pz,1.20,.27,.91,True,-1)
# Very fine black tie bands hug the load rather than adding a gameplay obstacle.
for x in [12.95,13.80]:
    cube('Jack cargo tension band',(x,1.151,pz),(.025,.004,.93),DARK,.001)
    for z in [pz-.511,pz+.511]:cube('Jack cargo vertical band',(x,.60,z),(.025,.52,.003),DARK,.001)

# UTILITY CABINET — outside travel lane, pressed door and louver vents.
GROUP='utility_cabinet'
cx,cz=15.25,6.91
cube('Utility cabinet dark plinth',(cx,.05,cz),(.63,.10,.64),DARK,.013)
cube('Utility cabinet steel housing',(cx,1.025,cz),(.66,1.95,.65),TEAL,.025)
cube('Utility cabinet recessed door',(cx,1.10,cz+.331),(.59,1.73,.025),STEEL,.012)
for y in [.47,.55,.63,1.55,1.63,1.71]:
    cube('Cabinet dark louver slot',(cx,y,cz+.347),(.39,.025,.003),DARK,.005)
    cube('Cabinet pressed louver lip',(cx,y+.017,cz+.355),(.41,.015,.016),TEAL,.004)
cube('Cabinet latch backing',(cx-.21,1.07,cz+.348),(.043,.17,.010),DARK,.005)
rod('Cabinet chrome pull',(cx-.21,1.025,cz+.35),(cx-.21,1.135,cz+.35),.012,STEEL)
for y in [.35,1.8]:cube('Cabinet hinge',(cx+.31,y,cz+.35),(.028,.12,.022),STEEL,.005)
cube('Cabinet hazard plaque',(cx,1.32,cz+.348),(.19,.11,.003),YELLOW,.004)
text('Cabinet high voltage icon','!',(cx,1.32,cz+.352),.08,DARK)

# WALL EQUIPMENT — mounted at 1.6 m and higher on the rear service wall.
GROUP='wall_services'
for x,w,h,y in [(8.12,.57,.79,2.00),(7.36,.53,.61,2.09)]:
    cube('Wall switchgear mounting plate',(x,y,11.873),(w+.06,h+.06,.027),DARK,.008)
    cube('Wall switchgear enclosure',(x,y,11.79),(w,h,.17),STEEL,.020)
    cube('Wall switchgear raised front door',(x,y,11.697),(w-.043,h-.045,.020),TEAL,.009)
    for dx in [-w*.39,w*.39]:
        for dy in [-h*.41,h*.41]:bolt('Switchgear captive screw',x+dx,y+dy,11.683,-1,.010)
    cube('Switchgear engraved identifier',(x,y+h*.23,11.684),(w*.69,.08,.003),PAPER,.002)
    cube('Switchgear yellow warning plate',(x-.11,y-.11,11.684),(.12,.14,.003),YELLOW,.002)
    cube('Switchgear disconnect lever',(x+.15,y-.10,11.665),(.034,.19,.047),DARK,.005)
    tube('Switchgear incoming conduit',[(x,y+h/2,11.78),(x,3.23,11.78),(x+.20,3.43,11.78),(8.93,3.43,11.78),(8.93,3.43,11.90)],.026,STEEL)
    for yy in [2.76,3.17]:cube('Conduit wall saddle',(x,yy,11.82),(.095,.044,.135),STEEL,.005)
text('Electrical circuit identifier','POWER / 03',(8.12,2.185,11.680),.058,DARK,-1)
cube('Service wayfinding sign',(10.10,2.92,11.874),(2.0,.49,.025),TEAL,.016)
text('Receiving direction sign','RECEIVING  /  02',(10.10,2.94,11.857),.14,PAPER,-1)
text('Receiving safety subline','KEEP ACCESS CLEAR',(10.10,2.78,11.856),.065,YELLOW,-1)

# OVERHEAD PIPEWORK — unions, valve wheels, hangers, inspection bands.
GROUP='overhead_services'
for z,r in [(5.44,.071),(6.03,.051)]:
    # Both pipe runs enter a real wall instead of ending in open air.
    east=MOUNTS['east']
    tube('Main suspended service pipe',[(MOUNTS['west']-.025,4.12,z),(east-.30,4.12,z),(east-.14,3.96,z),(east-.14,3.36,z),(east+.025,3.36,z)],r,TEAL if r>.06 else STEEL)
    for x in [5.5,8.65,11.8,14.66]:
        rod('Pipe compression sleeve',(x-.065,4.12,z),(x+.065,4.12,z),r+.022,STEEL,16)
        for dx in [-.068,.068]:rod('Pipe union rim',(x+dx-.008,4.12,z),(x+dx+.008,4.12,z),r+.033,DARK,16)
    for x in [5.3,8.6,11.9,14.8]:
        rod('Threaded pipe suspension',(x,4.15,z),(x,MOUNTS['ceiling']-.02,z),.011,STEEL,8)
        cube('Suspension ceiling anchor',(x,MOUNTS['ceiling']-.02,z),(.12,.04,.10),STEEL,.005)
        rod('Suspended pipe clamp',(x-.035,4.12,z),(x+.035,4.12,z),r+.035,STEEL,16)
    for x in [7.0,12.5]:rod('Pipe identification collar',(x-.042,4.12,z),(x+.042,4.12,z),r+.002,YELLOW,16)
    rod('Pipe valve body',(10.0,4.12,z),(10.26,4.12,z),r+.033,STEEL,16)
    rod('Valve spindle',(10.13,4.12,z),(10.13,3.91,z),.026,STEEL,12)
    pts=[(10.13+.145*math.cos(a),3.90,z+.145*math.sin(a)) for a in np.linspace(0,2*PI,25)]
    tube('Red service valve wheel',pts,.015,RED)
    for a in [0,PI/2,PI,3*PI/2]:tube('Valve wheel spoke',[(10.13,3.90,z),(10.13+.143*math.cos(a),3.90,z+.143*math.sin(a))],.010,RED)
for x,z in [(7.5,8.6),(12.9,8.6),(12.9,4.3)]:
    cube('Fluorescent fixture steel body',(x,4.55,z),(1.74,.14,.33),STEEL,.024)
    cube('Fluorescent dark reflector',(x,4.465,z),(1.59,.032,.27),DARK,.01)
    for zz in [z-.079,z+.079]:
        rod('Fluorescent opal tube',(x-.71,4.44,zz),(x+.71,4.44,zz),.027,LIT,12)
        for dx in [-.735,.735]:cube('Fluorescent tube ceramic socket',(x+dx,4.46,zz),(.06,.09,.083),PAPER,.009)
    for dx in [-.54,.54]:rod('Fixture ceiling drop',(x+dx,4.6,z),(x+dx,MOUNTS['ceiling'],z),.018,STEEL,8)

# FIRE POINT — wall-mounted, does not claim a walkable floor footprint.
GROUP='fire_point'
cube('Fire point wall backplate',(9.03,1.23,3.25),(.41,1.28,.05),DARK,.012)
rod('Extinguisher red cylinder',(9.03,.87,3.39),(9.03,1.46,3.39),.13,RED,24)
disk('Extinguisher rounded bottom',9.03,.875,3.39,.124,.075,RED)
disk('Extinguisher neck',9.03,1.486,3.39,.056,.09,STEEL)
cube('Extinguisher white instruction label',(9.03,1.155,3.521),(.15,.27,.003),PAPER,.006)
for y in [1.23,1.19,1.15,1.11]:cube('Extinguisher instruction text rule',(9.03,y,3.524),(.11,.008,.001),DARK,0)
tube('Extinguisher black delivery hose',[(9.07,1.49,3.4),(9.23,1.48,3.4),(9.26,1.35,3.4),(9.25,.91,3.4)],.021,DARK)
cube('Extinguisher squeeze handle',(9.03,1.56,3.39),(.22,.035,.056),RED,.008)
rod('Extinguisher pressure gauge',(9.03,1.50,3.425),(9.03,1.50,3.47),.036,STEEL,16)
rod('Extinguisher gauge face',(9.03,1.50,3.47),(9.03,1.50,3.477),.029,PAPER,16)
cube('Fire extinguisher location sign',(9.03,2.05,3.26),(.48,.51,.032),RED,.012)
text('Fire point sign label','FIRE',(9.03,2.09,3.28),.12,PAPER)
text('Fire point sign arrow','V',(9.03,1.93,3.28),.12,PAPER)

# The furnishings still use their original local coordinates; only equipment
# attached to walls follows the enlarged supply room's actual interior faces.
for o in ASSETS.objects:
    if o.get('assembly') == 'wall_services':
        o.location.y -= MOUNTS['north'] - 11.8865
    elif o.get('assembly') == 'fire_point':
        o.location.y -= MOUNTS['south'] - 3.225

# LOW PROFILE FLOOR STENCILS — raised above the runtime floor and its joints.
GROUP='floor_markings'
for z in [7.59,9.61]:
    for x in np.arange(4.75,15.5,1.22):cube('Worn pedestrian route dash',(float(x),.020,z),(.67,.003,.040),YELLOW,.001)
for z in [4.21,7.11]:cube('Truck bay long boundary',(7.8,.020,z),(5.75,.003,.048),YELLOW,.001)
for x in [4.92,10.68]:cube('Truck bay end boundary',(x,.020,5.66),(.048,.003,2.95),YELLOW,.001)
for x in np.arange(5.04,10.57,.38):
    o=cube('Loading bay diagonal safety hatch',(float(x),.020,7.0),(.18,.003,.21),YELLOW,.001);o.rotation_euler.z=-PI/5

CONTRACT={
 'delivery_pallet':{'center':[14.5,5.45],'footprint':[1.7,2.1],'height':1.9,'solid':True},
 'storage_shelf':{'center':[6.5,11.25],'footprint':[2.7,1.1],'height':2.7,'solid':True},
 'pallet_jack':{'center':[13.9,10.95],'footprint':[2.7,1.3],'height':1.35,'solid':True},
 'utility_cabinet':{'center':[15.25,6.91],'footprint':[.7,.75],'height':2.0,'solid':True},
 'wall_services':{'solid':False,'notes':'Rear wall mounted; bottom height >=1.57m. No floor obstacle.'},
 'overhead_services':{'solid':False,'notes':'All geometry higher than 3.3m; cross-room passage remains clear.'},
 'fire_point':{'solid':False,'notes':'South wall mounted extinguisher and locator sign.'},
 'floor_markings':{'solid':False,'notes':'Paint is 3mm thick at world Y .020, above runtime floor/joints. Preview floor and shell are excluded.'},
}
def report(objects):
    d={'coordinateSystem':'Intended game metres Y-up. Source Blender=(x,-z,y); export reflects X for default Babylon LH root.','wallMounts':MOUNTS,'assemblies':{}}
    deps=bpy.context.evaluated_depsgraph_get()
    for o in objects:
        ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();key=o['assembly']
        a=d['assemblies'].setdefault(key,{'objects':0,'triangles':0,'min':[1e6]*3,'max':[-1e6]*3,'collisionContract':CONTRACT[key]})
        a['objects']+=1;a['triangles']+=len(me.loop_triangles)
        for v in me.vertices:
            b=o.matrix_world@v.co;co=(b.x,b.z,-b.y)
            for j in range(3):a['min'][j]=min(a['min'][j],co[j]);a['max'][j]=max(a['max'][j],co[j])
        ev.to_mesh_clear()
    for a in d['assemblies'].values():
        a['min']=[round(v,5) for v in a['min']];a['max']=[round(v,5) for v in a['max']]
        c=a['collisionContract']
        if c.get('solid'):
            x,z=c['center'];w,dep=c['footprint']
            assert a['min'][0]>=x-w/2-.002 and a['max'][0]<=x+w/2+.002, (c,a)
            assert a['min'][2]>=z-dep/2-.002 and a['max'][2]<=z+dep/2+.002, (c,a)
            assert a['max'][1]<=c['height']+.002,(c,a)
    d['triangles']=sum(a['triangles'] for a in d['assemblies'].values());d['sourceObjects']=len(objects)
    assert d['triangles']<80000,d['triangles']
    return d
ASSET_OBJECTS=list(ASSETS.objects);LETTERS={o.name for o in ASSET_OBJECTS if o.type=='FONT'};QA=report(ASSET_OBJECTS)

# Preview scene: neutral utility shell, industrial lighting, source art study.
GROUP='preview'
FLOOR=material('Preview sealed concrete',(.12,.145,.15),.08,.62)
WALL=material('Preview service wall',(.28,.33,.33),0,.78)
centerX=(MOUNTS['west']+MOUNTS['east'])/2;centerZ=(MOUNTS['south']+MOUNTS['north'])/2
roomW=MOUNTS['east']-MOUNTS['west'];roomD=MOUNTS['north']-MOUNTS['south']
cube('Preview floor',(centerX,-.06,centerZ),(roomW,.12,roomD),FLOOR,.01,True)
cube('Preview north wall',(centerX,2.4,MOUNTS['north']+.05),(roomW,4.8,.10),WALL,.01,True)
cube('Preview east wall',(MOUNTS['east']+.05,2.4,centerZ),(.10,4.8,roomD),WALL,.01,True)
for z in [5.1,7.4,9.7]:cube('Preview concrete floor joint',(10,.0002,z),(12,.0002,.011),DARK,0,True)
def area(name,loc,power,col,size,target):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=col;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);STAGE.objects.link(o);o.location=xyz(loc);o.rotation_euler=(Vector(xyz(target))-o.location).to_track_quat('-Z','Y').to_euler()
area('Soft cool service key',(7,7.3,8),2300,(.69,.85,1),7,(10,0,8))
area('Warm loading bay fill',(12,6,2),1800,(1,.77,.47),7,(12,1,7))
area('Shelf face softbox',(4,4.2,6),900,(.85,.91,1),5,(7,1.3,11))
area('Pallet edge softbox',(12,4,8),550,(1,.89,.73),4,(14.5,1,5.5))
cam=bpy.data.cameras.new('Props study camera');co=bpy.data.objects.new('Props study camera',cam);STAGE.objects.link(co)
co.location=xyz((-.7,9.0,-1.3));co.rotation_euler=(Vector(xyz((10.3,1.8,7.6)))-co.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=16.5
scene=bpy.context.scene;scene.camera=co;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1150;scene.render.resolution_percentage=100
scene.world.color=(.16,.16,.16);scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(DOCS/'props-preview.png')
scene['asset_contract']=json.dumps(CONTRACT);scene['rebuild_command']='blender --background --python tools/service-assets/build_props.py'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))

# Preserve source components, convert/pack export by material, then mirror X.
bpy.ops.object.select_all(action='DESELECT')
for o in ASSET_OBJECTS:o.select_set(True)
bpy.context.view_layer.objects.active=ASSET_OBJECTS[0];bpy.ops.object.convert(target='MESH');objects=list(bpy.context.selected_objects)
reflection=Matrix.Diagonal((-1.0,1.0,1.0,1.0))
def reverse(o):
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update()
for o in objects:
    if o.name in LETTERS:o.data.transform(reflection);reverse(o)
groups={}
for o in objects:groups.setdefault(o.data.materials[0].name,[]).append(o)
exported=[]
for name,obs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    if len(obs)>1:bpy.ops.object.join()
    o=bpy.context.object;o.name='Service corridor / '+name;o['assembly']='material_batch';exported.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exported:
    o.data.transform(reflection@o.matrix_world);o.matrix_world=Matrix.Identity(4);reverse(o);o.select_set(True)
bpy.context.view_layer.objects.active=exported[0]
bpy.ops.export_scene.gltf(filepath=str(EXPORT),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
QA['exportMeshes']=len(exported);QA['glbBytes']=EXPORT.stat().st_size;QA['materials']=len(groups)
QA['runtimeCoordinateSystem']='Reflected export X; retain default Babylon __root__ conversion for intended game world bounds.'
QA['letteringOrientation']='Text reflected locally for reading order in Babylon left-handed camera; source preview retains Blender reading order.'
assert QA['glbBytes']<6*1024*1024,QA['glbBytes']
(DOCS/'props-report.json').write_text(json.dumps(QA,indent=2))
print('SERVICE_PROPS_REPORT',json.dumps(QA))
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.ops.render.render(write_still=True)
print('SERVICE_PROPS_COMPLETE',str(EXPORT))
