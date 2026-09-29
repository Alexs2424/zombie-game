"""Small, two-thread CPU previews of the actual exported assets (no GPU rendering)."""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['hotel-reception','hotel-jukebox','hotel-dining-table','tommy']
for name in names:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models'/f'{name}.glb'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    size=hi-lo;extent=max(size);center=(lo+hi)/2
    bpy.ops.mesh.primitive_plane_add(size=extent*20,location=(0,0,lo.z-.015))
    floor=bpy.data.materials.new('Preview dark slate');floor.diffuse_color=(.025,.035,.034,1);bpy.context.object.data.materials.append(floor)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=720;scene.render.resolution_y=540;scene.render.resolution_percentage=100
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.32,.37,.38,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    for title,offset,power,color in [('Soft key',(1,1.5,2.2),80,(1,.88,.69)),('Soft fill',(-1,1,1),45,(.72,.85,1)),('Edge',(0,-1.4,1.8),120,(1,.84,.64))]:
        data=bpy.data.lights.new(title,'AREA');data.energy=power*extent**2;data.shape='DISK';data.size=extent*1.1;data.color=color
        obj=bpy.data.objects.new(title,data);scene.collection.objects.link(obj);obj.location=center+Vector(offset)*extent;obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    camdata=bpy.data.cameras.new('Preview camera');camera=bpy.data.objects.new('Preview camera',camdata);scene.collection.objects.link(camera)
    offset=Vector((1.4,2.2,1.25)) if name!='tommy' else Vector((1.7,1.1,.85))
    camera.location=center+offset*extent;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=extent*1.36;scene.camera=camera
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'docs/hotel-assets'/f'{name}-preview.png');scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.7
    bpy.ops.render.render(write_still=True)
