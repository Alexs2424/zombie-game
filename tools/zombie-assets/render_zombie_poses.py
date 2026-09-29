"""Render the authored assets with the game's rigid shoulder/elbow/hip hierarchy.

Blender --background docs/zombie-assets/casino-undead.blend --python tools/zombie-assets/render_zombie_poses.py
This diagnostic does not modify the saved .blend or gameplay assets.
"""
import bpy
from mathutils import Matrix, Vector
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PIVOTS={'body':(0,0,0),'head':(0,1.48,0),'jaw':(0,1.61,.035),
        'leftArm':(-.3,1.36,0),'rightArm':(.3,1.36,0),
        'leftForearm':(-.3,1.08,0),'rightForearm':(.3,1.08,0),
        'leftLeg':(-.11,.8,0),'rightLeg':(.11,.8,0)}
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
def rotate(node,x=0,y=0,z=0):
    node.rotation_mode='QUATERNION'
    node.rotation_quaternion=(C @ Matrix.Rotation(y,3,'Y') @ Matrix.Rotation(x,3,'X') @ Matrix.Rotation(z,3,'Z') @ C.inverted()).to_quaternion()

for i,name in enumerate(['Pit Boss','Crooked Dealer','Last Showman']):
    collection=bpy.data.collections[name]
    meshes=list(collection.objects)
    pivots={}
    for part,p in PIVOTS.items():
        node=bpy.data.objects.new('Preview pivot • '+part,None)
        collection.objects.link(node)
        node.location=C @ Vector(p)+Vector(((i-1)*.95,0,0))
        pivots[part]=node
    bpy.context.view_layer.update()
    for part,node in pivots.items():
        if part=='body': continue
        parent='head' if part=='jaw' else 'leftArm' if part=='leftForearm' else 'rightArm' if part=='rightForearm' else 'body'
        world=node.matrix_world.copy();node.parent=pivots[parent];node.matrix_world=world
    bpy.context.view_layer.update()
    for o in meshes:
        if o.type!='MESH': continue
        part=o['part']
        p=part.removeprefix('wound_') if part.startswith('wound_') else 'body' if part.startswith('stump_') else part
        world=o.matrix_world.copy();o.parent=pivots[p];o.matrix_world=world
    bpy.context.view_layer.update()
    rotate(pivots['leftArm'],-.75-i*.15,z=-.12)
    rotate(pivots['rightArm'],-.95+i*.10,z=.12)
    rotate(pivots['leftForearm'],-.28)
    rotate(pivots['rightForearm'],-.4)
    rotate(pivots['leftLeg'],.15 if i%2 else -.16)
    rotate(pivots['rightLeg'],-.15 if i%2 else .16)
    rotate(pivots['jaw'],-.08-i*.09)
    rotate(pivots['head'],.035,z=(i-1)*.045)
    rotate(pivots['body'],y=(i-1)*-.15)

scene=bpy.context.scene
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.18
lights=[o for o in bpy.data.collections['STUDIO • preview only'].objects if o.type=='LIGHT']
for light in lights: light.data.energy*=.67
camera=scene.camera
camera.location=(2.1,-6.2,2.65)
camera.rotation_euler=(Vector((0,-.22,1.04))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=3.8
scene.render.resolution_x=1600;scene.render.resolution_y=1100
scene.render.filepath=str(ROOT/'docs/zombie-assets/pose-preview.png')
bpy.ops.render.render(write_still=True)
