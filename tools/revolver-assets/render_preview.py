"""CPU depth-buffer renders of the delivered GLBs, including exact fitted hands."""
from pathlib import Path
import math
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from asset_io import read
PROJECT=Path(__file__).resolve().parents[2]
OUT=PROJECT/'docs'/'revolver-assets'

def unit(v):
    v=np.array(v,float);return v/max(np.linalg.norm(v),1e-12)

def render(mode):
    width,height=1600,1000
    pixels=np.zeros((height,width,3),np.uint8)
    for y in range(height):pixels[y,:,:]=np.array([22,29,33])+(height-y)/height*13
    depth=np.full((height,width),np.inf)
    perspective=mode.startswith('shooter')
    if perspective:
        root=np.array([.26,-.18,.48]) if mode=='shooter-close' else np.array([.29,-.21,.61])
        cam=-root;target=cam+np.array([0,0,1]);focal=height/(2*math.tan(1.32/2))
    elif mode=='front':cam=np.array([.56,.28,1.15]);target=np.array([0,.02,.07]);focal=2350
    else:cam=np.array([1.05,.31,.50]);target=np.array([0,-.017,.085]);focal=2750 if mode=='weapon' else 2100
    forward=unit(target-cam);right=unit(np.cross([0,1,0],forward));up=unit(np.cross(forward,right));R=np.stack([right,up,forward])
    key=unit([-.4,.9,-.5]);fill=unit([.8,.4,.5]);view=unit(cam-target)
    files=['revolver.glb']+([] if mode in ['weapon','front'] else ['hands-revolver.glb'])
    for filename in files:
        g,_,parts=read(PROJECT/'public'/'models'/filename)
        for part in parts:
            vv=(part['v']-cam)@R.T
            if perspective:xy=np.stack([width/2+focal*vv[:,0]/np.maximum(.04,vv[:,2]),height/2-focal*vv[:,1]/np.maximum(.04,vv[:,2])],1)
            else:xy=np.stack([width/2+focal*vv[:,0],height*.51-focal*vv[:,1]],1)
            mat=g['materials'][part['mat']]['pbrMetallicRoughness'];base=np.power(np.array(mat['baseColorFactor'][:3]),.4545)*245;metal=mat['metallicFactor'];rough=mat['roughnessFactor']
            for f in part['f']:
                xyz=vv[f]
                if np.min(xyz[:,2])<.04:continue
                world=part['v'][f];fn=np.cross(world[1]-world[0],world[2]-world[0])
                if np.dot(fn,cam-world.mean(0))<=0:continue
                coords=xy[f];x0=max(0,int(np.floor(coords[:,0].min())));x1=min(width-1,int(np.ceil(coords[:,0].max())));y0=max(0,int(np.floor(coords[:,1].min())));y1=min(height-1,int(np.ceil(coords[:,1].max())))
                if x1<x0 or y1<y0:continue
                a,b,c=coords;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
                if abs(den)<1e-12:continue
                xs,ys=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
                wa=((b[1]-c[1])*(xs-c[0])+(c[0]-b[0])*(ys-c[1]))/den;wb=((c[1]-a[1])*(xs-c[0])+(a[0]-c[0])*(ys-c[1]))/den;wc=1-wa-wb
                iz=wa/xyz[0,2]+wb/xyz[1,2]+wc/xyz[2,2]
                zz=np.divide(1,iz,out=np.full_like(iz,np.inf),where=abs(iz)>1e-12) if perspective else wa*xyz[0,2]+wb*xyz[1,2]+wc*xyz[2,2]
                db=depth[y0:y1+1,x0:x1+1];mask=(wa>=0)&(wb>=0)&(wc>=0)&(zz<db)
                if not mask.any():continue
                n=part['n'][f];normal=wa[:,:,None]*n[0]+wb[:,:,None]*n[1]+wc[:,:,None]*n[2];normal/=np.maximum(np.linalg.norm(normal,axis=2)[:,:,None],1e-9)
                diffuse=.27+.58*np.maximum(0,normal@key)+.32*np.maximum(0,normal@fill)
                half=unit(fill+view);spec=np.maximum(0,normal@half)**(10+50*(1-rough))*.48*metal
                rgb=np.clip(base[None,None,:]*diffuse[:,:,None]+spec[:,:,None]*np.maximum(base,145)[None,None,:],0,255)
                pixels[y0:y1+1,x0:x1+1][mask]=rgb.astype(np.uint8)[mask];db[mask]=zz[mask]
    image=Image.fromarray(pixels);draw=ImageDraw.Draw(image)
    try:font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',29);small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',18)
    except:font=small=None
    labels={'weapon':'BLUED STEEL / GOLD INLAY / WALNUT   •   actual exported geometry','front':'SIX OPEN CHAMBERS / FLUTED CYLINDER / OCTAGONAL BORE','grip':'FITTED TWO-HAND GRIP   •   unchanged pistol contact geometry','shooter':'SHOOTER VIEW   •   root (0.29, -0.21, 0.61) / FOV 1.32','shooter-close':'SHOOTER VIEW   •   suggested root (0.26, -0.18, 0.48) / FOV 1.32'}
    draw.text((38,30),'THE DEAD MAN’S HAND',fill=(232,218,184),font=font)
    draw.text((40,74),labels[mode],fill=(157,178,174),font=small)
    draw.text((40,height-42),'Original procedural casino revolver • No external models or textures • +Y up / +Z muzzle',fill=(155,172,164),font=small)
    image.save(OUT/f'{mode}.png');print('Rendered',mode,flush=True)

if __name__=='__main__':
    for mode in ['weapon','front','grip','shooter','shooter-close']:render(mode)
