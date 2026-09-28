"""Render the saved editable source with short 2-thread CPU jobs. Does not rewrite GLBs."""
import bpy,json,sys,argparse
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,default=Path(bpy.data.filepath).parent);a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);root=a.output_dir.resolve();root.mkdir(parents=True,exist_ok=True)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.threads_mode='FIXED';s.render.threads=2
s.render.resolution_x=980;s.render.resolution_y=900;s.render.resolution_percentage=100;s.render.filepath=str(root/'slots-blender-preview.png');bpy.ops.render.render(write_still=True)
bpy.data.collections['SOURCE • BURGUNDY'].hide_render=True;cam=s.camera;cam.location=(1.25,-4.6,2.27);target=Vector((-.565,-.26,1.18));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1.62
s.render.resolution_x=720;s.render.resolution_y=760;s.render.filepath=str(root/'slots-blender-detail.png');bpy.ops.render.render(write_still=True)
images=[dict(name=im.name,size=list(im.size),packed=im.packed_file is not None) for im in bpy.data.images if im.source=='FILE'];assert all(i['packed'] for i in images)
counts={c.name:len(c.objects) for c in bpy.data.collections if c.name.startswith('SOURCE')}
(root/'blender-source-validation.json').write_text(json.dumps(dict(blender_version=bpy.app.version_string,native_file=Path(bpy.data.filepath).name,source_object_counts=counts,images=images,render_device='CPU',render_threads=2,render_samples=12),indent=2))
print('RENDERS_AND_NATIVE_PACK_VALIDATION_COMPLETE',flush=True)
