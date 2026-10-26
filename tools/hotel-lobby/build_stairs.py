"""Blender architectural rail kit matching the shared hotel collision layout."""
import sys,math,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from asset_lib import *
reset();M=palette();texture(M['wood'],'wood')
layout=json.loads((DOC/'layout.json').read_text())

def rail(path,length,name):
    # A closed lower panel deliberately matches the continuous collision guard.
    samples=max(2,math.ceil(length/.28));v=[]
    for i in range(samples+1):
        x,y,z=path(i/samples)
        t0=path(max(0,i/samples-.001));t1=path(min(1,i/samples+.001));dx=t1[0]-t0[0];dz=t1[2]-t0[2];l=math.hypot(dx,dz);nx=-dz/l;nz=dx/l
        for offset,height in [(-.049,.08),(.049,.08),(.049,.96),(-.049,.96)]:v.append((x+nx*offset,y+height,z+nz*offset))
    f=[]
    for i in range(samples):
        for j in range(4):f.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    f.extend([(3,2,1,0),tuple(samples*4+j for j in range(4))]);mesh(name+' solid raised guard',v,f,M['green'],.008)
    for h,r,mat in [(1.09,.055,'wood'),(1.015,.026,'gold'),(.14,.022,'gold'),(.89,.014,'gold')]:
        line(name+' continuous '+mat,[(x,y+h,z) for x,y,z in [path(i/(samples*2)) for i in range(samples*2+1)]],r,M[mat])
    count=max(1,round(length/.76))
    for i in range(count+1):
        x,y,z=path(i/count)
        a=path(max(0,i/count-.001));b=path(min(1,i/count+.001));dx=b[0]-a[0];dz=b[2]-a[2];l=math.hypot(dx,dz)
        for side in [-1,1]:
            xx=x-dz/l*.057*side;zz=z+dx/l*.057*side
            rod(name+' bronze pilaster',(xx,y+.15,zz),(xx,y+.98,zz),.014,M['gold'],10)
            for h in [.19,.85]:sphere(name+' collar',(xx,y+h,zz),(.065,.045,.065),M['gold'],8,4)
    for i in range(count):
        t=(i+.5)/count;x,y,z=path(t);a=path(max(0,t-.001));b=path(min(1,t+.001));dx=b[0]-a[0];dz=b[2]-a[2];l=math.hypot(dx,dz);tx=dx/l;tz=dz/l
        for side in [-1,1]:
            pts=[]
            for j in range(33):
                q=math.tau*j/32;offset=math.sin(q)*min(.23,length/count*.33)
                pts.append((x+tx*offset-tz*.062*side,y+.52+math.cos(q)*.26,z+tz*offset+tx*.062*side))
            line(name+' oval bronze relief',pts,.012,M['gold'],1)
    for t in [0,1]:
        x,y,z=path(t)
        # Newel width stays within the existing guard footprint plus player clearance.
        box(name+' newel shoe',(x,y+.12,z),(.19,.24,.19),M['stone'])
        lathe(name+' turned newel',x,z,[(y+.24,.073),(y+.29,.08),(y+.35,.058),(y+.92,.055),(y+1,.08),(y+1.055,.08)],M['wood'],24)
        sphere(name+' newel finial',(x,y+1.125,z),(.16,.14,.16),M['gold'])
for s in layout['stairs']:
    for radius in [s['innerRadius']-.075,s['outerRadius']+.075]:
        def point(t,s=s,r=radius):return (s['cx']+s['side']*math.sin(t*math.pi)*r,4*t,s['cz']-math.cos(t*math.pi)*r)
        rail(point,math.hypot(math.pi*radius,4),s['id'])
    for radius in [s['innerRadius']-.04,s['outerRadius']+.04]:
        verts=[];faces=[];segments=112
        for i in range(segments+1):
            t=i/segments
            for r,h in [(radius-.018,.006),(radius+.018,.006),(radius+.018,max(.009,4*t-.055)),(radius-.018,max(.009,4*t-.055))]:
                verts.append((s['cx']+s['side']*math.sin(t*math.pi)*r,h,s['cz']-math.cos(t*math.pi)*r))
        for i in range(segments):
            for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
        faces.extend([(3,2,1,0),tuple(segments*4+j for j in range(4))])
        mesh('Continuous curved stone spandrel',verts,faces,M['stone'],smooth=True)
    # Continuous sculpted stringer cap stays on the solid outside of the treads.
    r=s['outerRadius']+.045
    for dy,thickness in [(.045,.036),(-.14,.055)]:
        line('Stair carved limestone stringer',[(s['cx']+s['side']*math.sin(t*math.pi)*r,max(thickness+.005,4*t+dy),s['cz']-math.cos(t*math.pi)*r) for t in np.linspace(0,1,97)],thickness,M['stone'])
for q in layout['rails']:
    angle=q.get('yaw',0);tx=math.cos(angle);tz=math.sin(angle)
    def point(t,q=q,tx=tx,tz=tz):return(q['x']+(t-.5)*q['w']*tx,4,q['z']+(t-.5)*q['w']*tz)
    rail(point,q['w'],q['id'])
    for y,h,d,mat in [(3.80,.18,.20,'ivory'),(3.65,.10,.24,'stone'),(3.59,.035,.26,'gold')]:
        o=box('Balcony carved fascia',(q['x'],y,q['z']),(q['w'],h,d),M[mat]);o.rotation_euler.z=-angle
for x in [-9,1]:
    z=34.2
    box('Column square plinth',(x,.13,z),(.70,.26,.70),M['stone'],.025)
    lathe('Column turned base',x,z,[(.26,.29),(.31,.31),(.36,.29),(.40,.24),(.46,.23)],M['ivory'],48)
    lathe('Column fluted shaft',x,z,[(.44,.22),(.65,.23),(2.9,.195),(3.18,.19)],M['ivory'],64,.011)
    lathe('Column carved capital',x,z,[(3.17,.20),(3.23,.22),(3.29,.27),(3.37,.30),(3.47,.32)],M['stone'],48)
    for i in range(12):
        a=i*math.tau/12
        for dy,r in [(0,.24),(.12,.27)]:
            leaf=sphere('Capital acanthus leaf',(x+math.cos(a)*r,3.29+dy,z+math.sin(a)*r),(.075,.26,.045),M['gold'],12,8);leaf.rotation_euler.z=-a
    box('Column bearing abacus',(x,3.59,z),(.70,.26,.70),M['ivory'],.028)
export('hotel-grand-stairs')
