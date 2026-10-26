"""Original fitted marble slabs and stone compass inlay, with embedded surface maps."""
import sys,math,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from asset_lib import *
reset();M=palette()
n=1024;y,x=np.mgrid[0:n,0:n]/n;rng=np.random.default_rng(214)
warp=x*6+y*3+np.sin(y*13+x*7)*.8+np.sin(y*37-x*11)*.16
vein=np.exp(-np.abs(np.sin(warp))*80)
fine=np.exp(-np.abs(np.sin(warp*2.7+y*9))*120)*.23
cloud=np.sin(x*11+y*7)*np.sin(y*13-x*3)*.013
value=.91-vein*.12-fine*.08+cloud+rng.normal(0,.002,(n,n))
def image(name,rgb):
    pixels=np.ones((n,n,4),np.float32);pixels[:,:,:3]=np.clip(rgb,0,1)
    im=bpy.data.images.new(name,n,n);im.pixels.foreach_set(pixels.ravel());im.pack();return im
albedo=image('Original warm limestone marble veins',np.stack([value,value*.973,value*.914],axis=2))
# Room-space wear follows entrances, reception and the two stair approaches.
wx=-23+x*38;wz=15+y*36
traffic=np.exp(-((wx+4)/2.5)**2)*np.exp(-((wz-27)/12)**4)
for px,pz,sx,sz in [(-12,23,4,1.8),(-15,23,2,2.4),(7,23,2,2.4),(-4,40,7,2)]:
    traffic=np.maximum(traffic,np.exp(-((wx-px)/sx)**2-((wz-pz)/sz)**2))
scuffs=np.zeros_like(x)
for _ in range(95):
    px=rng.uniform(-17,9);pz=rng.uniform(17,43);angle=rng.uniform(-.5,.5)
    dx=wx-px;dz=wz-pz;along=dx*np.sin(angle)+dz*np.cos(angle);across=dx*np.cos(angle)-dz*np.sin(angle)
    scuffs+=np.exp(-(along/rng.uniform(.12,.38))**2-(across/.035)**2)*rng.uniform(.025,.065)
r=np.clip(.31+traffic*.095+scuffs*traffic+.012*np.sin(wx*17+wz*13),.29,.50)
rough=image('Original room-space polish wear',np.stack([r,r,r],axis=2));rough.colorspace_settings.name='Non-Color'
marbles=[]
for i,hex in enumerate(['#fff9ed','#f8f2e4','#f5edda']):
    m=material('Hotel marble slab '+str(i),hex,.33)
    nodes=m.node_tree.nodes;bsdf=nodes.get('Principled BSDF')
    node=nodes.new('ShaderNodeTexImage');node.image=albedo;m.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
    node=nodes.new('ShaderNodeTexImage');node.image=rough;m.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Roughness'])
    coords=nodes.new('ShaderNodeUVMap');coords.uv_map='RoomUV';m.node_tree.links.new(coords.outputs['UV'],node.inputs['Vector'])
    marbles.append(m)
# UV offsets vary the veining on individual slabs while sharing packed maps.
polygon=[(p['x'],p['z']) for p in json.loads((DOC/'layout.json').read_text())['polygon']]
def clip(poly,axis,limit,greater):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ina=a[axis]>=limit if greater else a[axis]<=limit;inb=b[axis]>=limit if greater else b[axis]<=limit
        if ina:out.append(a)
        if ina!=inb:
            t=(limit-a[axis])/(b[axis]-a[axis]);out.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(2)))
    return out
for ix in range(22):
    for iz in range(21):
        xa=-23+ix*1.8;za=15+iz*1.8;poly=polygon
        for axis,limit,greater in [(0,xa+.007,True),(0,xa+1.793,False),(1,za+.007,True),(1,za+1.793,False)]:poly=clip(poly,axis,limit,greater)
        poly=[p for i,p in enumerate(poly) if math.dist(p,poly[i-1])>.001]
        if len(poly)<3:continue
        verts=[(x,h,z) for h in [.001,.015] for x,z in poly];count=len(poly)
        faces=[tuple(reversed(range(count))),tuple(count+i for i in range(count))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        o=mesh('Individually fitted marble slab',verts,faces,marbles[(ix+iz)%3],.003)
        for uv in o.data.uv_layers.active.data:
            a,b=uv.uv;uv.uv=(a*.42+ix*.173,b*.42+iz*.117)
        room_uv=o.data.uv_layers.new(name='RoomUV')
        for face in o.data.polygons:
            for li in face.loop_indices:
                v=o.data.vertices[o.data.loops[li].vertex_index].co
                room_uv.data[li].uv=((v.x+23)/38,(-v.y-15)/36)
# Broad perimeter border consists of inset polygon bands, not raised obstacles.
def inset(poly,amount):
    result=[]
    for i,p in enumerate(poly):
        prev=poly[i-1];nxt=poly[(i+1)%len(poly)]
        e1=Vector((p[0]-prev[0],p[1]-prev[1]));e1.normalize();e2=Vector((nxt[0]-p[0],nxt[1]-p[1]));e2.normalize()
        n1=Vector((-e1.y,e1.x));n2=Vector((-e2.y,e2.x));direction=n1+n2;direction/=direction.dot(n1)
        result.append((p[0]+direction.x*amount,p[1]+direction.y*amount))
    return result
for outer,inner,mat in [(.50,.69,'green'),(.73,.755,'gold'),(.88,.96,'green')]:
    a=inset(polygon,outer);b=inset(polygon,inner);count=len(a)
    mesh('Fitted perimeter stone border',[(x,.021,z) for x,z in a+b],[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)],M[mat])
# Flush compass fitted over the slab field. Ivory sectors mask the tile joints.
cx,cz=-4,30
for i in range(64):
    a=i*math.tau/64;b=(i+1)*math.tau/64
    mesh('Compass ivory field',[(cx,.023,cz),(cx+math.cos(a)*3.25,.023,cz+math.sin(a)*3.25),(cx+math.cos(b)*3.25,.023,cz+math.sin(b)*3.25)],[(0,1,2)],M['ivory'])
for i in range(16):
    a=i*math.tau/16;b=(i+1)*math.tau/16;r1=2.8 if i%2==0 else .83;r2=.83 if i%2==0 else 2.8
    mesh('Compass cut stone ray',[(cx,.025,cz),(cx+math.sin(a)*r1,.025,cz+math.cos(a)*r1),(cx+math.sin(b)*r2,.025,cz+math.cos(b)*r2)],[(0,1,2)],M['green'] if i%2 else M['stone'])
for ra,rb,mat in [(3.25,3.42,'green'),(3.42,3.45,'gold'),(3.50,3.54,'green')]:
    verts=[(cx+math.cos(a)*r,.025,cz+math.sin(a)*r) for r in [ra,rb] for a in np.linspace(0,math.tau,129)[:-1]]
    mesh('Compass fitted concentric ring',verts,[(i,(i+1)%128,(i+1)%128+128,i+128) for i in range(128)],M[mat])
for o in PARTS:
    if o.type=='MESH' and max(v.co.z for v in o.data.vertices)-min(v.co.z for v in o.data.vertices)<1e-6:
        if o.data.polygons[0].normal.z<0:
            bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
export('hotel-grand-floor')
(DOC/'material-wear.json').write_text(json.dumps({'floorRoughnessRange':[float(r.min()),float(r.max())],'wearFollowsTraffic':True,'scuffMarks':95,'textureResolution':[n,n],'woodGrain':'long axis on straight pieces; arc length on curved rails','fabricWeaveRepeatMetres':.16,'brassWear':'door pulls, escutcheons and kickplates only'},indent=2)+'\n')
