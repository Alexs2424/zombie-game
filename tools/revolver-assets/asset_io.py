"""Minimal glTF 2.0 inspection for original unskinned local assets."""
import json,struct
import numpy as np

def read(path):
    data=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',data)
    assert (magic,version,total)==(b'glTF',2,len(data))
    jlen,tag=struct.unpack_from('<I4s',data,12);assert tag==b'JSON'
    gltf=json.loads(data[20:20+jlen]);blen,tag=struct.unpack_from('<I4s',data,20+jlen);assert tag==b'BIN\0'
    blob=data[28+jlen:];assert len(blob)==blen==gltf['buffers'][0]['byteLength']
    def accessor(i):
        a=gltf['accessors'][i];v=gltf['bufferViews'][a['bufferView']];dim={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
        offset=v.get('byteOffset',0)+a.get('byteOffset',0)
        assert offset%4==0
        return np.frombuffer(blob,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*dim,offset=offset).reshape(-1,dim)
    parts=[]
    for node in gltf['nodes']:
        if 'mesh' not in node:continue
        assert not any(k in node for k in ['scale','rotation','matrix'])
        for p in gltf['meshes'][node['mesh']]['primitives']:
            parts.append(dict(name=node.get('name',''),v=accessor(p['attributes']['POSITION'])+node.get('translation',[0,0,0]),n=accessor(p['attributes']['NORMAL']),f=accessor(p['indices']).reshape(-1,3),mat=p['material']))
    return gltf,accessor,parts
