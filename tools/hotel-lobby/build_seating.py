"""Original soft upholstery models inside the existing hotel furniture footprints."""
import sys,math,argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from asset_lib import *
parser=argparse.ArgumentParser();parser.add_argument('--only',default='all');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
def signed(v,p):return math.copysign(abs(v)**p,v)
def cushion(name,p,size,m,exponent=.32):
    # Superellipsoid upholstery: broad compressed faces, rounded edges, soft corners.
    n=40;rings=16;verts=[(p[0],p[1]-size[1]/2,p[2])]
    for j in range(1,rings):
        a=-math.pi/2+j*math.pi/rings
        for i in range(n):
            b=i*math.tau/n
            xx=signed(math.cos(a),exponent)*signed(math.cos(b),exponent)
            yy=signed(math.sin(a),exponent)
            zz=signed(math.cos(a),exponent)*signed(math.sin(b),exponent)
            depression=.016*math.exp(-(xx*xx+zz*zz)*3) if yy>0 else 0
            verts.append((p[0]+xx*size[0]/2,p[1]+yy*size[1]/2-depression,p[2]+zz*size[2]/2))
    top=len(verts);verts.append((p[0],p[1]+size[1]/2-.016,p[2]));faces=[]
    for i in range(n):faces.append((0,1+(i+1)%n,1+i));faces.append((top,1+(rings-2)*n+i,1+(rings-2)*n+(i+1)%n))
    for j in range(rings-2):
        for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    return mesh(name,verts,faces,m,smooth=True)
def piping(name,x,y,z,w,d,m):
    pts=[(x+signed(math.cos(a),.25)*w/2,y,z+signed(math.sin(a),.25)*d/2) for a in np.linspace(0,math.tau,65)]
    line(name,pts,.005,m,1)
for kind in ['sofa','armchair','booth']:
    if args.only not in ['all',kind]:continue
    reset();M=palette();texture(M['wood'],'wood');texture(M['fabric'],'fabric');seam=material('Hotel upholstery dark piping','#1c322b',.82)
    if kind in ['sofa','armchair']:
        w=3.8 if kind=='sofa' else 1.2;d=1.35 if kind=='sofa' else 1.2;count=3 if kind=='sofa' else 1
        for x in [-w/2+.17,w/2-.17]:
            for z in [-d/2+.17,d/2-.17]:
                rod('Tapered walnut foot',(x,.04,z),(x,.29,z),.042,M['wood'],16,r2=.055)
                rod('Brass foot sabot',(x,0,z),(x,.075,z),.043,M['gold'],16)
        box('Carved walnut seat rail',(0,.30,0),(w-.09,.18,d-.08),M['wood'],.035)
        box('Lower brass bead',(0,.265,-d/2+.032),(w-.12,.018,.022),M['gold'],.006)
        box('Walnut back support',(0,.57,d/2-.05),(w-.18,.55,.08),M['wood'],.02)
        cushion('Upholstered back foundation',(0,.80,d/2-.15),(w-.18,.59,.26),M['fabric'])
        for side in [-1,1]:
            x=side*(w/2-.14)
            cushion('Soft rolled upholstered arm',(x,.72,-.005),(.265,.29,d-.08),M['fabric'],.45)
            box('Walnut arm veneer',(side*(w/2-.035),.52,0),(.06,.34,d-.23),M['wood'],.022)
            piping('Arm sewn seam',x,.77,-.005,.25,d-.10,seam)
        width=(w-.58)/count
        for i in range(count):
            x=(i-(count-1)/2)*width
            cushion('Compressed seat cushion',(x,.51,-.06),(width-.025,.24,d-.38),M['fabric'])
            piping('Seat cushion welt',x,.568,-.06,width-.04,d-.40,seam)
            cushion('Individually filled back cushion',(x,.85,d/2-.26),(width-.028,.48,.26),M['fabric'])
            for t in [-.23,.23]:
                sphere('Upholstery covered button',(x+width*t,.88,d/2-.399),(.024,.024,.012),seam,12,6)
            # A loose accent cushion gives the large sofa a human scale.
        if kind=='sofa':
            pillow=cushion('Loose ivory woven cushion',(-1.18,.77,-.04),(.39,.36,.15),M['ivory'],.52);pillow.rotation_euler.y=.13
    else:
        box('Booth walnut plinth',(0,.20,0),(1.87,.4,5.91),M['wood'],.025)
        box('Booth lower brass fillet',(.95,.23,0),(.018,.035,5.85),M['gold'],.005)
        box('Booth structural walnut back',(-.86,.86,0),(.10,1.0,5.83),M['wood'],.018)
        cushion('Booth back upholstered foundation',(-.78,.99,0),(.28,.74,5.87),M['fabric'])
        for i in range(6):
            z=(i-2.5)*.96
            cushion('Booth individual seat cushion',(.09,.53,z),(1.35,.24,.935),M['fabric'])
            piping('Booth seat sewn welt',.09,.585,z,1.32,.915,seam)
            cushion('Booth channeled back cushion',(-.62,1.04,z),(.24,.65,.91),M['fabric'])
            for dz in [-.29,0,.29]:
                line('Booth vertical channel seam',[(-.489,.80,z+dz),(-.481,1.25,z+dz)],.004,seam,1)
        for z in [-2.94,2.94]:
            box('Booth sculpted walnut end cap',(-.05,.67,z),(1.84,.92,.09),M['wood'],.032)
            box('Booth gilded end cap inlay',(.12,.79,z+math.copysign(.048,z)),(1.20,.018,.01),M['gold'],.003)
        rod('Booth brass footrail',(.92,.19,-2.80),(.92,.19,2.80),.025,M['gold'],20)
    export('hotel-'+kind)
