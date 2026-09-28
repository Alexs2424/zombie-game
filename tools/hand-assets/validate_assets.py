"""Structural GLB validation and source-weapon geometry identity checks."""
import sys,struct,json,hashlib
from pathlib import Path
import numpy as np
import generate_hands as H
PROJECT=Path(__file__).resolve().parents[2]
OUT=PROJECT/"public"/"models"
WEAPONS=OUT

def read(path):
 data=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',data)
 assert magic==b'glTF' and version==2 and total==len(data)
 jlen,jtype=struct.unpack_from('<I4s',data,12);assert jtype==b'JSON'
 gltf=json.loads(data[20:20+jlen]);blen,btype=struct.unpack_from('<I4s',data,20+jlen);assert btype==b'BIN\0'
 blob=data[28+jlen:];assert blen==len(blob)==gltf['buffers'][0]['byteLength']
 def accessor(index):
  a=gltf['accessors'][index];v=gltf['bufferViews'][a['bufferView']];d={5126:'<f4',5125:'<u4'}[a['componentType']];n={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
  result=np.frombuffer(blob,dtype=d,count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)
  assert np.all(np.isfinite(result))
  return result
 return gltf,accessor

report=[]
for kind in ['pistol','shotgun','smg','rifle']:
 path=OUT/f'hands-{kind}.glb';g,a=read(path)
 assert [n['name'] for n in g['nodes']]==['RightHand','LeftHand']
 assert all('uri' not in image for image in g['images']) and len(g['images'])==2
 tris=0;bounds=[];shortest=1.
 for node in g['nodes']:
  for p in g['meshes'][node['mesh']]['primitives']:
   v=a(p['attributes']['POSITION']);n=a(p['attributes']['NORMAL']);uv=a(p['attributes']['TEXCOORD_0']);indices=a(p['indices']).flatten()
   assert indices.max()<len(v) and len(v)==len(n)==len(uv) and len(indices)%3==0
   normal_len=np.linalg.norm(n,axis=1);assert np.allclose(normal_len,1,atol=1e-4)
   f=indices.reshape(-1,3);areas=np.linalg.norm(np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]]),axis=1)/2
   assert np.min(areas)>1e-15,(kind,np.min(areas))
   shortest=min(shortest,float(np.min(areas)));tris+=len(f);bounds.extend(v+node['translation'])
 assert 10000<=tris<=20000
 gunpath=WEAPONS/f'{kind}.glb';gg,ga=read(gunpath);w=H.load_weapon(kind);source_parts={(p['name'],p['mat']):p for p in w.parts}
 maximum_error=0.
 for node in gg['nodes']:
  pr=gg['meshes'][node['mesh']]['primitives'][0];p=source_parts[(node['name'],pr['material'])];actual=ga(pr['attributes']['POSITION'])+node.get('translation',[0,0,0]);assert actual.shape==p['v'].shape
  err=float(abs(actual-p['v']).max());maximum_error=max(maximum_error,err);
  assert err==0.,(kind,node['name'],err)
 stats=dict(asset=path.name,triangles=tris,bytes=path.stat().st_size,embedded_texture_count=2,finite_unit_normals=True,index_ranges_valid=True,nondegenerate_triangles=True,minimum_triangle_area=shortest,weapon_reference=gunpath.name,weapon_geometry_max_error_metres=maximum_error,weapon_sha256=hashlib.sha256(gunpath.read_bytes()).hexdigest(),asset_sha256=hashlib.sha256(path.read_bytes()).hexdigest())
 report.append(stats)
(PROJECT/'docs'/'hand-assets'/'validation-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
