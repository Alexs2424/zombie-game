"""Original fictional six-shot casino revolver. Never rewrites existing weapons.
Uses the project's existing procedural mesh primitives; only the new revolver
and its explicitly compatible hand copy are written to public/models.
"""
from pathlib import Path
import importlib.util, json, math, shutil, hashlib, sys
sys.dont_write_bytecode = True
import numpy as np
from scipy.spatial import Delaunay

PROJECT = Path(__file__).resolve().parents[2]
OUT = PROJECT / 'public' / 'models'
DOCS = PROJECT / 'docs' / 'revolver-assets'
spec = importlib.util.spec_from_file_location('last_jackpot_weapon_geometry', PROJECT/'tools'/'generate_weapons.py')
G = importlib.util.module_from_spec(spec)
spec.loader.exec_module(G)
# Existing material indices stay stable; the added finish is used only here.
G.MATS = list(G.MATS) + [('Polished engraved gold',(.68,.435,.105,1),.90,.24), ('Cylinder dark steel',(.057,.078,.085,1),.85,.31)]
GOLD, CYLINDER = 11, 12
unit = G.unit
CYLINDER_CENTER = np.array([0,.048,.038])
MUZZLE = [0,.070,.307]
CONTACT_NAMES = {'Grip frame','Trigger guard','Trigger guard right','Trigger','Rear backstrap'}


def polyline(m, name, mat, points, radius=.0005, n=6):
    for a,b in zip(points[:-1],points[1:]):
        m.rod(name,mat,a,b,radius,n=n)


def cylinder(m):
    """Actual six through-bores, a fluted outer wall, and perforated end faces."""
    n = 144
    front,rear = .090,-.014
    center = np.array([0,.048])
    chamber_radius=.0079
    angles=np.linspace(0,2*math.pi,n,endpoint=False)
    # Six broad concave flutes remove material over the chamber centerlines.
    radius=.0387-.0025*np.maximum(0,np.cos(6*(angles-math.pi/2)))**4
    outer=np.stack([np.cos(angles)*radius,np.sin(angles)*radius],1)+center
    holes=[(center+np.array([math.cos(a),math.sin(a)])*.022,chamber_radius) for a in math.pi/2+np.arange(6)*math.pi/3]
    holes.append((center,.0043))
    points=list(outer)
    for c,r in holes:
        points.extend([c+r*np.array([math.cos(a),math.sin(a)]) for a in np.linspace(0,2*math.pi,24,endpoint=False)])
    points=np.array(points)
    triangulation=Delaunay(points)
    faces=[]
    for f in triangulation.simplices:
        centroid=points[f].mean(0)
        if any(np.linalg.norm(centroid-c)<r*.999 for c,r in holes):continue
        # Reject triangles across a concave flute boundary.
        mids=(points[f]+np.roll(points[f],1,axis=0))/2
        valid=True
        for p in list(mids)+[centroid]:
            a=math.atan2(p[1]-center[1],p[0]-center[0]);limit=.0387-.0025*max(0,math.cos(6*(a-math.pi/2)))**4
            if np.linalg.norm(p-center)>limit+.00008:valid=False;break
        if valid:faces.append(tuple(f))
    for z,sign in [(front,1),(rear,-1)]:
        vertices=np.column_stack([points,np.full(len(points),z)]);ff=[]
        for a,b,c in faces:
            cross=np.cross(vertices[b]-vertices[a],vertices[c]-vertices[a])[2]
            ff.append((a,b,c) if cross*sign>0 else (a,c,b))
        m.add('Cylinder end faces',CYLINDER,vertices,ff,np.tile([0,0,sign],(len(vertices),1)))
    vertices=np.concatenate([np.column_stack([outer,np.full(n,rear)]),np.column_stack([outer,np.full(n,front)])])
    normals=[]
    for _ in range(2):
        for i in range(n):
            tangent=outer[(i+1)%n]-outer[(i-1)%n]
            normals.append(unit([tangent[1],-tangent[0],0]))
    faces=[]
    for i in range(n):j=(i+1)%n;faces.extend([(i,j,n+j),(i,n+j,n+i)])
    m.add('Cylinder fluted body',CYLINDER,vertices,faces,normals)
    for c,r in holes:
        # Only inward-facing walls: end faces above provide the solid bridges.
        vertices=[];normals=[];faces=[];sides=24
        for z in [rear,front]:
            for a in np.linspace(0,2*math.pi,sides,endpoint=False):
                u=np.array([math.cos(a),math.sin(a)]);vertices.append([*(c+r*u),z]);normals.append([-u[0],-u[1],0])
        for i in range(sides):j=(i+1)%sides;faces.extend([(i,sides+j,j),(i,sides+i,sides+j)])
        m.add('Cylinder chamber interiors',3,vertices,faces,normals)
    # Six chamber rims and rear case heads remain separate from the moving frame.
    for index,(c,r) in enumerate(holes[:6]):
        m.tube('Cylinder gold chamber rims',GOLD,(*c,front-.0004),(*c,front+.0005),r+.0010,r,24)
        m.rod('Cylinder cartridge heads',7,(*c,rear-.0007),(*c,rear+.0001),r*.93,n=24)
        m.rod('Cylinder primers',GOLD,(*c,rear-.0010),(*c,rear-.0008),.0020,n=12)
        a=math.pi/2+index*math.pi/3
        # Gold accents run along the shoulder between flutes, away from chamber openings.
        for offset in [-.24,.24]:
            b=a+offset;r0=.0387-.0025*max(0,math.cos(6*(b-math.pi/2)))**4
            x,y=np.array([math.cos(b),math.sin(b)])*(r0+.00025)+center
            m.rod('Cylinder engraved gold lines',GOLD,(x,y,.010),(x,y,.067),.00048,n=6)
    m.rod('Cylinder axle',1,(0,.048,rear-.002),(0,.048,front+.006),.0038,n=20)


def octagonal_barrel(m):
    rear,front=.096,.300
    sides=64;center=np.array([0,.070]);apothem=.0235;inner=.0080
    angles=np.linspace(0,2*math.pi,sides,endpoint=False)
    # Eight flat outer planes, round through-bore.
    radius=apothem/np.cos((angles+math.pi/8)%(math.pi/4)-math.pi/8)
    outer=np.stack([np.cos(angles)*radius,np.sin(angles)*radius],1)+center
    inside=np.stack([np.cos(angles)*inner,np.sin(angles)*inner],1)+center
    vertices=[];normals=[];faces=[]
    for xy,is_outer in [(outer,True),(inside,False)]:
        base=len(vertices)
        for z in [rear,front]:
            for i,p in enumerate(xy):
                if is_outer:
                    nearest=round(angles[i]/(math.pi/4))*math.pi/4
                    normal=[math.cos(nearest),math.sin(nearest),0]
                else:normal=[-math.cos(angles[i]),-math.sin(angles[i]),0]
                vertices.append([*p,z]);normals.append(normal)
        for i in range(sides):
            j=(i+1)%sides;ff=[(base+i,base+j,base+sides+j),(base+i,base+sides+j,base+sides+i)]
            faces.extend(ff if is_outer else [f[::-1] for f in ff])
    m.add('Octagonal barrel shroud with bore',0,vertices,faces,normals)
    for z,sign in [(rear,-1),(front,1)]:
        vertices=[[*p,z] for ring in [outer,inside] for p in ring];faces=[]
        for i in range(sides):
            j=(i+1)%sides;ff=[(i,j,sides+j),(i,sides+j,sides+i)]
            faces.extend(ff if sign>0 else [f[::-1] for f in ff])
        m.add('Barrel shroud end shoulders',1,vertices,faces,np.tile([0,0,sign],(len(vertices),1)))
    m.tube('Recessed muzzle crown',1,(0,.070,.298),(0,.070,.307),.015,.008,48)
    # An octagonal collar follows the shroud instead of disappearing at corners.
    outer_ring=[np.array([math.cos(a),math.sin(a)])*(.02405/math.cos(math.pi/8))+center for a in math.pi/8+np.arange(8)*math.pi/4]
    inner_ring=[center+(p-center)*.93 for p in outer_ring]
    verts=[[*p,z] for z in [.291,.297] for ring in [outer_ring,inner_ring] for p in ring]
    faces=[]
    for i in range(8):
        j=(i+1)%8
        faces.extend([(i,j,16+j),(i,16+j,16+i),(8+i,24+j,8+j),(8+i,24+i,24+j),(i,8+j,j),(i,8+i,8+j),(16+i,16+j,24+j),(16+i,24+j,24+i)])
    m.add('Gold muzzle band',GOLD,verts,faces)


def spade(m,side,y,z,size):
    outline=np.array([[1,0],[.38,-.57],[-.02,-.82],[-.36,-.72],[-.43,-.35],[-.25,-.11],[-.77,-.30],[-.77,.30],[-.25,.11],[-.43,.35],[-.36,.72],[-.02,.82],[.38,.57]])*size
    # A center fan preserves the engraved spade's two lobes and narrow stem.
    center=np.array([-.04,0])*size
    verts=[(side*.02394,y+center[0],z+center[1])]+[(side*.02394,y+q[0],z+q[1]) for q in outline]
    faces=[]
    for i in range(len(outline)):
        a,b,c=0,i+1,(i+1)%len(outline)+1
        va,vb,vc=np.array(verts)[[a,b,c]]
        if np.cross(vb-va,vc-va)[0]*side<0:b,c=c,b
        faces.append((a,b,c))
    m.add('Gold spade engraving',GOLD,verts,faces,np.tile([side,0,0],(len(verts),1)))


def build():
    m=G.Model('THE DEAD MAN’S HAND / original casino revolver')
    pistol=G.build_pistol()
    for p in pistol.parts:
        if p['name'] in CONTACT_NAMES:
            m.parts.append({k:(v.copy() if isinstance(v,np.ndarray) else v) for k,v in p.items()})
        elif p['name']=='Bakelite grip panels':
            part={k:(v.copy() if isinstance(v,np.ndarray) else v) for k,v in p.items()};part['name']='Sculpted walnut grip panels';part['mat']=4;m.parts.append(part)
    # Open frame around the large cylinder leaves its six chamber faces legible.
    m.profile('Forged rear frame',0,[(-.012,-.096),(.008,-.111),(.059,-.100),(.087,-.046),(.086,-.019),(.017,-.021),(-.009,-.003)],.045,.003)
    m.box('Top strap',0,(0,.091,.044),(.024,.014,.155),.003)
    m.box('Top strap polished bevel',1,(0,.099,.037),(.017,.002,.139),.0005)
    m.box('Lower cylinder bridge',0,(0,.006,.040),(.031,.012,.122),.003)
    m.profile('Front cylinder frame',0,[(.007,.089),(.009,.108),(.055,.118),(.090,.110),(.094,.086)],.028,.002)
    cylinder(m);octagonal_barrel(m)
    m.profile('Heavy underlug',0,[(.047,.103),(.047,.287),(.031,.296),(.014,.279),(.008,.129),(.018,.103)],.037,.003)
    m.rod('Ejector rod',1,(-.019,.032,.102),(-.019,.032,.243),.0040,n=20)
    m.rod('Ejector rod checkered tip',GOLD,(-.019,.032,.233),(-.019,.032,.250),.0053,n=20)
    for z in np.linspace(.236,.247,5):m.tube('Ejector knurl rings',0,(-.019,.032,z),(-.019,.032,z+.00065),.00555,.0048,12)
    # Square notch + gold blade stay above the top strap and barrel.
    m.box('Rear sight pedestal',0,(0,.092,-.039),(.029,.018,.027),.002)
    m.box('Rear sight base',0,(0,.104,-.037),(.034,.010,.021),.002)
    for x in [-.012,.012]:m.box('Rear sight notch',1,(x,.113,-.037),(.009,.009,.008),.001)
    m.box('Front sight ramp',0,(0,.101,.269),(.011,.018,.033),.002)
    m.box('Front gold sight blade',GOLD,(0,.113,.276),(.004,.014,.017),.0007)
    m.rod('Rear sight pin',GOLD,(-.009,.110,-.042),(-.009,.110,-.043),.0014,n=10)
    m.rod('Rear sight pin',GOLD,(.009,.110,-.042),(.009,.110,-.043),.0014,n=10)
    m.profile('Hammer',1,[(.042,-.101),(.078,-.123),(.093,-.123),(.086,-.113),(.060,-.090)],.016,.001)
    for i in range(4):m.box('Hammer thumb serrations',0,(0,.087-i*.003,-.121+i*.003),(.017,.0018,.004),.0004)
    m.box('Thumb latch',GOLD,(-.026,.022,-.036),(.007,.013,.027),.002)
    for z in [-.044,-.038,-.032]:m.box('Thumb latch grooves',0,(-.030,.022,z),(.001,.010,.0014),.0003)
    # The existing grip contour is unchanged, with walnut grain and inlaid trim.
    for side in [-1,1]:
        for j in range(8):
            y=-.05-j*.011;z=-.054-j*.0024
            m.rod('Walnut grip checkering',5,(side*.0231,y,z-.020),(side*.0231,y+.005,z+.016),.00065,n=6)
            m.rod('Walnut grip checkering',9,(side*.0231,y+.005,z-.018),(side*.0231,y,z+.014),.00045,n=6)
        for y,z in [(-.047,-.060),(-.132,-.076)]:G.screw(m,side*.0232,y,z,.0034)
        m.rod('Grip gold medallion',GOLD,(side*.0234,-.088,-.072),(side*.0241,-.088,-.072),.009,n=24)
        # Fine gold lines and spades are geometry, not licensed decals or text.
        for y in [.0615,.0785]:
            polyline(m,'Barrel gold hairline',GOLD,[(side*.02394,y,.116),(side*.02394,y,.270)],.00045)
        for z in [.141,.185,.231]:spade(m,side,.070,z,.008)
        for z in [.118,.262]:
            points=[]
            for t in np.linspace(0,1,13):points.append((side*.02394,.070+.006*math.sin(t*2*math.pi),z+t*.013))
            polyline(m,'Gold scroll engraving',GOLD,points,.00040)
        for y,z in [(.016,-.086),(.060,-.060),(.019,-.008)]:G.screw(m,side*.0238,y,z,.0025)
        polyline(m,'Rear frame gold border',GOLD,[(side*.0230,.010,-.092),(side*.0230,.043,-.090),(side*.0230,.071,-.050),(side*.0230,.069,-.027)],.0007)
    m.box('Grip heel brass shoe',GOLD,(0,-.161,-.068),(.044,.009,.049),.003)
    return m


def main():
    OUT.mkdir(parents=True,exist_ok=True);DOCS.mkdir(parents=True,exist_ok=True)
    model=build();stats=model.export(str(OUT/'revolver.glb'));stats['file']='revolver.glb'
    shutil.copyfile(OUT/'hands-pistol.glb',OUT/'hands-revolver.glb')
    hands_hash=hashlib.sha256((OUT/'hands-revolver.glb').read_bytes()).hexdigest()
    manifest=dict(name='THE DEAD MAN’S HAND',upgraded_name='ACE OF SPADES',provenance='Original procedural fictional revolver. Reuses existing project mesh utilities and exact pistol grip contact geometry. No third-party art or external assets.',coordinate_system='Metres; +Y up; +Z muzzle; receiver origin. Gun and hands share root, scale 1.',muzzle=MUZZLE,cylinder_axis='Z',cylinder_center=CYLINDER_CENTER.tolist(),chambers=6,display_rotation='No baked rotation. For a side-on wall display, use the existing weapon display convention: yaw +pi/2 or -pi/2 according to wall facing.',grip=dict(reference='pistol.glb',exact_contact_nodes=sorted(CONTACT_NAMES),panels='Same panel vertices, walnut PBR material and separate fine checkering.',hands='hands-revolver.glb is byte-for-byte identical to hands-pistol.glb. Preserve named RightHand/LeftHand wrist pivot transforms.',hands_sha256=hands_hash),animation=dict(rotating_prefix='Cylinder ',fixed_parts='Thumb latch, frame, barrel, sights, grip, trigger, hammer, ejector rod',note='Cylinder components are coaxial along Z and retain local translations. Group them under a shared pivot at cylinder_center for swing-out motion. There is no Magazine or Slide node.'),asset=stats)
    (DOCS/'asset-manifest.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps(manifest,indent=2))

if __name__=='__main__':main()
