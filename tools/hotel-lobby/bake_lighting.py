"""Bake original static floor irradiance in Cycles; no moving props or characters.

The PNG is an art-directed irradiance multiplier, not additive emissive color.
Runtime UV2 uses game X/Z over [-23,15] x [15,51].
"""
import sys, json, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from asset_lib import *
reset()
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48
scene.cycles.max_bounces=5;scene.cycles.diffuse_bounces=4
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.60,.69,.80,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.12
layout=json.loads((DOC/'layout.json').read_text())
M=palette()
# Original soft mullion projection for the principal runtime daylight source.
cookie_n=256;cy,cx=np.mgrid[0:cookie_n,0:cookie_n]/(cookie_n-1)
edge=lambda v:.5+.5*np.tanh(v/.018)
panes=edge(cx-.12)*edge(.88-cx)*edge(cy-.12)*edge(.88-cy)
for a in [.31,.50,.69]:panes*=1-.87*np.exp(-((cx-a)/.012)**2)
for a in [.37,.63]:panes*=1-.87*np.exp(-((cy-a)/.014)**2)
cookie_pixels=np.ones((cookie_n,cookie_n,4),np.float32)
cookie_pixels[:,:,:3]=panes[:,:,None]
cookie=bpy.data.images.new('Soft hotel window mullion projection',cookie_n,cookie_n)
cookie.colorspace_settings.name='Non-Color';cookie.pixels.foreach_set(cookie_pixels.ravel())
cookie.filepath_raw=str(ROOT/'public/models/hotel-window-light.png');cookie.file_format='PNG';cookie.save();cookie.pack();cookie.use_fake_user=True
# The real authored stairs include the column capitals and solid curved guards.
with bpy.data.libraries.load(str(ROOT/'assets/source/hotel-grand-stairs.blend')) as (src,dst):
    dst.objects=src.objects
for o in dst.objects:
    if o is not None:scene.collection.objects.link(o)
poly=layout['polygon']
for a,b in zip(poly,poly[1:]+poly[:1]):
    length=math.hypot(b['x']-a['x'],b['z']-a['z'])
    o=box('Bake wall shell',((a['x']+b['x'])/2,4.4,(a['z']+b['z'])/2),(length,8.8,.2),M['ivory'],0)
    o.rotation_euler.z=-math.atan2(b['z']-a['z'],b['x']-a['x'])
# Sources are just inside the window glazing, so the intact collision shell is valid.
def area(name,p,target,power,color,size,size_y=None):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color
    data.shape='RECTANGLE';data.size=size;data.size_y=size if size_y is None else size_y
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=xyz(p)
    o.rotation_euler=(Vector(xyz(target))-o.location).to_track_quat('-Z','Y').to_euler()
for x,z,power in [(14.55,26,1900),(-22.55,26,700),(14.55,39,900),(-22.55,40,450)]:
    area('Window diffuse daylight',(x,6.45,z),(-4,1,z+3),power,(.69,.82,1),3.55,3.5)
area('Grand chandelier bounce',(-4,6.2,28),(-4,0,28),950,(1,.77,.49),3)
area('Dining chandelier bounce',(-4,7.1,41),(-4,4,41),600,(1,.78,.53),3)
for x,z in [(-16,40),(8,40),(-16,44),(8,44),(-12,21)]:
    area('Warm salon or reception pool',(x,3.2,z),(x,0,z),160,(1,.76,.47),1.1)
def horizontal(name,points,y,mat):
    o=mesh(name,[(p['x'],y,p['z']) for p in points],[tuple(range(len(points)))],mat)
    if o.data.polygons[0].normal.z<0:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    return o
upper=horizontal('Actual mezzanine occluder',layout['upperPolygon'],3.85,M['stone'])
solid=upper.modifiers.new('Mezzanine thickness','SOLIDIFY');solid.thickness=.28
ceiling=horizontal('Ceiling bounce shell',poly,layout['ceilingY'],M['ivory'])
receiver=horizontal('Floor lighting receiver',poly,.018,material('Neutral irradiance receiver','#ffffff',1))
uv=receiver.data.uv_layers.active
for f in receiver.data.polygons:
    for li in f.loop_indices:
        v=receiver.data.vertices[receiver.data.loops[li].vertex_index].co
        uv.data[li].uv=((v.x+23)/38,(-v.y-15)/36)
n=1024
raw=bpy.data.images.new('Cycles floor irradiance raw',n,n,float_buffer=True)
raw.colorspace_settings.name='Non-Color'
mat=receiver.data.materials[0];node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=raw;mat.node_tree.nodes.active=node
bpy.ops.object.select_all(action='DESELECT');receiver.select_set(True);bpy.context.view_layer.objects.active=receiver
scene.render.bake.margin=8
bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'})
pixels=np.array(raw.pixels[:],dtype=np.float32).reshape(n,n,4)
rgb=pixels[:,:,:3]
# Small separable filter suppresses Monte Carlo noise without smearing room-scale shading.
for axis in [0,1]:
    rgb=sum(np.roll(rgb,i,axis=axis)*w for i,w in [(-2,1),(-1,4),(0,6),(1,4),(2,1)])/16
lum=rgb@np.array([.2126,.7152,.0722]);inside=pixels[:,:,3]>.5
scale=float(np.percentile(lum[inside],95))
assert scale>0 and np.isfinite(rgb).all(),'Cycles produced valid irradiance'
normalized=np.clip(rgb/max(scale,.001),0,1)
# Preserve readable combat shadows and restrained color separation; no crushed black floor.
out=np.ones((n,n,4),np.float32);out[:,:,:3]=.52+.48*normalized
packed=bpy.data.images.new('Hotel baked floor light multiplier',n,n)
packed.colorspace_settings.name='Non-Color';packed.pixels.foreach_set(out.ravel())
path=ROOT/'public/models/hotel-floor-lighting.png'
packed.filepath_raw=str(path);packed.file_format='PNG';packed.save();packed.pack();packed.use_fake_user=True
raw.pack()
scene['bake_contract']='Static diffuse lighting multiplier; exclude movable furniture, gates, quest panels and actors; UV2 X/Z'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/hotel-lighting-bake.blend'))
report={'engine':'Cycles CPU','samples':48,'resolution':[n,n],'bounces':5,'linearRange':[float(out[:,:,:3].min()),float(out[:,:,:3].max())],'irradianceP95':scale,'bytes':path.stat().st_size,'bounds':{'minX':-23,'maxX':15,'minZ':15,'maxZ':51},'movingObjectsIncluded':False}
(DOC/'lighting-bake.json').write_text(json.dumps(report,indent=2)+'\n')
print('LIGHTING_BAKE',json.dumps(report),flush=True)
