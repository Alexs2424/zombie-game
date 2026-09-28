"""Independent structural / dimensional validation of generated binary glTFs."""
import json, struct, io
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation
PROJECT=Path(__file__).resolve().parents[2]
ROOT=PROJECT/"docs"/"table-assets"
manifest=json.loads((ROOT/'asset-manifest.json').read_text())
report=[]
for asset in manifest['assets']:
    path=PROJECT/"public"/"models"/Path(asset['file']).name;raw=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',raw)
    assert magic==b'glTF' and version==2 and total==len(raw)
    jl,typ=struct.unpack_from('<I4s',raw,12);assert typ==b'JSON'
    g=json.loads(raw[20:20+jl]);bl,typ=struct.unpack_from('<I4s',raw,20+jl);assert typ==b'BIN\0';blob=raw[28+jl:28+jl+bl]
    assert g['buffers'][0]['byteLength']==len(blob)
    def readacc(i):
        a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dt={5126:'<f4',5125:'<u4'}[a['componentType']];off=v.get('byteOffset',0)+a.get('byteOffset',0)
        r=np.frombuffer(blob,dtype=dt,count=a['count']*n,offset=off).reshape((a['count'],n));assert np.isfinite(r).all();return r
    world={}
    def walk(i,parent=np.zeros(3)):
        node=g['nodes'][i];p=parent+np.array(node.get('translation',[0,0,0]));world[i]=p
        for c in node.get('children',[]):walk(c,p)
    for node in g['scenes'][g['scene']]['nodes']:walk(node)
    vertices=[];tris=0;bad=[];deg=0
    for ni,node in enumerate(g['nodes']):
        if 'mesh'not in node:continue
        for p in g['meshes'][node['mesh']]['primitives']:
            a=p['attributes'];v=readacc(a['POSITION']);n=readacc(a['NORMAL']);ix=readacc(p['indices']).reshape((-1,3));assert ix.min()>=0 and ix.max()<len(v);assert len(v)==len(n)
            assert np.allclose(np.linalg.norm(n,axis=1),1,atol=1e-4)
            if 'TEXCOORD_0'in a:assert len(readacc(a['TEXCOORD_0']))==len(v)
            vertices.append(v+world[ni]);tris+=len(ix)
            fn=np.cross(v[ix[:,1]]-v[ix[:,0]],v[ix[:,2]]-v[ix[:,0]]);length=np.linalg.norm(fn,axis=1);valid=length>1e-13;deg+=int((~valid).sum())
            d=np.einsum('ij,ij->i',fn,n[ix].mean(1));back=(d< -1e-10)&valid
            if back.any():bad.append([node['name'],int(back.sum()),len(ix)])
    vv=np.concatenate(vertices);dims=vv.max(0)-vv.min(0);assert np.allclose(dims,asset['dimensions'],atol=1e-6)
    assert tris==asset['triangles'];assert tris<25000
    for im in g.get('images',[]):
        view=g['bufferViews'][im['bufferView']];data=blob[view['byteOffset']:view['byteOffset']+view['byteLength']];Image.open(io.BytesIO(data)).verify()
    if path.name=='roulette-table.glb':
        wheel=[n for n in g['nodes'] if n['name']=='roulette_wheel'];assert len(wheel)==1 and len(wheel[0]['children'])>=7;assert np.allclose(wheel[0]['translation'],[-.735,.860,0]);assert any(n['name']=='roulette_ball' for n in g['nodes'])
    assert not bad,(path.name,bad)
    report.append(dict(file=path.name,triangles=tris,dimensions=dims.tolist(),degenerate_triangles=deg,checks='GLB structure, finite arrays, indices, unit normals, face winding, embedded PNGs, bounds, triangle budget: passed'))
face_normals={1:[0,1,0],2:[0,0,1],3:[1,0,0],4:[-1,0,0],5:[0,0,-1],6:[0,-1,0]}
for face,q in manifest['dice']['quaternion_xyzw_for_top_face'].items():
    assert np.allclose(Rotation.from_quat(q).apply(face_normals[int(face)]),[0,1,0],atol=1e-9)
(ROOT/'validation-report.json').write_text(json.dumps(dict(status='passed',assets=report,dice_quaternions='All six expected faces map to +Y'),indent=2));print(json.dumps(report,indent=2))
