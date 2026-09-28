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
