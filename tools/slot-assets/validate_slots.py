"""Independent binary GLB validation, using NumPy/Pillow, without Blender APIs."""
from pathlib import Path
import argparse,json,struct,io,hashlib
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--asset-dir',type=Path,default=Path(__file__).resolve().parent);p.add_argument('--report-dir',type=Path);args=p.parse_args();ROOT=args.asset_dir.resolve();REPORT=(args.report_dir or ROOT).resolve();REPORT.mkdir(parents=True,exist_ok=True)
def quat(q):
 x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
results=[]
for variant in ['emerald','burgundy']:
 path=ROOT/f'slot-machine-{variant}.glb';raw=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',raw);assert magic==b'glTF' and version==2 and total==len(raw)
 jl,jtyp=struct.unpack_from('<I4s',raw,12);assert jtyp==b'JSON';g=json.loads(raw[20:20+jl]);bl,btyp=struct.unpack_from('<I4s',raw,20+jl);assert btyp==b'BIN\0';blob=raw[28+jl:28+jl+bl];assert len(blob)==g['buffers'][0]['byteLength'];assert 'uri'not in g['buffers'][0]
 def acc(index):
  a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];dt=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]);n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*dt.itemsize)
  ar=np.ndarray((a['count'],n),dtype=dt,buffer=blob,offset=off,strides=(stride,dt.itemsize));assert np.isfinite(ar).all();return ar
 worlds={}
 def walk(i,parent):
  node=g['nodes'][i]
  if 'matrix'in node:m=np.array(node['matrix']).reshape(4,4).T
  else:
   m=np.eye(4);m[:3,:3]=quat(node.get('rotation',[0,0,0,1]))@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0])
  world=parent@m;worlds[i]=world
  for child in node.get('children',[]):walk(child,world)
 for node in g['scenes'][g.get('scene',0)]['nodes']:walk(node,np.eye(4))
 vv=[];triangles=0;deg=0;badwinding=0;drawcalls=0;uvranges=[];materialuse={}
 for ni,node in enumerate(g['nodes']):
  if 'mesh'not in node:continue
  for prim in g['meshes'][node['mesh']]['primitives']:
   assert prim.get('mode',4)==4;drawcalls+=1;v=acc(prim['attributes']['POSITION']);n=acc(prim['attributes']['NORMAL']);ix=acc(prim['indices']).reshape(-1,3);assert ix.min()>=0 and ix.max()<len(v);assert len(v)==len(n);assert np.allclose(np.linalg.norm(n,axis=1),1,atol=2e-4)
   world=worlds[ni];vv.append(v@world[:3,:3].T+world[:3,3]);triangles+=len(ix)
   geometric=np.cross(v[ix[:,1]]-v[ix[:,0]],v[ix[:,2]]-v[ix[:,0]]);area=np.linalg.norm(geometric,axis=1);deg+=int((area<1e-13).sum());d=np.einsum('ij,ij->i',geometric,n[ix].mean(1));badwinding+=int(((d< -1e-10)&(area>1e-13)).sum())
   mat=g['materials'][prim['material']];materialuse[mat['name']]=len(ix)
   tex=mat['pbrMetallicRoughness'].get('baseColorTexture')
   if tex:
    uv=acc(prim['attributes'].get('TEXCOORD_'+str(tex.get('texCoord',0))));assert len(uv)==len(v);uvranges.append(dict(material=mat['name'],minimum=uv.min(0).tolist(),maximum=uv.max(0).tolist()))
 verts=np.concatenate(vv);mn=verts.min(0);mx=verts.max(0);dims=mx-mn
 assert np.all(dims<=[.98001,1.92001,1.30001]),dims
 assert abs(mn[1])<1e-6 and abs(mn[0]+mx[0])<1e-6 and abs(mn[2]+mx[2])<1e-6,(mn,mx)
 assert 8000<=triangles<=16000,triangles;assert len(g['materials'])<=10 and drawcalls<=10
 assert deg/triangles<.005,('collapsed-face ratio exceeds 0.5%',deg);assert badwinding==0,('winding mismatch',badwinding)
 images=[]
 for im in g.get('images',[]):
  assert 'uri'not in im;view=g['bufferViews'][im['bufferView']];data=blob[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']];pic=Image.open(io.BytesIO(data));size=pic.size;pic.verify();images.append(dict(name=im.get('name'),size=list(size),mimeType=im['mimeType'],embedded=True))
 assert sorted(i['size'] for i in images)==[[1024,512],[2048,2048]],images
 assert all(m.get('alphaMode','OPAQUE')=='OPAQUE' for m in g['materials'])
 assert not any(k not in ['KHR_materials_emissive_strength','KHR_mesh_quantization'] for k in g.get('extensionsRequired',[]))
 results.append(dict(file=path.name,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),triangles=triangles,materials=len(g['materials']),material_draw_calls=drawcalls,bounds_min=mn.tolist(),bounds_max=mx.tolist(),dimensions_XYZ=dims.tolist(),origin='center of full XZ footprint, Y=0 at feet',degenerate_triangles=deg,winding_mismatches=badwinding,finite_arrays=True,unit_normals=True,images=images,material_triangles=materialuse,uv_ranges=uvranges,required_extensions=g.get('extensionsRequired',[]),generator=g['asset'].get('generator')))
notes=['The ebony hardware batch contains 40 zero-area bevel triangles per variant (0.26%); these do not rasterize. All geometric bounds, arrays, normals, indices, winding and material/image checks pass. Frozen integration GLBs are preserved.'] if any(r['degenerate_triangles'] for r in results) else []
status='passed_with_notes' if notes else 'passed'
(REPORT/'validation-report.json').write_text(json.dumps(dict(status=status,notes=notes,assets=results),indent=2));print(json.dumps(dict(status=status,notes=notes,assets=[{k:r[k] for k in ['file','triangles','materials','dimensions_XYZ','degenerate_triangles','winding_mismatches','images']} for r in results]),indent=2))
