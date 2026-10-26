"""Original fitted curtains, runner cloth, rugs, sconces and service-door hardware."""
import sys,math,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from asset_lib import *
reset();M=palette();texture(M['fabric'],'fabric');texture(M['wood'],'wood')
M['handled']=material('Hotel handled brass','#b8a277',.35,.72);texture(M['handled'],'brass')
lining=material('Hotel curtain warm lining','#aa9472',.83)
rug=material('Hotel woven moss rug','#414735',.91)
layout=json.loads((DOC/'layout.json').read_text())
for wall_index,z in [(6,26),(2,26),(6,40),(2,39)]:
    a=layout['polygon'][wall_index];b=layout['polygon'][(wall_index+1)%8];length=math.hypot(b['x']-a['x'],b['z']-a['z']);tx=(b['x']-a['x'])/length;tz=(b['z']-a['z'])/length;nx=-tz;nz=tx
    x=a['x']+(b['x']-a['x'])*(z-a['z'])/(b['z']-a['z'])
    def at(along,y,depth):return(x+tx*along+nx*depth,y,z+tz*along+nz*depth)
    for side in [-1,1]:
        verts=[];faces=[];cols=48;rows=32
        for j in range(rows+1):
            v=j/rows;y=4.57+v*3.73;gather=math.exp(-((y-5.82)/.42)**2)
            width=.94-.42*gather
            for i in range(cols+1):
                u=i/cols;along=side*(1.53+u*width+.12*gather)
                fold=math.sin(u*math.tau*6.5+.18*math.sin(v*4))*(.08-.035*gather)
                verts.append(at(along,y+.045*(1-v)**8*math.cos(u*math.tau*6.5),.35+fold))
        for j in range(rows):
            for i in range(cols):k=j*(cols+1)+i;faces.append((k,k+1,k+cols+2,k+cols+1))
        cloth=mesh('Gathered velvet curtain',verts,faces,M['fabric'],smooth=True)
        solid=cloth.modifiers.new('Cloth lining thickness','SOLIDIFY');solid.thickness=.009
        # Warm lining follows the exposed outer edge; no floating straight tubes.
        line('Curtain rolled lining',[verts[j*(cols+1)+cols] for j in range(rows+1)],.022,lining)
        rope=[at(side*(1.64+t*.50),5.83-.055*math.sin(t*math.pi),.43+.035*math.sin(t*math.pi)) for t in np.linspace(0,1,25)]
        line('Braided curtain tieback',rope,.018,M['gold'])
        p=at(side*2.08,5.68,.45);sphere('Curtain tassel knot',p,(.06,.08,.06),M['gold'],12,6)
        rod('Curtain silk tassel',(p[0],5.65,p[2]),(p[0],5.43,p[2]),.034,lining,16,r2=.01)
    # A fitted pelmet unifies the drapes with the existing window cornice.
    for y,w,h,d,mat in [(8.28,4.35,.15,.12,'wood'),(8.20,4.26,.028,.13,'gold')]:
        o=box('Window fitted pelmet',at(0,y,.27),(w,h,d),M[mat]);o.rotation_euler.z=-math.atan2(tz,tx)

# Carpet follows each actual tread AND riser, preserving both curved walking lanes.
for s in layout['stairs']:
    def at(t,r,y):return(s['cx']+s['side']*math.sin(t*math.pi)*r,y,s['cz']-math.cos(t*math.pi)*r)
    for i in range(28):
        a=i/28-.0015;b=(i+1)/28-.0015;top=4*(i+1)/28+.021;bottom=4*i/28+.021;verts=[]
        for radius in [3.08,4.92]:
            verts.extend(at(t,radius,top) for t in np.linspace(a,b,9))
        faces=[(j,j+1,j+10,j+9) for j in range(8)]
        verts.extend([at(a,3.08,bottom),at(a,4.92,bottom)]);faces.append((0,9,19,18))
        runner=mesh('Fitted woven tread and riser',verts,faces,M['fabric'])
        solid=runner.modifiers.new('Runner cloth thickness','SOLIDIFY');solid.thickness=.005
        for ra,rb in [(3.12,3.15),(4.85,4.88)]:
            vv=[at(t,r,top+.004) for r in [ra,rb] for t in np.linspace(a,b,9)]
            mesh('Runner narrow woven border',vv,[(j,j+1,j+10,j+9) for j in range(8)],lining)
        line('Brass stair carpet rod',[at(b-.002,r,top+.018) for r in [3.13,4.87]],.014,M['gold'])
        for r in [3.12,4.88]:sphere('Runner rod finial',at(b-.002,r,top+.018),(.045,.045,.045),M['gold'],12,6)

for x,z,w,d in [(-16,41,5.8,5.0),(8,41,5.8,5.0),(-12,22.65,8.9,2.7)]:
    box('Woven seating rug',(x,.021,z),(w,.010,d),rug,.003)
    for side in [-1,1]:
        box('Rug warm woven border',(x+side*(w/2-.18),.027,z),(.045,.002,d-.28),lining,.0003)
        box('Rug warm woven border',(x,.027,z+side*(d/2-.18)),(w-.28,.002,.045),lining,.0003)
    for i in range(int(w/.25)):
        xx=x-w/2+.12+i*.25
        for side in [-1,1]:
            line('Rug short knotted fringe',[(xx,.021,z+side*d/2),(xx+.025,.020,z+side*(d/2+.07))],.007,lining,0)

# Rear salon sconces keep their familiar anchors, now with actual sockets and glass.
for x in [-8.65,-5.15,-2.85,.65]:
    z=45.72
    box('Sconce carved bronze backplate',(x,2.22,z),(.16,.49,.075),M['dark'],.035)
    sphere('Sconce oval gilt escutcheon',(x,2.22,z-.046),(.13,.39,.035),M['gold'])
    line('Sconce swept brass arm',[(x,2.10,z-.05),(x,2.03,z-.18),(x,2.10,z-.31),(x,2.24,z-.37)],.022,M['gold'])
    lathe('Sconce turned socket',x,z-.37,[(2.20,.08),(2.25,.12),(2.29,.11)],M['gold'],24)
    lathe('Sconce fluted opal glass',x,z-.37,[(2.28,.10),(2.34,.135),(2.58,.105),(2.64,.09)],M['opal'],48,.008)
    for a in np.linspace(0,math.tau,9)[:-1]:
        line('Sconce glass cage rib',[(x+math.cos(a)*r,y,z-.37+math.sin(a)*r) for y,r in [(2.28,.105),(2.35,.138),(2.60,.10)]],.005,M['gold'],1)

for spawn in json.loads((DOC/'doors.json').read_text()):
    door=spawn['door'];angle=door['yaw'];tx=math.cos(angle);tz=-math.sin(angle);nx=math.sin(angle);nz=math.cos(angle)
    def at(u,y,depth):return(door['x']+tx*u+nx*depth,door['y']+y,door['z']+tz*u+nz*depth)
    for side in [-1,1]:
        for offset,width,depth,mat in [(0,.15,.23,'wood'),(.045,.025,.282,'gold')]:
            o=box('Service door profiled casing',at(side*((door['w']+.18)/2+offset),(door['h']+.18)/2,depth),(width,door['h']+.18,.06),M[mat],.012);o.rotation_euler.z=angle
        o=box('Door leaf raised field',at(side*door['w']*.24,door['h']*.55,.184),(door['w']*.36,door['h']*.61,.022),M['green'],.027);o.rotation_euler.z=angle
    for y,w,h,depth,mat in [(door['h']+.09,door['w']+.36,.18,.23,'wood'),(door['h']+.18,door['w']+.40,.045,.27,'gold'),(.18,door['w']-.12,.23,.185,'handled')]:
        o=box('Door lintel or kickplate',at(0,y,depth),(w,h,.045),M[mat],.01);o.rotation_euler.z=angle
    for side in [-1,1]:
        u=side*.12
        o=box('Door oval lock escutcheon',at(u,1.25,.22),(.09,.25,.025),M['handled'],.018);o.rotation_euler.z=angle
        line('Door shaped pull',[at(u,1.17,.245),at(u,1.19,.285),at(u,1.33,.285),at(u,1.35,.245)],.011,M['handled'])
# Ensure single-sheet horizontal cloth faces upward. Double-sided drapes retain thickness.
for o in PARTS:
    if o.type=='MESH' and len(o.data.vertices)>0 and max(v.co.z for v in o.data.vertices)-min(v.co.z for v in o.data.vertices)<1e-6 and o.data.polygons[0].normal.z<0:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
export('hotel-grand-details')
