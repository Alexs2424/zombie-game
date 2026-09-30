"""Coordinated original plaster coffers and brass/crystal chandelier family."""
import sys,math,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from asset_lib import *
reset();M=palette()

def crystal(p,scale=1):
    x,y,z=p;verts=[(x,y+.16*scale,z),(x,y-.21*scale,z)]
    verts += [(x+math.cos(a)*.06*scale,y+.045*scale,z+math.sin(a)*.06*scale) for a in np.linspace(0,math.tau,7)[:-1]]
    faces=[]
    for i in range(6):faces.extend([(0,2+i,2+(i+1)%6),(1,2+(i+1)%6,2+i)])
    mesh('Hand-cut crystal pear drop',verts,faces,M['crystal'])

def chandelier(cx,cz,top,scale):
    def p(x,y,z):return(cx+x*scale,top+y*scale,cz+z*scale)
    lathe('Chandelier turned suspension',cx,cz,[(top,0.03*scale),(8.47,.03*scale),(8.53,.16*scale),(8.59,.28*scale)],M['gold'],32)
    for radius,drop,count in [(1.7,0,48),(1.15,-.36,36),(.60,-.7,24)]:
        for dy,r,m in [(0,.035,'gold'),(.075,.014,'gold'),(-.025,.018,'dark')]:
            line('Chandelier engraved crown', [p(math.cos(a)*radius,drop+dy,math.sin(a)*radius) for a in np.linspace(0,math.tau,97)],r*scale,M[m])
        for i in range(count):
            a=i*math.tau/count;x=math.cos(a)*radius;z=math.sin(a)*radius
            rod('Crystal suspension pin',p(x,drop,z),p(x,drop-.10,z),.008*scale,M['gold'],8)
            crystal(p(x,drop-.24,z),scale)
    # Curved load-bearing arms and candle-style opal lamps.
    for i in range(12):
        a=i*math.tau/12
        pts=[p(math.cos(a)*r,y,math.sin(a)*r) for r,y in [(0,.65),(.3,.45),(.7,.12),(1.1,-.03),(1.48,.1),(1.63,.28)]]
        line('Swept brass lamp arm',pts,.032*scale,M['gold'])
        x,z=math.cos(a)*1.63,math.sin(a)*1.63
        rod('Fluted lamp socket',p(x,.24,z),p(x,.4,z),.06*scale,M['dark'],16)
        sphere('Opal candle lamp',p(x,.53,z),(.11*scale,.30*scale,.11*scale),M['opal'],16,10)
        for j in range(8):
            t=j/7;radius=.35+t*1.3;yy=.75*(1-t)+.14*t-.22*math.sin(math.pi*t)
            sphere('Cut crystal festoon bead',p(math.cos(a)*radius,yy,math.sin(a)*radius),(.07*scale,)*3,M['crystal'],8,4)
    lathe('Chandelier lower finial',cx,cz,[(top-1.06*scale,.035*scale),(top-.93*scale,.13*scale),(top-.76*scale,.07*scale)],M['gold'],24)
    crystal(p(0,-1.18,0),scale*1.25)
    # Concentric plaster ceiling canopy with original leaf petals.
    for r,y in [(1.02,8.62),(1.23,8.67),(1.39,8.71)]:
        line('Ceiling rose carved rim',[(cx+math.cos(a)*r*scale,y,cz+math.sin(a)*r*scale) for a in np.linspace(0,math.tau,81)],.045*scale,M['ivory'])
    for i in range(16):
        a=i*math.tau/16
        leaf=sphere('Ceiling rose acanthus petal',(cx+math.cos(a)*.95*scale,8.67,cz+math.sin(a)*.95*scale),(.48*scale,.075,.17*scale),M['ivory'],12,6);leaf.rotation_euler.z=-a
chandelier(-4,28,7.0,1)
chandelier(-11,41.55,7.6,.55);chandelier(3,41.55,7.6,.55)

polygon=[(p['x'],p['z']) for p in json.loads((DOC/'layout.json').read_text())['polygon']]
def clip(poly,axis,limit,greater):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ina=(a[axis]>=limit) if greater else (a[axis]<=limit);inb=(b[axis]>=limit) if greater else (b[axis]<=limit)
        if ina:out.append(a)
        if ina!=inb:
            t=(limit-a[axis])/(b[axis]-a[axis]);out.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(2)))
    return out
for xa,xb in zip([-23,-15,-4,7],[-15,-4,7,15]):
    for za,zb in zip([15,23,32.5,43],[23,32.5,43,51]):
        poly=polygon
        for axis,limit,greater in [(0,xa,True),(0,xb,False),(1,za,True),(1,zb,False)]:poly=clip(poly,axis,limit,greater)
        # Remove coincident polygon corners at clipped octagonal intersections.
        poly=[p for i,p in enumerate(poly) if math.dist(p,poly[i-1])>.001]
        if len(poly)<3:continue
        cx=sum(p[0] for p in poly)/len(poly);cz=sum(p[1] for p in poly)/len(poly)
        for inset,y,r,mat in [(.10,8.53,.085,'ivory'),(.25,8.59,.065,'stone'),(.34,8.63,.020,'gold'),(.44,8.69,.045,'ivory')]:
            pts=[]
            for x,z in poly:
                dx=x-cx;dz=z-cz;length=math.hypot(dx,dz);pts.append((x-dx/length*inset,y,z-dz/length*inset))
            line('Coffer stepped perimeter '+mat,pts+[pts[0]],r,M[mat])
# Low ceiling lights in the rear salon share the main chandelier material family.
for x in [-12,4]:
    for z in [38,44]:
        lathe('Salon ceiling mount',x,z,[(3.48,.39),(3.52,.49),(3.60,.49),(3.66,.24)],M['gold'],40)
        sphere('Salon fluted opal bowl',(x,3.43,z),(.78,.18,.78),M['opal'],32,12)
        for i in range(8):
            a=i*math.tau/8
            line('Salon bowl bronze rib',[(x+math.cos(a)*r,y,z+math.sin(a)*r) for r,y in [(.4,3.5),(.30,3.38),(.1,3.35)]],.013,M['gold'])
export('hotel-grand-ceiling')
