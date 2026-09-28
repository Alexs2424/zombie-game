"""Create the original LAST CALL Art Deco lounge set in Blender.

Run with Blender 5.x:
  blender --background --python tools/bar-assets/build_lounge.py

All public geometry is authored in game metres through world=(x,y,z), Y up.
Blender coordinates are (x,-z,y); the game export reflects X so Babylon's
default left-handed glTF root restores the intended world coordinates.
The source keeps separate named furniture components; the GLB is consolidated
by material. Preview-only floor/walls/lights/camera are excluded from export.
No external assets, photos, fonts or texture downloads are required.
"""
from pathlib import Path
import bpy, math, json, random, numpy as np
from mathutils import Vector, Matrix
import bmesh

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/source/last-call-lounge.blend'
EXPORT = ROOT / 'public/models/last-call-lounge.glb'
DOCS = ROOT / 'docs/bar-assets'
TEX = DOCS / 'textures'
for p in [SOURCE.parent, EXPORT.parent, DOCS, TEX]: p.mkdir(parents=True, exist_ok=True)
random.seed(2431)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
FURN = bpy.data.collections.get('Collection')
FURN.name = 'LAST CALL — editable furniture'
STAGE = bpy.data.collections.new('PREVIEW ONLY — excluded from game')
bpy.context.scene.collection.children.link(STAGE)
GROUP = 'unassigned'
PI = math.pi

def xyz(p): return (p[0], -p[2], p[1])
def register(obj, name, material, stage=False):
    obj.name = name
    obj['assembly'] = GROUP
    obj['original_asset'] = 'LAST CALL / authored in Blender'
    if material: obj.data.materials.append(material)
    target = STAGE if stage else FURN
    for c in list(obj.users_collection): c.objects.unlink(obj)
    target.objects.link(obj)
    return obj

def material(name, color, metallic=0, roughness=.4, emission=None):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metallic
    p.inputs['Roughness'].default_value=roughness
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*color,1)
    return m

def analytic_texture(name, kind, size=512):
    """Create seamless mathematical base-color maps, packed into source/export."""
    v,u=np.mgrid[0:size,0:size].astype(np.float32)/size
    if kind=='marble':
        flow=8*u+3*v+.45*np.sin(2*PI*v)+.22*np.sin(8*PI*v+2*PI*u)
        thread=np.abs(np.sin(PI*flow))
        vein=np.exp(-thread*48)
        secondary=np.exp(-np.abs(np.sin(PI*(flow*2.13+.17*np.sin(v*24))))*90)
        cloud=.5+.5*np.sin(2*PI*(2*u+v)+np.sin(4*PI*v))
        rgb=np.zeros((size,size,3),np.float32)
        for ch,(base,gold) in enumerate(zip([.035,.043,.043],[.63,.43,.20])):
            rgb[:,:,ch]=base+cloud*.018+vein*gold*.52+secondary*.065
    elif kind=='wood':
        drift=.006*np.sin(u*PI*6)+.003*np.sin(u*PI*20)
        fine=np.sin((v+drift)*PI*256)*.012
        grain=np.sin((v+drift)*PI*42+.65*np.sin(v*PI*12))*.021
        bands=np.sin(v*PI*8+.5*np.sin(u*PI*2))*.018
        rgb=np.stack([.13+grain+bands+fine,.044+grain*.48+bands*.5+fine*.4,.017+grain*.18+bands*.2+fine*.2],axis=-1)
    else:
        rng=np.random.default_rng(264)
        grain=rng.random((size,size),dtype=np.float32)*.027
        pores=(np.sin(u*PI*246)*np.sin(v*PI*234))*.008
        rgb=np.stack([.24+grain+pores,.017+grain*.12,.041+grain*.28],axis=-1)
    rgba=np.ones((size,size,4),np.float32)
    rgba[:,:,:3]=np.clip(rgb,0,1)
    im=bpy.data.images.new(name,width=size,height=size,alpha=True)
    im.pixels.foreach_set(rgba.reshape(-1))
    im.filepath_raw=str(TEX/(name+'.png'));im.file_format='PNG';im.save();im.pack()
    return im

def textured(m, image):
    p=m.node_tree.nodes.get('Principled BSDF')
    t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])

BRASS=material('01 — antique champagne brass',(.66,.38,.115),.78,.28)
GOLD=material('02 — polished golden highlights',(.88,.63,.26),.80,.19)
MARBLE=material('03 — black gold-veined marble',(.07,.075,.074),.07,.22)
WALNUT=material('04 — bookmatched dark walnut',(.20,.07,.02),0,.35)
LEATHER=material('05 — oxblood pebbled leather',(.27,.02,.045),0,.44)
EBONY=material('06 — black lacquer',(.012,.02,.023),.2,.24)
MIRROR=material('07 — smoked bronze mirrors',(.16,.22,.23),.88,.20)
IVORY=material('08 — etched ivory paper',(.78,.69,.45),0,.68)
AMBER=material('09 — amber whisky crystal',(.34,.115,.025),.28,.23)
EMERALD=material('10 — emerald glass bottles',(.012,.145,.062),.3,.18)
RUBY=material('11 — ruby glass bottles',(.20,.012,.035),.3,.20)
TEAL=material('12 — teal glass bottles',(.012,.15,.20),.28,.2)
CRYSTAL=material('13 — champagne cut crystal',(.68,.73,.64),.4,.14)
LIT=material('14 — warm opal luminous glass',(1.0,.65,.28),0,.25,2.8)
PEARL=material('15 — warm ivory alabaster',(.72,.69,.52),.05,.32)
textured(MARBLE,analytic_texture('nero-marquina-gold','marble'))
textured(WALNUT,analytic_texture('smoked-walnut-grain','wood'))
textured(LEATHER,analytic_texture('oxblood-leather-grain','leather'))

def smooth(obj):
    if obj.type=='MESH':
        for p in obj.data.polygons:p.use_smooth=True
    return obj

def cube(name,loc,size,mat,bevel=.02,stage=False):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(loc))
    o=register(bpy.context.object,name,mat,stage)
    o.scale=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel>0:
        mod=o.modifiers.new('Hand-softened edges','BEVEL');mod.width=bevel;mod.segments=3
        mod=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    return o

def lathe(name,loc,profile,mat,segments=32):
    verts=[];faces=[]
    for h,r in profile:
        for i in range(segments):
            a=2*PI*i/segments
            verts.append(xyz((loc[0]+r*math.cos(a),loc[1]+h,loc[2]+r*math.sin(a))))
    for j in range(len(profile)-1):
        for i in range(segments):
            k=j*segments+i;n=j*segments+(i+1)%segments
            faces.append((k,k+segments,n+segments,n))
    faces.append(tuple(range(segments)))
    faces.append(tuple(reversed([(len(profile)-1)*segments+i for i in range(segments)])))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);FURN.objects.link(o);o['assembly']=GROUP;o.data.materials.append(mat)
    # Cylindrical UVs, with packed maps used only for selected material families.
    uv=me.uv_layers.new(name='UVMap')
    maxh=max(h for h,r in profile);minh=min(h for h,r in profile)
    for p in me.polygons:
        for li in p.loop_indices:
            vi=me.loops[li].vertex_index
            uv.data[li].uv=((vi%segments)/segments,(profile[vi//segments][0]-minh)/max(.001,maxh-minh))
    return smooth(o)

def cyl(name,loc,r,depth,mat,vertices=32):
    return lathe(name,(loc[0],loc[1]-depth/2,loc[2]),[(0,r),(.012,r),(max(.012,depth-.012),r),(depth,r)],mat,vertices)

def tube(name,points,r,mat,segments=6):
    crv=bpy.data.curves.new(name,'CURVE');crv.dimensions='3D';crv.resolution_u=1
    spl=crv.splines.new('POLY');spl.points.add(len(points)-1)
    for p,co in zip(spl.points,points):p.co=(*xyz(co),1)
    crv.bevel_depth=r;crv.bevel_resolution=1;crv.resolution_u=1
    o=bpy.data.objects.new(name,crv);FURN.objects.link(o);o['assembly']=GROUP;crv.materials.append(mat)
    return o

def ring(name,loc,r,t,mat,segments=48):
    pts=[(loc[0]+r*math.cos(i*2*PI/segments),loc[1],loc[2]+r*math.sin(i*2*PI/segments)) for i in range(segments+1)]
    return tube(name,pts,t,mat)

def pill(name,loc,size,mat):return cube(name,loc,size,mat,min(size)*.46)

def text(name,txt,loc,size,mat,align='CENTER'):
    crv=bpy.data.curves.new(name,'FONT');crv.body=txt;crv.size=size;crv.align_x=align;crv.align_y='CENTER'
    crv.extrude=.0015;crv.bevel_depth=.0006;crv.resolution_u=4
    o=bpy.data.objects.new(name,crv);FURN.objects.link(o);o.location=xyz(loc);o.rotation_euler=(PI/2,0,0)
    crv.materials.append(mat);o['assembly']=GROUP
    return o

def deco_fan(name,cx,y,z,r):
    # Vertical sunburst fan facing positive game Z.
    for i in range(9):
        a=PI*i/8
        tube(name+' ray '+str(i),[(cx,y,z),(cx+math.cos(a)*r,y+math.sin(a)*r,z)],.011,BRASS)
    for rad in [r*.66,r]:
        tube(name+' scallop',[(cx+math.cos(a)*rad,y+math.sin(a)*rad,z) for a in np.linspace(0,PI,33)],.012,BRASS)

def table(name,cx,cz,rx=.48,top=1.06,ry=None):
    ry=ry or rx
    # Pedestal base with tiered cast brass and smoked walnut central shaft.
    lathe(name+' stepped cast brass foot',(cx,0,cz),[(0,.29),(.025,.31),(.045,.31),(.065,.25),(.08,.24),(.12,.12),(.15,.10)],BRASS)
    lathe(name+' tapered fluted pedestal',(cx,.13,cz),[(0,.08),(.06,.075),(top-.23,.06),(top-.17,.11)],EBONY)
    for a in np.linspace(0,2*PI,13)[:-1]:
        tube(name+' stem gilding',[(cx+.071*math.cos(a),.19,cz+.071*math.sin(a)),(cx+.064*math.cos(a),top-.09,cz+.064*math.sin(a))],.007,BRASS)
    topobj=lathe(name+' marble oval',(cx,top-.075,cz),[(0,rx-.025),(.015,rx),(.055,rx),(.075,rx-.025)],MARBLE,48)
    # stretch on depth axis through the world-located geometry, leave x origin intact
    if ry!=rx:
        for v in topobj.data.vertices:v.co.y=-cz+(v.co.y+cz)*ry/rx
    pts=[(cx+rx*.997*math.cos(a),top-.038,cz+ry*.997*math.sin(a)) for a in np.linspace(0,2*PI,65)]
    tube(name+' fine brass rim',pts,.01,GOLD)

def lamp(name,cx,cz,y):
    lathe(name+' stepped brass base',(cx,y,cz),[(0,.09),(.018,.095),(.032,.067),(.045,.042),(.055,.025),(.19,.018),(.21,.032)],BRASS,24)
    lathe(name+' opal mushroom shade',(cx,y+.20,cz),[(0,.12),(.016,.123),(.03,.115),(.10,.084),(.12,.045),(.13,.02)],LIT,32)
    ring(name+' shade gold piping',(cx,y+.209,cz),.12,.008,GOLD,32)
    cyl(name+' shade finial',(cx,y+.344,cz),.025,.025,GOLD,16)

def coupe(name,cx,cz,y):
    lathe(name+' cut crystal coupe',(cx,y,cz),[(0,.046),(.007,.052),(.012,.032),(.022,.014),(.105,.008),(.115,.018),(.13,.05),(.17,.078),(.186,.081),(.194,.078)],CRYSTAL,20)
    ring(name+' fine gold lip',(cx,y+.192,cz),.079,.003,GOLD,24)

def bottle(name,cx,cz,y,h,r,mat,variant=0):
    body=h*.63;neck=h*.21
    profile=[(0,r*.83),(.018,r),(body-.018,r),(body,r*.88),(body+.065,r*.38),(h-.05,r*.32),(h-.018,r*.33)]
    if variant==1:profile=[(0,r*.85),(.015,r),(h*.50,r),(h*.66,r*.75),(h*.73,r*.32),(h-.018,r*.32)]
    lathe(name+' glass',(cx,y,cz),profile,mat,16)
    lathe(name+' ivory label',(cx,y+h*.22,cz),[(0,r*1.012),(h*.205,r*1.012)],IVORY,16)
    lathe(name+' gold label borders',(cx,y+h*.22,cz),[(0,r*1.02),(.008,r*1.02)],GOLD,16)
    lathe(name+' cork foil',(cx,y+h-.055,cz),[(0,r*.34),(.055,r*.34)],BRASS,12)
    # Small dark rectangular crest reads as a proper bottle label, rather than blank cylinders.
    cube(name+' label crest',(cx,y+h*.323,cz+r*1.012),(.042,.035,.004),EBONY,.003)

# --------------------------------------------------------------------------
# BAR: sculpted marble slab, reeded walnut, stepped brass, foot rail.
# --------------------------------------------------------------------------
GROUP='bar_counter'
cube('Bar shadow plinth',(12,.075,-8.72),(5.42,.15,.93),EBONY,.065)
cube('Bar lower brass reveal',(12,.15,-8.70),(5.45,.055,.98),BRASS,.035)
cube('Bar walnut carcass',(12,.715,-8.72),(5.42,1.08,.89),WALNUT,.05)
cube('Bar floating upper brass reveal',(12,1.205,-8.70),(5.61,.047,1.04),GOLD,.035)
cube('Bar thick gold veined marble counter',(12,1.2825,-8.70),(5.70,.115,1.10),MARBLE,.07)
cube('Bar luminous under-counter edge',(12,1.17,-8.198),(5.30,.023,.022),LIT,.009)
for i in range(68):
    x=9.37+i*(5.26/67)
    pill('Individually rounded walnut reed %02d'%i,(x,.695,-8.25),(.057,.95,.053),WALNUT)
for x in [9.31,10.50,12,13.5,14.69]:
    cube('Bar gilded vertical pilaster',(x,.71,-8.209),(.042,.98,.041),BRASS,.009)
    cube('Pilaster cap',(x,1.16,-8.205),(.10,.043,.05),GOLD,.008)
for x in [9.53,11.17,12.83,14.47]:
    tube('Brass rail bracket',[(x,.16,-8.30),(x,.16,-8.19)],.026,BRASS)
tube('Bar continuous polished foot rail',[(9.30,.21,-8.195),(14.70,.21,-8.195)],.037,GOLD)
cube('Bar central crest plate',(12,.76,-8.177),(.55,.32,.024),EBONY,.06)
text('Bar front LC monogram','LC',(12,.77,-8.151),.205,GOLD)
deco_fan('Bar center sunburst',12,.51,-8.155,.33)
for x in [9.52,14.49]:
    lamp('Counter opal lamp',x,-8.66,1.34)
# Tabletop details away from bartender/player central sightline.
for x,z in [(10.28,-8.38),(13.86,-8.49),(14.11,-8.44)]:coupe('Counter coupe',x,z,1.34)
lathe('Bar tray',(13.96,1.34,-8.65),[(0,.28),(.015,.28),(.02,.27),(.028,.27)],BRASS,32)
bottle('Counter crystal decanter',13.94,-8.77,1.37,.31,.10,AMBER,1)

# --------------------------------------------------------------------------
# BACKBAR: three architectural arched bays, fluted pilasters and jewel bottles.
# --------------------------------------------------------------------------
GROUP='backbar'
cube('Backbar walnut lower cabinet',(12,.62,-11.57),(6.08,1.17,.64),WALNUT,.05)
cube('Backbar stepped ebony plinth',(12,.095,-11.55),(6.10,.19,.69),EBONY,.025)
cube('Backbar toe brass trim',(12,.21,-11.55),(6.04,.045,.68),BRASS,.015)
cube('Backbar base marble ledge',(12,1.22,-11.55),(6.1,.09,.70),MARBLE,.032)
cube('Backbar dark lacquer backing',(12,2.35,-11.837),(6.04,2.20,.075),EBONY,.015)
for cx in [10.03,12,13.97]:
    cube('Smoked mirror lower panel',(cx,2.08,-11.779),(1.77,1.67,.025),MIRROR,.025)
    # top half disk completes each arched mirror
    rr=.885;base=2.50
    vs=[xyz((cx,base,-11.777))]+[xyz((cx+rr*math.cos(a),base+rr*math.sin(a),-11.777)) for a in np.linspace(0,PI,33)]
    fs=[(0,i,i+1) for i in range(1,33)]
    mesh=bpy.data.meshes.new('Arched bronze mirror');mesh.from_pydata(vs,[],fs);mesh.update()
    ob=bpy.data.objects.new('Arched bronze mirror',mesh);FURN.objects.link(ob);mesh.materials.append(MIRROR);ob['assembly']=GROUP
    for rad in [.89,.85]:
        pts=[(cx-rad,1.28,-11.739),(cx-rad,2.50,-11.739)]
        pts += [(cx+rad*math.cos(a),2.50+rad*math.sin(a),-11.739) for a in np.linspace(PI,0,37)]
        pts += [(cx+rad,1.28,-11.739)]
        tube('Twin champagne arch molding',pts,.016,BRASS)
    for y in [1.30,1.94,2.58]:
        cube('Walnut floating bottle shelf',(cx,y,-11.51),(1.78,.055,.52),WALNUT,.017)
        cube('Shelf brass nosing',(cx,y-.008,-11.24),(1.80,.031,.022),GOLD,.008)
        cube('Warm shelf lighting',(cx,y-.035,-11.28),(1.70,.012,.028),LIT,.004)
        for i in range(8 if y<2.5 else 6):
            bx=cx-.72+i*(.205 if y<2.5 else .278)
            h=random.uniform(.29,.42);r=random.uniform(.047,.065)
            bottle('Handmade spirits bottle',bx,-11.43+random.uniform(-.06,.055),y+.03,h,r,[AMBER,EMERALD,RUBY,TEAL][(i+int(cx))%4],i%2)
    # Arched radial fan above the tallest bottle row.
    deco_fan('Backbar arch fan',cx,2.65,-11.722,.56)
for x in [9.01,11.01,12.99,14.99]:
    cube('Backbar column base',(x,1.32,-11.50),(.14,.16,.52),BRASS,.02)
    for dx in [-.032,0,.032]:
        tube('Backbar reeded brass column',[(x+dx,1.40,-11.55),(x+dx,3.43,-11.55)],.018,BRASS)
    cube('Backbar column capital',(x,3.45,-11.56),(.16,.095,.43),GOLD,.018)
for x in [9.5,10.5,11.5,12.5,13.5,14.5]:
    cube('Backbar recessed cabinet face',(x,.70,-11.232),(.88,.78,.027),EBONY,.01)
    for dx in [-.4,.4]:cube('Cabinet gilded border',(x+dx,.70,-11.211),(.012,.71,.014),BRASS,.003)
    for y in [.35,1.055]:cube('Cabinet gilded border',(x,y,-11.211),(.8,.012,.014),BRASS,.003)
    tube('Cabinet brass handle',[(x+.24,.7,-11.18),(x+.24,.82,-11.18)],.013,GOLD)
cube('Backbar stepped crown lower',(12,3.44,-11.60),(6.10,.09,.57),WALNUT,.022)
cube('Backbar stepped crown gold',(12,3.515,-11.60),(6.10,.06,.64),BRASS,.019)
text('Backbar LAST CALL logotype','L A S T   C A L L',(12,3.16,-11.674),.19,GOLD)

# --------------------------------------------------------------------------
# WEST BANQUETTE: U-shaped curved-edged composition, open towards room center.
# --------------------------------------------------------------------------
GROUP='west_booth'
cube('West banquette floating black plinth',(6.77,.13,-7.9),(1.65,.26,3.40),EBONY,.13)
cube('West banquette brass base reveal',(6.76,.265,-7.9),(1.67,.045,3.42),BRASS,.02)
cube('West booth upholstered back foundation',(6.14,.84,-7.9),(.39,1.12,3.36),LEATHER,.17)
cube('West booth continuous seat',(6.55,.48,-7.9),(1.13,.29,3.34),LEATHER,.13)
for i in range(16):
    z=-9.44+i*(3.08/15)
    pill('West booth individual vertical channel',(6.37,.99,z),(.17,.86,.19),LEATHER)
    # button at each deep seam
    lathe('Upholstery brass button',(6.41,.91,z),[(0,.011),(.008,.011)],BRASS,8)
for z in [-9.51,-6.29]:
    cube('West booth curved upholstered wing',(6.85,.70,z),(1.75,.90,.32),LEATHER,.15)
    cube('West booth wing top gold piping',(6.85,1.154,z),(1.50,.012,.012),BRASS,.005)
    cube('West booth wing seat',(6.91,.49,z+(.20 if z<-7 else -.20)),(1.62,.25,.46),LEATHER,.12)
# Long oval table fully within island footprint and attached to inset side.
table('West booth oval table',7.39,-7.90,.58,.79,.91)
lamp('West table lamp',7.44,-8.54,.79)
coupe('West table coupe',7.40,-7.63,.79)
ring('West coaster',(7.53,.795,-7.96),.095,.003,BRASS,24)

# NORTH BANQUETTE: backs the north wall, presents its open front toward the bar.
GROUP='north_booth'
cube('North banquette floating black plinth',(10.3,.12,.42),(3.29,.24,1.05),EBONY,.14)
cube('North banquette champagne reveal',(10.3,.245,.42),(3.30,.04,1.07),BRASS,.025)
cube('North banquette upholstered back',(10.3,.83,.82),(3.30,1.04,.32),LEATHER,.14)
cube('North banquette seat cushion',(10.3,.47,.41),(3.25,.28,.82),LEATHER,.13)
for i in range(17):
    x=8.80+i*(3.0/16)
    pill('North booth individual channel',(x,.99,.626),(.18,.73,.14),LEATHER)
for x in [8.77,11.83]:
    cube('North banquette scroll arm',(x,.75,.35),(.28,.73,1.06),LEATHER,.135)
table('North booth oval table',10.30,-.43,.75,.77,.36)
lamp('North table lamp',10.76,-.41,.77)
coupe('North table coupe',9.99,-.43,.77)

# COCKTAIL PEDESTAL & BAR STOOLS
GROUP='cocktail_table'
table('Free standing cocktail table',13.8,-1.1,.54,1.075)
lamp('Cocktail table lamp',13.81,-1.23,1.075)
coupe('Cocktail table coupe',13.59,-.92,1.075)
for cx in [10,14.1]:
    GROUP='bar_stool_left' if cx==10 else 'bar_stool_right'
    cz=-7.35
    lathe('Stool tiered bronze pedestal',(cx,0,cz),[(0,.265),(.025,.29),(.045,.29),(.072,.24),(.105,.085),(.13,.065),(.67,.047),(.72,.12)],BRASS,32)
    ring('Stool circular brass footrest',(cx,.28,cz),.245,.018,GOLD,40)
    for a in [0,PI/2,PI,3*PI/2]:
        tube('Stool footrest spoke',[(cx+.05*math.cos(a),.28,cz+.05*math.sin(a)),(cx+.245*math.cos(a),.28,cz+.245*math.sin(a))],.012,BRASS)
    lathe('Stool turned walnut seat rim',(cx,.72,cz),[(0,.27),(.03,.29),(.055,.29)],WALNUT,40)
    lathe('Stool tailored leather seat',(cx,.77,cz),[(0,.28),(.025,.303),(.06,.31),(.09,.29),(.103,.24)],LEATHER,40)
    ring('Stool gold welt seam',(cx,.807,cz),.309,.005,GOLD,40)
    for a in np.linspace(0,2*PI,17)[:-1]:
        # edge tacks, tiny but give silhouette a deliberate seam
        lathe('Stool upholstery tack',(cx+.293*math.cos(a),.818,cz+.293*math.sin(a)),[(0,.009),(.012,.009)],BRASS,8)

# --------------------------------------------------------------------------
# CHANDELIER: three stepped tiers of cut crystal rods, suspended brass crown.
# --------------------------------------------------------------------------
GROUP='chandelier'
cx,cz=10,-4.6
lathe('Chandelier canopy',(cx,4.65,cz),[(0,.16),(.045,.22),(.065,.22)],BRASS,40)
cyl('Chandelier suspension stem',(cx,4.35,cz),.035,.66,BRASS,20)
for radius,y,count,drop in [(1.03,4.08,40,.43),(.76,3.76,32,.44),(.46,3.45,24,.34)]:
    ring('Chandelier tier outer crown',(cx,y,cz),radius,.042,BRASS,64)
    ring('Chandelier tier lower beading',(cx,y-.055,cz),radius,.012,GOLD,64)
    ring('Chandelier interior opal light',(cx,y-.06,cz),radius-.10,.020,LIT,48)
    for i in range(count):
        a=i*2*PI/count
        x,z=cx+radius*math.cos(a),cz+radius*math.sin(a)
        # octagonal prisms with tapered diamond tips, rather than flat strips
        lathe('Individually cut crystal pendant',(x,y-drop,z),[(0,.006),(.04,.035),(drop-.035,.035),(drop-.015,.026),(drop,.012)],CRYSTAL,8)
        lathe('Pendant golden clasp',(x,y-.025,z),[(0,.039),(.04,.039)],BRASS,8)
    for i in range(8):
        a=i*PI/4
        tube('Chandelier radial gilded arm',[(cx,.0+y+.075,cz),(cx+radius*math.cos(a),y+.075,cz+radius*math.sin(a)),(cx+radius*math.cos(a),y,cz+radius*math.sin(a))],.015,BRASS)
lathe('Chandelier faceted center drop',(cx,3.08,cz),[(0,.015),(.045,.085),(.17,.11),(.25,.045)],CRYSTAL,12)

# Custom metadata survives in the .blend and exported node extras.
CONTRACT={
 'bar_counter':{'center':[12,-8.7],'footprint':[5.7,1.1],'bodyHeight':1.34,'solid':True,'notes':'Glassware and lamps above counter are decorative; front face is positive Z.'},
 'backbar':{'center':[12,-11.6],'footprint':[6.1,.7],'height':3.55,'solid':True},
 'west_booth':{'center':[7,-7.9],'footprint':[2.2,3.6],'height':1.45,'solid':True},
 'north_booth':{'center':[10.3,.1],'footprint':[3.4,1.85],'height':1.35,'solid':True},
 'cocktail_table':{'center':[13.8,-1.1],'footprint':[1.1,1.1],'bodyHeight':1.075,'solid':True},
 'bar_stool_left':{'center':[10,-7.35],'footprint':[.65,.65],'height':.88,'solid':True},
 'bar_stool_right':{'center':[14.1,-7.35],'footprint':[.65,.65],'height':.88,'solid':True},
 'chandelier':{'center':[10,-4.6],'footprint':[2.2,2.2],'minHeight':3.08,'maxHeight':4.715,'solid':False},
}

def apply_meshes(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.convert(target='MESH')
    return list(bpy.context.selected_objects)

def report(objects):
    d={'coordinateSystem':'Bounds below are intended game metres, Y up; editable source Blender=(x,-z,y). Export reflects X for default Babylon left-handed glTF conversion.','assemblies':{},'materials':len(bpy.data.materials)}
    deps=bpy.context.evaluated_depsgraph_get()
    for o in objects:
        ev=o.evaluated_get(deps)
        me=ev.to_mesh();me.calc_loop_triangles()
        key=o.get('assembly','unassigned')
        item=d['assemblies'].setdefault(key,{'objects':0,'triangles':0,'min':[1e6]*3,'max':[-1e6]*3,'collisionContract':CONTRACT.get(key)})
        item['objects']+=1;item['triangles']+=len(me.loop_triangles)
        for v in me.vertices:
            b=o.matrix_world @ v.co;co=(b.x,b.z,-b.y)
            for j in range(3):item['min'][j]=min(item['min'][j],co[j]);item['max'][j]=max(item['max'][j],co[j])
        ev.to_mesh_clear()
    for item in d['assemblies'].values():
        item['min']=[round(v,5) for v in item['min']];item['max']=[round(v,5) for v in item['max']]
    d['triangles']=sum(i['triangles'] for i in d['assemblies'].values())
    d['sourceObjects']=len(objects)
    return d

ASSET_OBJECTS=list(FURN.objects)
LETTERING_NAMES={o.name for o in ASSET_OBJECTS if o.type=='FONT'}
QA=report(ASSET_OBJECTS)
(DOCS/'asset-report.json').write_text(json.dumps(QA,indent=2))

# PREVIEW STAGE, deliberately absent from the game GLB.
GROUP='preview'
FLOOR=material('Preview limestone',(.19,.19,.16),.08,.37)
WALL=material('Preview desaturated teal wall',(.027,.065,.064),0,.6)
cube('Preview limestone floor',(10,-.09,-5.7),(13,.18,14),FLOOR,.02,True)
cube('Preview north wall',(10,2.3,-12),(13,4.6,.16),WALL,.03,True)
cube('Preview west wall',(4.0,2.3,-5.7),(.16,4.6,12.8),WALL,.03,True)
# geometric tessellated inset floor border
for x in [4.65,15.35]:cube('Preview gold floor border',(x,.006,-5.7),(.025,.012,12.0),BRASS,.002,True)
for z in [-11.7,.3]:cube('Preview gold floor border',(10,.006,z),(10.70,.012,.025),BRASS,.002,True)
for x in np.arange(5,16,1.2):
    for z in np.arange(-11.4,1,1.2):
        o=cube('Preview black stone diamond',(float(x),.005,float(z)),(.16,.009,.16),EBONY,.006,True)
        o.rotation_euler.z=PI/4
for z in [-10.9,-8.3,-5.7,-3.1,-.5]:
    cube('Preview brass wall pilaster',(4.101,1.7,z),(.028,3.3,.048),BRASS,.006,True)
for y in [.15,1.30,3.4]:cube('Preview west wall chair rail',(4.1,y,-5.7),(.06,.05,12.2),BRASS,.008,True)

def area(name,loc,energy,color,size,target):
    ld=bpy.data.lights.new(name,'AREA');ld.energy=energy;ld.color=color;ld.shape='DISK';ld.size=size
    o=bpy.data.objects.new(name,ld);STAGE.objects.link(o);o.location=xyz(loc)
    o.rotation_euler=(Vector(xyz(target))-o.location).to_track_quat('-Z','Y').to_euler()
    return o
area('Preview warm key',(12,7,-3),2200,(1,.78,.53),8,(11,0,-7))
area('Preview soft cyan fill',(5,5,-6),1250,(.56,.78,1),7,(11,1,-7))
area('Preview bar glow',(12,4.3,-10.4),950,(1,.64,.32),4,(12,1,-10))
area('Preview frontal softbox',(17,5,1),1800,(1,.85,.67),7,(10,1,-6))
area('Preview chandelier glow',(10,3.7,-4.6),260,(1,.69,.38),2,(10,0,-4.6))
camera=bpy.data.cameras.new('Preview camera');co=bpy.data.objects.new('Preview camera',camera);STAGE.objects.link(co)
co.location=xyz((20.5,10,6.7));co.rotation_euler=(Vector(xyz((10.5,1.5,-6.1)))-co.location).to_track_quat('-Z','Y').to_euler()
camera.type='ORTHO';camera.ortho_scale=15.9;bpy.context.scene.camera=co
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=40
scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1150;scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18)
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(DOCS/'last-call-lounge-preview.png')
scene.view_settings.view_transform='AgX'
scene['asset_contract']=json.dumps(CONTRACT)
scene['rebuild_command']='blender --background --python tools/bar-assets/build_lounge.py'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))

# Consolidate only game furnishings by material after preserving the editable source.
objects=apply_meshes(ASSET_OBJECTS)
# The game uses Babylon's left-handed camera: when approaching the bar from
# positive Z, positive world X is screen-left. Reverse lettering locally for
# game reading order, while keeping source text readable in Blender's preview.
lettering_reflection=Matrix.Diagonal((-1.0,1.0,1.0,1.0))
for o in objects:
    if o.name in LETTERING_NAMES:
        o.data.transform(lettering_reflection)
        bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
        bm.to_mesh(o.data);bm.free();o.data.update()
groups={}
for o in objects:
    if not o.data.materials:continue
    key=o.data.materials[0].name
    groups.setdefault(key,[]).append(o)
exported=[]
for name,obs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    if len(obs)>1:bpy.ops.object.join()
    o=bpy.context.object;o.name='Last Call / '+name;o['assembly']='consolidated_by_material'
    exported.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exported:o.select_set(True)
bpy.context.view_layer.objects.active=exported[0]
# Babylon's default left-handed glTF root converts x -> -x (Y rotation PI
# together with Z scale -1). Mirror the export only, preserving the source.
# Bake the reflected world matrix and reverse winding explicitly.
reflection=Matrix.Diagonal((-1.0,1.0,1.0,1.0))
for o in exported:
    o.data.transform(reflection @ o.matrix_world)
    o.matrix_world=Matrix.Identity(4)
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(o.data);bm.free();o.data.update()
bpy.ops.export_scene.gltf(filepath=str(EXPORT),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
QA['exportMeshes']=len(exported);QA['glbBytes']=EXPORT.stat().st_size
QA['runtimeCoordinateSystem']='Export Blender X is reflected; default Babylon left-handed glTF loader restores intended game X. Keep default __root__ conversion.'
QA['letteringOrientation']='Game export mirrors only lettering locally so it reads correctly when approached from positive Z in the left-handed game camera; editable Blender text remains preview-readable.'
(DOCS/'asset-report.json').write_text(json.dumps(QA,indent=2))
print('LAST_CALL_EXPORT',json.dumps(QA))
# Render the saved editable source, with its natural Blender text orientation.
# This is a furnishing study; the playable game's shell and lighting are separate.
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.ops.render.render(write_still=True)
print('LAST_CALL_COMPLETE',str(EXPORT),str(SOURCE))
