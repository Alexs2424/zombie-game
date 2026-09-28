"""Independent GLB, dimensions, embedded-image and five-card clearance audit."""
from pathlib import Path
import argparse,json,struct,io,hashlib
import numpy as np
from PIL import Image
PROJECT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--model-path',type=Path,default=PROJECT/'public'/'models'/'poker-table.glb');p.add_argument('--report-dir',type=Path,default=PROJECT/'docs'/'poker-assets');args=p.parse_args();path=args.model_path.resolve();OUT=args.report_dir.resolve();OUT.mkdir(parents=True,exist_ok=True)
def quat(q):
 x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
raw=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',raw);assert magic==b'glTF' and version==2 and total==len(raw);jl,jtyp=struct.unpack_from('<I4s',raw,12);assert jtyp==b'JSON';g=json.loads(raw[20:20+jl]);bl,btyp=struct.unpack_from('<I4s',raw,20+jl);assert btyp==b'BIN\0';blob=raw[28+jl:28+jl+bl];assert len(blob)==g['buffers'][0]['byteLength'];assert 'uri'not in g['buffers'][0]
def acc(index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];dt=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]);n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*dt.itemsize);ar=np.ndarray((a['count'],n),dtype=dt,buffer=blob,offset=off,strides=(stride,dt.itemsize));assert np.isfinite(ar).all();return ar
worlds={}
def walk(i,parent):
 node=g['nodes'][i]
 if 'matrix'in node:m=np.array(node['matrix']).reshape(4,4).T
 else:
  m=np.eye(4);m[:3,:3]=quat(node.get('rotation',[0,0,0,1]))@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0])
 world=parent@m;worlds[i]=world
 for child in node.get('children',[]):walk(child,world)
for ni in g['scenes'][g.get('scene',0)]['nodes']:walk(ni,np.eye(4))
def clip(poly,axis,bound,keepgreater):
 result=[]
 if not len(poly):return result
 for a,b in zip(poly,np.roll(poly,-1,axis=0)):
  ia=a[axis]>=bound if keepgreater else a[axis]<=bound;ib=b[axis]>=bound if keepgreater else b[axis]<=bound
  if ia:result.append(a)
  if ia!=ib:result.append(a+(b-a)*((bound-a[axis])/(b[axis]-a[axis])))
 return result
vertices=[];triangles=0;deg=0;bad=0;drawcalls=0;material_stats=[];obstructions=[]
for ni,node in enumerate(g['nodes']):
 if 'mesh'not in node:continue
 for prim in g['meshes'][node['mesh']]['primitives']:
  drawcalls+=1;v=acc(prim['attributes']['POSITION']);n=acc(prim['attributes']['NORMAL']);ix=acc(prim['indices']).reshape(-1,3);assert ix.min()>=0 and ix.max()<len(v);assert len(v)==len(n);assert np.allclose(np.linalg.norm(n,axis=1),1,atol=2e-4)
  world=worlds[ni];wv=v@world[:3,:3].T+world[:3,3];vertices.append(wv);triangles+=len(ix);geometric=np.cross(v[ix[:,1]]-v[ix[:,0]],v[ix[:,2]]-v[ix[:,0]]);area=np.linalg.norm(geometric,axis=1);deg+=int((area<1e-13).sum());d=np.einsum('ij,ij->i',geometric,n[ix].mean(1));bad+=int(((d< -1e-10)&(area>1e-13)).sum());mat=g['materials'][prim['material']];material_stats.append({'material':mat['name'],'triangles':len(ix),'vertices':len(v)})
  tex=mat['pbrMetallicRoughness'].get('baseColorTexture')
  if tex:uv=acc(prim['attributes']['TEXCOORD_'+str(tex.get('texCoord',0))]);assert len(uv)==len(v)
  # The root uses the default glTF conversion, which flips X only. The reserved zone is symmetric X.
  for tri in wv[ix]:
   if tri[:,1].max()<=.8651:continue
   if tri[:,0].max()<-.78 or tri[:,0].min()>.78 or tri[:,2].max()<-.55 or tri[:,2].min()>-.16:continue
   poly=tri
   for axis,bound,greater in [(0,-.78,True),(0,.78,False),(2,-.55,True),(2,-.16,False)]:poly=clip(poly,axis,bound,greater)
   if len(poly)>=3 and max(point[1] for point in poly)>.8651:obstructions.append(mat['name'])
vv=np.concatenate(vertices);mn=vv.min(0);mx=vv.max(0);dims=mx-mn
assert np.all(dims<=[3.80001,.95001,2.40001]),dims
assert abs(mn[1])<1e-6 and abs(mn[0]+mx[0])<1e-5 and abs(mn[2]+mx[2])<1e-5
assert triangles<=50000 and len(g['materials'])<=10 and drawcalls<=10
assert deg==0,('zero-area triangles',deg)
assert bad==0,('winding mismatches',bad)
assert not obstructions,('runtime card area obstructed',sorted(set(obstructions)))
images=[]
for im in g.get('images',[]):
 assert 'uri'not in im;view=g['bufferViews'][im['bufferView']];data=blob[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']];pic=Image.open(io.BytesIO(data));size=pic.size;pic.verify();images.append({'name':im.get('name'),'size':list(size),'embedded':True})
assert sorted(i['size'] for i in images)==[[1024,512],[1024,1024],[2048,1024]]
assert all(m.get('alphaMode','OPAQUE')=='OPAQUE' for m in g['materials'])
report={'status':'passed','file':path.name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'triangles':triangles,'materials':len(g['materials']),'material_draw_calls':drawcalls,'bounds_min':mn.tolist(),'bounds_max':mx.tolist(),'dimensions_XYZ':dims.tolist(),'finite_arrays':True,'unit_normals':True,'indices_valid':True,'degenerate_triangles':deg,'winding_mismatches':bad,'five_card_region_clear':True,'five_card_region_XZ':{'x':[-.78,.78],'z':[-.55,-.16]},'felt_Y':.865,'recommended_card_plane_Y':.870,'images':images,'material_geometry':material_stats,'generator':g['asset'].get('generator')}
(OUT/'validation-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
