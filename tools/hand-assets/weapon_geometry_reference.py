import json, struct, math, os
import numpy as np
from scipy.spatial import ConvexHull
from PIL import Image, ImageDraw, ImageFont

OUT = '/private/tmp/last-jackpot-models'

MATS = [
    ('Blued steel', (0.105,0.135,0.14,1), .88,.29),
    ('Edge worn steel', (.30,.34,.33,1), .92,.26),
    ('Parkerized receiver', (.155,.19,.18,1), .78,.42),
    ('Recess black', (.022,.029,.028,1), .3,.63),
    ('Walnut', (.27,.113,.047,1), .02,.43),
    ('Walnut end grain', (.16,.055,.022,1), .03,.52),
    ('Bakelite', (.118,.079,.055,1), .02,.38),
    ('Aged brass', (.52,.365,.12,1), .82,.31),
    ('Rubber', (.046,.052,.048,1), .01,.79),
    ('Wood grain light', (.36,.16,.062,1), .03,.45),
    ('Sight paint', (.82,.78,.56,1), .05,.6),
]

def unit(v):
    v=np.asarray(v,dtype=float); n=np.linalg.norm(v); return v/n if n else v

class Model:
    def __init__(self,name): self.name=name; self.parts=[]
    def add(self,name,mat,verts,faces,normals=None):
        v=np.array(verts,dtype=float); f=np.array(faces,dtype=np.uint32)
        if normals is None:
            # Flat faces make bevel boundaries intentional, without interpolation artifacts.
            vf=v[f].reshape((-1,3)); nf=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
            nf/=np.maximum(np.linalg.norm(nf,axis=1)[:,None],1e-12)
            normals=np.repeat(nf,3,axis=0); v=vf; f=np.arange(len(v),dtype=np.uint32).reshape((-1,3))
        self.parts.append(dict(name=name,mat=mat,v=v,f=f,n=np.array(normals,dtype=float)))
    def hull(self,name,mat,verts):
        v=np.array(verts,float); h=ConvexHull(v); faces=[]
        for face,eq in zip(h.simplices,h.equations):
            a,b,c=face
            if np.dot(np.cross(v[b]-v[a],v[c]-v[a]),eq[:3])<0: b,c=c,b
            faces.append((a,b,c))
        self.add(name,mat,v,faces)
    def box(self,name,mat,center,size,bevel=.002,rot=None):
        c=np.array(center); s=np.array(size)/2; b=min(bevel,min(s)*.65)
        verts=[]
        for axis in range(3):
            for sign in [-1,1]:
                for a in [-1,1]:
                    for k in [-1,1]:
                        p=np.zeros(3); p[axis]=sign*s[axis]; p[(axis+1)%3]=a*(s[(axis+1)%3]-b); p[(axis+2)%3]=k*(s[(axis+2)%3]-b); verts.append(p)
        verts=np.array(verts)
        if rot is not None: verts=verts@np.array(rot).T
        self.hull(name,mat,verts+c)
    def profile(self,name,mat,poly,width,bevel=.002):
        # Convex shaped stock/grip profile in YZ, with a bevel strip on either broad side.
        yz=np.array(poly,float); mid=np.mean(yz,axis=0); vs=[]
        for x,shrink in [(-width/2,bevel),(-width/2+bevel,0),(width/2-bevel,0),(width/2,bevel)]:
            for p in yz:
                d=p-mid; vs.append((x,*(p-unit(d)*shrink)))
        self.hull(name,mat,vs)
    def rod(self,name,mat,a,b,r1,r2=None,n=20):
        a=np.array(a,float); b=np.array(b,float); w=unit(b-a); u=unit(np.cross(w,[0,1,0] if abs(w[1])<.9 else [1,0,0])); v=np.cross(w,u)
        r2=r1 if r2 is None else r2; verts=[]; norms=[]
        slope=(r1-r2)/np.linalg.norm(b-a)
        for pt,r in [(a,r1),(b,r2)]:
            for i in range(n):
                vec=u*math.cos(i*2*math.pi/n)+v*math.sin(i*2*math.pi/n)
                verts.append(pt+r*vec); norms.append(unit(vec+slope*w))
        faces=[]
        for i in range(n): j=(i+1)%n; faces.extend([(i,j,n+j),(i,n+j,n+i)])
        for pt,r,sgn in [(a,r1,-1),(b,r2,1)]:
            idx=len(verts); verts.append(pt); norms.append(w*sgn)
            for i in range(n): verts.append(pt+r*(u*math.cos(i*2*math.pi/n)+v*math.sin(i*2*math.pi/n))); norms.append(w*sgn)
            for i in range(n):
                j=(i+1)%n; face=(idx,idx+1+i,idx+1+j)
                faces.append(face if sgn>0 else face[::-1])
        self.add(name,mat,verts,faces,norms)
    def tube(self,name,mat,a,b,r,inner,n=32):
        a=np.array(a,float); b=np.array(b,float); w=unit(b-a); u=unit(np.cross(w,[0,1,0] if abs(w[1])<.9 else [1,0,0])); v=np.cross(w,u)
        verts=[]; norms=[]; faces=[]
        # Sides and bevel-free planar rims.
        for rad,sign in [(r,1),(inner,-1)]:
            base=len(verts)
            for p in [a,b]:
                for i in range(n):
                    vec=u*math.cos(i*2*math.pi/n)+v*math.sin(i*2*math.pi/n); verts.append(p+rad*vec); norms.append(vec*sign)
            for i in range(n):
                j=(i+1)%n; tris=[(base+i,base+j,base+n+j),(base+i,base+n+j,base+n+i)]
                faces.extend(tris if sign>0 else [t[::-1] for t in tris])
        for p,sign in [(a,-1),(b,1)]:
            base=len(verts)
            for rad in [r,inner]:
                for i in range(n): verts.append(p+rad*(u*math.cos(i*2*math.pi/n)+v*math.sin(i*2*math.pi/n))); norms.append(w*sign)
            for i in range(n):
                j=(i+1)%n; ts=[(base+i,base+j,base+n+j),(base+i,base+n+j,base+n+i)]
                faces.extend(ts if sign>0 else [t[::-1] for t in ts])
        self.add(name,mat,verts,faces,norms)
    def shield(self,name,y,z0,z1,r,thickness=.002,columns=10,rows=4):
        verts=[]; faces=[]; ns=[]
        # Unwrap each cylindrical panel and remove an ellipse: actual open holes.
        for iz in range(rows):
            for ia in range(columns):
                ac=(ia+.5)*2*math.pi/columns; zc=z0+(iz+.5)*(z1-z0)/rows
                hu=math.pi/columns; hv=(z1-z0)/rows/2
                holeu=hu*.54; holev=hv*.49; N=16; base=len(verts)
                for radius,outer in [(r,True),(r,False),(r-thickness,True),(r-thickness,False)]:
                    for k in range(N):
                        ang=math.pi/4+k*2*math.pi/N; dx=math.cos(ang); dy=math.sin(ang)
                        if outer:
                            scale=1/max(abs(dx),abs(dy)); du=dx*scale*hu; dz=dy*scale*hv
                        else: du=dx*holeu; dz=dy*holev
                        aa=ac+du; verts.append((radius*math.cos(aa),y+radius*math.sin(aa),zc+dz))
                        norm=np.array([math.cos(aa),math.sin(aa),0])*(1 if radius==r else -1); ns.append(norm)
                for k in range(N):
                    j=(k+1)%N
                    faces.extend([(base+k,base+j,base+N+j),(base+k,base+N+j,base+N+k)])
                    faces.extend([(base+2*N+k,base+3*N+j,base+2*N+j),(base+2*N+k,base+3*N+k,base+3*N+j)])
                # Hole walls are separate so their normals remain crisp.
                for k in range(N):
                    j=(k+1)%N; va=np.array(verts[base+N+k]); vb=np.array(verts[base+N+j]); vc=np.array(verts[base+3*N+j]); vd=np.array(verts[base+3*N+k]); offset=len(verts)
                    norm=unit(np.cross(vb-va,vc-va)); verts.extend([va,vb,vc,vd]); ns.extend([norm]*4); faces.extend([(offset,offset+1,offset+2),(offset,offset+2,offset+3)])
        self.add(name,0,verts,faces,ns)
        self.tube(name+' rear rim',1,(0,y,z0-.002),(0,y,z0+.002),r+.001,r-thickness,32)
        self.tube(name+' front rim',1,(0,y,z1-.002),(0,y,z1+.002),r+.001,r-thickness,32)
    def merge(self):
        # Merge repeated decorative parts with matching names/materials, retaining functional nodes.
        groups={}
        for p in self.parts: groups.setdefault((p['name'],p['mat']),[]).append(p)
        merged=[]
        for (name,mat),ps in groups.items():
            vv=[];ff=[];nn=[];offset=0
            for p in ps: vv.append(p['v']); nn.append(p['n']); ff.append(p['f']+offset); offset+=len(p['v'])
            merged.append(dict(name=name,mat=mat,v=np.concatenate(vv),f=np.concatenate(ff),n=np.concatenate(nn)))
        self.parts=merged
    def export(self,path):
        self.merge(); blob=bytearray(); views=[]; accessors=[]; meshes=[]; nodes=[]
        def attr(data,dtype,kind,target):
            data=np.asarray(data,dtype=dtype); raw=data.tobytes(); off=len(blob); blob.extend(raw)
            while len(blob)%4:blob.append(0)
            vi=len(views); views.append(dict(buffer=0,byteOffset=off,byteLength=len(raw),target=target))
            a=dict(bufferView=vi,componentType=5126 if dtype=='<f4' else 5125,count=len(data),type=kind)
            if kind=='VEC3':a['min']=data.min(axis=0).tolist();a['max']=data.max(axis=0).tolist()
            accessors.append(a);return len(accessors)-1
        for p in self.parts:
            center=(p['v'].min(axis=0)+p['v'].max(axis=0))/2
            pos=attr(p['v']-center,'<f4','VEC3',34962); normal=attr(p['n'],'<f4','VEC3',34962); index=attr(p['f'].flatten(),'<u4','SCALAR',34963)
            meshes.append(dict(name=p['name'],primitives=[dict(attributes=dict(POSITION=pos,NORMAL=normal),indices=index,material=p['mat'])]))
            nodes.append(dict(name=p['name'],mesh=len(meshes)-1,translation=center.tolist()))
        materials=[dict(name=n,pbrMetallicRoughness=dict(baseColorFactor=c,metallicFactor=m,roughnessFactor=r),doubleSided=False) for n,c,m,r in MATS]
        gltf=dict(asset=dict(version='2.0',generator='Last Jackpot original procedural assets',copyright='Original procedurally authored for this project; no third-party geometry or textures'),scene=0,scenes=[dict(name=self.name,nodes=list(range(len(nodes))))],nodes=nodes,meshes=meshes,materials=materials,buffers=[dict(byteLength=len(blob))],bufferViews=views,accessors=accessors)
        j=json.dumps(gltf,separators=(',',':')).encode(); j+=b' '*((-len(j))%4)
        with open(path,'wb') as f:f.write(struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(blob)));f.write(struct.pack('<I4s',len(j),b'JSON'));f.write(j);f.write(struct.pack('<I4s',len(blob),b'BIN\0'));f.write(blob)
        verts=np.concatenate([p['v'] for p in self.parts]); return dict(file=path,nodes=len(nodes),vertices=len(verts),triangles=sum(len(p['f']) for p in self.parts),bounds=[verts.min(0).tolist(),verts.max(0).tolist()],bytes=os.path.getsize(path))

def screw(m,x,y,z,r=.0027):
    sg=1 if x>0 else -1
    m.rod('Fasteners',1,(x,y,z),(x+sg*.0015,y,z),r,n=12)
    m.box('Fastener slots',3,(x+sg*.0016,y,z),(.0003,r*1.2,.0006),.0001)

def guard(m,y0,z0,z1,width=.025):
    # Open trigger guard surrounding the actual trigger.
    m.rod('Trigger guard',0,(-width/2,y0,z0),(-width/2,y0-.036,z0+.006),.003,n=10)
    m.rod('Trigger guard',0,(-width/2,y0-.036,z0+.006),(-width/2,y0-.041,z1-.009),.003,n=10)
    m.rod('Trigger guard',0,(-width/2,y0-.041,z1-.009),(-width/2,y0-.026,z1+.003),.003,n=10)
    m.rod('Trigger guard',0,(-width/2,y0-.026,z1+.003),(-width/2,y0,z1),.003,n=10)
    # Duplicated sides linked by thin end bars retain the hollow silhouette.
    for yy,zz in [(y0-.036,z0+.006),(y0-.041,z1-.009)]:m.rod('Trigger guard',0,(-width/2,yy,zz),(width/2,yy,zz),.0025,n=10)
    m.profile('Trigger',1,[(y0-.002,z0+.024),(y0-.029,z0+.029),(y0-.034,z0+.037),(y0-.03,z0+.04),(y0-.021,z0+.034),(y0-.002,z0+.031)],.008,.001)

def build_smg():
    m=Model('Casino surplus compact automatic carbine')
    m.box('Receiver',2,(0,0,0),(.052,.061,.203),.006)
    m.box('Receiver top cover',0,(0,.033,-.006),(.049,.013,.186),.004)
    m.box('Receiver lower seam',1,(0,-.026,.004),(.054,.004,.187),.001)
    m.box('Rear cap',0,(0,.004,-.109),(.057,.062,.016),.004)
    m.box('Bolt slot',3,(.027,.006,.026),(.002,.019,.08),.003)
    m.box('Bolt',1,(.028,.006,.043),(.003,.014,.043),.003)
    m.rod('Charging handle',1,(.027,.016,-.008),(.057,.016,-.008),.005,n=16)
    m.rod('Charging handle grip',0,(.058,.016,-.019),(.058,.016,.003),.006,n=16)
    m.rod('Barrel collar',1,(0,.011,.098),(0,.011,.139),.024,n=24)
    m.rod('Barrel',0,(0,.011,.125),(0,.011,.374),.0105,n=24)
    m.shield('Perforated heat shield',.011,.138,.319,.03,columns=10,rows=5)
    m.tube('Muzzle brake',1,(0,.011,.352),(0,.011,.393),.015,.009,32)
    m.tube('Muzzle crown',0,(0,.011,.391),(0,.011,.398),.016,.0088,32)
    # Side-open muzzle brake ports show as sharp recesses, front bore is genuinely open.
    for side in [-1,1]:
        for z in [.364,.377]:m.box('Muzzle ports',3,(side*.0147,.011,z),(.001,.012,.006),.001)
    m.box('Front sight base',0,(0,.044,.306),(.018,.018,.019),.003)
    m.rod('Front sight post',1,(0,.05,.306),(0,.075,.306),.0024,n=12)
    for x in [-.014,.014]:m.box('Front sight wings',0,(x,.064,.306),(.004,.026,.013),.001)
    m.box('Rear sight base',0,(0,.046,-.073),(.027,.012,.022),.002)
    for x in [-.011,.011]:m.box('Rear sight notch',1,(x,.06,-.073),(.009,.015,.006),.001)
    m.profile('Pistol grip',6,[(-.028,-.063),(-.041,-.025),(-.143,-.063),(-.148,-.098),(-.128,-.103)],.039,.004)
    for i in range(8):
        yy=-.056-i*.011;zz=-.051-i*.0038
        for side in [-1,1]:m.box('Grip ribs',8,(side*.0197,yy,zz),(.0025,.003,.034),.001)
    m.box('Grip heel',0,(0,-.143,-.079),(.041,.012,.036),.003)
    guard(m,-.028,-.031,.036)
    m.box('Magazine well',0,(0,-.037,.064),(.043,.025,.047),.003)
    m.profile('Magazine',2,[(-.041,.044),(-.041,.084),(-.173,.105),(-.182,.068)],.029,.003)
    for side in [-1,1]:
        for dz in [0,.011]:m.rod('Magazine pressed ribs',0,(side*.0155,-.058,.057+dz),(side*.0155,-.16,.075+dz),.0018,n=8)
    m.box('Magazine floor plate',1,(0,-.18,.086),(.034,.009,.044),.002)
    m.box('Magazine catch',1,(.026,-.038,.032),(.008,.014,.016),.002)
    for x in [-.021,.021]:
        m.rod('Stock rails',1,(x,-.002,-.112),(x,-.004,-.26),.005,n=12)
        m.rod('Stock elbows',0,(x,-.004,-.258),(x,-.045,-.276),.005,n=12)
    m.profile('Stock butt plate',8,[(.016,-.273),(.01,-.291),(-.088,-.291),(-.096,-.277)],.041,.003)
    for y in [-.072,-.058,-.044,-.03,-.016]:m.box('Butt grip ribs',6,(0,y,-.292),(.031,.003,.0025),.0006)
    m.rod('Selector pivot',7,(-.03,-.008,-.062),(-.034,-.008,-.062),.007,n=16)
    m.rod('Selector lever',1,(-.035,-.008,-.062),(-.035,-.019,-.041),.003,n=10)
    m.box('Brass serial plate',7,(-.0278,.002,-.004),(.0018,.012,.037),.0008)
    for z in [-.018,.01]:screw(m,-.029,0,z,.0016)
    for side in [-1,1]:
        for y,z in [(.018,-.09),(-.014,-.053),(-.013,.014),(.018,.086)]:screw(m,side*.0275,y,z)
    m.tube('Sling ring',1,(-.033,-.006,-.103),(-.036,-.006,-.103),.008,.005,16)
    return m

def build_rifle():
    m=Model('Walnut casino security battle rifle')
    m.profile('Walnut buttstock',4,[(.003,-.111),(-.009,-.185),(.01,-.326),(-.006,-.353),(-.119,-.351),(-.13,-.322),(-.067,-.186),(-.074,-.123)],.06,.005)
    m.profile('Rubber recoil pad',8,[(.009,-.349),(.008,-.359),(-.121,-.359),(-.131,-.35)],.062,.003)
    for y in [-.11,-.095,-.08,-.065,-.05,-.035,-.02]:m.box('Recoil pad tread',6,(0,y,-.3595),(.048,.003,.0025),.001)
    m.box('Stock socket',0,(0,-.018,-.119),(.057,.073,.033),.004)
    m.box('Receiver',0,(0,.008,-.009),(.057,.064,.194),.006)
    m.box('Receiver top rail',1,(0,.043,-.008),(.041,.01,.177),.003)
    m.box('Receiver right recess',3,(.029,.018,.018),(.002,.023,.071),.003)
    m.box('Bolt',1,(.0303,.018,.024),(.003,.016,.045),.003)
    m.rod('Bolt handle stem',1,(.03,.025,-.012),(.054,.025,-.006),.0037,n=12)
    m.rod('Bolt handle knob',0,(.054,.024,-.014),(.054,.024,.005),.006,n=16)
    m.box('Lower receiver',2,(0,-.028,.011),(.045,.019,.142),.003)
    m.profile('Walnut pistol grip',4,[(-.033,-.079),(-.041,-.037),(-.142,-.067),(-.146,-.099),(-.116,-.108)],.039,.004)
    for side in [-1,1]:
        for i in range(7):
            y=-.07-i*.008;z=-.065-i*.0025
            m.rod('Grip checkering',5,(side*.0198,y,z-.01),(side*.0198,y+.008,z+.01),.0008,n=6)
            m.rod('Grip checkering',9,(side*.0200,y+.008,z-.009),(side*.0200,y,z+.01),.0006,n=6)
    m.box('Grip base cap',5,(0,-.143,-.082),(.041,.01,.033),.003)
    guard(m,-.034,-.04,.035)
    m.profile('Magazine',2,[(-.03,.037),(-.032,.099),(-.159,.118),(-.169,.083),(-.126,.05)],.039,.003)
    for side in [-1,1]:
        for z in [.059,.072,.085]:m.rod('Magazine pressed ribs',0,(side*.0205,-.049,z),(side*.0205,-.137,z+.014),.0018,n=8)
    m.box('Magazine floor plate',1,(0,-.163,.096),(.044,.01,.047),.002)
    m.rod('Magazine release',1,(0,-.047,.028),(0,-.061,.017),.004,n=12)
    m.profile('Walnut handguard',4,[(.013,.093),(.029,.123),(.028,.276),(.013,.309),(-.033,.295),(-.041,.114)],.058,.005)
    m.profile('Upper handguard',9,[(.027,.118),(.052,.135),(.052,.263),(.028,.292)],.04,.003)
    for side in [-1,1]:
        for i in range(11):
            z=.13+i*.0136
            m.box('Handguard grooves',5,(side*.0293,-.007,z),(.0018,.034,.0025),.0006)
        # Several flowing, slender grain lines make the broad stock surfaces visually wood-like.
        for j in range(6):
            z0=-.327+j*.013;y0=-.03-j*.011
            m.rod('Stock wood grain',9,(side*.0301,y0,z0),(side*.0301,y0+.009,z0+.067),.0007,n=6)
            m.rod('Stock wood grain',5,(side*.0302,y0-.004,z0+.008),(side*.0302,y0+.005,z0+.075),.00055,n=6)
        for j in range(3):m.rod('Handguard wood grain',9,(side*.0295,-.022+j*.012,.123),(side*.0295,-.014+j*.01,.28),.0007,n=6)
    m.box('Handguard rear band',0,(0,.004,.106),(.062,.067,.013),.003)
    m.box('Handguard forward band',0,(0,.004,.294),(.055,.066,.014),.003)
    m.rod('Barrel',0,(0,.013,.088),(0,.013,.609),.0125,.0105,n=28)
    m.rod('Gas tube',1,(0,.053,.09),(0,.053,.443),.0085,.007,n=20)
    m.rod('Gas tube rear collar',0,(0,.053,.085),(0,.053,.113),.012,n=20)
    m.rod('Gas block',0,(0,.013,.426),(0,.013,.455),.018,n=24)
    m.box('Gas block tower',0,(0,.031,.442),(.026,.059,.021),.003)
    m.rod('Gas regulator',7,(0,.054,.449),(0,.054,.47),.008,n=20)
    for z in [.451,.456,.461]:m.tube('Regulator grooves',0,(0,.054,z),(0,.054,z+.0015),.0085,.0077,20)
    m.box('Front sight base',0,(0,.039,.53),(.02,.041,.028),.003)
    m.rod('Front sight pin',1,(0,.049,.53),(0,.077,.53),.002,n=12)
    for x in [-.013,.013]:m.profile('Front sight ears',0,[(.045,.521),(.082,.527),(.082,.535),(.045,.54)],.003,.0008)
    # Move sight ear pair from the central profile axis to either side.
    m.parts[-1]['v'][:,0]+=.013;m.parts[-2]['v'][:,0]-=.013
    m.box('Rear sight block',0,(0,.055,-.074),(.025,.021,.031),.003)
    for x in [-.009,.009]:m.box('Rear sight notch',1,(x,.071,-.069),(.008,.012,.008),.001)
    m.rod('Sight adjustment screw',7,(-.02,.057,-.075),(.02,.057,-.075),.005,n=16)
    m.tube('Muzzle sleeve',0,(0,.013,.579),(0,.013,.631),.017,.01,32)
    m.tube('Muzzle crown',1,(0,.013,.631),(0,.013,.637),.0175,.0095,32)
    for side in [-1,1]:
        for z in [.59,.607,.62]:m.box('Muzzle ports',3,(side*.0167,.013,z),(.001,.014,.007),.001)
    m.rod('Selector pin',7,(-.032,.003,-.07),(-.035,.003,-.07),.006,n=16)
    m.rod('Selector lever',1,(-.036,.003,-.07),(-.036,-.011,-.05),.0027,n=10)
    for side in [-1,1]:
        for y,z in [(.025,-.092),(-.01,-.092),(-.012,.068),(-.044,-.276)]:screw(m,side*(.031 if z<-.2 else .0295),y,z)
    m.box('Brass stock medallion',7,(-.031,-.056,-.298),(.0015,.015,.027),.0015)
    m.tube('Rear sling loop',1,(0,-.091,-.258),(0,-.091,-.263),.009,.006,20)
    m.tube('Front sling loop',1,(0,-.039,.292),(0,-.039,.298),.008,.005,20)
    return m

def build_pistol():
    m=Model('Casino security machined-steel service pistol')
    m.box('Receiver',2,(0,.007,.026),(.043,.034,.252),.004)
    m.box('Dust cover',0,(0,-.01,.111),(.037,.023,.105),.003)
    m.box('Slide',0,(0,.043,.041),(.053,.049,.315),.006)
    m.box('Slide top rib',2,(0,.069,.045),(.026,.006,.272),.0015)
    m.box('Slide lower bright edge',1,(0,.021,.04),(.054,.003,.291),.0008)
    m.box('Ejection port',3,(.0268,.052,.045),(.002,.024,.051),.003)
    m.box('Bolt',1,(.028,.05,.052),(.0015,.016,.029),.002)
    m.box('Ejection port upper lip',1,(.022,.066,.046),(.008,.003,.049),.001)
    m.rod('Barrel',1,(0,.043,.174),(0,.043,.229),.014,n=28)
    m.tube('Muzzle crown',0,(0,.043,.224),(0,.043,.24),.015,.0087,32)
    m.tube('Barrel bushing',1,(0,.043,.193),(0,.043,.203),.019,.0145,28)
    m.rod('Guide rod',0,(0,.013,.165),(0,.013,.201),.005,n=16)
    m.rod('Guide rod tip',1,(0,.013,.2),(0,.013,.204),.0034,n=16)
    for side in [-1,1]:
        for i in range(8):
            z=-.099+i*.008
            m.rod('Slide serrations',1,(side*.0262,.026,z),(side*.0262,.060,z+.007),.0011,n=8)
        for z in [.145,.156,.167]:m.box('Forward slide cuts',3,(side*.0266,.045,z),(.001,.028,.0025),.0007)
    m.profile('Grip frame',0,[(-.008,-.09),(-.009,-.013),(-.151,-.042),(-.16,-.091),(-.141,-.113)],.039,.004)
    for side in [-1,1]:
        # Curved tapered panels flank a narrow full-metal grip frame.
        poly=[(-.036,-.086),(-.037,-.028),(-.137,-.05),(-.144,-.09),(-.133,-.103)]
        m.profile('Bakelite grip panels',6,poly,.004,.001)
        m.parts[-1]['v'][:,0]+=side*.0204
        for i in range(9):
            y=-.054-i*.009;z=-.053-i*.0024
            m.rod('Grip ribs',8,(side*.0231,y,z-.02),(side*.0231,y+.006,z+.017),.0012,n=8)
        for y,z in [(-.047,-.060),(-.132,-.076)]:screw(m,side*.0232,y,z,.0034)
    m.profile('Magazine',2,[(-.036,-.066),(-.039,-.022),(-.159,-.046),(-.163,-.088)],.029,.002)
    m.box('Magazine floor plate',1,(0,-.16,-.067),(.044,.01,.05),.002)
    m.box('Grip brass medallion',7,(-.0238,-.088,-.071),(.0015,.018,.021),.002)
    # A closed three-dimensional guard uses paired rods and thin crosslinks.
    guard(m,-.012,-.006,.075,width=.028)
    m.rod('Trigger guard right',0,(.014,-.012,-.006),(.014,-.048,0),.003,n=10)
    m.rod('Trigger guard right',0,(.014,-.048,0),(.014,-.053,.066),.003,n=10)
    m.rod('Trigger guard right',0,(.014,-.053,.066),(.014,-.038,.078),.003,n=10)
    m.rod('Trigger guard right',0,(.014,-.038,.078),(.014,-.012,.075),.003,n=10)
    m.box('Rear sight base',0,(0,.077,-.083),(.033,.012,.018),.0015)
    for x in [-.012,.012]:m.box('Rear sight notch',1,(x,.086,-.083),(.01,.008,.007),.001)
    m.box('Front sight',0,(0,.079,.171),(.008,.02,.016),.001)
    m.rod('Sight bead',10,(0,.084,.162),(0,.084,.160),.002,n=12)
    m.profile('Hammer',1,[(.04,-.11),(.076,-.128),(.083,-.126),(.074,-.111),(.063,-.10)],.018,.001)
    for i in range(3):m.box('Hammer thumb grooves',0,(0,.079-i*.005,-.126+i*.005),(.016,.002,.003),.0005)
    m.rod('Safety pin',1,(-.029,.006,-.076),(-.033,.006,-.076),.005,n=14)
    m.box('Safety lever',1,(-.0335,.01,-.060),(.004,.008,.031),.002)
    m.rod('Slide stop pin',1,(-.027,-.004,-.003),(-.030,-.004,-.003),.0045,n=14)
    m.box('Slide stop lever',1,(-.03,0,.01),(.004,.005,.03),.001)
    m.rod('Magazine release',7,(-.026,-.026,-.04),(-.03,-.026,-.04),.005,n=14)
    for side in [-1,1]:
        for y,z in [(.01,-.071),(.005,.027),(.023,-.101)]:screw(m,side*.027,y,z,.0022)
    m.box('Rear backstrap',1,(0,-.077,-.101),(.02,.077,.005),.001)
    return m

def build_shotgun():
    m=Model('Casino security walnut pump-action shotgun')
    m.profile('Walnut buttstock',4,[(.008,-.112),(-.017,-.204),(.0,-.325),(-.008,-.35),(-.119,-.35),(-.131,-.322),(-.081,-.197),(-.063,-.126)],.058,.005)
    m.profile('Butt pad',8,[(.003,-.348),(.001,-.361),(-.122,-.361),(-.133,-.349)],.061,.003)
    m.profile('Stock wrist',9,[(.008,-.108),(-.008,-.175),(-.061,-.175),(-.066,-.128)],.043,.003)
    m.box('Stock socket',0,(0,-.014,-.109),(.051,.069,.024),.003)
    for y in [-.112,-.097,-.082,-.067,-.052,-.037,-.022]:m.box('Butt pad tread',6,(0,y,-.361),(.048,.003,.002),.0007)
    for side in [-1,1]:
        for j in range(6):
            y=-.024-j*.012;z=-.324+j*.006
            m.rod('Stock grain',9,(side*.0292,y,z),(side*.0292,y+.008,z+.075),.0006,n=6)
        for j in range(6):
            y=-.028-j*.0058
            m.rod('Wrist checkering',5,(side*.022,y,-.175),(side*.022,y+.009,-.13),.00065,n=6)
    m.box('Receiver',0,(0,.005,-.007),(.058,.067,.203),.006)
    m.box('Receiver top rib',2,(0,.041,-.014),(.037,.008,.175),.002)
    m.box('Receiver lower seam',1,(0,-.028,-.003),(.055,.003,.178),.0008)
    m.box('Loading port',3,(0,-.032,.023),(.038,.004,.071),.003)
    m.box('Loading gate',1,(0,-.034,.016),(.029,.002,.051),.001)
    m.box('Ejection port',3,(.0298,.012,.018),(.002,.031,.095),.003)
    m.box('Bolt',1,(.0309,.012,.025),(.002,.024,.066),.003)
    m.box('Extractor',0,(.0326,.019,.048),(.0015,.005,.024),.001)
    m.box('Ejection port lower lip',1,(.03,-.005,.018),(.003,.003,.093),.0008)
    guard(m,-.031,-.086,-.001,width=.026)
    m.rod('Trigger guard right',0,(.013,-.031,-.086),(.013,-.067,-.08),.003,n=10)
    m.rod('Trigger guard right',0,(.013,-.067,-.08),(.013,-.072,-.01),.003,n=10)
    m.rod('Trigger guard right',0,(.013,-.072,-.01),(.013,-.057,.002),.003,n=10)
    m.rod('Trigger guard right',0,(.013,-.057,.002),(.013,-.031,-.001),.003,n=10)
    m.rod('Safety button',7,(-.018,-.041,-.07),(.02,-.041,-.07),.004,n=14)
    m.rod('Barrel',0,(0,.033,.064),(0,.033,.622),.016,.0145,n=32)
    m.tube('Muzzle crown',1,(0,.033,.617),(0,.033,.64),.016,.0107,32)
    m.rod('Magazine',0,(0,-.015,.08),(0,-.015,.552),.0128,n=28)
    m.rod('Magazine cap',1,(0,-.015,.547),(0,-.015,.566),.0145,n=24)
    for z in [.55,.554,.558,.562]:m.tube('Magazine cap knurling',0,(0,-.015,z),(0,-.015,z+.0015),.0148,.0138,24)
    m.box('Barrel clamp',0,(0,.008,.519),(.042,.067,.015),.003)
    screw(m,.022,.008,.519,.0038);screw(m,-.022,.008,.519,.0038)
    m.profile('Pump',4,[(.011,.169),(.015,.203),(.014,.335),(-.001,.37),(-.049,.364),(-.057,.335),(-.058,.19),(-.043,.165)],.058,.005)
    for side in [-1,1]:
        for i in range(11):
            z=.192+i*.014
            m.box('Pump grooves',5,(side*.0292,-.022,z),(.0018,.045,.003),.0006)
        for j in range(3):m.rod('Pump wood grain',9,(side*.0294,-.038+j*.014,.19),(side*.0294,-.034+j*.013,.343),.00065,n=6)
    for i in range(11):
        z=.192+i*.014;m.box('Pump underside grooves',5,(0,-.058,z),(.044,.0018,.003),.0006)
    m.box('Pump front band',0,(0,-.018,.363),(.052,.063,.009),.002)
    m.box('Pump rear band',0,(0,-.022,.172),(.053,.063,.008),.002)
    for x in [-.023,.023]:m.box('Action bars',1,(x,-.013,.125),(.004,.011,.141),.001)
    # Vent rib mounted clear of the round barrel with regularly spaced supports.
    m.box('Ventilated barrel rib',1,(0,.055,.354),(.009,.003,.518),.0008)
    for z in [.12,.205,.29,.375,.46,.545,.603]:m.box('Barrel rib supports',0,(0,.050,z),(.006,.012,.009),.001)
    m.rod('Front bead sight',7,(0,.055,.593),(0,.063,.593),.0028,n=16)
    m.box('Rear bead sight',10,(0,.047,.065),(.003,.006,.003),.001)
    m.rod('Action release pin',1,(-.03,-.019,-.067),(-.035,-.019,-.067),.004,n=12)
    m.box('Action release lever',1,(-.035,-.023,-.05),(.004,.007,.028),.0015)
    for side in [-1,1]:
        for y,z in [(.018,-.086),(-.013,-.054),(-.013,.071),(-.041,-.283)]:screw(m,side*(.0305 if z>-.15 else .0295),y,z,.003)
    m.box('Brass receiver plate',7,(-.0305,.006,.018),(.0015,.015,.039),.001)
    for z in [.003,.033]:screw(m,-.0315,.006,z,.0015)
    m.tube('Rear sling ring',1,(0,-.105,-.274),(0,-.105,-.279),.008,.005,20)
    m.tube('Magazine sling ring',1,(0,-.036,.552),(0,-.036,.556),.007,.004,20)
    return m

def preview(models):
    # Orthographic CPU contact sheet; shades actual exported triangles and checks silhouettes.
    W,H=1800,560*len(models)+60; img=Image.new('RGB',(W,H),(18,24,25));draw=ImageDraw.Draw(img)
    try:font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',24);small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',17)
    except:font=small=None
    for idx,(model,label) in enumerate(models):
        yoff=idx*560
        draw.rounded_rectangle((26,yoff+25,W-26,yoff+548),20,fill=(26,33,34),outline=(67,81,77),width=2)
        draw.text((58,yoff+48),label,fill=(220,216,191),font=font)
        # Length lies horizontally, visible right face, plus top and muzzle detail.
        right=unit(np.array([.48,0,.88]));up=unit(np.array([-.29,.94,.16]));depth=unit(np.cross(right,up));R=np.stack([right,up,depth])
        tris=[]; allv=np.concatenate([p['v']@R.T for p in model.parts]);mn=allv.min(0);mx=allv.max(0); scale=min((W-185)/(mx[0]-mn[0]),385/(mx[1]-mn[1]));cx=(mn[0]+mx[0])/2;cy=(mn[1]+mx[1])/2
        pixels=np.array(img);depthbuffer=np.full((H,W),-np.inf)
        light=unit([-.5,.85,.6])
        for p in model.parts:
            vv=p['v']@R.T; fn=p['n'][p['f']].mean(axis=1)
            for f,n in zip(p['f'],fn):
                if np.dot(n,depth)<-.02:continue
                pts=vv[f];xy=[(W/2+(a-cx)*scale,yoff+318-(b-cy)*scale) for a,b,c in pts]
                col=np.array(MATS[p['mat']][1][:3]);shade=.40+.6*max(0,np.dot(unit(n),light));col=np.sqrt(col)*255*shade
                tris.append((pts[:,2],xy,np.minimum(255,col).astype(np.uint8)))
        for zs,xy,col in tris:
            xy=np.array(xy);x0=max(0,int(np.floor(xy[:,0].min())));x1=min(W-1,int(np.ceil(xy[:,0].max())));y0=max(0,int(np.floor(xy[:,1].min())));y1=min(H-1,int(np.ceil(xy[:,1].max())))
            if x1<x0 or y1<y0:continue
            xs,ys=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
            a,b,c=xy;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(den)<1e-9:continue
            w0=((b[1]-c[1])*(xs-c[0])+(c[0]-b[0])*(ys-c[1]))/den;w1=((c[1]-a[1])*(xs-c[0])+(a[0]-c[0])*(ys-c[1]))/den;w2=1-w0-w1;z=w0*zs[0]+w1*zs[1]+w2*zs[2]
            target=depthbuffer[y0:y1+1,x0:x1+1];mask=(w0>=0)&(w1>=0)&(w2>=0)&(z>target);target[mask]=z[mask];pixels[y0:y1+1,x0:x1+1][mask]=col
        img=Image.fromarray(pixels);draw=ImageDraw.Draw(img)
        draw.text((58,yoff+510),f'{len(model.parts)} named parts / {sum(len(p["f"]) for p in model.parts):,} triangles / original procedural geometry',fill=(144,163,153),font=small)
    img.save(OUT+'/weapons-preview.png')

if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True);smg=build_smg();rifle=build_rifle();pistol=build_pistol();shotgun=build_shotgun();stats=[pistol.export(OUT+'/pistol.glb'),shotgun.export(OUT+'/shotgun.glb'),smg.export(OUT+'/smg.glb'),rifle.export(OUT+'/rifle.glb')]
    with open(OUT+'/asset-manifest.json','w') as f:json.dump(dict(provenance='Original authored procedural geometry; no imported models, textures, logos, or licensed weapon names.',coordinate_system='Right-handed glTF; metres; +Y up; muzzle +Z; receiver at origin',assets=stats),f,indent=2)
    preview([(pistol,'HOUSE SPECIAL / machined-steel service pistol'),(shotgun,'DOORMAN / walnut pump-action shotgun'),(smg,'CROUPIER / compact stamped-steel automatic'),(rifle,'PIT BOSS / walnut-stock battle rifle')]);print(json.dumps(stats,indent=2))
