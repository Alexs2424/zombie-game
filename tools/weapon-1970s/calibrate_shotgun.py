"""Blender calibration of the existing Room Service rear bead to its barrel rib.
The model uses a low rear bead hidden by its vent rib; lift it onto a period dovetail pedestal.
"""
import bpy, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import wlib
from wlib import ROOT, B
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/shotgun.glb'))
bead=bpy.data.objects['Rear bead sight']
# Imported GLB Y-up becomes Blender Z-up; absolute assignment makes reruns idempotent.
bead.location.z=.061
if bpy.data.objects.get('Rear sight dovetail'):
    bpy.data.objects.remove(bpy.data.objects['Rear sight dovetail'],do_unlink=True)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,-.065,.056))
base=bpy.context.object;base.name='Rear sight dovetail'
base.dimensions=(.006,.009,.01)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
base.data.materials.append(next(m for m in bpy.data.materials if 'steel' in m.name.lower()))
objects=list(bpy.context.scene.objects)
wlib.export_glb(ROOT/'public/models/shotgun.glb',objects)
wlib.studio(objects,ROOT/'docs/weapon-1970s-assets/shotgun-sights.jpg',res=(1200,750))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/weapons-1970s/shotgun-sights.blend'),compress=True)
