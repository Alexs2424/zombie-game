"""Original Belle Epoque reception assets, authored in Blender in metres.

Blender --background --factory-startup --threads 2 --python this_file.py
Use -- --only reception to rebuild a single asset. Material batches in GLB;
individual named construction parts and packed textures in editable .blend files.
All geometry and textures are generated locally. No third-party assets.
"""
import argparse, bpy, bmesh, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models'; DOC=ROOT/'docs/hotel-assets'
TEX=DOC/'reception-textures';TEX.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
PARTS=[]; M={}; STATS=[]

def texture(name,kind):
    n=512;yy,xx=np.mgrid[0:n,0:n];rng=np.random.default_rng(215)
    if kind=='wood':
        grain=np.sin(xx*.24+np.sin(yy*.014)*2+np.sin(yy*.035)*.6)
        fine=np.sin(xx*.96+np.sin(yy*.028)*1.5)*.022
        v=.73+grain*.1+fine+rng.normal(0,.009,(n,n));rgb=np.dstack([v*.17,v*.059,v*.020])
    elif kind=='marble':
        veins=np.abs(np.sin(xx*.013+yy*.004+np.sin(yy*.016)*1.25+np.sin(xx*.045)*.14))**42
        second=np.abs(np.sin(xx*.041-yy*.009+np.sin(yy*.021)))**76
        v=.89-veins*.23-second*.08+rng.normal(0,.006,(n,n));rgb=np.dstack([v,v*.966,v*.884])
    else:
        v=.86+rng.normal(0,.035,(n,n));rgb=np.dstack([v*.19,v*.046,v*.035])
    image=bpy.data.images.new(name,n,n)
    image.pixels.foreach_set(np.dstack([np.clip(rgb,0,1),np.ones((n,n))]).astype(np.float32).ravel())
    image.filepath_raw=str(TEX/(name+'.png'));image.file_format='PNG';image.save();image.pack();return image

def material(name,color,rough=.5,metal=0,image=None,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if image:
        t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image;m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m

def reset():
    global PARTS,M
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);PARTS=[]
    bpy.context.scene.unit_settings.system='METRIC'
    M={
      'walnut':material('French walnut • quarter-sawn grain',(.22,.08,.028),.29,image=texture('reception-walnut','wood')),
      'carved':material('Dark carved walnut',(.085,.024,.009),.36),
      'marble':material('Ivory marble • mineral veining',(.85,.81,.73),.19,image=texture('reception-ivory-marble','marble')),
      'brass':material('Warm satin brass',(.56,.34,.105),.29,.78),
      'gold':material('Pale gilt ornament',(.68,.48,.19),.33,.68),
      'bronze':material('Aged bronze shadow details',(.12,.063,.019),.44,.66),
      'ivory':material('Warm ivory lacquer',(.83,.765,.615),.36),
      'linen':material('Pleated champagne silk',(.84,.72,.50),.64,emission=.16),
      'leather':material('Oxblood calfskin',(.17,.036,.027),.58,image=texture('reception-leather','leather')),
      'green':material('Bottle green leather writing pad',(.02,.082,.058),.53),
      'black':material('Black Bakelite',(.012,.015,.014),.30),
      'recess':material('Dark cabinet recess',(.018,.012,.009),.86),
      'paper':material('Warm uncoated paper',(.89,.835,.705),.83),
      'ink':material('Faded sepia ink',(.08,.046,.022),.95),
      'tan':material('Honey saddle leather',(.30,.136,.058),.59),
      'lining':material('Muted green suitcase lining',(.085,.14,.102),.9),
    }

def finish(o,name,mat,edge=0,smooth=False):
    o.name=name;o.data.materials.append(M[mat]);PARTS.append(o)
    if o.type=='MESH':
        uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
        for f in o.data.polygons:
            axis=max(range(3),key=lambda i:abs(f.normal[i]));axes=[i for i in range(3) if i!=axis]
            for li in f.loop_indices:
                p=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(p[axes[0]]*(.17 if mat=='marble' else .9),p[axes[1]]*(.42 if mat=='marble' else .55))
            f.use_smooth=smooth or bool(edge)
        if edge:
            b=o.modifiers.new('Rounded joinery edges','BEVEL');b.width=edge;b.segments=3;b.limit_method='ANGLE';b.harden_normals=True
            n=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL');n.keep_sharp=True
    return o

def box(name,p,s,mat='walnut',edge=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,min(edge,min(s)*.23))

def mesh(name,verts,faces,mat,smooth=False):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();bm=bmesh.new();bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,mat,smooth=smooth)

def rod(name,a,b,r,mat='brass',n=16,r2=None):
    a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return finish(o,name,mat,smooth=True)

def line(name,points,r=.006,mat='brass',closed=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=1
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*v,1)
    s.use_cyclic_u=closed;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);return finish(o,name,mat)

def lathe(name,profile,mat='brass',center=(0,0),n=32,flutes=0):
    verts=[]
    for r,z in profile:
        for i in range(n):
            a=math.tau*i/n;rr=r*(1+flutes*math.cos(a*16));verts.append((center[0]+rr*math.cos(a),center[1]+rr*math.sin(a),z))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(n):k=(i+1)%n;faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
    return mesh(name,verts,faces,mat,True)

def text(name,label,p,size=.10,mat='brass',flat=False):
    c=bpy.data.curves.new(name,'FONT');c.body=label;c.align_x='CENTER';c.size=size;c.extrude=.00055;c.bevel_depth=0;c.resolution_u=3
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=p;o.rotation_euler=(0,0,math.pi) if flat else (math.pi/2,0,math.pi)
    return finish(o,name,mat)

def frame(name,x,y,z,w,h,mat='brass',r=.009):
    return line(name,[(x-w/2,y,z-h/2),(x+w/2,y,z-h/2),(x+w/2,y,z+h/2),(x-w/2,y,z+h/2)],r,mat,True)

def leaf(name,x,y,z,angle=0,length=.17,width=.055,mat='gold'):
    # Convex carved acanthus leaf with raised central vein.
    raw=[(0,0,0),(-width/2,length*.28,0),(-width*.42,length*.65,0),(0,length,0),(width*.42,length*.65,0),(width/2,length*.28,0),(0,length*.48,.018)]
    verts=[(x+u*math.cos(angle)-v*math.sin(angle),y+d,z+u*math.sin(angle)+v*math.cos(angle)) for u,v,d in raw]
    mesh(name,verts,[(i,(i+1)%6,6) for i in range(6)]+[tuple(reversed(range(6)))],mat,True)

def rosette(name,x,y,z,r=.09,mat='gold'):
    for i in range(8):leaf(name,x,y,z,i*math.tau/8,r,.04,mat)
    rod(name+' center',(x,y,z),(x,y+.015,z),r*.23,mat,16)

def scroll_panel(x,y,z,w,h):
    frame('Raised walnut panel',x,y,z,w,h,'carved',.027);frame('Fine gilt panel fillet',x,y+.028,z,w-.07,h-.07,'gold',.005)
    for side in [-1,1]:
        points=[]
        for t in np.linspace(0,math.tau*1.15,32):
            r=.105*(1-t/(math.tau*1.35));points.append((x+side*(w*.27+r*math.cos(t)),y+.028,z+r*math.sin(t)))
        line('Hand-carved volute',points,.012,'carved')
        for k in range(3):leaf('Gilt acanthus accent',x+side*(w*.20+k*.075),y+.04,z-.07,side*(-.7+k*.2),.11,.035)
    rosette('Central carved flower',x,y+.018,z,.095,'carved')

def lamp(x,y,z):
    lathe('Lamp weighted brass base',[(0,z),(.18,z),(.19,z+.025),(.14,z+.06),(.075,z+.085),(.033,z+.12),(.027,z+.44),(.09,z+.48)],center=(x,y))
    lathe('Lamp fluted stem collar',[(.055,z+.13),(.052,z+.18),(.034,z+.2)],center=(x,y),flutes=.1)
    lathe('Pleated silk lamp shade',[(.29,z+.43),(.285,z+.445),(.18,z+.66),(.175,z+.67)],'linen',center=(x,y),n=64,flutes=.032)
    for r,zz in [(.29,z+.43),(.175,z+.67)]:lathe('Shade bound edge',[(r,zz),(r,zz+.015)],'gold',center=(x,y),n=64)
    lathe('Lamp acorn finial',[(0,z+.69),(.025,z+.69),(.035,z+.71),(.02,z+.74),(0,z+.75)],center=(x,y),n=20)

def paper(x,y,z,w=.36,d=.24,title='GRAND HOTEL',lines=5,angle=0):
    first=len(PARTS);box('Hotel correspondence paper',(0,0,z),(w,d,.003),'paper',.001)
    text('Stationery letterhead',title,(0,d*.32,z+.003),w*.055,'ink',True)
    for i in range(lines):
        line('Handwritten correspondence',[(w*.36,-d*.22+i*d*.075,z+.004),(-w*(.19 if i==lines-1 else .36),-d*.22+i*d*.075,z+.004)],.0007,'ink')
    tr=Matrix.Translation((x,y,0))@Matrix.Rotation(angle,4,'Z')
    for o in PARTS[first:]:o.matrix_world=tr@o.matrix_world

def reception():
    box('Recessed dark toe plinth',(0,0,.055),(7.25,1.40,.11),'recess',.025)
    box('Walnut counter carcass',(0,.05,.60),(7.40,1.42,.98),'walnut',.05)
    for z,depth,h in [(.17,1.47,.13),(.24,1.45,.045),(.99,1.47,.055),(1.06,1.50,.055)]:box('Stepped carved counter molding',(0,.05,z),(7.46,depth,h),'carved',.012)
    for z in [.27,1.035]:box('Restrained brass shadow line',(0,.793,z),(7.34,.02,.019),'gold',.003)
    box('Ivory marble countertop',(0,0,1.135),(7.6,1.65,.09),'marble',.038)
    box('Marble undercut edge',(0,0,1.082),(7.50,1.56,.027),'marble',.011)
    for x in [-2.70,-.90,.90,2.70]:
        box('Recessed ivory panel field',(x,.772,.63),(1.60,.025,.66),'ivory',.016)
        scroll_panel(x,.792,.63,1.47,.52)
    for x in [-3.60,-1.80,0,1.80,3.60]:
        box('Counter pilaster base',(x,.784,.31),(.13,.09,.08),'carved',.01)
        box('Counter pilaster capital',(x,.784,.96),(.16,.09,.07),'carved',.01)
        for dx in [-.036,0,.036]:rod('Gilt counter fluting',(x+dx,.797,.37),(x+dx,.797,.91),.007,'gold',8)
    # Rear staff cabinet reveals drawers and one interrupted filing task.
    for x in [-2.85,-1.75,-.65,.65,1.75,2.85]:
        for z in [.46,.83]:
            box('Staff drawer face',(x,-.678,z),(.99,.075,.29),'walnut',.015)
            rod('Staff drawer brass handle',(x-.095,-.73,z),(x+.095,-.73,z),.012,'brass')
    box('Slightly open stationery drawer',(-.65,-.725,.83),(.91,.20,.26),'carved',.013)
    rod('Open drawer pull',(-.75,-.84,.84),(-.55,-.84,.84),.012)
    lamp(-2.65,-.09,1.18);lamp(2.65,-.09,1.18)
    box('Bottle green leather writing pad',(.55,.22,1.183),(1.35,.70,.013),'green',.033)
    for x in [-.09,1.19]:box('Writing pad brass corner strip',(x,.22,1.192),(.018,.61,.004),'brass',.002)
    box('Open guest register cover',(.51,.22,1.201),(.75,.47,.018),'leather',.011)
    for x in [.327,.695]:box('Guest register page block',(x,.22,1.221),(.354,.435,.024),'paper',.008)
    text('Guest register title','GUEST REGISTER',(.51,.37,1.236),.026,'ink',True)
    for i in range(5):
        yy=.30-i*.055
        line('Ruled guest ledger',[(.17,yy,1.236),(.86,yy,1.236)],.00065,'ink')
    text('Missing guest ledger entry','214  E. VARGA  CHECKED OUT',(.51,.157,1.239),.018,'ink',True)
    rod('Fountain pen barrel',(1.03,.02,1.211),(1.19,.13,1.211),.011,'black',14)
    rod('Fountain pen gold nib',(1.19,.13,1.211),(1.235,.16,1.211),.009,'brass',10,r2=0)
    lathe('Service bell',[(0,1.18),(.13,1.18),(.135,1.195),(.12,1.215),(.11,1.24),(.08,1.285),(.03,1.302),(0,1.302)],center=(-.52,.43))
    rod('Bell button',(-.52,.43,1.30),(-.52,.43,1.345),.018,'brass')
    # Bakelite rotary telephone with receiver resting beside its cradle.
    box('Bakelite telephone base',(-1.51,-.01,1.245),(.55,.40,.13),'black',.08)
    lathe('Telephone rotary brass dial',[(0,1.315),(.13,1.315),(.13,1.325),(0,1.325)],'brass',center=(-1.51,.045),n=32)
    for i in range(10):
        a=i*math.tau/11;lathe('Rotary dial finger hole',[(0,1.326),(.017,1.326),(.017,1.329),(0,1.329)],'black',center=(-1.51+.09*math.cos(a),.045+.09*math.sin(a)),n=10)
    for x in [-1.7,-1.32]:rod('Telephone cradle',(x,-.13,1.28),(x,-.13,1.38),.035,'black')
    line('Off-hook telephone receiver',[(-2.04,.32,1.24),(-2.04,.13,1.27),(-1.99,-.04,1.27),(-1.93,-.19,1.24)],.04,'black')
    for xx,yy in [(-2.04,.32),(-1.93,-.19)]:lathe('Receiver Bakelite earpiece',[(0,1.183),(.069,1.183),(.073,1.22),(.045,1.26)],'black',center=(xx,yy),n=24)
    line('Coiled telephone cord',[(-1.86+.026*math.cos(t),-.30-.009*t,1.22+.026*math.sin(t)) for t in np.linspace(0,math.tau*6,160)],.007,'black')
    paper(1.83,.15,1.183,.43,.30,'GRAND HOTEL',5,.14)
    paper(1.81,.18,1.19,.40,.24,'FOR THE NIGHT PORTER',3,-.05)
    box('Envelope set aside',(-.42,-.28,1.187),(.32,.19,.009),'paper',.004)
    line('Envelope folded flap',[(-.58,-.375,1.193),(-.42,-.275,1.193),(-.26,-.375,1.193)],.001,'ink')
    box('Reception brass desk sign',(0,.66,1.245),(.66,.035,.125),'brass',.006)
    text('Reception sign','RECEPTION',(0,.682,1.222),.063,'ink')

def backdrop():
    box('Full-height walnut cabinet back',(0,-.09,1.67),(7.94,.41,3.29),'walnut',.018)
    box('Stepped plinth',(0,0,.075),(8.2,.65,.15),'carved',.025)
    for z,w,h in [(3.13,8.02,.07),(3.23,8.10,.08),(3.34,8.2,.12)]:box('Layered architectural cornice',(0,0,z),(w,.65,h),'carved',.015)
    box('Cornice gilt fillet',(0,.33,3.26),(8.13,.015,.025),'gold',.003)
    for x in [-3.94,-1.32,1.32,3.94]:
        box('Ivory pilaster',(x,.208,1.60),(.19,.19,2.80),'ivory',.011)
        for dx in [-.06,0,.06]:rod('Pilaster gilt fluting',(x+dx,.31,.53),(x+dx,.31,2.89),.007,'gold',10)
        for z,w,h in [(.22,.30,.13),(.35,.25,.10),(2.98,.29,.13),(3.07,.35,.09)]:box('Pilaster capital and base',(x,.21,z),(w,.24,h),'ivory',.012)
        rosette('Pilaster capital rosette',x,.335,2.97,.075)
    for cx in [-2.62,2.62]:
        # Cabinet lower cupboards and paired drawer fronts.
        for xx in [cx-.54,cx+.54]:
            box('Lower concierge cupboard',(xx,.169,.67),(1.0,.08,.83),'walnut',.02)
            scroll_panel(xx,.218,.67,.89,.68)
            rod('Cupboard brass escutcheon',(xx,.25,.78),(xx,.27,.78),.035,'brass')
        box('Cabinet working ledge',(cx,.04,1.135),(2.39,.56,.07),'marble',.018)
        box('Dark key cabinet recess',(cx,.139,1.93),(2.30,.05,1.45),'recess',.008)
        # Distinct brass numbers above each key. Room 214 visibly absent.
        for row in range(3):
            for col in range(6):
                xx=cx-.94+col*.375;zz=1.43+row*.34;num=(201 if cx<0 else 219)+row*6+col
                text('Numbered room key hook',str(num),(xx,.213,zz+.18),.061,'gold')
                rod('Brass wall key hook',(xx,.18,zz+.09),(xx,.25,zz+.09),.011)
                if num!=214:
                    box('Ivory engraved key fob',(xx,.245,zz),(.102,.018,.12),'ivory',.021)
                    text('Engraved key tag',str(num),(xx,.257,zz-.012),.032,'ink')
                    rod('Room key shank',(xx+.036,.256,zz-.07),(xx+.036,.256,zz-.15),.007)
                    box('Room key tooth',(xx+.046,.256,zz-.143),(.028,.014,.024),'brass',.003)
        for zz in [1.23,1.57,1.91,2.29]:box('Key rack horizontal molding',(cx,.215,zz),(2.35,.08,.018),'walnut',.005)
        # Letters stand in actual dark pigeonholes over the key rack.
        for xx in np.linspace(cx-1.15,cx+1.15,7):box('Pigeonhole vertical divider',(float(xx),.09,2.66),(.022,.31,.56),'walnut',.004)
        for zz in [2.38,2.64,2.92]:box('Mail pigeonhole shelf',(cx,.09,zz),(2.34,.31,.025),'walnut',.004)
        for col in [0,2,3,5]:
            xx=cx-.965+col*.386
            for row in [0,1]:
                zz=2.43+row*.265
                box('Waiting guest correspondence',(xx,.185,zz+.068),(.275,.022,.136),'paper',.006)
                line('Envelope seam',[(xx-.137,.20,zz+.136),(xx,.20,zz+.06),(xx+.137,.20,zz+.136)],.0014,'ink')
    # Central hotel identity beneath a brass-rimmed ivory clock.
    box('Central carved panel',(0,.164,1.55),(2.32,.085,2.65),'walnut',.03)
    frame('Central panel gilt surround',0,.221,1.60,2.10,2.50,'gold',.009)
    text('Hotel crest lettering','GRAND HOTEL',(0,.23,1.87),.203,'gold')
    text('Hotel concierge lettering','C O N C I E R G E',(0,.234,1.72),.090,'ivory')
    text('Hotel founding date','E S T .  1 8 9 6',(0,.234,1.48),.060,'gold')
    for side in [-1,1]:
        for i in range(7):
            a=-1.35+i*.205;x=side*(.65+.23*math.cos(a));z=2.69+.42*math.sin(a)
            leaf('Clock laurel leaf',x,.228,z,side*(1.8-i*.12),.135,.06)
    rod('Clock sculpted walnut surround',(0,.17,2.61),(0,.26,2.61),.51,'carved',64)
    rod('Clock brass bezel',(0,.262,2.61),(0,.282,2.61),.454,'brass',64)
    rod('Clock porcelain face',(0,.284,2.61),(0,.295,2.61),.423,'ivory',64)
    for i,label in enumerate(['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI']):
        a=i*math.tau/12;text('Clock Roman numeral',label,(-.337*math.sin(a),.301,2.585+.337*math.cos(a)),.061,'ink')
    line('Clock hour hand',[(0,.31,2.61),(-.19,.31,2.69)],.012,'black')
    line('Clock minute hand',[(0,.314,2.61),(.075,.314,2.91)],.008,'black')
    rod('Clock hand boss',(0,.31,2.61),(0,.33,2.61),.027,'brass')
    rosette('Central carved cabinet rosette',0,.225,.88,.23,'carved')
    for s in [-1,1]:
        for i in range(5):leaf('Central gilt acanthus',s*(.14+i*.11),.247,.63+s*0, -s*(.25+i*.16),.20,.065)
    box('Service drawer',(0,.221,.36),(1.70,.025,.25),'walnut',.02)
    rod('Service drawer pull',(-.1,.257,.37),(.1,.257,.37),.012)

def suitcase_parts(x,y,z,w=1.08,d=.63,h=.42,mat='tan',number='214',tag=True):
    box('Leather suitcase shell',(x,y,z+h/2),(w,d,h),mat,.07)
    box('Suitcase lid seam',(x,y,z+h*.64),(w+.006,d+.006,.015),'bronze',.006)
    for xx in [x-w*.28,x+w*.28]:
        box('Suitcase leather strap',(xx,y,z+h+.006),(.075,d*.97,.012),'leather',.006)
        box('Suitcase front leather strap',(xx,y+d/2+.005,z+h*.50),(.075,.015,h*.86),'leather',.004)
        frame('Brass suitcase strap buckle',xx,y+d/2+.018,z+h*.66,.085,.073,'brass',.006)
        box('Suitcase lock plate',(xx,y+d/2+.019,z+h*.46),(.071,.013,.062),'brass',.006)
        box('Suitcase lock slit',(xx,y+d/2+.027,z+h*.46),(.009,.003,.022),'recess',.001)
    line('Suitcase stitched top piping',[(x-w/2+.05,y-d/2+.035,z+h-.018),(x+w/2-.05,y-d/2+.035,z+h-.018),(x+w/2-.035,y+d/2-.035,z+h-.018),(x-w/2+.035,y+d/2-.035,z+h-.018)],.005,'tan',True)
    for sx in [-1,1]:
        for sy in [-1,1]:box('Suitcase reinforced brass corner',(x+sx*(w/2-.052),y+sy*(d/2-.028),z+h*.84),(.105,.054,.095),'bronze',.018)
    line('Suitcase stitched leather handle',[(x-.13,y+d/2+.029,z+h*.53),(x-.10,y+d/2+.102,z+h*.53),(x+.10,y+d/2+.102,z+h*.53),(x+.13,y+d/2+.029,z+h*.53)],.023,'leather')
    if tag:
        tag_x=(.153+(w*.28-.0375))/2;tag_w=(w*.28-.0375-.153)*.9
        box('Guest luggage paper tag',(x+tag_x,y+d/2+.038,z+h*.49),(tag_w,.009,.10),'paper',.004)
        text('Guest luggage tag room',number,(x+tag_x,y+d/2+.045,z+h*.49-.022),min(.037,tag_w*.35),'ink')

def suitcase():
    for xx in [-.49,.49]:
        rod('Folding luggage stand leg',(xx,-.28,0),(xx,.28,.39),.025,'carved')
        rod('Folding luggage stand leg',(xx,.28,0),(xx,-.28,.39),.025,'carved')
        rod('Luggage stand brass hinge',(xx-.025,0,.195),(xx+.025,0,.195),.027)
    for yy in [-.28,.28]:rod('Luggage stand crossrail',(-.55,yy,.37),(.55,yy,.37),.023,'walnut')
    for xx in [-.32,0,.32]:box('Luggage stand fabric webbing',(xx,0,.385),(.10,.62,.017),'green',.003)
    suitcase_parts(0,-.04,.4,1.2,.66,.30,'tan','214')
    text('Missing guest name','E. VARGA',(.22575,.338,.570),.0175,'ink')
    box('Visible fitted suitcase lining',(0,-.04,.704),(1.04,.49,.012),'lining',.018)
    # Lid left slightly ajar: close inspection exposes the green lining and document pocket.
    start=len(PARTS)
    box('Lifted suitcase lid',(0,0,.048),(1.20,.66,.096),'tan',.047)
    box('Lid interior fabric lining',(0,0,-.004),(1.05,.50,.012),'lining',.018)
    for xx in [-.336,.336]:box('Lid leather travel strap',(xx,0,.10),(.075,.63,.012),'leather',.006)
    box('Leather document pocket inside lid',(.20,0,-.016),(.38,.29,.013),'leather',.015)
    line('Document pocket stitched edge',[(.01,-.145,-.024),(.39,-.145,-.024),(.39,.145,-.024)],.0024,'tan')
    transform=Matrix.Translation((0,-.37,.704))@Matrix.Rotation(.23,4,'X')@Matrix.Translation((0,.33,0))
    for o in PARTS[start:]:o.matrix_world=transform@o.matrix_world
    for xx in [-.38,.38]:rod('Suitcase brass lid hinge',(xx-.035,-.374,.712),(xx+.035,-.374,.712),.019,'brass')

def luggage_shelf():
    for xx in [-1.82,1.82]:
        for yy in [-.27,.27]:box('Luggage archive upright',(xx,yy,1.25),(.09,.09,2.5),'walnut',.012)
    for zz in [.08,.82,1.58,2.35]:
        box('Luggage shelf solid walnut',(0,0,zz),(3.76,.68,.075),'walnut',.015)
        box('Luggage shelf brass lip',(0,.346,zz+.03),(3.70,.014,.035),'brass',.004)
    for row,z in enumerate([.125,.865,1.625]):
        for col,x in enumerate([-1.20,0,1.20]):
            suitcase_parts(x,-.04,z,1.04,.51,.43 if col%2==0 else .51,['tan','leather','green'][(row+col)%3],str([207,209,211,215,218,223,226,231,234][row*3+col]))
    for xx in [-1.78,1.78]:line('Cabinet rear crossbrace',[(xx,-.285,.12),(-xx,-.285,2.35)],.018,'carved')
    text('Luggage archive plaque','GUEST EFFECTS',(0,.355,2.34),.105,'gold')

def porter():
    box('Porter cabinet foot plinth',(-.17,0,.06),(1.43,.56,.12),'carved',.018)
    box('Porter walnut cabinet',(-.17,0,.53),(1.40,.53,.91),'walnut',.025)
    box('Porter marble worktop',(-.17,0,1.02),(1.5,.64,.08),'marble',.022)
    for xx in [-.50,.16]:
        box('Porter cupboard door',(xx,.282,.55),(.60,.048,.74),'walnut',.016)
        scroll_panel(xx,.313,.55,.52,.64)
        rod('Porter cabinet round handle',(xx,.335,.69),(xx,.352,.69),.027)
    paper(-.21,.01,1.067,.48,.29,'PORTER / COLLECTIONS',6,.03)
    box('Porter brass pen tray',(.28,-.04,1.074),(.22,.24,.026),'brass',.01)
    rod('Porter pencil',(.24,-.12,1.09),(.31,.03,1.09),.006,'black',8)
    # Narrow fluted umbrella receiver fitted within the cabinet envelope.
    lathe('Porter umbrella stand',[(0,0),(.14,0),(.14,.045),(.12,.07),(.12,.51),(.135,.54),(.135,.57),(.113,.57),(.10,.11),(0,.11)],'brass',center=(.73,0),flutes=.02)
    for dx,dy in [(-.05,-.025),(.045,.05)]:
        rod('Folded umbrella',(.73+dx,dy,.18),(.73+dx,dy,.92),.028,'green',12,r2=.013)
        line('Umbrella curved handle',[(.73+dx,dy,.86),(.73+dx,dy,1.06),(.74+dx,dy,1.11),(.79+dx,dy,1.11),(.81+dx,dy,1.06)],.012,'carved')

def measure(objects):
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();verts=[]
    for o in objects:
        me=bpy.data.meshes.new_from_object(o.evaluated_get(deps),depsgraph=deps);verts.extend(o.matrix_world@v.co for v in me.vertices);bpy.data.meshes.remove(me)
    vv=np.array([[v.x,v.y,v.z] for v in verts]);return vv.min(0),vv.max(0)

def export_asset(name,expected):
    lo,hi=measure(PARTS)
    sx=min(1,expected[0]/(2*max(abs(lo[0]),abs(hi[0]))));sy=min(1,expected[1]/(2*max(abs(lo[1]),abs(hi[1]))));sz=min(1,expected[2]/(hi[2]-lo[2]))
    # A rotated open suitcase lid must scale uniformly: assigning a sheared
    # matrix_world decomposes its shear and can push evaluated bevels below zero.
    if name=='guest-suitcase':sx=sy=sz=min(sx,sy,sz)
    fit=Matrix.Diagonal((sx,sy,sz,1))@Matrix.Translation((0,0,-lo[2]))
    for o in PARTS:o.matrix_world=fit@o.matrix_world
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();groups={}
    for o in PARTS:
        me=bpy.data.meshes.new_from_object(o.evaluated_get(deps),depsgraph=deps)
        if not me.vertices:continue
        me.transform(o.matrix_world);me.update()
        if not me.uv_layers:me.uv_layers.new(name='UVMap')
        material=o.data.materials[0];copy=bpy.data.objects.new(material.name,me);bpy.context.collection.objects.link(copy);groups.setdefault(material.name,[]).append(copy)
    root=bpy.data.objects.new('Hotel_'+name,None);bpy.context.collection.objects.link(root);root['units']='metres';root['front']='-Z in Babylon';exports=[]
    for mat,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=objects[0];o.name=mat;o.parent=root;exports.append(o)
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in exports:o.select_set(True)
    filename='hotel-'+name+'.glb'
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False,export_extras=True)
    triangles=0;verts=[]
    for o in exports:
        o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles);verts.extend([v.co.x,v.co.z,-v.co.y] for v in o.data.vertices);o.hide_set(True);o.hide_render=True
    vv=np.array(verts);stats=dict(file=filename,bytes=(OUT/filename).stat().st_size,mesh_nodes=len(exports),material_batches=len(exports),triangles=triangles,vertices=len(vv),bounds=[vv.min(0).tolist(),vv.max(0).tolist()],expected_fixture=expected,uvs=True,source='reception-'+name+'.blend')
    STATS.append(stats);bpy.ops.wm.save_as_mainfile(filepath=str(DOC/stats['source']));print('ASSET_DONE '+json.dumps(stats),flush=True)

def preview(name,expected):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.cycles.max_bounces=4
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.world.color=(.18,.18,.18)
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.7
    w,d,h=expected
    floor=box('Preview floor',(0,0,-.04),(200,200,.07),'ivory',0)
    for name_,pos,power,size in [('Key',(-w*.35,4,6),1300,6),('Fill',(4,1,4),900,5),('Rim',(-3,-2,5),1000,4)]:
        data=bpy.data.lights.new(name_,'AREA');data.energy=power;data.shape='DISK';data.size=size
        o=bpy.data.objects.new(name_,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,h*.4))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(w*.45,max(4,w*.90),h+max(1.4,w*.34)));camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,h*.45))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=max(w*1.23,h*1.68);scene.camera=camera
    scene.render.filepath=str(DOC/('reception-'+name+'-preview.png'));bpy.ops.render.render(write_still=True)

parser=argparse.ArgumentParser();parser.add_argument('--only',default='all');parser.add_argument('--no-preview',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
BUILDERS=[('reception',reception,[7.6,1.65,1.9]),('reception-backdrop',backdrop,[8.2,.65,3.5]),('guest-suitcase',suitcase,[1.25,.85,.9]),('luggage-shelf',luggage_shelf,[3.8,.7,2.5]),('porter-cabinet',porter,[1.8,.65,1.15])]
for name,build,bounds in BUILDERS:
    if args.only!='all' and name not in args.only.split(','):continue
    reset();build();export_asset(name,bounds)
    if not args.no_preview:preview(name,bounds)
path=DOC/'reception-asset-manifest.json';old=json.loads(path.read_text()) if path.exists() else {};entries={a['file']:a for a in old.get('assets',[])};entries.update({a['file']:a for a in STATS})
path.write_text(json.dumps(dict(provenance='Original Blender-authored Belle Epoque reception; seeded procedural PBR textures, no downloaded assets.',units='metres',coordinates='Raw glTF +Y up, front -Z, floor-centered; consistent with existing hotel asset pipeline.',assets=list(entries.values())),indent=2)+'\n')
