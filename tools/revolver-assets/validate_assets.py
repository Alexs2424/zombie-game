"""Verify delivered revolver geometry, compatible grip, hands, and bore openings."""
from pathlib import Path
import json,hashlib,math
import numpy as np
from asset_io import read
from generate_revolver import CONTACT_NAMES,MUZZLE
PROJECT=Path(__file__).resolve().parents[2]
MODELS=PROJECT/'public'/'models'
DOCS=PROJECT/'docs'/'revolver-assets'

def validate(name):
    path=MODELS/name;g,a,parts=read(path);triangles=0;min_area=1.;min_dot=1.;inherited_cap_normals=0
    for part in parts:
        v,n,f=part['v'],part['n'],part['f']
        assert np.all(np.isfinite(v)) and np.all(np.isfinite(n))
        assert f.min()>=0 and f.max()<len(v)
        assert np.allclose(np.linalg.norm(n,axis=1),1,atol=1e-4)
        cross=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
        area=np.linalg.norm(cross,axis=1)/2
        assert area.min()>1e-15,(name,part['name'],'degenerate',area.min())
        dots=np.einsum('ij,ij->i',cross,n[f].mean(axis=1))
        if name=='revolver.glb':assert dots.min()>0,(name,part['name'],'winding',dots.min())
        else:inherited_cap_normals+=int(np.count_nonzero(dots<=0))
        min_area=min(min_area,float(area.min()));min_dot=min(min_dot,float(dots.min()));triangles+=len(f)
    assert triangles<=20000
    assert all('uri' not in image for image in g.get('images',[]))
    v=np.concatenate([p['v'] for p in parts])
    return dict(file=name,triangles=triangles,vertices=sum(len(p['v']) for p in parts),bounds=[v.min(0).tolist(),v.max(0).tolist()],bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),checks=dict(header_and_buffer_lengths=True,indices=True,finite_positions=True,unit_normals=True,face_winding=(True if name=='revolver.glb' else 'Inherited hand mesh; source-identical'),nondegenerate_triangles=True,self_contained=True),minimum_triangle_area=min_area,inherited_hand_cap_normal_disagreements=inherited_cap_normals),parts

reports=[]
for name in ['revolver.glb','hands-revolver.glb']:
    report,parts=validate(name);reports.append(report)
    if name=='revolver.glb':revolver=parts
_,_,pistol=read(MODELS/'pistol.glb')
reference={(p['name'],p['mat']):p for p in pistol}
for p in revolver:
    if p['name'] not in CONTACT_NAMES:continue
    old=reference[(p['name'],p['mat'])]
    assert np.allclose(p['v'],old['v'],atol=1e-7)
    assert np.array_equal(p['f'],old['f'])
assert (MODELS/'hands-pistol.glb').read_bytes()==(MODELS/'hands-revolver.glb').read_bytes()
# Test each chamber center against the cylinder cap triangles: all six openings
# must remain unfilled, even though the loaded cartridge heads close the rear.
cap=next(p for p in revolver if p['name']=='Cylinder end faces')
for angle in math.pi/2+np.arange(6)*math.pi/3:
    xy=np.array([math.cos(angle),math.sin(angle)])*.022+[0,.048]
    for tri in cap['v'][cap['f']]:
        a,b,c=tri[:,:2]
        den=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        if abs(den)<1e-12:continue
        u=((xy[0]-a[0])*(c[1]-a[1])-(xy[1]-a[1])*(c[0]-a[0]))/den;v=((b[0]-a[0])*(xy[1]-a[1])-(b[1]-a[1])*(xy[0]-a[0]))/den
        assert not (u>1e-6 and v>1e-6 and u+v<1-1e-6),'chamber capped'
result=dict(assets=reports,grip_contact_geometry_matches_pistol=True,hands_identical_to_pistol=True,six_open_chamber_caps=True,muzzle=MUZZLE)
(DOCS/'validation-report.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
