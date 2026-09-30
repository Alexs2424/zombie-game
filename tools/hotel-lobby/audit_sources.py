"""Read editable Blender files and check evaluated geometry and packed images."""
import bpy,json,sys,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
names=sys.argv[sys.argv.index('--')+1:]
reports=[]
for name in names:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/source'/f'{name}.blend'))
    objects=[o for o in bpy.context.scene.objects if o.type in {'MESH','CURVE','FONT'}]
    assert len(objects)>1,'editable construction parts must be retained'
    deps=bpy.context.evaluated_depsgraph_get();verts=0
    for o in objects:
        me=bpy.data.meshes.new_from_object(o.evaluated_get(deps),depsgraph=deps)
        assert all(math.isfinite(v) for vertex in me.vertices for v in vertex.co),'finite vertices'
        verts+=len(me.vertices);bpy.data.meshes.remove(me)
    images=[i for i in bpy.data.images if i.type=='IMAGE' and i.size[0]>0]
    assert all(i.packed_file for i in images),'self-contained source textures'
    reports.append({'asset':name,'status':'passed','editableParts':len(objects),'evaluatedVertices':verts,'packedImages':len(images)})
(ROOT/'docs/hotel-assets/lobby/source-audit.json').write_text(json.dumps(reports,indent=2)+'\n')
print(json.dumps(reports))
