"""Author the original LAST JACKPOT hotel delivery truck in Blender 5.x.

Run: blender --background --python tools/service-assets/build_truck.py
Game coordinates are metres / Y-up; source Blender coordinates are (x,-z,y).
Only the game export reflects X for the default Babylon left-handed glTF root.
No external models, texture files or fonts are needed. Material textures below
are deterministic authored pixel maps, packed into the editable source and GLB.
"""
from pathlib import Path
import bpy, bmesh, json, math, random
import numpy as np
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/source/service-truck.blend'
EXPORT=ROOT/'public/models/service-truck.glb'
DOCS=ROOT/'docs/service-assets'
for path in [SOURCE.parent,EXPORT.parent,DOCS]:path.mkdir(parents=True,exist_ok=True)
random.seed(1404)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name!='Collection':bpy.data.collections.remove(c)
ASSETS=bpy.data.collections.get('Collection');ASSETS.name='LAST JACKPOT / truck editable components'
STAGE=bpy.data.collections.new('PREVIEW ONLY / excluded from GLB');bpy.context.scene.collection.children.link(STAGE)
PI=math.pi;CX=7.8;CZ=5.65;GROUP='truck'

def xyz(p):return (p[0],-p[2],p[1])

def register(obj,name,mat,stage=False):
    obj.name=name;obj['assembly']=GROUP;obj['original_asset']='LAST JACKPOT / original Blender model'
    for c in list(obj.users_collection):c.objects.unlink(obj)
    (STAGE if stage else ASSETS).objects.link(obj)
    if mat:obj.data.materials.append(mat)
    return obj

def material(name,col,metal=0,rough=.45,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*col,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*col,1);p.inputs['Emission Strength'].default_value=emission
    return m

def painted_texture(mat,name,col,variation=.025):
    n=512;y,x=np.mgrid[0:n,0:n].astype(np.float32)/n
    rng=np.random.default_rng(417)
    grain=(rng.random((n,n),dtype=np.float32)-.5)*variation
    cloud=(np.sin(x*PI*8+np.sin(y*PI*4))*.22+np.sin(y*PI*18+x*PI*4)*.1)*variation
    speckles=(rng.random((n,n),dtype=np.float32)>.996)*variation*1.8
    rgb=np.stack([np.clip(c+grain+cloud-speckles,0,1) for c in col],axis=-1)
    rgba=np.ones((n,n,4),np.float32);rgba[:,:,:3]=rgb
    image=bpy.data.images.new(name,width=n,height=n,alpha=True)
    image.pixels.foreach_set(rgba.reshape(-1));image.pack()
    node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

SAGE=material('01 / aged sage enamel',(.285,.36,.29),.24,.42)
CREAM=material('02 / warm ivory cargo enamel',(.76,.705,.55),.18,.48)
TEAL=material('03 / deep petrol livery',(.027,.11,.115),.20,.43)
BRASS=material('04 / satin champagne brass',(.53,.39,.17),.72,.33)
CHROME=material('05 / weathered brushed alloy',(.48,.51,.48),.86,.32)
RUBBER=material('06 / tire rubber',(.022,.026,.024),0,.72)
BLACK=material('07 / chassis graphite',(.04,.045,.039),.40,.62)
GLASS=material('08 / blue black cab glazing',(.028,.075,.087),.45,.19)
SHADOW=material('09 / panel seams and grille recess',(.016,.024,.023),.08,.66)
AMBER=material('10 / amber safety lamp',(.98,.32,.055),.15,.25,.40)
WHITE=material('11 / headlight prismatic glass',(.83,.85,.71),.25,.19,.24)
RED=material('12 / ruby tail lamp',(.39,.02,.018),.17,.3,.25)
WEAR=material('13 / edge chips dark oxide',(.16,.105,.052),.36,.70)
MIRROR=material('14 / polished mirror glass',(.40,.52,.55),.94,.16)
painted_texture(SAGE,'Truck / sage enamel micro patina',(.285,.36,.29),.035)
painted_texture(CREAM,'Truck / ivory enamel micro patina',(.76,.705,.55),.031)
painted_texture(RUBBER,'Truck / granular rubber',(.022,.026,.024),.014)

def project_uv(obj):
    me=obj.data
    if not me.uv_layers:me.uv_layers.new(name='UVMap')
    uv=me.uv_layers.active
    for p in me.polygons:
        ax=max(range(3),key=lambda a:abs(p.normal[a]));dims=[a for a in range(3) if a!=ax]
        for li in p.loop_indices:
            v=me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv=(v[dims[0]],v[dims[1]])
    return obj

def soften(obj,width=.02,segments=3):
    if width:
        # Fine hardware is subpixel at game distance: one chamfer is enough.
        segments=min(segments,1 if width<=.014 else (2 if width<=.027 else 3))
        b=obj.modifiers.new('Machined and rolled edge radii','BEVEL');b.width=width;b.segments=segments
        w=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');w.keep_sharp=True
    return obj

def mesh(name,verts,faces,mat,bevel=0):
    me=bpy.data.meshes.new(name);me.from_pydata([xyz(v) for v in verts],[],faces);me.update()
    o=bpy.data.objects.new(name,me);ASSETS.objects.link(o);o['assembly']=GROUP;o.data.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    project_uv(o);soften(o,bevel)
    return o

def cube(name,loc,size,mat,bevel=.016,stage=False):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(loc))
    o=register(bpy.context.object,name,mat,stage);o.scale=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    project_uv(o);soften(o,bevel)
    return o

def extruded(name,outline,z0,z1,mat,bevel=.02):
    n=len(outline);verts=[(x,y,z) for z in [z0,z1] for x,y in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh(name,verts,faces,mat,bevel)

def tube(name,points,r,mat,detail=1):
    crv=bpy.data.curves.new(name,'CURVE');crv.dimensions='3D';crv.resolution_u=1
    sp=crv.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*xyz(co),1)
    crv.bevel_depth=r;crv.bevel_resolution=detail
    o=bpy.data.objects.new(name,crv);ASSETS.objects.link(o);o['assembly']=GROUP;crv.materials.append(mat)
    return o

def cylinder(name,a,b,r,mat,vertices=24,bevel=.006):
    a,b=Vector(xyz(a)),Vector(xyz(b));axis=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=axis.length,location=(a+b)/2)
    o=register(bpy.context.object,name,mat);o.rotation_euler=axis.to_track_quat('Z','Y').to_euler()
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    soften(o,bevel,1)
    return o

def wheelring(name,center,profile,mat,segments=48):
    x,y,z=center;verts=[];faces=[]
    for axial,r in profile:
        for i in range(segments):
            a=2*PI*i/segments;verts.append((x+r*math.cos(a),y+r*math.sin(a),z+axial))
    for j in range(len(profile)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
    o=mesh(name,verts,faces,mat)
    for p in o.data.polygons:p.use_smooth=True
    uv=o.data.uv_layers.active
    for p in o.data.polygons:
        for li in p.loop_indices:
            vi=o.data.loops[li].vertex_index
            uv.data[li].uv=(vi%segments/segments,(profile[vi//segments][0]+.2)*3)
    return o

def torus_z(name,center,r,t,mat,segments=48):
    return wheelring(name,center,[(math.sin(a)*t,r+math.cos(a)*t) for a in np.linspace(0,2*PI,7)],mat,min(segments,48))

def label(name,body,loc,size,mat,side=1,align='CENTER',extrude=.001):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.align_x=align;c.align_y='CENTER'
    c.size=size;c.space_character=1.12;c.extrude=extrude;c.bevel_depth=0;c.resolution_u=3
    o=bpy.data.objects.new(name,c);ASSETS.objects.link(o);o.location=xyz(loc)
    o.rotation_euler=(PI/2,0,0 if side>0 else PI);c.materials.append(mat);o['assembly']=GROUP
    return o

# A boxed ladder chassis, axles, longitudinal leaf springs and tanks are visible
# beneath the cargo bed, avoiding the floating-box silhouette of a placeholder.
GROUP='undercarriage'
for z in [CZ-.67,CZ+.67]:
    cube('Riveted ladder chassis rail',(7.90,.70,z),(4.97,.21,.14),BLACK,.025)
for x in [5.51,6.17,7.08,8.2,9.24,10.12]:
    cube('Chassis crossmember',(x,.70,CZ),(.12,.15,1.42),BLACK,.012)
for x in [6.07,9.35]:
    cylinder('Solid axle',(x,.515,CZ-1.02),(x,.515,CZ+1.02),.085,BLACK)
    cube('Differential housing',(x,.515,CZ),(.33,.28,.30),BLACK,.09)
    for z in [CZ-.68,CZ+.68]:
        for i in range(4):
            tube('Layered leaf spring',[(x-.55+i*.075,.62+i*.018,z),(x,.51+i*.018,z),(x+.55-i*.075,.62+i*.018,z)],.012,CHROME)
        for xoff in [-.10,.10]:tube('Axle U clamp',[(x+xoff,.70,z-.06),(x+xoff,.48,z-.06),(x+xoff,.48,z+.06),(x+xoff,.70,z+.06)],.009,CHROME)
cylinder('Drive shaft',(6.45,.58,CZ),(9.35,.515,CZ),.037,BLACK)
cube('Fuel tank',(7.55,.69,CZ+.77),(1.00,.36,.34),CHROME,.09)
for x in [7.25,7.85]:cube('Fuel tank steel strap',(x,.69,CZ+.953),(.06,.37,.017),BLACK,.012)
cylinder('Fuel tank filler',(7.85,.87,CZ+.79),(7.85,.96,CZ+.83),.056,BLACK)
cube('Battery locker',(7.51,.70,CZ-.77),(.87,.38,.32),BLACK,.035)
for x in [7.28,7.76]:cube('Battery locker latch',(x,.73,CZ-.94),(.05,.08,.023),CHROME,.008)
tube('Exhaust tail pipe',[(6.67,.49,CZ-.24),(8.29,.49,CZ-.24),(8.66,.48,CZ-.68),(8.69,.43,CZ-1.0)],.037,CHROME)

# Tires use a revolved 22-ring cross section with actual longitudinal grooves,
# rounded shoulders, recessed center webs, six lug nuts and embossed sidewalls.
GROUP='wheels'
for axle,x in [('front',6.07),('rear',9.35)]:
    for side in [-1,1]:
        z=CZ+side*1.015;y=.515
        profile=[(-.153,.29),(-.158,.365),(-.151,.411),(-.132,.445),(-.112,.467),(-.087,.484),(-.07,.485),(-.061,.474),(-.051,.474),(-.043,.489),(-.012,.490),(-.006,.480),(.006,.480),(.012,.490),(.043,.489),(.051,.474),(.061,.474),(.070,.485),(.087,.484),(.112,.467),(.132,.445),(.151,.411),(.158,.365),(.153,.29)]
        wheelring(f'{axle} tire / grooved rounded carcass',(x,y,z),profile,RUBBER)
        outer=z+side*.162
        torus_z('Raised tire sidewall line',(x,y,outer),.367,.004,RUBBER,64)
        torus_z('Tire bead',(x,y,z+side*.15),.29,.014,RUBBER,64)
        cylinder('Pressed steel wheel barrel',(x,y,z-side*.13),(x,y,z+side*.166),.286,CREAM,48,.01)
        cylinder('Recessed wheel dish',(x,y,z+side*.171),(x,y,z+side*.181),.227,BLACK,48,.004)
        cylinder('Domed center wheel disc',(x,y,z+side*.182),(x,y,z+side*.209),.184,CREAM,48,.014)
        torus_z('Rolled rim lip',(x,y,z+side*.177),.271,.017,CHROME,64)
        for i in range(6):
            a=i*2*PI/6;px=x+math.cos(a)*.14;py=y+math.sin(a)*.14
            cylinder('Wheel lug washer',(px,py,z+side*.211),(px,py,z+side*.215),.025,BLACK,12,.002)
            cylinder('Hexagonal wheel nut',(px,py,z+side*.215),(px,py,z+side*.235),.019,CHROME,6,.003)
            a+=PI/6;px=x+math.cos(a)*.226;py=y+math.sin(a)*.226
            cylinder('Wheel cooling aperture',(px,py,z+side*.178),(px,py,z+side*.187),.025,SHADOW,12,.002)
        cylinder('Central axle hub',(x,y,z+side*.205),(x,y,z+side*.250),.073,CHROME,32,.02)
        cylinder('Central sage hub cap',(x,y,z+side*.249),(x,y,z+side*.260),.040,SAGE,24,.006)
        # Small molded bars catch raking light; these remain inside the footprint.
        for i in range(36):
            a=i*2*PI/36
            for sign in [-1,1]:
                r=.455;px=x+r*math.cos(a);py=y+r*math.sin(a)
                o=cube('Molded shoulder tread block',(px,py,z+sign*.128),(.045,.013,.021),RUBBER,0)
                o.rotation_euler.y=-a
        for i in range(12):
            a=i*2*PI/12;px=x+.391*math.cos(a);py=y+.391*math.sin(a)
            tube('Molded tire sidewall dash',[(px,py,outer),(x+.411*math.cos(a),y+.411*math.sin(a),outer)],.003,RUBBER,0)

# Cab side profile includes a genuine open front wheel arch. The windshield
# slopes into the hood and the two-tone roof is a separate rolled sheet panel.
GROUP='cab'
outline=[(5.20,.73),(5.20,1.35),(5.33,1.54),(5.83,1.59),(6.08,2.32),(6.22,2.47),(6.83,2.47),(6.99,2.30),(7.02,.78),(6.64,.78)]
for a in np.linspace(0,PI,21):outline.append((6.07+.566*math.cos(a),.515+.566*math.sin(a)))
outline.extend([(5.505,.73)])
extruded('Pressed cab shell with open wheel arch',outline,CZ-.99,CZ+.99,SAGE,.035)
cube('Rolled ivory roof cap',(6.54,2.465,CZ),(.87,.095,2.075),CREAM,.07)
for side in [-1,1]:
    z=CZ+side*1.008
    # The dark outline is the rubber gasket; inner polygon carries blue glazing.
    gasket=[(5.955,1.63),(6.18,2.292),(6.80,2.292),(6.858,1.63)]
    glass=[(6.015,1.68),(6.211,2.235),(6.74,2.235),(6.79,1.68)]
    extruded('Cab side glazing rubber seal',gasket,z-side*.008,z+side*.014,SHADOW,.019)
    extruded('Cab side window inset',glass,z+side*.015,z+side*.022,GLASS,.01)
    # Quarter-light divider, rain gutter, door perimeter and polished handle.
    tube('Quarter-light divider',[(6.27,1.67,z+side*.027),(6.275,2.26,z+side*.027)],.012,CHROME)
    tube('Cab side rain gutter',[(6.03,2.36,z+side*.018),(6.19,2.41,z+side*.018),(6.88,2.41,z+side*.018)],.013,CHROME)
    door=[(6.17,1.58,z+side*.02),(6.86,1.58,z+side*.02),(6.90,.92,z+side*.02),(6.60,.92,z+side*.02)]
    tube('Recessed driver door perimeter',door,.006,SHADOW,0)
    tube('Door upright seam',[(6.885,.93,z+side*.022),(6.885,2.27,z+side*.022)],.006,SHADOW,0)
    cube('Door handle shadow',(6.73,1.49,z+side*.022),(.16,.05,.015),SHADOW,.019)
    cube('Polished cab door handle',(6.73,1.507,z+side*.045),(.14,.023,.03),CHROME,.008)
    cylinder('Door key lock',(6.73,1.434,z+side*.019),(6.73,1.434,z+side*.028),.011,CHROME,12,.002)
    # Separate shaped wheel lip follows the open arch and skirt behind it.
    arch=[(6.07+.588*math.cos(a),.515+.588*math.sin(a),z+side*.03) for a in np.linspace(0,PI,37)]
    tube('Rolled front fender arch',arch,.035,SAGE,2)
    tube('Fender chrome edge',[(x,y,az+side*.033) for x,y,az in arch],.008,CHROME)
    cube('Serrated cab entry step',(6.79,.72,z+side*.04),(.37,.07,.15),CHROME,.021)
    for i in range(6):cube('Entry step grip',(6.65+i*.055,.761,z+side*.04),(.020,.012,.13),BLACK,.003)
    # Each mirror is supported by a bent triangular tubular arm.
    tube('Mirror support arm',[(6.25,1.71,z+side*.02),(6.17,1.78,CZ+side*1.204),(6.12,2.02,CZ+side*1.204)],.014,CHROME)
    tube('Mirror diagonal brace',[(6.08,1.96,z+side*.02),(6.12,2.02,CZ+side*1.204)],.011,CHROME)
    cube('Rounded mirror back',(6.12,2.045,CZ+side*1.211),(.23,.30,.070),BLACK,.044)
    cube('Mirror polished insert',(6.12,2.045,CZ+side*1.249),(.185,.242,.010),MIRROR,.033)
    label('Cab fleet number','04',(6.59,1.24,z+side*.03),.155,CREAM,side)
    label('Cab fleet district','HOTEL SERVICES',(6.58,1.105,z+side*.03),.031,CREAM,side)
    cube('Cab amber side repeater',(5.46,1.22,z+side*.026),(.13,.055,.022),AMBER,.019)

# Broad windshield, split down the center, with sloped planar glass and wipers.
def windpanel(name,z0,z1,mat,offset=0):
    return mesh(name,[(5.843-offset,1.646,z0),(5.843-offset,1.646,z1),(6.077-offset,2.298,z1),(6.077-offset,2.298,z0)],[(0,1,2,3)],mat)
windpanel('Full front windshield rubber gasket',CZ-.925,CZ+.925,SHADOW,.011)
for side in [-1,1]:
    z0,z1=(CZ-.870,CZ-.028) if side<0 else (CZ+.028,CZ+.870)
    # Slightly inset all four edges from gasket.
    mesh('Split laminated windshield',[(5.844,1.695,z0),(5.844,1.695,z1),(6.061,2.25,z1),(6.061,2.25,z0)],[(0,1,2,3)],GLASS)
    for zz in [z0,z1]:tube('Windshield bright surround',[(5.829,1.684,zz),(6.047,2.265,zz)],.009,CHROME)
    tube('Windshield top bright surround',[(6.047,2.265,z0),(6.047,2.265,z1)],.009,CHROME)
    tube('Windshield lower bright surround',[(5.829,1.684,z0),(5.829,1.684,z1)],.009,CHROME)
    tube('Windshield wiper arm',[(5.79,1.65,CZ+side*.18),(5.875,1.87,CZ+side*.34)],.010,BLACK)
    tube('Windshield wiper rubber blade',[(5.834,1.77,CZ+side*.24),(5.917,1.99,CZ+side*.43)],.014,BLACK)
cube('Ivory front fascia',(5.203,1.09,CZ),(.054,.50,1.78),CREAM,.06)
cube('Inset black radiator grille',(5.169,1.07,CZ),(.027,.30,1.03),SHADOW,.035)
for y in [.972,1.026,1.08,1.134,1.188]:cube('Radiator grille horizontal bright bar',(5.147,y,CZ),(.035,.017,1.035),CHROME,.006)
for zz in [-.44,0,.44]:cube('Grille upright',(5.126,1.08,CZ+zz),(.017,.29,.014),CHROME,.004)
for side in [-1,1]:
    z=CZ+side*.693
    cylinder('Headlight ivory pod',(5.18,1.105,z),(5.13,1.105,z),.166,CREAM,48,.012)
    cylinder('Chrome headlight surround',(5.126,1.105,z),(5.105,1.105,z),.140,CHROME,48,.010)
    cylinder('Recessed sealed-beam headlight',(5.102,1.105,z),(5.084,1.105,z),.120,WHITE,48,.009)
    for offset in [-.071,-.035,0,.035,.071]:
        half=math.sqrt(.11**2-offset**2)
        tube('Headlamp cast glass fluting',[(5.078,1.105-half,z+offset),(5.078,1.105+half,z+offset)],.0025,CHROME,0)
    cube('Front amber indicator',(5.172,.864,z),(.035,.064,.16),AMBER,.019)
cube('Front pressed chrome bumper',(5.148,.681,CZ),(.18,.14,2.10),CHROME,.038)
for z in [CZ-.76,CZ+.76]:cube('Rubber bumper overrider',(5.081,.698,z),(.054,.205,.11),RUBBER,.022)
cube('Front plate',(5.065,.638,CZ),(.021,.117,.39),TEAL,.010)
# Hood seam, vent slots, badge, and split panel center ornament.
for side in [-1,1]:
    tube('Hood side panel seam',[(5.34,1.475,CZ+side*.986),(5.77,1.535,CZ+side*.986)],.005,SHADOW,0)
    for i in range(5):cube('Hood engine cooling slot',(5.42+i*.064,1.40,CZ+side*.996),(.035,.063,.012),SHADOW,.01)
tube('Hood central bright spear',[(5.30,1.567,CZ),(5.75,1.611,CZ)],.011,CHROME)
cube('Front shield badge',(5.183,1.383,CZ),(.023,.08,.14),BRASS,.015)

# Raised floor and a detailed riveted corrugated box. Main flat wall gives the
# convex ribs a closed back; the side signs stand proud of corrugation.
GROUP='cargo_body'
cube('Cargo raised floor rim',(8.694,1.055,CZ),(3.43,.17,2.235),BLACK,.027)
cube('Ivory insulated cargo shell',(8.70,1.999,CZ),(3.37,1.795,2.19),CREAM,.034)
cube('Rolled cargo roof cap',(8.70,2.916,CZ),(3.44,.045,2.265),CREAM,.028)
for side in [-1,1]:
    z=CZ+side*1.109
    for i in range(33):
        x=7.107+i*.099
        cube('Cargo sheet shallow corrugation',(x,1.981,z),(.028,1.715,.026),CREAM,.012)
    for y in [1.166,2.81]:
        cube('Cargo alloy side belt rail',(8.70,y,z+side*.031),(3.41,.056,.055),CHROME,.009)
        for i in range(17):
            x=7.105+i*.199
            cylinder('Cargo belt rail rivet',(x,y,z+side*.060),(x,y,z+side*.068),.009,BLACK,10,.002)
    for x in [7.012,10.382]:
        cube('Cargo vertical corner protector',(x,1.99,z+side*.023),(.085,1.87,.079),CHROME,.017)
        for y in np.linspace(1.2,2.78,9):cylinder('Corner protector rivet',(x,float(y),z+side*.064),(x,float(y),z+side*.071),.009,BLACK,10,.002)
    # The original livery uses physical text/relief for reliable game export.
    cube('Petrol livery sign raised panel',(8.73,2.059,z+side*.044),(2.80,.826,.047),TEAL,.024)
    for y in [1.705,2.413]:cube('Livery champagne rule',(8.73,y,z+side*.071),(2.62,.009,.007),BRASS,.003)
    for x in [7.46,10.0]:cube('Livery short upright',(x,2.059,z+side*.071),(.009,.56,.007),BRASS,.003)
    label('Hotel name / original cast lettering','LAST JACKPOT',(8.73,2.160,z+side*.078),.239,CREAM,side)
    label('Hotel supply secondary lettering','H O T E L   S U P P L Y',(8.73,1.957,z+side*.078),.097,CREAM,side)
    label('Casino delivery small lettering','CASINO  /  LINEN  /  PROVISIONS',(8.73,1.800,z+side*.078),.044,BRASS,side)
    for x in [7.11,10.275]:
        cube('Cargo marker black mount',(x,1.315,z+side*.022),(.137,.073,.031),BLACK,.018)
        cube('Cargo amber marker lens',(x,1.315,z+side*.043),(.11,.047,.019),AMBER,.014)
    # Rear wheels have a formed metal half-fender and suspended rubber mudflap.
    arch=[(9.35+.595*math.cos(a),.515+.595*math.sin(a),CZ+side*1.075) for a in np.linspace(0,PI,37)]
    tube('Rear fender rolled steel crown',arch,.059,BLACK,2)
    tube('Rear fender bright outside piping',[(x,y,z+side*.069) for x,y,z in arch],.010,CHROME)
    cube('Rear wheel rubber mud flap',(9.977,.487,CZ+side*.965),(.038,.67,.38),RUBBER,.012)
    cube('Mudflap galvanized top clamp',(9.998,.819,CZ+side*.965),(.027,.046,.395),CHROME,.008)
    for zz in [-.13,0,.13]:cylinder('Mudflap clamp fastener',(10.014,.819,CZ+side*.965+zz),(10.024,.819,CZ+side*.965+zz),.012,BLACK,10,.002)

# Double cargo doors: recessed seals, frame, three working hinges per leaf,
# locking rods, hasps, rear safety lights, bumper and non-slip loading step.
GROUP='rear_hardware'
cube('Rear door dark weather seal',(10.398,1.99,CZ),(.033,1.785,2.085),SHADOW,.025)
for side in [-1,1]:
    zz=CZ+side*.514
    cube('Rear split cargo door',(10.421,1.99,zz),(.043,1.699,.998),CREAM,.016)
    for y in [1.204,2.78]:cube('Door perimeter horizontal aluminum rail',(10.455,y,zz),(.027,.033,.948),CHROME,.004)
    for zoff in [-.477,.477]:cube('Door vertical aluminum rail',(10.455,1.99,zz+zoff),(.027,1.59,.031),CHROME,.004)
    for y in [1.435,1.996,2.548]:
        cube('Door hinge leaf',(10.474,y,CZ+side*.917),(.026,.087,.188),CHROME,.007)
        cylinder('Door hinge barrel',(10.499,y-.065,CZ+side*1.008),(10.499,y+.065,CZ+side*1.008),.026,CHROME,20,.005)
        for zo in [.861,.948]:cylinder('Hinge fixing bolt',(10.491,y,CZ+side*zo),(10.501,y,CZ+side*zo),.012,BLACK,10,.002)
    cylinder('Cargo door full height locking bar',(10.487,1.244,CZ+side*.313),(10.487,2.748,CZ+side*.313),.018,CHROME,20,.002)
    for y in [1.30,1.66,2.33,2.692]:cube('Lock rod retaining saddle',(10.506,y,CZ+side*.313),(.052,.055,.097),CHROME,.009)
    cube('Door latch plate',(10.5,1.823,CZ+side*.32),(.041,.147,.12),BLACK,.017)
    tube('Swing door latch handle',[(10.523,1.86,CZ+side*.313),(10.530,1.81,CZ+side*.21),(10.530,1.81,CZ+side*.107)],.016,CHROME)
    cube('Rear taillight black surround',(10.426,.949,CZ+side*.844),(.06,.163,.243),BLACK,.027)
    cube('Rear red taillight lens',(10.461,.966,CZ+side*.903),(.025,.106,.103),RED,.015)
    cube('Rear amber indicator lens',(10.461,.966,CZ+side*.785),(.025,.106,.092),AMBER,.015)
    for zz1 in [-.029,0,.029]:cube('Rear lamp lens ribs',(10.476,.966,CZ+side*.903+zz1),(.007,.080,.003),RED,.001)
    cube('Rear red reflector',(10.456,1.29,CZ+side*.90),(.022,.053,.101),RED,.014)
cube('Rear underride chrome bumper',(10.413,.65,CZ),(.185,.135,2.135),CHROME,.025)
cube('Rear loading step',(10.443,.806,CZ),(.18,.057,1.3),CHROME,.012)
for z in np.linspace(CZ-.6,CZ+.6,18):cube('Loading step non-slip grip',(10.444,.840,float(z)),(.15,.009,.017),BLACK,.002)
cube('Rear registration plate',(10.513,.65,CZ),(.023,.12,.42),TEAL,.007)
for z in [CZ-.82,CZ,CZ+.82]:cube('Roof rear red clearance marker',(10.401,2.848,z),(.038,.037,.082),RED,.012)
for z in [CZ-.79,CZ,CZ+.79]:cube('Roof front amber clearance marker',(7.001,2.848,z),(.038,.037,.082),AMBER,.012)

# Restrained modeled paint damage at load-handling edges. These irregular,
# paper-thin islands survive glTF export without unsupported noise shaders.
GROUP='surface_wear'
for side in [-1,1]:
    for i in range(33):
        x=random.uniform(7.12,10.25);y=random.choice([1.15,1.21,2.80])+random.uniform(-.011,.011)
        z=CZ+side*1.144
        w=random.uniform(.012,.065);h=random.uniform(.004,.013)
        extruded('Cargo rail irregular oxide chip',[(x-w,y),(x-w*.55,y+h),(x+w*.45,y+h*.6),(x+w,y-h*.3),(x,y-h)],z,z+side*.002,WEAR,0)
    for i in range(8):
        x=random.uniform(5.24,5.48);y=random.uniform(.75,1.05);z=CZ+side*1.016
        tube('Cab sill worn edge',[(x,y,z),(x+random.uniform(.015,.065),y+.005,z)],.0035,WEAR,0)
    for i in range(8):
        x=random.uniform(7.18,10.2);y=1.33+random.uniform(0,.18);z=CZ+side*1.128
        tube('Lower cargo handling scuff',[(x,y,z),(x+random.uniform(.018,.09),y+.008,z)],.0027,WEAR,0)

CONTRACT={'id':'service_truck','center':[7.8,5.65],'footprint':[5.5,2.55],'height':2.95,'solid':True,'orientation':'Cab faces west / negative game X','wheelContactY':.025,'asset':'service-truck.glb'}
asset_objects=list(ASSETS.objects);lettering_names={o.name for o in asset_objects if o.type=='FONT'}

def report(objects):
    deps=bpy.context.evaluated_depsgraph_get();r={'coordinateSystem':'Intended game metres, Y-up; Blender source=(x,-z,y). Export reflects X for default Babylon left-handed glTF conversion.','collisionContract':CONTRACT,'sourceObjects':len(objects),'materials':len({o.data.materials[0].name for o in objects if o.data.materials}),'triangles':0,'min':[1e6]*3,'max':[-1e6]*3,'assemblies':{}}
    for o in objects:
        ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();tri=len(me.loop_triangles)
        a=r['assemblies'].setdefault(o.get('assembly','truck'),{'objects':0,'triangles':0});a['objects']+=1;a['triangles']+=tri;r['triangles']+=tri
        for v in me.vertices:
            p=o.matrix_world@v.co;co=(p.x,p.z,-p.y)
            for j in range(3):r['min'][j]=min(r['min'][j],co[j]);r['max'][j]=max(r['max'][j],co[j])
        ev.to_mesh_clear()
    for key in ['min','max']:r[key]=[round(x,6) for x in r[key]]
    return r
QA=report(asset_objects)

# Three-quarter product study, physically lit, saved with all editable pieces.
GROUP='preview'
floor=material('Preview / warm concrete',(.14,.16,.16),.04,.61)
cube('Preview concrete',(7.8,-.075,5.65),(200,.14,200),floor,.0,True)
def area(name,loc,energy,col,size,target):
    light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.color=col;light.shape='DISK';light.size=size
    o=bpy.data.objects.new(name,light);STAGE.objects.link(o);o.location=xyz(loc)
    o.rotation_euler=(Vector(xyz(target))-o.location).to_track_quat('-Z','Y').to_euler()
area('Preview / large softbox',(3.7,7.8,10.2),1450,(1,.88,.72),6,(7.8,1,5.65))
area('Preview / cool rim',(10.2,6.1,2.2),1650,(.73,.86,1),5,(7.8,1.3,5.65))
area('Preview / gentle frontal fill',(2.3,3.4,3.6),700,(.83,.92,1),4,(6.8,1.3,5.65))
camera=bpy.data.cameras.new('Preview / three quarter camera');co=bpy.data.objects.new('Preview / three quarter camera',camera);STAGE.objects.link(co)
co.location=xyz((1.05,4.20,12.2));co.rotation_euler=(Vector(xyz((7.7,1.35,5.65)))-co.location).to_track_quat('-Z','Y').to_euler()
camera.type='ORTHO';camera.ortho_scale=7.90;bpy.context.scene.camera=co
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.20,.20,.20);scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(DOCS/'truck-preview.png')
scene['asset_contract']=json.dumps(CONTRACT);scene['rebuild_command']='blender --background --python tools/service-assets/build_truck.py'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))

# Bake export-only modifiers and consolidate by material. The .blend above
# retains the complete separate component model and camera/light rig.
bpy.ops.object.select_all(action='DESELECT')
for o in asset_objects:o.select_set(True)
bpy.context.view_layer.objects.active=asset_objects[0];bpy.ops.object.convert(target='MESH')
objects=list(bpy.context.selected_objects)
for o in objects:
    if o.name in lettering_names:
        o.data.transform(Matrix.Diagonal((-1.,1.,1.,1.)))
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
groups={}
for o in objects:groups.setdefault(o.data.materials[0].name,[]).append(o)
exported=[]
for mat,obs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    if len(obs)>1:bpy.ops.object.join()
    o=bpy.context.object;o.name='Hotel delivery truck / '+mat;o['assembly']='consolidated_by_material';exported.append(o)
bpy.ops.object.select_all(action='DESELECT')
reflection=Matrix.Diagonal((-1.,1.,1.,1.))
for o in exported:
    o.data.transform(reflection@o.matrix_world);o.matrix_world=Matrix.Identity(4)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update();o.select_set(True)
bpy.context.view_layer.objects.active=exported[0]
bpy.ops.export_scene.gltf(filepath=str(EXPORT),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
QA['exportMeshes']=len(exported);QA['glbBytes']=EXPORT.stat().st_size
QA['runtimeCoordinateSystem']='Reflected X is restored by the default Babylon left-handed glTF root; keep that default root conversion.'
QA['letteringOrientation']='Export mirrors local text X to maintain reading order in the game camera, matching the existing lounge asset convention. Editable source lettering is natural for the Blender preview.'
(DOCS/'truck-report.json').write_text(json.dumps(QA,indent=2))
print('SERVICE_TRUCK_EXPORT',json.dumps(QA))
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.ops.render.render(write_still=True)
print('SERVICE_TRUCK_COMPLETE',str(EXPORT),str(SOURCE))
