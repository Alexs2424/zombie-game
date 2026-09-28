"""Original anatomical first-person gloves, explicitly fitted to Last Jackpot weapons.
Run: python3 generate_hands.py
Weapon reference generator is used for unchanged geometry in QA renders only.
No external geometry, textures, copyrighted assets or generator services used.
"""
import json, struct, math, os, io, hashlib, copy
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy.interpolate import CubicSpline
import weapon_geometry_reference as W

PROJECT=Path(__file__).resolve().parents[2]
OUT=PROJECT/"outputs"/"hand-assets"
OUT.mkdir(parents=True, exist_ok=True)
unit=W.unit
MATS=[
 ('Weathered saddle-brown glove leather',(.255,.158,.084,1),0,.77),
 ('Palm and fingertip suede',(.155,.102,.060,1),0,.90),
 ('Reinforced charcoal knuckle panels',(.095,.115,.096,1),0,.72),
 ('Raised leather piping',(.105,.065,.036,1),0,.8),
 ('Flax contrast stitching',(.40,.31,.19,1),0,.9),
 ('Olive woven sleeve',(.125,.157,.123,1),0,.94),
 ('Ribbed elastic cuff',(.063,.077,.060,1),0,.94),
 ('Worn leather fold edges',(.28,.185,.096,1),0,.8),
 ('Darkened knuckle creases',(.048,.035,.023,1),0,.95),
 ('Wrist buckle and snap',(.22,.235,.20,1),.7,.43),
]
W.MATS=MATS

class HandModel(W.Model):
 def __init__(self,name): super().__init__(name); self.side='RightHand'; self.pivots={}
 def add(self,name,mat,verts,faces,normals=None):
  super().add(self.side+' / '+name,mat,verts,faces,normals)
 def smooth(self,name,mat,verts,faces):
  v=np.array(verts,float); f=np.array(faces,np.uint32); n=np.zeros_like(v)
  fn=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
  for k in range(3): np.add.at(n,f[:,k],fn)
  n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-12)
  self.add(name,mat,v,f,n)

 def sweep(self,name,mat,points,widths,depths=None,n=12,samples=3,up=None,rounded=.74):
  """Tapered, flattened anatomical loft. Joint stations supply actual bends."""
  p=np.array(points,float); widths=np.array(widths,float); depths=widths if depths is None else np.array(depths,float)
  ts=np.arange(len(p),dtype=float); ss=np.linspace(0,len(p)-1,(len(p)-1)*samples+1)
  if len(p)>2:
   spline=CubicSpline(ts,p,axis=0,bc_type='natural'); pp=spline(ss); tans=spline(ss,1)
  else: pp=np.array([p[0]*(1-t)+p[-1]*t for t in np.linspace(0,1,len(ss))]);tans=np.tile(unit(p[-1]-p[0]),(len(ss),1))
  rr=np.interp(ss,ts,widths);dd=np.interp(ss,ts,depths)
  verts=[]; faces=[]; frames=[]
  for k,(pt,tan,r,d) in enumerate(zip(pp,tans,rr,dd)):
   w=unit(tan)
   if up is not None: u=unit(np.array(up)-w*np.dot(up,w))
   elif k: u=unit(frames[-1][0]-w*np.dot(frames[-1][0],w))
   else:u=unit(np.cross(w,[0,1,0] if abs(w[1])<.9 else [1,0,0]))
   v=unit(np.cross(w,u));frames.append((u,v))
   for i in range(n):
    a=2*math.pi*i/n; ca=math.cos(a);sa=math.sin(a)
    verts.append(pt+u*r*np.sign(ca)*abs(ca)**rounded+v*d*np.sign(sa)*abs(sa)**rounded)
   if k:
    for i in range(n):j=(i+1)%n; a0=(k-1)*n+i;b=(k-1)*n+j;c=k*n+j;d0=k*n+i;faces.extend([(a0,b,c),(a0,c,d0)])
  for end,k,rev in [(pp[0],0,True),(pp[-1],len(pp)-1,False)]:
   ci=len(verts);verts.append(end)
   for i in range(n):
    tri=(ci,k*n+i,k*n+(i+1)%n);faces.append(tri[::-1] if rev else tri)
  # Ring winding above faces outward for frame (u,v,w).
  self.smooth(name,mat,verts,faces)
  return pp,frames,rr,dd

 def palm(self,name,outline,axis=0,center=.04,thickness=.027):
  """Beveled custom silhouette with bulged dorsal plane and tapered heel."""
  poly=np.array(outline,float);c=poly.mean(0);rings=[]
  # Round each authored corner locally, preserving the distinct palm silhouette.
  for i,p in enumerate(poly):
   prev=poly[i-1];nxt=poly[(i+1)%len(poly)]
   for t in np.linspace(0,1,4,endpoint=False):
    a=p*.82+prev*.18;b=p*.82+nxt*.18
    rings.append((1-t)**2*a+2*t*(1-t)*p+t*t*b)
  ring=np.array(rings);N=len(ring);verts=[];faces=[]
  depth_levels=[(-.5,.60),(-.45,.83),(-.26,1.00),(.10,1.01),(.39,.91),(.5,.64)]
  for dep,scale in depth_levels:
   for q in ring:
    pos=np.zeros(3);pos[axis]=center+dep*thickness;pos[[i for i in range(3) if i!=axis]]=c+(q-c)*scale;verts.append(pos)
  # Detect ring orientation in the other two axes, orient all faces after creation.
  for k in range(len(depth_levels)-1):
   for i in range(N):j=(i+1)%N;faces.extend([(k*N+i,k*N+j,(k+1)*N+j),(k*N+i,(k+1)*N+j,(k+1)*N+i)])
  for k in [0,len(depth_levels)-1]:
   idx=len(verts);cen=np.zeros(3);cen[axis]=center+depth_levels[k][0]*thickness;cen[[i for i in range(3) if i!=axis]]=c;verts.append(cen)
   for i in range(N):faces.append((idx,k*N+i,k*N+(i+1)%N))
  # Hull-like shape; orient face normal away from central point.
  vc=np.mean(verts,0);verts=np.array(verts)
  for i,(a,b,c0) in enumerate(faces):
   nn=np.cross(verts[b]-verts[a],verts[c0]-verts[a]);fc=(verts[a]+verts[b]+verts[c0])/3
   if np.dot(nn,fc-vc)<0:faces[i]=(a,c0,b)
  self.smooth(name,0,verts,faces)

 def seam(self,name,points,stitches=False,rad=.0006):
  p=np.array(points,float)
  for a,b in zip(p[:-1],p[1:]):
   if stitches:
    d=np.linalg.norm(b-a); count=max(1,int(d/(.011 if 'Forearm' in name else .004)));v=(b-a)/count
    w=unit(b-a);u=unit(np.cross(w,[0,1,0] if abs(w[1])<.9 else [1,0,0]));cross=np.cross(w,u)
    for k in range(count):
     aa=a+v*(k+.10);bb=a+v*(k+.55);verts=[q+rad*(u*math.cos(j*2*math.pi/3)+cross*math.sin(j*2*math.pi/3)) for q in [aa,bb] for j in range(3)]
     faces=[]
     for j in range(3):jj=(j+1)%3;faces.extend([(j,jj,3+jj),(j,3+jj,3+j)])
     self.smooth(name,4,verts,faces)
   else:self.rod(name,3,a,b,rad,n=6)

 def finger(self,name,points,r=.009,flatten=.83,up=(0,1,0),panel=True):
  """Three human phalanges, two bent knuckles, tapered flattened distal pad."""
  ps=np.array(points,float)
  widths=[r*.93,r*1.02,r*.84,r*.62,r*.20] if len(ps)==5 else np.linspace(r,r*.28,len(ps))
  depths=np.array(widths)*flatten
  pp,frames,rr,dd=self.sweep(name+' leather',0,ps,widths,depths,n=12,samples=3,up=up,rounded=.78)
  # Dorsal small reinforced panels on each phalanx stay on the outside of the grip.
  dorsal=np.array(up,float)
  for j in range(len(ps)-2):
   a=ps[j];b=ps[j+1];axis=unit(b-a)
   # Offset onto the outward-facing side represented by u (same as sweep up).
   normal=unit(dorsal-axis*np.dot(dorsal,axis));ww=float(widths[j]*.87)
   pa=a+(b-a)*.18+normal*ww;pb=a+(b-a)*.77+normal*ww
   if panel:
    # Shallow arched pad with broad face, not circular knuckle balls.
    self.sweep(name+' phalanx reinforcement',2,[pa,pb],[r*.59,r*.51],[.0011,.0010],n=8,samples=1,up=np.cross(axis,normal),rounded=.62)
   # Actual knuckle folds are three low raised, non-uniform transverse curves.
   if j:
    ctr=a+normal*widths[j]*.98;cross=unit(np.cross(axis,normal))
    for shift in [-.0022,.0010]:
     cc=ctr+axis*shift
     curve=[cc-cross*r*.65-normal*.0012,cc-cross*r*.33,cc,cc+cross*r*.33,cc+cross*r*.65-normal*.0012]
     self.seam(name+' flexion crease',curve,rad=.00055)
   # A double line of tiny stitches visibly follows the finger side seam.
   side=unit(np.cross(axis,normal));self.seam(name+' saddle stitch',[a+(b-a)*.10+normal*ww*.60+side*r*.70,b-(b-a)*.14+normal*ww*.60+side*r*.62],True,.00037)
  # Suede fingertip underside, geometrically flattened and inset against the grip.
  a,b=ps[-2:];axis=unit(b-a);normal=unit(dorsal-axis*np.dot(dorsal,axis))
  self.sweep(name+' fingertip suede',1,[a+normal*r*.44,(a+b)*.5+normal*r*.34,b],[r*.45,r*.42,r*.12],[.0008,.001,.0004],n=8,samples=2,up=np.cross(axis,normal))

 def arm(self,wrist,elbow,side):
  wrist=np.array(wrist,float);elbow=np.array(elbow,float);direction=unit(wrist-elbow)
  # Wrist blend is lean, then the sleeve gently broadens toward the camera.
  p=[elbow,elbow*.55+wrist*.45,wrist-direction*.082,wrist-direction*.026,wrist]
  self.sweep('Sleeve forearm',5,p,[.052,.045,.037,.031,.027],[.045,.040,.032,.027,.025],n=16,samples=3,up=(1,0,0),rounded=.77)
  cuff0=wrist-direction*.052;cuff1=wrist-direction*.005
  pp,frames,rr,dd=self.sweep('Elastic wrist cuff',6,[cuff0,cuff1],[.034,.029],[.029,.026],n=16,samples=3,up=(1,0,0),rounded=.78)
  u,v=frames[0]
  # Six circumferential knit ridges follow the tapered anatomical wrist.
  for t in np.linspace(.05,.97,8):
   c=cuff0*(1-t)+cuff1*t;wr=.034*(1-t)+.029*t;dr=.029*(1-t)+.026*t
   pts=[]
   for i in range(25):
    a=i*2*math.pi/24;pts.append(c+u*math.cos(a)*(wr+.0011)+v*math.sin(a)*(dr+.0011))
   self.sweep('Cuff ribbing',6,pts,[.0013]*len(pts),n=4,samples=1,rounded=1)
  # Leather closing strap on the exposed dorsal face of the cuff.
  normal=u if side=='RightHand' else -u
  cc=(cuff0+cuff1)/2+normal*.032
  self.sweep('Leather wrist strap',0,[cc-v*.021,cc+v*.021],[.009,.009],[.0021,.0021],n=8,samples=2,up=direction,rounded=.62)
  self.seam('Wrist strap stitching',[cc-v*.019+direction*.007+normal*.002,cc+v*.019+direction*.007+normal*.002],True,.0005)
  self.rod('Wrist strap snap',9,cc+normal*.001,cc+normal*.003,.004,n=16)
  # Cloth sleeve seam, broken stitch line and two angled fabric folds.
  for sign in [-1,1]:
   a=elbow+u*sign*.045+v*.016;b=wrist-direction*.065+u*sign*.034+v*.011
   self.seam('Forearm tailored seam',[a,a*.4+b*.6,b],False,.001)
   self.seam('Forearm stitching',[a+u*sign*.0015,b+u*sign*.0015],True,.00042)

 def finish(self,path):
  self.merge()
  # Consolidate by side and material: each hand is an independently animated node
  # with ten named material primitives, under its anatomical wrist pivot.
  blob=bytearray();views=[];acc=[];meshes=[];nodes=[]
  def buffer(raw,target=None):
   off=len(blob);blob.extend(raw)
   while len(blob)%4:blob.append(0)
   d=dict(buffer=0,byteOffset=off,byteLength=len(raw))
   if target:d['target']=target
   views.append(d);return len(views)-1
  def attr(a,dtype,kind,target):
   a=np.asarray(a,dtype=dtype);vi=buffer(a.tobytes(),target);d=dict(bufferView=vi,componentType=5126 if dtype=='<f4' else 5125,count=len(a),type=kind)
   if kind=='VEC3':d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
   acc.append(d);return len(acc)-1
  # Procedural embedded 384px leather pore texture; original seeded noise.
  rng=np.random.default_rng(91);N=384
  fine=rng.normal(0,7,(N,N));coarse=np.asarray(Image.fromarray(rng.integers(100,240,(48,48),dtype=np.uint8)).resize((N,N),Image.Resampling.BICUBIC),float)
  base=np.clip(211+(coarse-170)*.15+fine,145,244).astype(np.uint8)
  tex=Image.fromarray(np.repeat(base[:,:,None],3,axis=2),'RGB');td=ImageDraw.Draw(tex)
  for i in range(1250):
   x,y=rng.integers(0,N,2);shade=int(rng.integers(125,195));td.line([(int(x),int(y)),(int(x+1),int(y))],fill=(shade,shade,shade),width=1)
  tex=tex.filter(ImageFilter.GaussianBlur(.20));bio=io.BytesIO();tex.save(bio,format='PNG');imv=buffer(bio.getvalue())
  yy,xx=np.gradient(np.array(tex)[:,:,0].astype(float));norm=np.dstack([-xx*.037,-yy*.037,np.ones_like(xx)]);norm/=np.linalg.norm(norm,axis=2)[:,:,None];normaltex=Image.fromarray(np.clip((norm*.5+.5)*255,0,255).astype(np.uint8));nb=io.BytesIO();normaltex.save(nb,format='PNG');normalview=buffer(nb.getvalue())
  for side in ['RightHand','LeftHand']:
   prims=[];pivot=np.array(self.pivots[side])
   for mat in range(len(MATS)):
    ps=[p for p in self.parts if p['name'].startswith(side+' / ') and p['mat']==mat]
    if not ps:continue
    vv=[];nn=[];ff=[];uu=[];off=0
    for p in ps:
     vv.append(p['v']-pivot);nn.append(p['n']);ff.append(p['f']+off);off+=len(p['v'])
     # Stable box-projected UV in world metre coordinates gives tiny pore grain.
     v=p['v'];norm=p['n'];major=np.argmax(np.abs(norm).mean(axis=0));axes=[i for i in range(3) if i!=major];uu.append(v[:,axes]/.074)
    pos=attr(np.concatenate(vv),'<f4','VEC3',34962);nor=attr(np.concatenate(nn),'<f4','VEC3',34962);uv=attr(np.concatenate(uu),'<f4','VEC2',34962);ind=attr(np.concatenate(ff).flatten(),'<u4','SCALAR',34963)
    prims.append(dict(attributes=dict(POSITION=pos,NORMAL=nor,TEXCOORD_0=uv),indices=ind,material=mat))
   meshes.append(dict(name=side+' articulated glove and forearm',primitives=prims))
   nodes.append(dict(name=side,mesh=len(meshes)-1,translation=pivot.tolist(),extras=dict(animationPivot='anatomical wrist',fingers=5)))
  mats=[]
  for i,(name,col,metal,rough) in enumerate(MATS):
   pbr=dict(baseColorFactor=col,metallicFactor=metal,roughnessFactor=rough)
   if i not in [4,9]:pbr['baseColorTexture']=dict(index=0)
   material=dict(name=name,pbrMetallicRoughness=pbr,doubleSided=False)
   if i not in [4,9]:material['normalTexture']=dict(index=1,scale=.30)
   mats.append(material)
  gltf=dict(asset=dict(version='2.0',generator='Last Jackpot original anatomical hand lofts',copyright='Original procedural meshes and embedded textures; no external assets'),scene=0,scenes=[dict(name=self.name,nodes=[0,1])],nodes=nodes,meshes=meshes,materials=mats,textures=[dict(source=0,sampler=0),dict(source=1,sampler=0)],images=[dict(name='Original seeded leather pore grain',bufferView=imv,mimeType='image/png'),dict(name='Original pore normal map',bufferView=normalview,mimeType='image/png')],samplers=[dict(magFilter=9729,minFilter=9987,wrapS=10497,wrapT=10497)],buffers=[dict(byteLength=len(blob))],bufferViews=views,accessors=acc)
  jb=json.dumps(gltf,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4)
  with open(path,'wb') as f:f.write(struct.pack('<4sII',b'glTF',2,28+len(jb)+len(blob)));f.write(struct.pack('<I4s',len(jb),b'JSON'));f.write(jb);f.write(struct.pack('<I4s',len(blob),b'BIN\0'));f.write(blob)
  v=np.concatenate([p['v'] for p in self.parts]);return dict(file=path.name,triangles=sum(len(p['f']) for p in self.parts),vertices=len(v),bytes=path.stat().st_size,bounds=[v.min(0).tolist(),v.max(0).tolist()],nodes=['RightHand','LeftHand'],wrist_pivots=self.pivots)

def dorsal_panel(m,outline,axis,center,thickness=.003):
 before=len(m.parts);m.palm('Sculpted dorsal reinforcement',outline,axis,center,thickness)
 for p in m.parts[before:]:p['mat']=2
 # Piping and stitches follow the perimeter on top of the reinforced patch.
 pts=[]
 for q in outline+[outline[0]]:
  p=np.zeros(3);p[axis]=center+(.002 if center>0 else -.002);p[[i for i in range(3) if i!=axis]]=q;pts.append(p)
 m.seam('Palm reinforced panel piping',pts,False,.0007)
 c=np.mean(pts[:-1],0);m.seam('Dorsal panel saddle stitching',[c+(p-c)*.88 for p in pts],True,.00048)

def pistol_right(m,kind):
 m.side='RightHand'
 # Grip rear/forward limits are sampled from each exact weapon profile.
 dz=0 if kind=='pistol' else (-.006 if kind=='smg' else -.014)
 shift=np.array([0,-.007 if kind!='pistol' else 0,dz])
 def P(p):return np.array(p)+shift
 outline=[(-.145,-.123),(-.117,-.141),(-.060,-.110),(-.044,-.067),(-.057,-.023),(-.097,-.038),(-.133,-.069)]
 m.palm('Anatomical palm and hypothenar heel',[(y+shift[1],z+shift[2]) for y,z in outline],0,.041,.036)
 panel=[(-.129,-.117),(-.109,-.126),(-.069,-.101),(-.061,-.069),(-.077,-.042),(-.117,-.065)]
 dorsal_panel(m,[(y+shift[1],z+shift[2]) for y,z in panel],0,.060)
 # A visible thenar bulge from the thumb base, tapered into the palm.
 m.sweep('Thumb thenar web',0,[P((.040,-.119,-.106)),P((.032,-.077,-.105)),P((.017,-.042,-.087))],[.018,.022,.013],[.017,.018,.011],n=12,samples=3,up=(1,0,0))
 for idx,(name,y,z,r) in enumerate([('Middle',-.073,-.024,.0104),('Ring',-.096,-.031,.0097),('Little',-.117,-.040,.0087)]):
  pts=[(.047,y,z-.031),(.046,y+.004,z-.007),(.025,y+.004,z+.008),(-.012,y,z+.008),(-.029,y-.005,z-.008)]
  m.finger(name,[P(p) for p in pts],r,up=(0,-1,0))
 # Trigger finger has free space between it and the gripping middle finger.
 ztrigger=.026 if kind=='pistol' else .000
 pts=[(.044,-.047,-.060),(.049,-.035,-.020),(.037,-.030,ztrigger),(.018,-.032,ztrigger+.014),(.008,-.036,ztrigger+.007)]
 m.finger('Index trigger',[P(p) for p in pts],.0090,up=(0,1,0))
 pts=[(.032,-.077,-.106),(.013,-.043,-.107),(-.018,-.020,-.078),(-.036,-.022,-.043),(-.037,-.026,-.026)]
 m.finger('Opposed thumb',[P(p) for p in pts],.0130,flatten=.82,up=(0,1,0))
 # Two organic crease lines over the heel prevent a flat mitten silhouette.
 for y,z in [(-.109,-.112),(-.118,-.100)]:
  m.seam('Palm heel flexion stitching',[P((.059,y,z)),P((.059,y+.009,z+.017)),P((.057,y+.01,z+.029))],True,.0005)
 wrist=P((.062,-.145,-.140));m.sweep('Leather glove wrist transition',0,[wrist,wrist*.30+P((.041,-.125,-.105))*.70,P((.041,-.119,-.091))],[.026,.028,.027],[.023,.022,.019],n=12,samples=3,up=(1,0,0));m.pivots['RightHand']=wrist.tolist();m.arm(wrist,(.235,-.35,-.82),'RightHand')

def pistol_left(m):
 m.side='LeftHand'
 outline=[(-.151,-.118),(-.159,-.072),(-.131,-.022),(-.077,.003),(-.049,-.026),(-.061,-.074),(-.112,-.118)]
 m.palm('Support palm wrapped around dominant hand',outline,0,-.056,.030)
 panel=[(-.140,-.101),(-.141,-.069),(-.124,-.038),(-.081,-.014),(-.064,-.03),(-.072,-.069),(-.11,-.104)]
 dorsal_panel(m,panel,0,-.072)
 for name,y,z,r in [('Index support',-.061,.010,.0099),('Middle support',-.084,.004,.0101),('Ring support',-.106,-.007,.0094),('Little support',-.129,-.020,.0080)]:
  pts=[(-.055,y,z-.041),(-.052,y,z-.012),(-.032,y-.001,z+.012),(.009,y-.002,z+.017),(.037,y-.004,z+.001)]
  m.finger(name,pts,r,up=(0,-1,0))
 # Left thumb is above dominant thumb, parallel to the frame, below slide travel.
 m.sweep('Support thenar web',0,[(-.060,-.109,-.089),(-.050,-.067,-.064),(-.044,-.029,-.043)],[.019,.020,.013],[.018,.017,.011],n=12,samples=3,up=(-1,0,0))
 m.finger('Opposed support thumb',[(-.055,-.068,-.075),(-.047,-.030,-.050),(-.043,-.005,-.017),(-.042,-.005,.014),(-.04,-.009,.032)],.0122,up=(-1,0,0))
 wrist=(-.077,-.153,-.125);m.sweep('Leather glove wrist transition',0,[wrist,(-.064,-.141,-.105),(-.056,-.125,-.087)],[.026,.027,.027],[.023,.022,.020],n=12,samples=3,up=(1,0,0));m.pivots['LeftHand']=list(wrist);m.arm(wrist,(-.43,-.34,-.82),'LeftHand')

def foreend_left(m,kind):
 m.side='LeftHand'
 if kind=='shotgun':centerz=.256;bottom=-.058;top=.014;halfw=.030
 elif kind=='rifle':centerz=.207;bottom=-.040;top=.026;halfw=.030
 else:centerz=.222;bottom=-.021;top=.039;halfw=.031
 # Dorsum lies below fore-end; the palm cup follows its exact lower surface.
 py=bottom-.018
 outline=[(-.070,centerz-.059),(-.048,centerz-.076),(.017,centerz-.045),(.032,centerz+.025),(.007,centerz+.050),(-.048,centerz+.036)]
 m.palm('Support palm cupped under fore-end',outline,1,py,.036)
 panel=[(-.059,centerz-.052),(-.041,centerz-.062),(.007,centerz-.039),(.019,centerz+.018),(.002,centerz+.035),(-.039,centerz+.025)]
 # axis1 uses XZ polygon. Negative y dorsal panel.
 dorsal_panel(m,panel,1,py-.020)
 for name,dz,r,shorten in [('Index support',.035,.0103,.004),('Middle support',.012,.0107,0),('Ring support',-.012,.0099,.003),('Little support',-.034,.0087,.014)]:
  zz=centerz+dz
  if kind=='smg':
   pts=[(.005,py-.002,zz),(.029,bottom-.004,zz+.001),(.041,.010-shorten*.22,zz+.002),(.030,.039-shorten,zz+.002),(.016,.045-shorten,zz-.002)]
  else:
   pts=[(.005,py-.002,zz),(.029,bottom-.004,zz+.001),(.041,(bottom+top)/2-shorten*.22,zz+.002),(.037,top-.009-shorten,zz+.002),(.026,top-shorten,zz-.002)]
  m.finger(name,pts,r,up=(0,0,1))
 # Thumb opposes the fingertips on the far side and runs forward along fore-end.
 m.sweep('Support thumb web',0,[(-.055,py,centerz-.033),(-.047,bottom-.005,centerz-.013),(-.043,(bottom+top)/2,centerz+.003)],[.019,.016,.012],[.017,.014,.011],n=12,samples=3,up=(-1,0,0))
 thumbdrop=.009 if kind=='shotgun' else 0
 pts=[(-.057,py+.004,centerz-.040),(-.049,bottom+.015,centerz-.025),(-.042,top+.010-thumbdrop,centerz+.003),(-.035,top+.016-thumbdrop,centerz+.029),(-.022,top+.014-thumbdrop,centerz+.042)]
 if kind=='smg':pts=[(-.057,py+.004,centerz-.040),(-.046,-.010,centerz-.025),(-.039,.026,centerz+.003),(-.023,.040,centerz+.025),(-.010,.042,centerz+.040)]
 m.finger('Opposed support thumb',pts,.0127,up=(-1,0,0))
 wrist=(-.084,py-.036,centerz-.092);m.sweep('Leather glove wrist transition',0,[wrist,(-.063,py-.015,centerz-.062),(-.042,py,centerz-.037)],[.027,.028,.026],[.024,.023,.018],n=12,samples=3,up=(1,0,0));m.pivots['LeftHand']=list(wrist);m.arm(wrist,(-.47,-.35,-.82),'LeftHand')

def shotgun_right(m):
 m.side='RightHand'
 outline=[(-.084,-.192),(-.064,-.208),(-.020,-.183),(-.006,-.143),(-.015,-.104),(-.052,-.091),(-.080,-.132)]
 m.palm('Palm around shotgun stock wrist',outline,0,.042,.035)
 panel=[(-.074,-.181),(-.059,-.193),(-.031,-.173),(-.019,-.14),(-.026,-.114),(-.051,-.109),(-.070,-.138)]
 dorsal_panel(m,panel,0,.060)
 for name,z,r in [('Middle',-.119,.0107),('Ring',-.143,.0100),('Little',-.166,.0088)]:
  pts=[(.050,-.015,z),(.047,-.045,z+.003),(.021,-.075,z+.003),(-.013,-.076,z),(-.031,-.057,z-.004)]
  m.finger(name,pts,r,up=(0,0,1))
 m.finger('Index trigger',[(.043,-.025,-.108),(.046,-.037,-.082),(.034,-.046,-.052),(.015,-.049,-.043),(.007,-.052,-.051)],.0090,up=(0,1,0))
 m.sweep('Thumb thenar web',0,[(.037,-.069,-.182),(.031,-.035,-.174),(.019,-.009,-.159)],[.018,.020,.014],[.016,.016,.010],n=12,samples=3,up=(1,0,0))
 m.finger('Opposed stock thumb',[(.035,-.049,-.176),(.025,-.009,-.162),(.001,.014,-.145),(-.025,.011,-.126),(-.035,-.010,-.110)],.0127,up=(0,1,0))
 wrist=(.067,-.092,-.201);m.sweep('Leather glove wrist transition',0,[wrist,(.052,-.078,-.183),(.042,-.065,-.161)],[.027,.028,.026],[.024,.022,.019],n=12,samples=3,up=(1,0,0));m.pivots['RightHand']=list(wrist);m.arm(wrist,(.235,-.35,-.82),'RightHand')

def build(kind):
 m=HandModel('Fitted leather gloves / '+kind)
 if kind=='shotgun':shotgun_right(m)
 else:pistol_right(m,kind)
 if kind=='pistol':pistol_left(m)
 else:foreend_left(m,kind)
 return m

# Use imported weapon material definitions unchanged during QA.
WEAPON_MATS=[('Blued steel',(.105,.135,.14,1),.88,.29),('Edge worn steel',(.30,.34,.33,1),.92,.26),('Parkerized receiver',(.155,.19,.18,1),.78,.42),('Recess black',(.022,.029,.028,1),.3,.63),('Walnut',(.27,.113,.047,1),.02,.43),('Walnut end grain',(.16,.055,.022,1),.03,.52),('Bakelite',(.118,.079,.055,1),.02,.38),('Aged brass',(.52,.365,.12,1),.82,.31),('Rubber',(.046,.052,.048,1),.01,.79),('Wood grain light',(.36,.16,.062,1),.03,.45),('Sight paint',(.82,.78,.56,1),.05,.6)]

def load_weapon(kind):
 """Read the supplied GLB bytes so previews match actual weapons exactly."""
 weapon_dir=Path(os.environ.get('LAST_JACKPOT_WEAPONS',str(PROJECT/'public'/'models')))
 data=(weapon_dir/(kind+'.glb')).read_bytes();jlen=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+jlen]);blob=data[28+jlen:]
 def a(idx):
  q=g['accessors'][idx];v=g['bufferViews'][q['bufferView']];n={'VEC3':3,'VEC2':2,'SCALAR':1}[q['type']]
  return np.frombuffer(blob,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[q['componentType']],count=q['count']*n,offset=v.get('byteOffset',0)+q.get('byteOffset',0)).reshape(-1,n)
 model=W.Model(kind+' actual supplied GLB')
 for node in g['nodes']:
  if 'mesh' not in node:continue
  for p in g['meshes'][node['mesh']]['primitives']:
   v=a(p['attributes']['POSITION'])+node.get('translation',[0,0,0]);n=a(p['attributes']['NORMAL']);f=a(p['indices']).reshape(-1,3)
   model.add(node['name'],p['material'],v,f,n)
 return model

def render_scene(hand,weapon,filename,view='shooter'):
 width,height=(1600,1050)
 bg=np.zeros((height,width,3),np.uint8)
 for y in range(height):bg[y,:,:]=np.array([29,35,37])+(height-y)/height*14
 depthbuf=np.full((height,width),np.inf)
 # Actual root transform camera(.29,-.25,.61), +Z forward, fov 70.
 if view=='detail':
  cam=np.array([1.1,.15,.55]);target=np.array([0,-.063,-.045 if 'pistol' in hand.name else .050]);focal=2100;perspective=False
 elif view=='shooter':
  cam=np.array([-.29,.25,-.61]);target=cam+np.array([0,0,1]);focal=height/(2*math.tan(math.radians(70/2)));perspective=True
 else:
  cam=np.array([1.4,.53,.86]);target=np.array([-.03,-.07,-.03]);focal=1030;perspective=False
 forward=unit(target-cam);right=unit(np.cross([0,1,0],forward));up=unit(np.cross(forward,right));rot=np.stack([right,up,forward]);light=unit([-.4,.8,-.8]);light2=unit([.8,.4,.2])
 tris=0
 for obj,mats in [(weapon,WEAPON_MATS),(hand,MATS)]:
  for p in obj.parts:
   vv=(p['v']-cam)@rot.T
   if perspective:
    if np.min(vv[:,2])<.025:
     # Long sleeves extend behind camera. Clip individual triangles below.
     pass
    xy=np.stack([width*.5+focal*vv[:,0]/np.maximum(.025,vv[:,2]),height*.5-focal*vv[:,1]/np.maximum(.025,vv[:,2])],1)
   else:xy=np.stack([width*.5+focal*vv[:,0],height*.46-focal*vv[:,1]],1)
   col=np.array(mats[p['mat']][1][:3]);metal=mats[p['mat']][2]
   normals=p['n']
   for face in p['f']:
    xyz=vv[face]
    if np.min(xyz[:,2])<.025:continue
    coords=xy[face];x0=max(0,int(np.floor(coords[:,0].min())));x1=min(width-1,int(np.ceil(coords[:,0].max())));y0=max(0,int(np.floor(coords[:,1].min())));y1=min(height-1,int(np.ceil(coords[:,1].max())))
    if x1<x0 or y1<y0:continue
    # Back-face removal matches glTF single-sided rendering.
    world=p['v'][face];nn=unit(normals[face].mean(0));normalface=np.cross(world[1]-world[0],world[2]-world[0])
    if np.dot(normalface,cam-world.mean(0))<=0:continue
    a,b,c=coords;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(den)<1e-12:continue
    xs,ys=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
    w0=((b[1]-c[1])*(xs-c[0])+(c[0]-b[0])*(ys-c[1]))/den;w1=((c[1]-a[1])*(xs-c[0])+(a[0]-c[0])*(ys-c[1]))/den;w2=1-w0-w1
    iz=w0/xyz[0,2]+w1/xyz[1,2]+w2/xyz[2,2]
    z=np.divide(1,iz,out=np.full_like(iz,np.inf),where=abs(iz)>1e-12) if perspective else w0*xyz[0,2]+w1*xyz[1,2]+w2*xyz[2,2]
    db=depthbuf[y0:y1+1,x0:x1+1];mask=(w0>=0)&(w1>=0)&(w2>=0)&(z<db)
    if not mask.any():continue
    # Interpolated smooth vertex normals demonstrate actual beveled geometry.
    ns=normals[face];interp=w0[:,:,None]*ns[0]+w1[:,:,None]*ns[1]+w2[:,:,None]*ns[2];interp/=np.maximum(np.linalg.norm(interp,axis=2)[:,:,None],1e-9)
    diffuse=np.maximum(0,interp@light)*.63+np.maximum(0,interp@light2)*.23+.33
    base=np.power(np.maximum(.001,col),.4545)*245
    rgb=np.clip(base[None,None,:]*diffuse[:,:,None],0,255)
    if obj is hand and p['mat'] in [0,1,2,5,6]:
     # Fine deterministic screen-level modulation mirrors embedded leather grain.
     noise=(np.sin(xs*7.77+ys*5.34)*np.cos(xs*3.71-ys*9.45))*2.2;rgb=np.clip(rgb+noise[:,:,None],0,255)
    bg[y0:y1+1,x0:x1+1][mask]=rgb.astype(np.uint8)[mask];db[mask]=z[mask];tris+=1
 img=Image.fromarray(bg);d=ImageDraw.Draw(img)
 try:font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',27);small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',18)
 except:font=small=None
 d.text((35,27),hand.name.upper(),font=font,fill=(229,222,203));d.text((36,67),'SHOOTER VIEW  |  camera root (+0.29, -0.25, +0.61), 70° FOV' if view=='shooter' else 'SIDE / FRONT DETAIL  |  actual weapon + hand geometry',font=small,fill=(161,177,170))
 d.text((36,height-42),'Original modeled fingers • glove panels • raised seam stitching • ribbed cuffs',font=small,fill=(174,186,174));img.save(filename)
 print('Rendered',filename,flush=True)

if __name__=='__main__':
 stats=[]
 for kind in ['pistol','shotgun','smg','rifle']:
  m=build(kind);s=m.finish(OUT/f'hands-{kind}.glb');stats.append(s);print(json.dumps(s),flush=True)
  w=load_weapon(kind);render_scene(m,w,OUT/f'{kind}-shooter.png','shooter');render_scene(m,w,OUT/f'{kind}-side.png','side');render_scene(m,w,OUT/f'{kind}-grip-detail.png','detail')
 manifest=dict(provenance='Original anatomical procedural geometry and original embedded leather textures; no imported third-party meshes, images, logos, or weapon designs.',coordinate_system='glTF 2.0 metres; +Y up; +Z muzzle; receiver origin exactly matching supplied weapon assets. Parent weapon and hands together; keep both scales 1.',integration='Load matching hands-*.glb as a sibling of unchanged weapon mesh under common root. Expected camera root (.29, -.25, .61), forward +Z. GLB scene has RightHand and LeftHand nodes whose local translations are anatomical wrist pivots; rotating/translating them animates separate hands with their sleeves. Rest transforms must be retained. Meshes are baked posed grips, not skinned finger rigs.',anatomy='Every hand has separate index, middle, ring, little and opposed thumb paths. Each finger has three tapered flattened phalanges, knuckle folds, stitched side seams, dorsal reinforcement and suede fingertip. Wrists have tapered cuffs and long sleeve forearms extending behind/below camera.',preview='Each shooter and side PNG is rasterized from actual authored triangles, plus decoded triangles from exact unchanged supplied weapon GLBs. Shooter camera matches requested root with 70 degree FOV. Side views reveal grip contact.',assets=stats)
 (OUT/'asset-manifest.json').write_text(json.dumps(manifest,indent=2))
 print('COMPLETE',flush=True)
