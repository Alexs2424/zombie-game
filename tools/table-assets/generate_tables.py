"""Original casino furniture, layouts, wheel and ivory dice. Metres, Y up.
Run: python3 generate_tables.py. Dependencies: numpy, scipy, Pillow.
"""
from pathlib import Path
import math, json, struct, io
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from geometry_base import Model as BaseModel, unit

PROJECT=Path(__file__).resolve().parents[2]
OUT=PROJECT/"outputs"/"table-assets"
OUT.mkdir(parents=True, exist_ok=True)
TAU=math.tau
TEXTURES={}
MATS=[]
def mat(name,color,metal=0,rough=.5,tex=None):
    MATS.append(dict(name=name,color=color,metal=metal,rough=rough,texture=tex)); return len(MATS)-1
WALNUT=mat('Hand-polished walnut veneer',(.69,.46,.30,1),.02,.31,'walnut')
DARKWOOD=mat('Deep walnut endgrain',(.135,.043,.019,1),.02,.38)
BRASS=mat('Satin antique brass',(.63,.40,.125,1),.8,.27)
GOLD=mat('Bright engraved brass',(.86,.66,.30,1),.76,.23)
EMERALD=mat('Bottle-green leather padding',(.024,.10,.069,1),.02,.63)
BURGUNDY=mat('Oxblood leather padding',(.21,.024,.042,1),.02,.58)
BLACK=mat('Charcoal rubber and ebony',(.016,.021,.021,1),.02,.64)
IVORY=mat('Ivory phenolic',(.94,.898,.742,1),.02,.26)
WHITE=mat('Warm white chip inlays',(.9,.9,.81,1),.02,.48)
RED=mat('Crimson chip / pocket',(.54,.023,.039,1),.02,.5)
GREEN=mat('Emerald chip / zero',(.015,.30,.16,1),.03,.5)
BLUE=mat('Cobalt chip',(.025,.09,.32,1),.02,.5)
CRAPS=mat('Craps emerald printed baize',(1,1,1,1),0,.97,'craps_layout')
ROULETTE=mat('Roulette burgundy printed baize',(1,1,1,1),0,.97,'roulette_layout')
WHEEL=mat('Roulette pocket numerals',(1,1,1,1),.04,.49,'wheel_numbers')
PIP=mat('Recessed obsidian pips',(.006,.008,.007,1),.01,.31)

FONT_PATH='/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD_PATH='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def font(size,bold=False):
    return ImageFont.truetype(BOLD_PATH if bold else FONT_PATH,size)
def label(draw,xy,txt,size=32,color='#ecdfb9',bold=False,anchor='mm'):
    draw.text(xy,txt,fill=color,font=font(size,bold),anchor=anchor,stroke_width=0)
def canvas_noise(w,h,color,seed):
    rng=np.random.default_rng(seed); base=np.array(color)[None,None,:]
    a=np.clip(base+rng.normal(0,1.2,(h,w,1)),0,255).astype('uint8')
    return Image.fromarray(a)
def textures():
    # Walnut grain is analytic noise and flowing sine bands, with no photographic inputs.
    w,h=1024,512; rng=np.random.default_rng(482); y,x=np.mgrid[0:h,0:w]
    flow=y+6*np.sin(x*.012)+4*np.sin(x*.041+y*.016)
    grain=np.sin(flow*.72)+.35*np.sin(flow*2.4)+.3*np.sin(flow*.05+x*.009)
    a=np.clip(np.array([120,61,29])[None,None,:]+grain[:,:,None]*np.array([14,10,5])[None,None,:]+rng.normal(0,1.7,(h,w,1)),0,255).astype('uint8')
    TEXTURES['walnut']=Image.fromarray(a)
    # Original symmetric craps betting layout. Long table sides read from both player sides.
    im=canvas_noise(3072,1344,(16,70,53),421); d=ImageDraw.Draw(im); ink='#ded9ae'; pale='#eedcaa'
    d.rounded_rectangle((25,25,3047,1319),160,outline=ink,width=5)
    d.rounded_rectangle((95,95,2977,1249),120,outline=ink,width=4)
    label(d,(1536,1280),'P A S S   L I N E',42,pale,True)
    label(d,(1536,62),'P A S S   L I N E',42,pale,True)
    label(d,(640,164),"DON'T PASS  /  BAR 12",29,ink,True)
    label(d,(2420,164),"DON'T PASS  /  BAR 12",29,ink,True)
    label(d,(1536,1175),"DON'T PASS  /  BAR 12",29,ink,True)
    # Central divider / proposition box, flanked by mirrored place and field areas.
    for left in [165,1790]:
        right=left+1115
        d.rounded_rectangle((left,230,right,1070),32,outline=ink,width=5)
        for i,s in enumerate(['4','5','SIX','8','NINE','10']):
            a=left+i*1115/6; b=left+(i+1)*1115/6
            d.rectangle((a,230,b,443),outline=ink,width=4)
            label(d,((a+b)/2,321),s,54 if len(s)<3 else 43,ink,True)
            label(d,((a+b)/2,400),'PLACE',19,ink)
        d.line((left,535,right,535),fill=ink,width=4)
        label(d,((left+right)/2,487),"DON'T COME  /  BAR 12",34,ink,True)
        label(d,((left+right)/2,645),'C O M E',90,'#edddbe',True)
        d.arc((left+20,720,right-20,1265),190,350,fill=ink,width=5)
        label(d,((left+right)/2,817),'F I E L D',58,ink,True)
        for i,num in enumerate([2,3,4,9,10,11,12]):
            xx=left+105+i*151
            if num in [2,12]:d.ellipse((xx-48,886,xx+48,982),outline=ink,width=4)
            label(d,(xx,934),str(num),56,ink,True)
        label(d,((left+right)/2,1020),'2 PAYS DOUBLE   •   12 PAYS TRIPLE',24,ink)
    d.rounded_rectangle((1320,222,1752,1080),28,outline=ink,width=5)
    label(d,(1536,279),'PROPOSITION',32,ink,True)
    label(d,(1536,331),'ONE ROLL',24,ink)
    for i,(a,b) in enumerate([('ANY 7','4 TO 1'),('ANY CRAPS','7 TO 1'),('HORN BET','2 · 3 · 11 · 12'),('HARDWAYS','4 · 6 · 8 · 10')]):
        yy=395+i*158;d.line((1320,yy-24,1752,yy-24),fill=ink,width=3)
        label(d,(1536,yy+20),a,35 if len(a)<10 else 29,ink,True)
        label(d,(1536,yy+77),b,28,ink)
    TEXTURES['craps_layout']=im
    # European single-zero layout on oxblood felt; all 36 values follow the 3-column board.
    im=canvas_noise(1100,1660,(83,23,40),934); d=ImageDraw.Draw(im); ink='#e0cda0'
    red={1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36}
    x0,x1=260,980;y0=212;cw=240;rh=96
    d.polygon([(260,212),(260,100),(620,40),(980,100),(980,212)],fill='#195e43',outline=ink,width=5)
    label(d,(620,137),'0',66,'#f2ead4',True)
    for r in range(12):
        for c in range(3):
            n=3*r+c+1; xx=x0+c*cw;yy=y0+r*rh
            d.rectangle((xx,yy,xx+cw,yy+rh),fill='#942739' if n in red else '#202628',outline=ink,width=4)
            label(d,(xx+cw/2,yy+rh/2),str(n),54,'#f6eddc',True)
    for c in range(3):
        xx=x0+c*cw; d.rectangle((xx,y0+12*rh,xx+cw,1464),outline=ink,width=4);label(d,(xx+cw/2,1417),'2 TO 1',33,ink,True)
    for r in range(3):
        ya=y0+r*rh*4;d.rectangle((148,ya,260,ya+4*rh),outline=ink,width=4)
        layer=Image.new('RGBA',(384,112));ld=ImageDraw.Draw(layer);label(ld,(192,56),['1st 12','2nd 12','3rd 12'][r],40,ink,True)
        im.paste(layer.rotate(90,expand=True),(148,int(ya)),layer.rotate(90,expand=True))
    for r,s in enumerate(['1–18','EVEN','RED','BLACK','ODD','19–36']):
        ya=y0+r*rh*2; d.rectangle((20,ya,148,ya+2*rh),outline=ink,width=4)
        if s in ['RED','BLACK']:
            d.polygon([(84,ya+43),(122,ya+96),(84,ya+149),(46,ya+96)],fill='#b13845' if s=='RED' else '#111b1a',outline=ink,width=3)
        else:
            layer=Image.new('RGBA',(192,128));ld=ImageDraw.Draw(layer);label(ld,(96,64),s,33,ink,True)
            rr=layer.rotate(90,expand=True);im.paste(rr,(20,int(ya)),rr)
    label(d,(550,1545),'S I N G L E   Z E R O',42,ink,True)
    label(d,(550,1610),'EUROPEAN ROULETTE',28,ink)
    TEXTURES['roulette_layout']=im
    # Numbers baked into original radial artwork, real 37-pocket European order.
    im=Image.new('RGB',(1536,1536),(53,25,17));d=ImageDraw.Draw(im);cx=cy=768
    seq=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]
    for i,n in enumerate(seq):
        angle=-math.pi/2+i*TAU/37; half=math.pi/37
        pts=[]
        for r,angs in [(741,np.linspace(angle-half,angle+half,5)),(551,np.linspace(angle+half,angle-half,5))]:
            pts += [(cx+r*math.cos(a),cy+r*math.sin(a)) for a in angs]
        d.polygon(pts,fill='#226a42' if n==0 else '#a22536' if n in red else '#151d1c')
        a=angle-half;d.line((cx+551*math.cos(a),cy+551*math.sin(a),cx+741*math.cos(a),cy+741*math.sin(a)),fill='#d7b566',width=3)
        textim=Image.new('RGBA',(125,98));td=ImageDraw.Draw(textim);label(td,(62,49),str(n),56,'#f5e6c4',True)
        # Character tops face outward, readable while circling the physical wheel.
        rr=textim.rotate(-math.degrees(angle)-90,resample=Image.Resampling.BICUBIC,expand=True)
        xx=cx+646*math.cos(angle); yy=cy+646*math.sin(angle)
        im.paste(rr,(round(xx-rr.width/2),round(yy-rr.height/2)),rr)
    TEXTURES['wheel_numbers']=im
    for name,im in TEXTURES.items():im.save(OUT/(name+'.png'))

class Model(BaseModel):
    def __init__(self,name):super().__init__(name);self.group=None;self.pivots={}
    def add(self,name,matid,verts,faces,normals=None,uv=None):
        # Omit collapsed triangles at lathe/sphere poles before serialization.
        vv=np.asarray(verts,float); ff=np.asarray(faces,dtype=np.uint32)
        area=np.linalg.norm(np.cross(vv[ff[:,1]]-vv[ff[:,0]],vv[ff[:,2]]-vv[ff[:,0]]),axis=1)
        faces=ff[area>1e-13]
        super().add(name,matid,verts,faces,normals)
        p=self.parts[-1];p['group']=self.group
        if uv is not None:
            uv=np.asarray(uv,float)
            if normals is None:uv=uv[np.asarray(faces,dtype=int)].reshape((-1,2))
            p['uv']=uv
        elif MATS[matid].get('texture')=='walnut':
            # Grain follows the broad surfaces of each individual furniture component.
            axis=int(np.argmax(np.mean(abs(p['n']),axis=0)));ab=[i for i in range(3) if i!=axis]
            p['uv']=p['v'][:,ab]*np.array([.68,3.8])
    def merge(self):
        groups={}
        for p in self.parts:groups.setdefault((p['name'],p['mat'],p.get('group'),'uv' in p),[]).append(p)
        merged=[]
        for (name,matid,group,hasuv),ps in groups.items():
            offset=0;vv=[];ff=[];nn=[];uv=[]
            for p in ps:
                vv.append(p['v']);ff.append(p['f']+offset);nn.append(p['n']);offset+=len(p['v'])
                if hasuv:uv.append(p['uv'])
            p=dict(name=name,mat=matid,group=group,v=np.concatenate(vv),f=np.concatenate(ff),n=np.concatenate(nn))
            if hasuv:p['uv']=np.concatenate(uv)
            merged.append(p)
        self.parts=merged
    def export(self,path):
        self.merge();blob=bytearray();views=[];accessors=[];meshes=[];nodes=[]
        def attr(data,dtype,kind,target):
            data=np.asarray(data,dtype=dtype);raw=data.tobytes();off=len(blob);blob.extend(raw)
            while len(blob)%4:blob.append(0)
            vi=len(views);views.append(dict(buffer=0,byteOffset=off,byteLength=len(raw),target=target))
            a=dict(bufferView=vi,componentType=5126 if dtype=='<f4' else 5125,count=len(data),type=kind)
            if kind=='VEC3':a['min']=data.min(0).tolist();a['max']=data.max(0).tolist()
            accessors.append(a);return len(accessors)-1
        roots=[];groupnodes={}
        for name,pivot in self.pivots.items():groupnodes[name]=len(nodes);nodes.append(dict(name=name,translation=list(pivot),children=[]));roots.append(len(nodes)-1)
        for p in self.parts:
            center=(p['v'].min(0)+p['v'].max(0))/2
            attrs=dict(POSITION=attr(p['v']-center,'<f4','VEC3',34962),NORMAL=attr(p['n'],'<f4','VEC3',34962))
            if 'uv'in p:attrs['TEXCOORD_0']=attr(p['uv'],'<f4','VEC2',34962)
            ix=attr(p['f'].flatten(),'<u4','SCALAR',34963)
            meshes.append(dict(name=p['name'],primitives=[dict(attributes=attrs,indices=ix,material=p['mat'])]))
            g=p.get('group');trans=center-np.array(self.pivots[g]) if g else center
            nodes.append(dict(name=p['name'],mesh=len(meshes)-1,translation=trans.tolist()))
            if g:nodes[groupnodes[g]]['children'].append(len(nodes)-1)
            else:roots.append(len(nodes)-1)
        images=[];texlist=[];texids={}
        for name in dict.fromkeys(MATS[p['mat']].get('texture') for p in self.parts):
            if name is None:continue
            bio=io.BytesIO();TEXTURES[name].save(bio,format='PNG');raw=bio.getvalue();off=len(blob);blob.extend(raw)
            while len(blob)%4:blob.append(0)
            vi=len(views);views.append(dict(buffer=0,byteOffset=off,byteLength=len(raw)));images.append(dict(name=name,bufferView=vi,mimeType='image/png'))
            texids[name]=len(texlist);texlist.append(dict(source=len(images)-1,sampler=0))
        materials=[]
        for m in MATS:
            pbr=dict(baseColorFactor=m['color'],metallicFactor=m['metal'],roughnessFactor=m['rough'])
            if m.get('texture') in texids:pbr['baseColorTexture']=dict(index=texids[m['texture']])
            materials.append(dict(name=m['name'],pbrMetallicRoughness=pbr,doubleSided=False))
        gltf=dict(asset=dict(version='2.0',generator='Last Jackpot original procedural casino furniture',copyright='Original geometry and procedurally drawn textures; no imported art or brand assets.'),scene=0,scenes=[dict(name=self.name,nodes=roots)],nodes=nodes,meshes=meshes,materials=materials,buffers=[dict(byteLength=len(blob))],bufferViews=views,accessors=accessors)
        if images:gltf.update(images=images,textures=texlist,samplers=[dict(magFilter=9729,minFilter=9987,wrapS=10497,wrapT=10497)])
        j=json.dumps(gltf,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
        with open(path,'wb') as f:f.write(struct.pack('<4sII',b'glTF',2,28+len(j)+len(blob)));f.write(struct.pack('<I4s',len(j),b'JSON'));f.write(j);f.write(struct.pack('<I4s',len(blob),b'BIN\0'));f.write(blob)
        vv=np.concatenate([p['v'] for p in self.parts]);return dict(file=str(path),nodes=len(nodes),triangles=sum(len(p['f']) for p in self.parts),bounds=[vv.min(0).tolist(),vv.max(0).tolist()],dimensions=(vv.max(0)-vv.min(0)).tolist(),bytes=Path(path).stat().st_size,animation_nodes=self.pivots)

def rounded_path(hx,hz,r,n=10):
    pts=[]
    for cx,cz,start in [(hx-r,hz-r,0),(-hx+r,hz-r,90),(-hx+r,-hz+r,180),(hx-r,-hz+r,270)]:
        for a in np.linspace(start,start+90,n,endpoint=False):
            a=math.radians(a);pts.append((cx+r*math.sin(a),cz+r*math.cos(a)))
    # Clockwise viewed above: +Z -> +X order? Explicit reordering below avoids crossing corners.
    pts=[]
    for cx,cz,start in [(hx-r,hz-r,0),(-hx+r,hz-r,90),(-hx+r,-hz+r,180),(hx-r,-hz+r,270)]:
        for a in np.linspace(start,start+90,n,endpoint=False):
            a=math.radians(a);pts.append((cx+r*math.cos(a),cz+r*math.sin(a)))
    return np.array(pts)

def rounded_slab(m,name,matid,hx,hz,r,y0,y1):
    p=rounded_path(hx,hz,r);v=[(x,y,z) for y in [y0,y1] for x,z in p];N=len(p);f=[]
    for i in range(N):
        j=(i+1)%N;f += [(i,N+i,N+j),(i,N+j,j)]
    v += [(0,y0,0),(0,y1,0)]
    for i in range(N):j=(i+1)%N;f += [(2*N,i,j),(2*N+1,N+j,N+i)]
    m.add(name,matid,v,f)

def rounded_ring(m,name,matid,hx,hz,r,width,y0,y1):
    outer=rounded_path(hx,hz,r);inner=rounded_path(hx-width,hz-width,max(.03,r-width));N=len(outer)
    v=[(x,y,z) for y,p in [(y0,outer),(y1,outer),(y0,inner),(y1,inner)] for x,z in p];f=[]
    for i in range(N):
        j=(i+1)%N
        f += [(i,N+i,N+j),(i,N+j,j),(2*N+i,3*N+j,3*N+i),(2*N+i,2*N+j,3*N+j)]
        f += [(N+i,3*N+i,3*N+j),(N+i,3*N+j,N+j),(i,2*N+j,2*N+i),(i,j,2*N+j)]
    m.add(name,matid,v,f)

def felt(m,name,matid,hx,hz,r,y,center=(0,0)):
    p=rounded_path(hx,hz,r,16);v=[(center[0],y,center[1])]+[(x+center[0],y,z+center[1]) for x,z in p];N=len(p)
    uv=[(.5,.5)]+[((x+hx)/(hx*2),(z+hz)/(hz*2)) for x,z in p]
    f=[(0,1+(i+1)%N,1+i) for i in range(N)];m.add(name,matid,v,f,[(0,1,0)]*len(v),uv)

def lathe(m,name,matid,profile,center=(0,0),n=48):
    v=[];normals=[]
    for j,(r,y) in enumerate(profile):
        prev=profile[max(0,j-1)];nxt=profile[min(len(profile)-1,j+1)];dr=nxt[0]-prev[0];dy=nxt[1]-prev[1]
        for i in range(n):
            a=i*TAU/n;v.append((center[0]+r*math.cos(a),y,center[1]+r*math.sin(a)));normals.append(unit([dy*math.cos(a),-dr,dy*math.sin(a)]))
    f=[]
    for j in range(len(profile)-1):
        for i in range(n):k=(i+1)%n;a=j*n+i;b=j*n+k;c=(j+1)*n+k;d=(j+1)*n+i;f += [(a,c,b),(a,d,c)]
    m.add(name,matid,v,f,normals)

def rail(m,hx,hz,r,material,y=0.915):
    # 20 individually upholstered modules, with real fine seams and brass seam covers.
    raw=rounded_path(hx-.18,hz-.18,r,50);closed=np.concatenate([raw,raw[:1]])
    distance=np.concatenate([[0],np.cumsum(np.linalg.norm(np.diff(closed,axis=0),axis=1))])
    samples=np.linspace(0,distance[-1],180,endpoint=False)
    path=np.stack([np.interp(samples,distance,closed[:,i]) for i in range(2)],axis=1);N=len(path)
    segs=20;steps=N//segs
    for s in range(segs):
        vv=[];nn=[];indices=range(s*steps,(s+1)*steps+1)
        for q,i in enumerate(indices):
            p=path[i%N];a=path[(i-1)%N];b=path[(i+1)%N];t=unit([b[0]-a[0],0,b[1]-a[1]]);out=np.array([t[2],0,-t[0]])
            # 2mm gap separates cushions.
            p=p+(np.array([t[0],t[2]])*(.0015 if q==0 else -.0015 if q==steps else 0))
            for j in range(12):
                angle=j*TAU/12;vv.append([p[0]+out[0]*.18*math.cos(angle),y+.085*math.sin(angle),p[1]+out[2]*.18*math.cos(angle)]);nn.append(unit(out*math.cos(angle)/.18+np.array([0,math.sin(angle)/.085,0])))
        faces=[]
        for q in range(steps):
            for j in range(12):k=(j+1)%12;faces += [(q*12+j,q*12+k,(q+1)*12+k),(q*12+j,(q+1)*12+k,(q+1)*12+j)]
        m.add('Segmented leather rail',material,vv,faces,nn)
    # Fine continuous double stitched line just inside the outer cushion shoulder.
    for offset,yy in [(.128,y+.060),(-.12,y+.063)]:
        for i in range(0,N,2):
            p=path[i];a=path[(i-1)%N];b=path[(i+1)%N];t=unit([b[0]-a[0],0,b[1]-a[1]]);out=np.array([t[2],0,-t[0]])
            aa=np.array([p[0],yy,p[1]])+out*offset;bb=aa+t*.019
            m.rod('Leather saddle stitching',BRASS,aa,bb,.00085,n=5)

def leg(m,x,z):
    profile=[(.14,0),(.16,.025),(.155,.06),(.112,.09),(.086,.16),(.105,.22),(.087,.28),(.073,.36),(.101,.405),(.122,.44),(.111,.47),(.108,.64)]
    lathe(m,'Turned walnut legs',WALNUT,profile,(x,z),28)
    for y,r,h in [(.034,.16,.013),(.218,.105,.014),(.434,.125,.018),(.60,.113,.024)]:
        lathe(m,'Leg brass collars',BRASS,[(r,y),(r,y+h)],(x,z),28)
    m.rod('Leg top block',DARKWOOD,(x,.63,z),(x,.69,z),.16,n=4)

def apron(m,hx,hz):
    rounded_slab(m,'Walnut structural body',WALNUT,hx-.03,hz-.03,.37,.62,.79)
    rounded_ring(m,'Lower brass bead',BRASS,hx-.005,hz-.005,.39,.037,.633,.653)
    rounded_ring(m,'Carved lower molding',DARKWOOD,hx+.012,hz+.012,.39,.052,.607,.635)
    rounded_ring(m,'Top antique-brass rim',BRASS,hx+.014,hz+.014,.39,.055,.776,.799)
    # Raised paneled apron, slender inlay frame and diamond rosettes on both long sides.
    for z in [-hz+.012,hz-.012]:
        for x in np.linspace(-hx+.50,hx-.50,5):
            m.box('Inset apron panels',DARKWOOD,(x,.70,z),(.59,.10,.018),.009)
            m.box('Apron panel veneer',WALNUT,(x,.70,z+(.011 if z>0 else -.011)),(.53,.074,.010),.006)
            zz=z+(.017 if z>0 else -.017)
            for y in [.667,.733]:m.rod('Panel brass stringing',BRASS,(x-.258,y,zz),(x+.258,y,zz),.0022,n=6)
            # Decorative geometric marquetry, original motif.
            v=[(x,.725,zz+.0008),(x+.033,.70,zz+.0008),(x,.675,zz+.0008),(x-.033,.70,zz+.0008)]
            m.add('Apron brass diamond inlay',BRASS,v,[(0,1,2),(0,2,3)] if z<0 else [(0,2,1),(0,3,2)])
    for x in [-hx+.012,hx-.012]:
        for z in [-.42,.42]:
            m.box('End apron panel',DARKWOOD,(x,.70,z),(.018,.105,.57),.005)
            m.box('End apron veneer',WALNUT,(x+(.011 if x>0 else -.011),.70,z),(.01,.075,.51),.005)
    for x in [-hx+.6,hx-.6]:
        for z in [-hz+.48,hz-.48]:leg(m,x,z)
    # Low brass foot rail, with clearly separate stanchions.
    for z in [-hz+.045,hz-.045]:
        m.rod('Brass foot rail',BRASS,(-hx+.44,.205,z),(hx-.44,.205,z),.026,n=20)
        for x in [-hx+.61,hx-.61]:
            m.rod('Foot rail support',DARKWOOD,(x,.21,z*.69),(x,.205,z),.023,n=12)
            m.rod('Foot rail end cap',GOLD,(x-.025,.205,z),(x+.025,.205,z),.032,n=16)

def chip(m,x,y,z,color,count=4,r=.036):
    for i in range(count):
        yy=y+i*.012
        m.rod('Clay chip stacks',color,(x,yy,z),(x,yy+.011,z),r,n=18)
        if i==count-1:m.rod('Chip ivory center',WHITE,(x,yy+.0111,z),(x,yy+.0118,z),r*.55,n=18)
        for j in range(0,6):
            a=j*TAU/6;xx=x+math.cos(a)*r*.96;zz=z+math.sin(a)*r*.96
            # Tiny ivory edge dashes add denomination color blocking to each real layer.
            rr=r+.00015; a0=a-.105; a1=a+.105
            v=[(x+rr*math.cos(ang),yy+dy,z+rr*math.sin(ang)) for ang,dy in [(a0,.0017),(a1,.0017),(a1,.0097),(a0,.0097)]]
            m.add('Chip edge inserts',WHITE,v,[(0,2,1),(0,3,2)])

def rack(m,x,z,y,width=.60):
    m.box('Walnut dealer chip tray',DARKWOOD,(x,y,z),(width,.045,.21),.015)
    m.box('Chip tray brass lip',BRASS,(x,y+.022,z+.098),(width-.02,.013,.012),.003)
    m.box('Chip tray brass lip',BRASS,(x,y+.022,z-.098),(width-.02,.013,.012),.003)
    for i,color in enumerate([WHITE,RED,BLUE,GREEN,BLACK,RED]):
        xx=x-width*.41+i*width*.164
        m.box('Tray dividers',BRASS,(xx-width*.071,y+.027,z),(.008,.036,.17),.002)
        chip(m,xx,y+.023,z,color,count=3+i%3,r=.030)

PIPS={1:[(0,0)],2:[(-1,-1),(1,1)],3:[(-1,-1),(0,0),(1,1)],4:[(-1,-1),(-1,1),(1,-1),(1,1)],5:[(-1,-1),(-1,1),(0,0),(1,-1),(1,1)],6:[(-1,-1),(-1,0),(-1,1),(1,-1),(1,0),(1,1)]}
def die(m,name,center,size=.1,color=IVORY):
    x,y,z=center;m.box(name+' ivory body',color,center,(size,size,size),size*.075)
    # Standard right-handed opposite faces sum to seven: +Y1, -Y6, +Z2, -Z5, +X3, -X4.
    dirs=[(1,[0,1,0],[1,0,0],[0,0,1]),(6,[0,-1,0],[1,0,0],[0,0,-1]),(2,[0,0,1],[1,0,0],[0,1,0]),(5,[0,0,-1],[-1,0,0],[0,1,0]),(3,[1,0,0],[0,0,-1],[0,1,0]),(4,[-1,0,0],[0,0,1],[0,1,0])]
    for value,n,u,v in dirs:
        n=np.array(n);u=np.array(u);v=np.array(v)
        for a,b in PIPS[value]:
            c=np.array(center)+n*(size/2+.00002)+(a*u+b*v)*size*.235
            # Inlaid pip geometry lies essentially flush, with its dark face facing outward.
            m.rod(name+' inlaid pips',PIP,c-n*.00004,c+n*.00005,size*.072,n=12)

def build_craps():
    m=Model('Original walnut and emerald craps table')
    apron(m,2.36,1.21)
    rounded_slab(m,'Craps recessed playbed',DARKWOOD,2.10,.95,.31,.78,.809)
    felt(m,'Craps printed felt',CRAPS,2.055,.905,.27,.810)
    # Open well rises from baize to underside of soft rail.
    rounded_ring(m,'Deep padded well walls',EMERALD,2.17,1.025,.34,.083,.806,.91)
    rounded_ring(m,'Well brass reveal',BRASS,2.175,1.03,.34,.019,.883,.897)
    rail(m,2.4,1.25,.35,EMERALD)
    # Authentic raised diamond-pattern rubber at the two ends, below the cushions.
    for side in [-1,1]:
        for j in range(3):
            yy=.828+j*.023
            for k in range(28):
                zz=-.66+k*.048+(j%2)*.023
                xx=side*2.087
                vv=[(xx,yy-.009,zz),(xx,yy,zz-.014),(xx-side*.009,yy,zz),(xx,yy+.009,zz),(xx,yy,zz+.014)]
                faces=[(0,1,2),(1,3,2),(3,4,2),(4,0,2)]
                if side<0:faces=[f[::-1] for f in faces]
                m.add('End-wall diamond rubber',BLACK,vv,faces)
    rack(m,0,.88,.894,.63)
    for x,z,c,n in [(-1.28,-.63,RED,3),(-1.06,-.59,WHITE,2),(.93,-.62,GREEN,6),(1.15,-.58,BLACK,4),(-1.79,.35,BLUE,4)]:chip(m,x,.813,z,c,n)
    # A croupier stick is an actual slender wood shaft with a hooked working end.
    m.rod('Croupier stick',WALNUT,(-1.5,.843,.69),(.61,.843,.70),.011,n=12)
    m.rod('Croupier stick hook',WALNUT,(.60,.843,.70),(.67,.843,.61),.011,n=12)
    m.rod('Croupier stick hook',WALNUT,(.67,.843,.61),(.66,.843,.55),.011,n=12)
    # Small table presentation dice are distinct nodes; runtime can hide or replace them.
    die(m,'Presentation red die A',(-.42,.834,-.10),.044,RED)
    die(m,'Presentation red die B',(-.24,.834,.03),.044,RED)
    return m

def sector(m,name,matid,cx,cz,inner,outer,y0,y1,a0,a1):
    # Sloped annular quad, shared normals across the thin physical pocket.
    v=[(cx+r*math.cos(a),y,cz+r*math.sin(a)) for r,y,a in [(inner,y0,a0),(inner,y0,a1),(outer,y1,a1),(outer,y1,a0)]]
    m.add(name,matid,v,[(0,1,2),(0,2,3)])

def build_roulette():
    m=Model('Original walnut and burgundy European roulette table')
    apron(m,1.66,1.21)
    rounded_slab(m,'Roulette polished walnut top',WALNUT,1.70,1.25,.37,.786,.835)
    # Oxblood baize beneath right-hand betting grid.
    felt(m,'Roulette printed betting felt',ROULETTE,.535,.957,.035,.842,center=(.955,0))
    rounded_ring(m,'Roulette top brass perimeter',BRASS,1.685,1.235,.36,.024,.838,.853)
    # Rail at 0.91..0.98, keeping spindle and all table geometry within 1m height.
    # An outer cushion is a series of softly beveled furniture pads, exposing wheel housing.
    for z in [-1.185,1.185]:
        for x in np.linspace(-1.32,1.32,8):m.box('Roulette segmented oxblood rail',BURGUNDY,(x,.905,z),(.374,.115,.129),.034)
    for x in [-1.63,1.63]:
        for z in np.linspace(-.875,.875,5):m.box('Roulette segmented oxblood rail',BURGUNDY,(x,.905,z),(.13,.115,.345),.032)
    # Pocket bowl is static; rotor assembly is an explicit parent with origin at its axle.
    cx,cz=-.735,0
    lathe(m,'Sculpted walnut roulette bowl',WALNUT,[(.82,.839),(.866,.859),(.875,.889),(.863,.928),(.839,.949),(.805,.944),(.788,.92),(.770,.901),(.701,.870),(.620,.854),(.59,.858)],(cx,cz),96)
    lathe(m,'Bowl exterior brass piping',BRASS,[(.873,.884),(.878,.891),(.874,.901)],(cx,cz),96)
    lathe(m,'Bowl lip brass inlay',GOLD,[(.838,.948),(.831,.951),(.817,.948)],(cx,cz),96)
    lathe(m,'Ball track polished maple edge',BRASS,[(.787,.919),(.78,.914)],(cx,cz),96)
    # Static ball and deflectors sit on the outer conical track.
    for i in range(8):
        a=i*TAU/8
        r=.746;xx=cx+math.cos(a)*r;zz=cz+math.sin(a)*r
        m.box('Ball-track brass deflectors',BRASS,(xx,.900,zz),(.032,.015,.042),.009)
    # Sphere generated as latitude mesh, keeping the ball an independent named transform.
    sphere(m,'roulette_ball',IVORY,(cx+.716,.895,.115),.015,12,8)
    m.pivots['roulette_wheel']=(cx,.860,cz);m.group='roulette_wheel'
    lathe(m,'Rotor carved walnut cone',WALNUT,[(0,.864),(.615,.864),(.620,.878),(.606,.889),(.464,.889),(.404,.910),(.186,.944),(.086,.950),(0,.95)],(cx,cz),96)
    seq=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]
    red={1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36}
    for i,n in enumerate(seq):
        a=-math.pi/2+i*TAU/37;h=math.pi/37
        sector(m,'Colored roulette pockets',GREEN if n==0 else RED if n in red else BLACK,cx,cz,.432,.508,.900,.883,a-h+.004,a+h-.004)
        x0=cx+.43*math.cos(a-h);z0=cz+.43*math.sin(a-h);x1=cx+.510*math.cos(a-h);z1=cz+.51*math.sin(a-h)
        m.rod('Pocket separator frets',GOLD,(x0,.905,z0),(x1,.889,z1),.0031,n=6)
    # Physical number annulus, textured separately from the recessed pockets.
    v=[];uv=[];N=148
    for r in [.510,.615]:
        for i in range(N):
            a=i*TAU/N;v.append((cx+r*math.cos(a),.894,cz+r*math.sin(a)));uv.append((.5+r*math.cos(a)/1.27,.5+r*math.sin(a)/1.27))
    f=[]
    for i in range(N):j=(i+1)%N;f += [(i,j,N+j),(i,N+j,N+i)]
    # Annular triangles face +Y.
    m.add('Wheel numbered annulus',WHEEL,v,f,[(0,1,0)]*len(v),uv)
    for r,y in [(.616,.894),(.511,.894),(.427,.906)]:lathe(m,'Rotor concentric brass strings',GOLD,[(r-.0025,y-.002),(r,y+.002),(r+.0025,y-.002)],(cx,cz),96)
    lathe(m,'Central brass spindle',BRASS,[(.065,.941),(.08,.950),(.07,.96),(.037,.966),(.023,.982),(.03,.990),(.022,1.0),(0,1.0)],(cx,cz),40)
    # Four polished spokes atop the wooden rotor make animation immediately readable.
    for i in range(4):
        a=math.pi/4+i*TAU/4
        m.rod('Rotor decorative brass spokes',BRASS,(cx+math.cos(a)*.13,.945,cz+math.sin(a)*.13),(cx+math.cos(a)*.32,.925,cz+math.sin(a)*.32),.004,n=8)
    m.group=None
    rack(m,.02,1.00,.87,.49)
    for x,z,c,n in [(1.42,.65,RED,4),(1.39,.81,BLUE,6),(.63,-.99,GREEN,3)]:chip(m,x,.845,z,c,n,.031)
    return m

def sphere(m,name,matid,c,r,n=16,rings=12):
    v=[];ns=[]
    for j in range(rings+1):
        p=j*math.pi/rings
        for i in range(n):
            a=i*TAU/n;normal=[math.sin(p)*math.cos(a),math.cos(p),math.sin(p)*math.sin(a)];v.append(np.array(c)+r*np.array(normal));ns.append(normal)
    f=[]
    for j in range(rings):
        for i in range(n):k=(i+1)%n;f += [(j*n+i,j*n+k,(j+1)*n+k),(j*n+i,(j+1)*n+k,(j+1)*n+i)]
    m.add(name,matid,v,f,ns)

def preview_panel(model,width,height,view,background=(23,29,27)):
    # CPU z-buffer rasterization of final triangles, normals, UVs and texture pixels.
    pixels=np.zeros((height,width,3),dtype=np.uint8);pixels[:]=background;zb=np.full((height,width),-np.inf)
    eye=unit(view);right=unit(np.cross([0,1,0],eye));up=np.cross(eye,right);R=np.stack([right,up,eye]);allv=np.concatenate([p['v']@R.T for p in model.parts]);mn=allv.min(0);mx=allv.max(0);s=min((width-80)/(mx[0]-mn[0]),(height-64)/(mx[1]-mn[1]));cx=(mn[0]+mx[0])/2;cy=(mn[1]+mx[1])/2
    light=unit([-.45,.90,.6]);textures={k:np.array(v) for k,v in TEXTURES.items()}
    for p in model.parts:
        vv=p['v']@R.T;ns=p['n'];material=MATS[p['mat']];tex=textures.get(material.get('texture'));base=np.array(material['color'][:3],dtype=float)
        for f in p['f']:
            normal=unit(ns[f].mean(0))
            if np.dot(normal,eye)<-.01:continue
            pts=vv[f];xy=np.stack([width/2+(pts[:,0]-cx)*s,height/2-(pts[:,1]-cy)*s],1)
            x0=max(0,int(np.floor(xy[:,0].min())));x1=min(width-1,int(np.ceil(xy[:,0].max())));y0=max(0,int(np.floor(xy[:,1].min())));y1=min(height-1,int(np.ceil(xy[:,1].max())))
            if x1<x0 or y1<y0:continue
            xs,ys=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5);a,b,c=xy;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(den)<1e-9:continue
            w0=((b[1]-c[1])*(xs-c[0])+(c[0]-b[0])*(ys-c[1]))/den;w1=((c[1]-a[1])*(xs-c[0])+(a[0]-c[0])*(ys-c[1]))/den;w2=1-w0-w1;z=w0*pts[0,2]+w1*pts[1,2]+w2*pts[2,2]
            target=zb[y0:y1+1,x0:x1+1];mask=(w0>=0)&(w1>=0)&(w2>=0)&(z>target)
            if not mask.any():continue
            target[mask]=z[mask]
            nsamp=w0[mask,None]*ns[f[0]]+w1[mask,None]*ns[f[1]]+w2[mask,None]*ns[f[2]];nsamp/=np.maximum(1e-9,np.linalg.norm(nsamp,axis=1)[:,None]);shade=.43+.57*np.maximum(0,nsamp@light)
            col=np.tile(base,(mask.sum(),1))
            if tex is not None and 'uv'in p:
                uv=w0[mask,None]*p['uv'][f[0]]+w1[mask,None]*p['uv'][f[1]]+w2[mask,None]*p['uv'][f[2]]
                tx=np.floor(uv[:,0]%1*tex.shape[1]).astype(int);ty=np.floor(uv[:,1]%1*tex.shape[0]).astype(int);col*=np.power(tex[ty,tx]/255,2.2)
            col=np.power(np.maximum(0,col),1/2.2)*shade[:,None]*255
            # Simple Blinn highlight makes brass and leather surfaces readable.
            half=unit(light+eye);shine=np.maximum(0,nsamp@half)**(20+80*(1-material['rough']));col+=shine[:,None]*(10+34*material['metal'])
            pixels[y0:y1+1,x0:x1+1][mask]=np.clip(col,0,255).astype('uint8')
    return Image.fromarray(pixels)

def preview(models):
    W=2200;H=1800;im=Image.new('RGB',(W,H),(15,21,20));d=ImageDraw.Draw(im)
    label(d,(58,49),'THE LAST JACKPOT  /  ORIGINAL CASINO FURNITURE',34,'#e8d9b0',True,anchor='lm')
    label(d,(58,91),'CPU previews of the exported mesh triangles, materials and embedded textures',24,'#9dad9f',anchor='lm')
    for row,(model,title) in enumerate(models[:2]):
        y=140+row*675
        im.paste(preview_panel(model,1300,565,[2.8,2.9,4.7]),(25,y))
        im.paste(preview_panel(model,820,565,[.08,6.8,2.5]),(1350,y))
        d=ImageDraw.Draw(im);label(d,(56,y+591),title,29,'#e8d9b0',True,anchor='lm')
        label(d,(56,y+630),f'{sum(len(p["f"]) for p in model.parts):,} triangles  •  original walnut grain and printed betting layouts  •  metres, +Y up',22,'#9dad9f',anchor='lm')
    im.paste(preview_panel(models[2][0],380,230,[3,2,4]),(38,1505));im.paste(preview_panel(models[3][0],380,230,[-3,2,-4]),(400,1505))
    d=ImageDraw.Draw(im);label(d,(828,1570),'ANIMATABLE IVORY DICE',27,'#e8d9b0',True,anchor='lm')
    label(d,(828,1620),'0.10 m bodies / all six numbered faces / opposite faces sum to 7',22,'#9dad9f',anchor='lm')
    label(d,(828,1660),'Wheel pivot: roulette_wheel  •  static bowl + separate ball',22,'#9dad9f',anchor='lm')
    im.save(OUT/'tables-preview.png')

if __name__=='__main__':
    textures();craps=build_craps();roulette=build_roulette();a=Model('Ivory casino die A');die(a,'Ivory die A',(0,0,0));b=Model('Ivory casino die B');die(b,'Ivory die B',(0,0,0))
    pairs=[(craps,'CRAPS / EMERALD BAIZE'),(roulette,'ROULETTE / OXBLOOD BAIZE'),(a,'DIE A'),(b,'DIE B')]
    names=['craps-table.glb','roulette-table.glb','ivory-die-a.glb','ivory-die-b.glb'];stats=[m.export(OUT/name) for (m,_),name in zip(pairs,names)]
    manifest=dict(provenance='Original procedural geometry and Pillow artwork; no imported models, photos, logos or game art.',coordinate_system='glTF 2.0 right handed, metres, +Y up. Table origins at floor center. Dice origins at body center.',assets=stats,dice=dict(body_size_m=.1,pip_extension_m=.00007,faces={'+Y':1,'-Y':6,'+Z':2,'-Z':5,'+X':3,'-X':4},euler_xyz_radians_for_top_face={'1':[0,0,0],'2':[-math.pi/2,0,0],'3':[0,0,math.pi/2],'4':[0,0,-math.pi/2],'5':[math.pi/2,0,0],'6':[math.pi,0,0]},quaternion_xyzw_for_top_face={'1':[0,0,0,1],'2':[-math.sqrt(.5),0,0,math.sqrt(.5)],'3':[0,0,math.sqrt(.5),math.sqrt(.5)],'4':[0,0,-math.sqrt(.5),math.sqrt(.5)],'5':[math.sqrt(.5),0,0,math.sqrt(.5)],'6':[1,0,0,0]},placement_y_for_craps=.8601),roulette=dict(wheel_node='roulette_wheel',wheel_pivot_m=[-.735,.860,0],spin_axis='+Y',single_zero_order=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]),tabletop=dict(craps_felt_y=.810,craps_rail_top_y=1.0,roulette_felt_y=.842,roulette_spindle_top_y=1.0))
    (OUT/'asset-manifest.json').write_text(json.dumps(manifest,indent=2));preview(pairs);print(json.dumps(stats,indent=2))
