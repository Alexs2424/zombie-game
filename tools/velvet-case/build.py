import bpy, math, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
wood=mat('Oiled American walnut',(.12,.047,.023),0,.36)
# Procedural longitudinal grain remains editable in the native source.
n=wood.node_tree.nodes;links=wood.node_tree.links;tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=8;tex.inputs['Detail'].default_value=2
coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1,14,4);links.new(coord.outputs['Generated'],mapping.inputs[0]);links.new(mapping.outputs[0],tex.inputs['Vector'])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.035,.009,.004,1);ramp.color_ramp.elements[1].color=(.21,.083,.029,1);links.new(tex.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],n.get('Principled BSDF').inputs['Base Color'])
brass=mat('Aged brushed brass',(.43,.27,.085),.8,.35);velvet=mat('Burgundy velvet',(.16,.012,.029),0,.94);dark=mat('Case shadow',(.018,.01,.008),0,.85);ivory=mat('Engraved ivory',(.8,.68,.42),.25,.5)
def box(name,loc,scale,material,parent=None,bevel=.018):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('Hand softened edges','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted corners','WEIGHTED_NORMAL')
 if parent:o.parent=parent
 return o
for x in [-.66,.66]:
 for y in [-.34,.34]:
  box('Tapered brass leg',(x,y,.38),(.045,.045,.76),brass)
  box('Foot ferrule',(x,y,.035),(.072,.072,.07),dark)
box('Lower apron',(0,0,.73),(1.5,.91,.1),wood)
box('Velvet tray',(0,0,.93),(1.48,.88,.14),velvet)
for x in [-.75,.75]:box('Walnut case end',(x,0,1.015),(.09,1,.32),wood)
for y in [-.465,.465]:box('Walnut case rail',(0,y,1.015),(1.5,.07,.32),wood)
for x in [-.75,.75]:box('Brass corner binding',(x,0,1.18),(.055,1.01,.025),brass)
for y in [-.47,.47]:box('Brass rim',(0,y,1.18),(1.56,.035,.025),brass)
for x in [-.45,.45]:
 box('Brass latch',(x,-.51,1.09),(.10,.028,.13),brass)
 box('Recessed latch catch',(x,-.53,1.09),(.025,.014,.045),dark)
for x in [-.42,.42]:box('Velvet weapon bolster',(x,0,1.055),(.12,.67,.09),velvet)
# Lid meshes are local to the rear hinge; runtime rotates this exact node.
h=bpy.data.objects.new('CaseHinge',None);bpy.context.collection.objects.link(h);h.location=(0,.48,1.18)
box('Walnut raised lid',(0,-.48,.06),(1.6,1.02,.12),wood,h)
box('Padded lid lining',(0,-.48,-.012),(1.42,.84,.045),velvet,h)
for x in [-.73,.73]:box('Lid brass edge',(x,-.48,.127),(.025,.96,.015),brass,h)
for y in [-.92,-.04]:box('Lid brass edge',(0,y,.127),(1.49,.022,.015),brass,h)
box('Maker plate',(0,-.48,.132),(.58,.22,.013),brass,h)
def text(body,loc,size,material,parent=None,rot=(0,0,0)):
 bpy.ops.object.text_add(location=loc,rotation=rot);o=bpy.context.object;o.name='Engraving '+body;o.data.body=body;o.data.align_x='CENTER';o.data.size=size;o.data.extrude=.0007;o.data.materials.append(material)
 if parent:o.parent=parent
 bpy.ops.object.convert(target='MESH')
text('THE VELVET CASE',(0,-.49,.143),.045,dark,h)
text('PRIVATE RESERVE',(0,-.505,.965),.049,ivory,rot=(math.pi/2,0,0))
for x in [-.55,.55]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.026,depth=.18,location=(x,.49,1.18),rotation=(0,math.pi/2,0));bpy.context.object.name='Brass piano hinge';bpy.context.object.data.materials.append(brass)
# Keep the source stage useful for artist review without exporting lights/camera.
bpy.ops.object.camera_add(location=(2,-3,2.2));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(0,-2,4));bpy.context.object.data.energy=450;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/source/velvet-case/velvet-case.blend')
# glTF cannot export procedural wood nodes: use a stable walnut base in the game.
links.remove(n.get('Principled BSDF').inputs['Base Color'].links[0]);n.get('Principled BSDF').inputs['Base Color'].default_value=(.12,.047,.023,1)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/velvet-case.glb',export_format='GLB',export_cameras=False,export_lights=False)
