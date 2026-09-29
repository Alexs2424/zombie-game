"""Original Art Deco furniture and a fictional drum-fed reward gun, authored in Blender.
Run Blender --background --factory-startup --threads 2 --python this_file.py.
All textures and geometry are generated locally; no downloaded assets are used.
"""
import bpy, bmesh, math, json, sys, struct, argparse
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np
bpy.context.preferences.filepaths.save_version=0

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'public/models'
DOC = ROOT/'docs/hotel-assets'
DOC.mkdir(parents=True, exist_ok=True)
(DOC/'textures').mkdir(exist_ok=True)
p=argparse.ArgumentParser();p.add_argument('--only',default='all');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
PARTS=[]; M={}; CURRENT=''; MANIFEST=[]

def texture(name, kind):
    n=192; yy,xx=np.mgrid[0:n,0:n]; rng=np.random.default_rng(178 if kind=='wood' else 247)
    if kind=='wood':
        wave=np.sin(xx*.29+1.8*np.sin(yy*.024)+.4*np.sin(yy*.083))
        grain=np.sin(xx*1.05+2*np.sin(yy*.015))*.11
        v=.72+wave*.15+grain+rng.normal(0,.025,(n,n))
        rgb=np.dstack([v*.29,v*.12,v*.044])
    elif kind=='fabric':
        weave=(np.sin(xx*math.pi/2)*np.sin(yy*math.pi/2))*.07
        v=.83+weave+rng.normal(0,.035,(n,n));rgb=np.dstack([v*.055,v*.225,v*.205])
    else:
        veins=np.abs(np.sin(xx*.031+np.sin(yy*.027)*1.9))**24
        v=.11+veins*.11+rng.normal(0,.005,(n,n));rgb=np.dstack([v*.82,v,v*.98])
    pixels=np.dstack([np.clip(rgb,0,1),np.ones((n,n))]).astype(np.float32)
    im=bpy.data.images.new(name,n,n);im.pixels.foreach_set(pixels.ravel());im.filepath_raw=str(DOC/'textures'/f'{name}.png');im.file_format='PNG';im.save();im.pack();return im

def mat(name,color,metal=0,rough=.5,image=None,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
    if image:
        t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image;m.node_tree.links.new(t.outputs['Color'],b.inputs['Base Color'])
    if emission:
        b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    return m

def reset(name):
    global PARTS,M,CURRENT
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for c in list(bpy.data.collections):
        if c.name!='Collection' and c.users==0:bpy.data.collections.remove(c)
    PARTS=[];CURRENT=name
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
    wood=texture('original-walnut','wood');fabric=texture('original-teal-weave','fabric');stone=texture('original-green-marble','stone')
    M={
      'wood':mat('Walnut | original longitudinal grain',(.25,.09,.03),.02,.32,wood),
      'fabric':mat('Petrol velvet | original woven texture',(.055,.225,.205),0,.76,fabric),
      'marble':mat('Green marble | original mineral veins',(.09,.14,.12),.02,.22,stone),
      'brass':mat('Aged champagne brass',(.58,.36,.12),.82,.27),
      'bronze':mat('Dark patinated bronze',(.18,.115,.047),.75,.4),
      'black':mat('Ebony and deep recesses',(.012,.018,.019),.1,.49),
      'cream':mat('Warm ivory porcelain',(.85,.79,.63),.025,.32),
      'leather':mat('Oxblood leather',(.18,.023,.029),.015,.5),
      'seam':mat('Upholstery piping',(.024,.088,.076),0,.8),
      'steel':mat('Polished stainless details',(.43,.48,.46),.87,.23),
      'glass':mat('Smoked pale glass',(.42,.58,.51),.26,.16),
      'amber':mat('Warm illuminated amber',(.95,.38,.065),.12,.3,None,.65),
      'mint':mat('Jade illuminated glass',(.09,.57,.40),.12,.24,None,.55),
      'green':mat('Palm fronds',(.065,.21,.105),0,.77),
      'gun':mat('Brushed blued steel',(.055,.078,.09),.88,.27),
    }

def uv_project(o):
    if o.type!='MESH':return
    uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
    for f in o.data.polygons:
        axis=max(range(3),key=lambda i:abs(f.normal[i]));ab=[i for i in range(3) if i!=axis]
        for li in f.loop_indices:
            v=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(v[ab[0]]*.75,v[ab[1]]*2.2)

def finish(o,name,material,edge=0,smooth=False):
    o.name=name;o.data.materials.append(M[material]);PARTS.append(o)
    if o.type=='MESH':
        uv_project(o)
        if edge:
            b=o.modifiers.new('Soft manufactured edges','BEVEL');b.width=edge;b.segments=2;b.limit_method='ANGLE';b.harden_normals=True
            n=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');n.keep_sharp=True
        for f in o.data.polygons:f.use_smooth=smooth or bool(edge)
    return o

def box(name,loc,size,material='wood',edge=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,min(edge,min(size)*.22))

def mesh(name,verts,faces,material,edge=0,smooth=False):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
    return finish(o,name,material,edge,smooth)

def rod(name,a,b,r,material='brass',n=16,r2=None):
    a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return finish(o,name,material,.002,True)

def line(name,points,r,material='brass',closed=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=1
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*v,1)
    s.use_cyclic_u=closed;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);return finish(o,name,material)

def lathe(name,profile,material='brass',center=(0,0),n=32,flutes=0):
    verts=[]
    for r,z in profile:
        for i in range(n):
            a=math.tau*i/n;rr=r*(1+flutes*math.cos(a*16));verts.append((center[0]+rr*math.cos(a),center[1]+rr*math.sin(a),z))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(n):k=(i+1)%n;faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
    return mesh(name,verts,faces,material,smooth=True)

def extrude(name,profile,depth,material='wood',edge=.01):
    # X/height silhouette, thickness along Blender Y.
    n=len(profile);verts=[(x,y,z) for y in [-depth/2,depth/2] for x,z in profile]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,material,edge)

def text(name,label,loc,size=.10,material='brass'):
    c=bpy.data.curves.new(name,'FONT');c.body=label;c.align_x='CENTER';c.size=size;c.extrude=.0015;c.bevel_depth=.0008;c.bevel_resolution=1
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,math.pi)
    return finish(o,name,material)

def rim(name,x,y,z,w,d,r=.008,material='brass'):
    return line(name,[(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x+w/2,y+d/2,z),(x-w/2,y+d/2,z)],r,material,True)

def feet(w,d,z=.18,material='wood',offset=(0,0)):
    for x in [-w/2,w/2]:
        for y in [-d/2,d/2]:
            rod('Tapered furniture leg',(x+offset[0],y+offset[1],.03),(x+offset[0],y+offset[1],z),.055,material,r2=.04)
            rod('Brass leg sabot',(x+offset[0],y+offset[1],0),(x+offset[0],y+offset[1],.045),.058,'brass')

def reception():
    box('Recessed toe plinth',(0,0,.10),(6.45,1.90,.20),'black',.035)
    box('Walnut reception cabinet',(0,0,.62),(6.55,1.94,.98),'wood',.045)
    box('Thick green marble writing ledge',(0,0,1.16),(6.8,2.1,.12),'marble',.035)
    for x in np.linspace(-3.05,3.05,29):box('Fluted brass front pilaster',(float(x),.984,.62),(.045,.035,.84),'brass',.008)
    for x in [-2.15,0,2.15]:
        box('Inset leather guest panel',(x,1.014,.65),(1.79,.024,.57),'leather',.035)
        for k in [-1,1]:line('Deco panel diagonal',[(x+k*.73,1.04,.39),(x,1.04,.92),(x-k*.73,1.04,.39)],.008,'brass')
    for z in [.23,1.05]:box('Front brass perimeter molding',(0,1.012,z),(6.50,.045,.037),'brass',.008)
    box('Reception key pigeonhole case',(0,-.74,1.48),(3.25,.28,.43),'wood',.025)
    for x in np.linspace(-1.46,1.46,13):box('Key pigeonhole vertical divider',(float(x),-.57,1.47),(.021,.07,.32),'brass',.003)
    for z in [1.33,1.49,1.65]:box('Key pigeonhole shelf',(0,-.57,z),(3.10,.09,.022),'brass',.003)
    for i in range(12):
        x=-1.34+i*.244;rod('Room key hook',(x,-.52,1.40),(x,-.48,1.40),.009)
        box('Ivory room key tag',(x,-.465,1.35),(.064,.012,.085),'cream',.008)
    lathe('Reception service bell',[(0,1.22),(.125,1.22),(.125,1.25),(.085,1.30),(.025,1.34),(0,1.34)],center=(-2.45,.48))
    rod('Bell plunger',(-2.45,.48,1.33),(-2.45,.48,1.39),.018,'brass')
    box('Guest register leather cover',(2.15,.35,1.235),(.68,.46,.025),'leather',.008)
    box('Register ivory pages',(2.15,.35,1.26),(.63,.41,.03),'cream',.004)
    text('Reception maker lettering','GRAND HOTEL',(0,1.045,.62),.165,'cream')

def jukebox():
    profile=[(-.70,.06),(.70,.06),(.70,1.58)]+[(.70*math.cos(a),1.58+.70*math.sin(a)) for a in np.linspace(0,math.pi,33)][1:]+[(-.70,.06)]
    extrude('Sculpted arched walnut cabinet',profile,.76,'wood',.035)
    box('Brass stepped base',(0,0,.08),(1.5,.85,.16),'brass',.025)
    for radius,material,depth in [(.66,'brass',.414),(.60,'mint',.426),(.54,'brass',.427),(.48,'amber',.429)]:
        line('Luminous horseshoe arch',[(radius*math.cos(a),depth,1.57+radius*math.sin(a)) for a in np.linspace(0,math.pi,49)],.028,material)
        for x in [-radius,radius]:rod('Illuminated arch column',(x,depth,.23),(x,depth,1.57),.027,material)
    box('Speaker velvet grille',(0,.405,.66),(.88,.023,.78),'black',.06)
    for x in np.linspace(-.38,.38,13):rod('Speaker brass grille',(float(x),.435,.30),(float(x),.435,1.00),.012,'brass',10)
    for z in [.38,.90]:rod('Grille cross trim',(-.41,.442,z),(.41,.442,z),.012,'bronze')
    box('Song selector illuminated window',(0,.424,1.32),(.86,.035,.42),'cream',.018)
    for z in [1.19,1.28,1.37,1.46]:
        for x in [-.21,.21]:box('Printed song title card',(x,.449,z),(.34,.01,.047),'black',.003)
    for x in np.linspace(-.33,.33,8):rod('Selector pearl button',(float(x),.447,1.066),(float(x),.475,1.066),.029,'cream',16)
    text('Jukebox title','GRAND',(0,.44,1.80),.13)
    text('Jukebox subtitle','HI - FI',(0,.444,1.65),.065)
    box('Coin slot plate',(.35,.456,.22),(.20,.014,.14),'brass',.006)
    box('Coin slot',(.35,.469,.24),(.076,.005,.008),'black',.001)
    for x in [-.50,.50]:box('Decorative cabinet corner',(x,.0,2.20),(.20,.50,.08),'brass',.02)

def sofa(w=3.8,d=1.35,h=1.12,armchair=False):
    feet(w-.38,d-.36,.22)
    box('Sculpted walnut sofa frame',(0,0,.26),(w-.10,d-.05,.20),'wood',.04)
    box('Deep upholstered seat base',(0,.03,.43),(w-.20,d-.15,.25),'fabric',.08)
    box('Tufted curved back cushion',(0,-d*.33,h*.70),(w-.16,.40,h*.52),'fabric',.11)
    for x in [-w/2+.15,w/2-.15]:
        box('Rounded upholstered rolled arm',(x,.035,.67),(.29,d-.10,.48),'fabric',.11)
        box('Art Deco arm veneer',(x+(-.152 if x<0 else .152),.02,.55),(.021,d-.22,.43),'wood',.009)
        for k in [-1,0,1]:box('Arm brass streamline',(x+(-.169 if x<0 else .169),.03,.40+k*.10),(.012,d-.32,.012),'brass',.002)
    count=1 if armchair else 3
    seatw=(w-.67)/count
    for i in range(count):
        x=(i-(count-1)/2)*seatw
        box('Individual piped seat cushion',(x,.12,.57),(seatw-.035,d-.47,.18),'fabric',.06)
        rim('Cushion sewn piping',x,.12,.64,seatw-.10,d-.54,.007,'seam')
        for z in [h*.65,h*.84]:rod('Deep button tuft',(x,-d*.115,z),(x,-d*.098,z),.022,'seam',14)
    box('Sofa brass lower shadow line',(0,d*.47,.32),(w-.18,.02,.02),'brass',.004)

def chair(x,y,angle=0):
    start=len(PARTS)
    feet(.45,.48,.47)
    box('Dining chair bentwood seat frame',(0,0,.47),(.65,.66,.10),'wood',.025)
    box('Dining chair upholstered cushion',(0,.015,.55),(.61,.61,.13),'fabric',.045)
    rim('Dining chair cushion seam',0,.015,.60,.55,.54,.005,'seam')
    for xx in [-.25,.25]:rod('Tapered chair back stile',(xx,-.26,.42),(xx,-.28,1.12),.030,'wood')
    box('Dining chair upholstered back',(0,-.28,.91),(.61,.14,.42),'fabric',.06)
    for xx in [-.22,0,.22]:rod('Chair back brass flute',(xx,-.357,.72),(xx,-.357,1.08),.005,'brass',8)
    transform=Matrix.Translation((x,y,0))@Matrix.Rotation(angle,4,'Z')
    for o in PARTS[start:]:o.matrix_world=transform@o.matrix_world

def place_setting(x,y,z=.884,angle=0):
    lathe('Ivory dinner plate',[(0,z),(.19,z),(.21,z+.018),(.19,z+.032),(.14,z+.021),(0,z+.02)],'cream',center=(x,y),n=28)
    lathe('Plate fine gold rim',[(.199,z+.022),(.202,z+.028)],'brass',center=(x,y),n=28)
    box('Folded linen napkin',(x,y,z+.045),(.18,.12,.025),'cream',.012)
    for dx in [-.265,.265]:
        rod('Silver cutlery handle',(x+dx,y-.12,z+.03),(x+dx,y+.06,z+.03),.009,'steel',8)
        if dx<0:
            for k in [-1,0,1]:rod('Fork tine',(x+dx+k*.008,y+.055,z+.03),(x+dx+k*.008,y+.10,z+.03),.0025,'steel',6)
        else:box('Knife blade',(x+dx,y+.08,z+.03),(.020,.10,.009),'steel',.002)
    gx=x+.23;gy=y+.22
    lathe('Wine glass stem and bowl',[(0,z),(.051,z),(.055,z+.006),(.007,z+.012),(.005,z+.09),(.033,z+.11),(.048,z+.16),(.043,z+.20),(.038,z+.20),(.041,z+.16),(.027,z+.117),(0,z+.11)],'glass',center=(gx,gy),n=20)

def dining():
    for x in [-.77,.77]:
        lathe('Dining table turned pedestal',[(0,0),(.38,0),(.38,.06),(.29,.12),(.13,.19),(.105,.67),(.25,.75),(0,.76)],'wood',center=(x,0),flutes=.035)
        lathe('Pedestal brass foot ring',[(.36,.04),(.37,.06),(.36,.08)],'brass',center=(x,0))
    box('Thick oval-edge walnut dining top',(0,0,.82),(2.8,1.54,.13),'wood',.10)
    box('Ivory linen table runner',(0,0,.891),(2.62,.55,.012),'cream',.012)
    for y in [-1.21,1.21]:
        for x in [-.74,.74]:chair(x,y,0 if y<0 else math.pi)
    chair(-1.69,0,-math.pi/2);chair(1.69,0,math.pi/2)
    for x in [-.75,.75]:
        for y in [-.44,.44]:place_setting(x,y)
    lathe('Centerpiece fluted brass vase',[(0,.90),(.10,.90),(.065,1.04),(.09,1.19),(.075,1.20)],'brass',n=24,flutes=.06)
    for i in range(5):
        a=i*math.tau/5;rod('Flower stem',(0,0,1.08),(.10*math.cos(a),.10*math.sin(a),1.26),.005,'green',6)
        for k in range(5):
            aa=k*math.tau/5;bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=1,location=(.10*math.cos(a)+.022*math.cos(aa),.10*math.sin(a)+.022*math.sin(aa),1.27))
            o=bpy.context.object;o.scale=(.032,.032,.015);finish(o,'Ivory centerpiece flower petal','cream',smooth=True)

def booth():
    box('Long walnut banquette plinth',(-.14,0,.18),(1.60,5.85,.30),'wood',.065)
    box('Long upholstered seat base',(-.05,0,.43),(1.53,5.78,.25),'fabric',.08)
    box('Tall upholstered booth back',(-.76,0,.87),(.32,5.87,1.02),'fabric',.11)
    for y in np.linspace(-2.55,2.55,9):
        box('Individual banquette seat cushion',(.02,float(y),.62),(1.29,.61,.20),'fabric',.065)
        rim('Banquette cushion seam',.02,float(y),.70,1.19,.53,.006,'seam')
        box('Vertically channeled booth back',(-.55,float(y),1.01),(.17,.60,.62),'fabric',.06)
        rod('Backrest button tuft',(-.45,float(y),1.0),(-.43,float(y),1.0),.024,'seam',12)
    for y in [-2.89,2.89]:box('Booth end wood cap',(-.07,y,.83),(1.72,.13,.88),'wood',.04)
    rod('Long brass footrail',(.91,-2.8,.16),(.91,2.8,.16),.026,'brass')

def luggage():
    box('Carpeted luggage platform',(0,0,.25),(1.54,.91,.16),'wood',.055)
    box('Platform oxblood leather inset',(0,0,.345),(1.44,.82,.04),'leather',.025)
    for x in [-.62,.62]:
        for y in [-.34,.34]:rod('Black luggage caster',(x-.065,y,.12),(x+.065,y,.12),.12,'black',20)
    for x in [-.66,.66]:
        line('Polished brass trolley arch',[(x,y,z) for y,z in [(-.32,.35),(-.32,1.63),(-.26,1.83),(0,1.94),(.26,1.83),(.32,1.63),(.32,.35)]],.028,'brass')
    rod('Luggage trolley top rail',(-.66,0,1.94),(.66,0,1.94),.029,'brass')
    for y in [-.35,.35]:rod('Platform brass rail',(-.68,y,.39),(.68,y,.39),.024,'brass')
    for loc,size,matr in [((-.34,.02,.62),(.69,.65,.52),'leather'),((.34,-.02,.68),(.55,.63,.66),'wood'),((-.32,.03,1.00),(.62,.56,.22),'leather')]:
        box('Vintage travel case',loc,size,matr,.055)
        for xx in [-.18,.18]:box('Suitcase leather strap',(loc[0]+xx,loc[1],loc[2]),(.037,size[1]+.01,size[2]+.008),'bronze',.005)
        line('Suitcase handle',[(loc[0]-.09,loc[1],loc[2]+size[2]/2),(loc[0]-.09,loc[1],loc[2]+size[2]/2+.065),(loc[0]+.09,loc[1],loc[2]+size[2]/2+.065),(loc[0]+.09,loc[1],loc[2]+size[2]/2)],.014,'black')

def counter(w=6.4,d=1.3,h=1.45,host=False):
    body=h-.20
    box('Stepped ebony counter plinth',(0,0,.07),(w-.10,d-.10,.14),'black',.025)
    box('Walnut service cabinet',(0,0,body/2+.09),(w-.10,d-.08,body),'wood',.035)
    box('Green marble service top',(0,0,h-.08),(w,d,.12),'marble',.025)
    count=5 if not host else 1
    for i in range(count):
        x=(i-(count-1)/2)*(w-.30)/count;pw=(w-.30)/count-.07
        box('Inset cabinet face',(x,d/2-.026,body*.55),(pw,.035,body*.71),'leather' if host else 'wood',.012)
        for xx in [x-pw/2+.03,x+pw/2-.03]:box('Brass cabinet stile',(xx,d/2+.001,body*.55),(.018,.014,body*.68),'brass',.002)
        rod('Cabinet pull',(x-.11,d/2+.018,body*.76),(x+.11,d/2+.018,body*.76),.011,'brass')
    if host:
        box('Host reservation folio',(0,0,h-.002),(.62,.42,.038),'leather',.007)
        text('Host front emblem','GH',(0,d/2+.025,.68),.18)
    else:
        for x in [-2.25,2.25]:
            for i in range(4):lathe('Stacked service plates',[(0,h-.01+i*.023),(.18,h-.01+i*.023),(.20,h+.002+i*.023),(.19,h+.01+i*.023),(0,h+.013+i*.023)],'cream',center=(x,.05),n=24)

def planter():
    lathe('Fluted glazed planter',[(0,0),(.36,0),(.40,.055),(.48,.56),(.46,.64),(.40,.64),(.39,.58),(0,.56)],'marble',n=48,flutes=.03)
    lathe('Planter brass rim',[(.461,.61),(.465,.65),(.40,.65)],'brass',n=48)
    lathe('Dark soil',[(0,.56),(.39,.56)],'black',n=24)
    for i in range(3):
        ang=i*math.tau/3;cx=.09*math.cos(ang);cy=.09*math.sin(ang)
        rod('Palm fibrous trunk',(cx,cy,.55),(cx*.5,cy*.5,1.76+i*.12),.047,'wood',12,r2=.020)
        for k in range(8):
            a=k*math.tau/8+i*.34;start=Vector((cx*.5,cy*.5,1.68+i*.12));tip=start+Vector((.53*math.cos(a),.53*math.sin(a),.13 if k%2 else .35))
            line('Palm curved central rib',[start,start*.5+tip*.5+Vector((0,0,.18)),tip],.008,'green')
            for j in range(1,7):
                t=j/7;center=start.lerp(tip,t)+Vector((0,0,.12*math.sin(t*math.pi)));side=Vector((-math.sin(a),math.cos(a),-.08));length=.15*math.sin(math.pi*t)+.03
                for sign in [-1,1]:
                    end=center+side*sign*length+Vector((math.cos(a)*.08,math.sin(a)*.08,-.025))
                    v=[center,center.lerp(end,.45)+Vector((0,0,.023)),end,center.lerp(end,.45)-Vector((0,0,.012))]
                    mesh('Sculpted palm leaf',v,[(0,1,2),(0,2,3),(2,1,0),(3,2,0)],'green',smooth=True)

def coffee():
    feet(1.92,.82,.45)
    box('Walnut lower magazine shelf',(0,0,.23),(2.15,1.01,.07),'wood',.035)
    box('Beveled green marble coffee top',(0,0,.53),(2.4,1.2,.10),'marble',.045)
    rim('Coffee table brass rim',0,0,.49,2.32,1.12,.013,'brass')
    for i in range(3):box('Stacked lounge periodicals',(-.35,.10,.28+i*.025),(.64,.42,.020),'cream' if i%2 else 'leather',.006)

def wpoint(p):return (p[0],-p[2],p[1])
def wb(name,loc,size,matr='gun',edge=.002):return box(name,wpoint(loc),(size[0],size[2],size[1]),matr,edge)
def wr(name,a,b,r,matr='gun',n=24,r2=None):return rod(name,wpoint(a),wpoint(b),r,matr,n,r2)
def wprofile(name,profile,width,matr='wood',edge=.002):
    n=len(profile);v=[(x,-z,y) for x in [-width/2,width/2] for y,z in profile]
    f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,v,f,matr,edge)
def tube(name,a,b,r,inner,matr='gun',n=32):
    a,b=Vector(wpoint(a)),Vector(wpoint(b));w=(b-a).normalized();u=w.cross(Vector((0,1,0) if abs(w.y)<.9 else (1,0,0))).normalized();v=w.cross(u);verts=[]
    for pt,rr in [(a,r),(b,r),(a,inner),(b,inner)]:
        for i in range(n):verts.append(pt+rr*(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n)))
    faces=[]
    for i in range(n):
        j=(i+1)%n;faces += [(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)]
    return mesh(name,verts,faces,matr,smooth=True)

def tommy():
    wb('Receiver',(0,.014,-.01),(.061,.073,.256),'gun',.005)
    wb('Receiver upper machined ridge',(0,.054,-.01),(.047,.011,.24),'gun',.003)
    wb('Receiver lower trigger frame',(0,-.034,-.018),(.045,.019,.193),'gun',.003)
    wprofile('Walnut swept buttstock',[(.003,-.135),(-.008,-.225),(-.030,-.46),(-.046,-.515),(-.151,-.515),(-.164,-.468),(-.085,-.233),(-.073,-.14)],.069,'wood',.009)
    wprofile('Buttstock black recoil pad',[(-.042,-.510),(-.048,-.53),(-.151,-.53),(-.163,-.512)],.074,'black',.004)
    wprofile('Rifle-compatible walnut pistol grip',[(-.033,-.079),(-.041,-.037),(-.142,-.067),(-.146,-.099),(-.116,-.108)],.039,'wood',.004)
    for side in [-1,1]:
        for j in range(8):wr('Fine grip checkering',(side*.020,-.055-j*.009,-.062),(side*.020,-.05-j*.009,-.085),.0008,'bronze',6)
    wr('Barrel shoulder',(0,.025,.116),(0,.025,.163),.024,'gun',32)
    wr('Long barrel',(0,.025,.15),(0,.025,.458),.013,'gun',32)
    for z in np.linspace(.17,.335,24):tube('Closely spaced barrel cooling fins',(0,.025,float(z)),(0,.025,float(z)+.0032),.024,.012,'gun',32)
    tube('Open cut muzzle crown',(0,.025,.444),(0,.025,.480),.021,.009,'gun',40)
    for side in [-1,1]:
        for z in [.452,.463]:wb('Muzzle side ports',(side*.0205,.025,z),(.002,.017,.005),'black',.0005)
    wb('Rear sight pedestal',(0,.067,-.091),(.045,.014,.036),'gun',.002)
    for x in [-.015,.015]:wb('Rear aperture shoulders',(x,.085,-.092),(.009,.025,.012),'steel',.001)
    wb('Front sight ramp',(0,.053,.453),(.017,.027,.026),'gun',.003)
    wb('Brass front sight blade',(0,.072,.458),(.004,.014,.011),'brass',.0008)
    wb('Bolt channel',(0,.061,-.020),(.022,.003,.125),'black',.001)
    wb('Bolt',(0,.063,.0),(.017,.008,.056),'steel',.001)
    wr('Bolt handle stem',(0,.065,-.008),(0,.088,-.008),.004,'steel',16)
    wb('Bolt handle',(0,.089,-.008),(.028,.010,.017),'gun',.002)
    # The entire drum and every embossed detail are parented to a single Magazine node.
    begin=len(PARTS)
    wr('Drum body',(-.046,-.117,.065),(.046,-.117,.065),.099,'gun',64)
    for side in [-1,1]:
        wr('Drum face dish',(side*.047,-.117,.065),(side*.049,-.117,.065),.088,'gun',48)
        tube('Drum concentric rim',(side*.049,-.117,.065),(side*.051,-.117,.065),.090,.081,'steel',48)
        tube('Drum embossed inner ring',(side*.050,-.117,.065),(side*.052,-.117,.065),.063,.060,'gun',40)
        wr('Drum winding hub',(side*.050,-.117,.065),(side*.057,-.117,.065),.018,'bronze',24)
        for k in range(12):
            a=k*math.tau/12;wr('Drum radial pressed rib',(side*.052,-.117+.068*math.cos(a),.065+.068*math.sin(a)),(side*.052,-.117+.080*math.cos(a),.065+.080*math.sin(a)),.0022,'gun',6)
    wb('Drum feed tower',(0,-.044,.065),(.047,.038,.044),'gun',.003)
    for o in PARTS[begin:]:o['group']='Magazine'
    # Vertical support grip is shaped for the fitted support hand.
    wb('Foregrip steel mounting rail',(0,-.011,.255),(.028,.025,.139),'gun',.002)
    wprofile('Vertical walnut foregrip',[(-.016,.215),(-.021,.265),(-.065,.266),(-.170,.239),(-.174,.203),(-.14,.195),(-.055,.222)],.056,'wood',.007)
    for side in [-1,1]:
        for j in range(6):wr('Foregrip finger relief',(side*.028,-.056-j*.016,.211),(side*.028,-.053-j*.016,.247-j*.003),.0018,'bronze',8)
    line('Trigger guard',[wpoint(q) for q in [(0,-.041,-.040),(0,-.079,-.027),(0,-.082,.022),(0,-.062,.033),(0,-.040,.031)]],.004,'gun')
    line('Curved trigger',[wpoint(q) for q in [(0,-.037,-.006),(0,-.061,-.006),(0,-.067,.003)]],.004,'steel')
    for side in [-1,1]:
        wb('Receiver brass maker plate',(side*.0315,.003,-.055),(.001,.020,.077),'brass',.001)
        for y,z in [(.033,-.113),(-.012,-.106),(-.013,.016),(.034,.093)]:
            wr('Flush receiver screw',(side*.0305,y,z),(side*.033,y,z),.0034,'steel',12)
            wb('Screwdriver slot',(side*.0331,y,z),(.0004,.001,.005),'black',.0001)
        wr('Safety selector',(side*.033,-.018,-.061),(side*.034,-.030,-.047),.0025,'brass',10)
    tube('Rear sling eye',(-.038,-.091,-.395),(-.043,-.091,-.395),.010,.006,'steel',20)

def export_asset(name,expected=None,weapon=False):
    # Keep detailed editable construction in each .blend; export evaluated material batches.
    if expected:
        bpy.context.view_layer.update();dep=bpy.context.evaluated_depsgraph_get()
        # Curves can expose placeholder bound_box corners; measure the same evaluated
        # mesh geometry used by export, including text, bevels and upholstery piping.
        points=[]
        for o in PARTS:
            measured=bpy.data.meshes.new_from_object(o.evaluated_get(dep),depsgraph=dep)
            points.extend(o.matrix_world@v.co for v in measured.vertices)
            bpy.data.meshes.remove(measured)
        lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)]
        sx=min(1,expected[0]/(2*max(abs(lo[0]),abs(hi[0]))));sy=min(1,expected[1]/(2*max(abs(lo[1]),abs(hi[1]))));sz=min(1,expected[2]/(hi[2]-lo[2]))
        # Babylon's default glTF root mirrors X. Counter-mirror the asymmetric booth.
        fit=Matrix.Diagonal((sx*(-1 if name=='booth' else 1),sy,sz,1))@Matrix.Translation((0,0,-lo[2]))
        for o in PARTS:o.matrix_world=fit@o.matrix_world
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();groups={}
    for o in PARTS:
        ev=o.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev,depsgraph=deps)
        if len(me.vertices)==0:continue
        me.transform(o.matrix_world)
        if o.matrix_world.determinant()<0:me.flip_normals()
        me.update()
        # All exports carry UVs, including text/curve-derived ornamentation.
        if not me.uv_layers:me.uv_layers.new(name='UVMap')
        label=o.get('group','Bolt' if o.name=='Bolt' or o.name.startswith('Bolt handle') else 'Static')
        key=(label,o.data.materials[0].name)
        copy=bpy.data.objects.new(f'{label} | {o.data.materials[0].name}',me);bpy.context.collection.objects.link(copy)
        groups.setdefault(key,[]).append(copy)
    # Free exact animation names before creating export pivots; source objects remain editable.
    for original in PARTS:original.name='Source | '+original.name
    exports=[];parents={}
    root=bpy.data.objects.new('Tommy' if weapon else 'Hotel_'+name,None);bpy.context.collection.objects.link(root)
    root['units']='metres';root['front']='+Z muzzle' if weapon else '-Z in Babylon (booth seats face +X)'
    for (label,material),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0]
        o.name=f'{label} | {material}';o.parent=root
        if weapon and label!='Static':
            if label not in parents:
                p=bpy.data.objects.new(label,None);bpy.context.collection.objects.link(p);p.parent=root;parents[label]=p
            o.parent=parents[label]
        exports.append(o)
    # Bake static vertex positions into glTF, retaining clean identity animation pivots.
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in exports+list(parents.values()):o.select_set(True)
    filename=('tommy' if weapon else 'hotel-'+name)+'.glb'
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False,export_extras=True)
    verts=[o.matrix_world@v.co for o in exports for v in o.data.vertices]
    # Manifest is in raw glTF/Babylon convention, not Blender's Z-up editing space.
    vv=np.array([[v.x,v.z,-v.y] for v in verts]);tri=0
    for o in exports:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
    stat=dict(file=filename,bytes=(OUT/filename).stat().st_size,mesh_nodes=len(exports),material_batches=len(exports),triangles=tri,vertices=len(vv),bounds=[vv.min(0).tolist(),vv.max(0).tolist()],expected_fixture=expected,uvs=True)
    MANIFEST.append(stat)
    # Export mesh collection stays hidden in the editable source to avoid duplicate overlays.
    for o in exports:o.hide_set(True);o.hide_render=True
    bpy.ops.wm.save_as_mainfile(filepath=str(DOC/(('tommy' if weapon else 'hotel-'+name)+'.blend')))
    print('ASSET_DONE '+json.dumps(stat),flush=True)

def hands():
    reset('hands-tommy')
    bpy.ops.import_scene.gltf(filepath=str(OUT/'hands-rifle.glb'))
    imported=[o for o in bpy.context.scene.objects if o.type=='MESH']
    # Rotate the support palm from a horizontal fore-end onto the vertical grip.
    # A smooth forearm blend leaves the camera-side sleeve tail in its original location.
    pivot=Vector((0,-.02,.207));target=Vector((0,-.085,.226));rot=Matrix.Rotation(math.pi/2,3,'X')
    for o in imported:
        if 'LeftHand' not in o.name:continue
        inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            world=o.matrix_world@v.co;g=Vector((world.x,world.z,-world.y));t=max(0,min(1,(g.z+.25)/.37));weight=t*t*(3-2*t)
            shaped=rot@(g-pivot)+target;g=g.lerp(shaped,weight);v.co=inv@Vector((g.x,-g.z,g.y))
        o.data.update()
        if o.data.has_custom_normals:o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o not in PARTS:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'hands-tommy.glb'),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
    bpy.ops.wm.save_as_mainfile(filepath=str(DOC/'hands-tommy.blend'))
    data=(OUT/'hands-tommy.glb').read_bytes();gltf=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
    vv=np.array([[p.x,p.z,-p.y] for o in imported for v in o.data.vertices for p in [o.matrix_world@v.co]])
    primitives=[p for m in gltf['meshes'] for p in m['primitives']]
    MANIFEST.append(dict(file='hands-tommy.glb',bytes=len(data),mesh_nodes=len(primitives),material_batches=len(primitives),vertices=sum(gltf['accessors'][p['attributes']['POSITION']]['count'] for p in primitives),triangles=sum(gltf['accessors'][p['indices']]['count']//3 for p in primitives),bounds=[vv.min(0).tolist(),vv.max(0).tolist()],uvs=True))
    print('HANDS_DONE',flush=True)

builders=[
 ('reception',reception,[6.8,2.1,1.7]),('jukebox',jukebox,[1.5,.85,2.35]),
 ('dining-table',dining,[4.2,3.6,1.35]),('sofa',sofa,[3.8,1.35,1.12]),
 ('armchair',lambda:sofa(1.2,1.2,1.12,True),[1.2,1.2,1.12]),('booth',booth,[2,6,1.4]),
 ('luggage-cart',luggage,[1.6,1,2]),('host-stand',lambda:counter(1.35,.9,1.2,True),[1.35,.9,1.2]),
 ('service-counter',counter,[6.4,1.3,1.45]),('planter',planter,[1.2,1.2,2.35]),
 ('coffee-table',coffee,[2.4,1.2,.58]),('tommy',tommy,None),
]
for name,build,bounds in builders:
    if args.only!='all' and name not in args.only.split(','):continue
    reset(name);build();export_asset(name,bounds,name=='tommy')
if args.only=='all' or 'hands' in args.only.split(','):hands()
manifest_path=DOC/'asset-manifest.json'
old=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
entries={a['file']:a for a in old.get('assets',[])};entries.update({a['file']:a for a in MANIFEST})
manifest=dict(provenance='Original Blender-authored geometry and seeded procedural textures; fitted hands adapted from existing original hands-rifle.glb.',units='metres',coordinates='Raw glTF +Y up, furniture front -Z; booth back -X/open +X. Gun +Z forward, origin at receiver.',assets=list(entries.values()),tommy=dict(muzzle=[0,.025,.48],animation_nodes=['Magazine','Bolt'],hands='hands-tommy.glb',support_grip=[0,-.085,.226],right_grip='Same profile and contact position as existing rifle',length=1.01))
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
