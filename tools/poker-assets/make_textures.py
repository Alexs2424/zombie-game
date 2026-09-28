"""Original poker felt, card backs and walnut grain, drawn from first principles."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import argparse,json,math
import numpy as np
PROJECT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,default=PROJECT/'docs'/'poker-assets');args=p.parse_args();OUT=args.output_dir.resolve();OUT.mkdir(parents=True,exist_ok=True)
FONT='/System/Library/Fonts/Supplemental/Arial.ttf';BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def text(d,xy,s,n,color,b=False):d.text(xy,s,font=ImageFont.truetype(BOLD if b else FONT,n),fill=color,anchor='mm')
def suit(d,x,y,r,kind,color):
 if kind=='diamond':d.polygon([(x,y-r),(x+r*.72,y),(x,y+r),(x-r*.72,y)],fill=color)
 elif kind in ['heart','spade']:
  sg=1 if kind=='heart' else -1
  d.ellipse((x-r*.82,y-sg*r*.72-r*.46,x+r*.10,y-sg*r*.72+r*.46),fill=color)
  d.ellipse((x-r*.1,y-sg*r*.72-r*.46,x+r*.82,y-sg*r*.72+r*.46),fill=color)
  d.polygon([(x-r*.78,y-sg*r*.59),(x+r*.78,y-sg*r*.59),(x,y+sg*r*.83)],fill=color)
  if kind=='spade':d.polygon([(x,y+r*.12),(x-r*.33,y+r),(x+r*.33,y+r)],fill=color)
 else:
  for dx,dy in [(0,-.6),(-.5,.02),(.5,.02)]:d.ellipse((x+(dx-.42)*r,y+(dy-.42)*r,x+(dx+.42)*r,y+(dy+.42)*r),fill=color)
  d.polygon([(x,y),(x-r*.3,y+r),(x+r*.3,y+r)],fill=color)
# Green baize keeps the near-player half clear for runtime cards.
w,h=3072,1536;rng=np.random.default_rng(9734);a=np.clip(np.array([20,74,54])[None,None,:]+rng.normal(0,.65,(h,w,1)),0,255).astype('uint8');im=Image.fromarray(a);d=ImageDraw.Draw(im)
for yy in range(25,h,46):
 for xx in range(25,w,46):
  d.line([(xx,yy-7),(xx+5,yy),(xx,yy+7),(xx-5,yy),(xx,yy-7)],fill=(24,79,58),width=1)
# Capsule outline, twice, leaves uninterrupted playing baize in the lower half.
for inset,width in [(50,4),(79,2)]:d.rounded_rectangle((inset,inset,w-inset,h-inset),h//2-inset,outline='#b29b61',width=width)
text(d,(1536,431),'LAST JACKPOT',135,'#d3bd7b',True)
text(d,(1536,555),'H I G H   R O L L E R   P O K E R',42,'#b8aa76',True)
for sign in [-1,1]:
 x=1536+sign*680
 d.line((x-sign*170,480,x+sign*200,480),fill='#b5a36a',width=3)
 for j in range(3):
  xx=x+sign*(200+j*24);d.polygon([(xx,480),(xx+sign*16,474),(xx+sign*24,480),(xx+sign*16,486)],fill='#b5a36a')
for j,kind in enumerate(['spade','heart','club','diamond']):suit(d,1396+j*94,668,27,kind,'#bbaa70')
# A subtle interior betting line frames the usable board, without fake static cards.
d.arc((190,160,w-190,h-160),8,172,fill='#799167',width=3)
im.resize((2048,1024),Image.Resampling.LANCZOS).save(OUT/'poker-felt.png')
# Original burgundy card-back atlas, dealer button and chip-center medallions.
im=Image.new('RGB',(1024,1024),'#eadbc1');d=ImageDraw.Draw(im)
regions={'card_back':[24,24,440,624],'dealer':[520,24,464,200],'chip25':[520,260,210,210],'chip100':[770,260,210,210],'crest':[520,520,464,464]}
x,y,cw,ch=regions['card_back'];d.rounded_rectangle((x,y,x+cw,y+ch),22,fill='#efe1c7');d.rounded_rectangle((x+19,y+19,x+cw-19,y+ch-19),16,fill='#622536',outline='#b79655',width=5)
for yy in range(y+39,y+ch-32,22):
 for xx in range(x+38,x+cw-30,22):d.line([(xx,yy-7),(xx+7,yy),(xx,yy+7),(xx-7,yy),(xx,yy-7)],fill='#966044',width=1)
for inset in [32,44]:d.rounded_rectangle((x+inset,y+inset,x+cw-inset,y+ch-inset),12,outline='#d6ba77',width=2)
d.ellipse((x+85,y+186,x+cw-85,y+ch-186),fill='#692436',outline='#d1b875',width=4)
text(d,(x+cw/2,y+ch/2-20),'LJ',90,'#e9d59b',True);text(d,(x+cw/2,y+ch/2+56),'POKER',28,'#d9c083',True)
for yy in [y+106,y+ch-106]:suit(d,x+cw/2,yy,24,'spade','#d5b974')
x,y,cw,ch=regions['dealer'];d.rounded_rectangle((x,y,x+cw,y+ch),70,fill='#e9dfc3',outline='#947846',width=12);text(d,(x+cw/2,y+ch/2),'DEALER',62,'#283f30',True)
for key,value in [('chip25','25'),('chip100','100')]:
 x,y,cw,ch=regions[key];d.ellipse((x,y,x+cw,y+ch),fill='#eee3c7',outline='#b89755',width=8);text(d,(x+cw/2,y+ch/2),value,71,'#3d4232',True)
x,y,cw,ch=regions['crest'];d.rectangle((x,y,x+cw,y+ch),fill='#283f2e')
for r in [210,195,166]:d.ellipse((x+232-r,y+232-r,x+232+r,y+232+r),outline='#c4a460',width=4)
text(d,(x+232,y+194),'LJ',135,'#e1c98a',True);text(d,(x+232,y+311),'HIGH ROLLER',28,'#c9ae70',True)
im.save(OUT/'poker-deck-atlas.png');(OUT/'atlas-regions.json').write_text(json.dumps(regions,indent=2))
# Flowing analytic walnut, not a downloaded photograph.
w,h=1024,512;yy,xx=np.mgrid[0:h,0:w];flow=yy+2.7*np.sin(xx*.012)+2*np.sin(xx*.036+yy*.018);grain=np.sin(flow*.55)+.27*np.sin(flow*2.1)+.25*np.sin(flow*.15);a=np.clip(np.array([91,44,23])[None,None,:]+grain[:,:,None]*np.array([12,8,5])[None,None,:]+rng.normal(0,.65,(h,w,1)),0,255).astype('uint8');Image.fromarray(a).save(OUT/'poker-walnut.png')
print('Original poker textures ready in',OUT)
