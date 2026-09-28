"""Original slot cabinet atlas and walnut grain; no downloaded art or logos."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import numpy as np, math, json, argparse
OUT=Path(__file__).resolve().parent
FONT='/System/Library/Fonts/Supplemental/Arial.ttf';BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def font(n,b=False):return ImageFont.truetype(BOLD if b else FONT,n)
def text(d,xy,s,n=32,fill='#ecd3a0',b=False,anchor='mm'):d.text(xy,s,font=font(n,b),fill=fill,anchor=anchor)
GOLD='#c59a50';LIGHT='#f9e9b4';DARK='#142622';RED='#b92f37'
def symbol(name,size=220):
 im=Image.new('RGBA',(size,size));d=ImageDraw.Draw(im);s=size/220
 def p(points):return [(int(x*s),int(y*s)) for x,y in points]
 def line(points,fill,width=5):d.line(p(points),fill=fill,width=max(1,round(width*s)),joint='curve')
 def poly(points,fill,outline=None):d.polygon(p(points),fill=fill,outline=outline,width=max(1,round(3*s)))
 def ell(box,fill,outline=None,w=4):d.ellipse(tuple(round(x*s) for x in box),fill=fill,outline=outline,width=round(w*s))
 if name=='seven':
  poly([(48,35),(180,35),(178,74),(111,184),(54,184),(123,79),(48,79)],'#5c1b26')
  poly([(40,26),(174,26),(172,63),(105,177),(48,177),(115,70),(40,70)],RED,LIGHT)
  line([(48,36),(161,36),(157,53)],'#f87564',5);line([(54,166),(94,166),(149,75)],'#7e162d',5)
  poly([(108,20),(113,33),(129,36),(115,41),(110,55),(105,42),(91,38),(104,32)],'#fff4cf')
 elif name=='cherry':
  line([(83,108),(112,60),(143,41),(148,104)],'#487140',8)
  poly([(113,58),(110,26),(145,26),(159,42),(140,56)],'#407a3d','#d7d8a1')
  ell((38,89,126,178),'#8b1832',LIGHT);ell((112,89,198,176),'#a72435',LIGHT)
  ell((47,94,116,158),'#c93445',None);ell((119,97,187,156),'#d34541',None)
  ell((59,104,75,121),'#ffe5c4',None);ell((134,109,150,125),'#ffe7c8',None)
 elif name=='bell':
  ell((94,25,128,60),'#bf7620','#fff0b8')
  poly([(104,43),(136,55),(150,85),(155,135),(180,158),(173,174),(45,174),(39,157),(64,134),(68,86),(83,55)],'#d49c33','#663e1c')
  poly([(91,60),(115,54),(133,67),(143,134),(159,151),(59,151),(78,129),(79,91)],'#f3cd6b')
  line([(57,160),(164,160)],'#ffeaa3',6);line([(92,65),(86,89),(86,122)],'#fff1b3',7)
  ell((91,163,132,194),'#a46023','#eac073')
 elif name=='diamond':
  poly([(56,43),(164,43),(198,95),(111,188),(23,95)],'#276579','#173b45')
  poly([(56,43),(83,95),(23,95)],'#9bd6d7');poly([(56,43),(110,43),(83,95)],'#4aa9b5')
  poly([(110,43),(164,43),(139,95)],'#a9e3dc');poly([(83,95),(110,43),(139,95)],'#d2f1e2')
  poly([(164,43),(198,95),(139,95)],'#479ab0');poly([(23,95),(83,95),(111,188)],'#4094ad')
  poly([(83,95),(139,95),(111,188)],'#7bcece');poly([(139,95),(198,95),(111,188)],'#296783')
  line([(56,43),(164,43),(198,95),(111,188),(23,95),(56,43)],LIGHT,4)
 elif name=='bar':
  d.rounded_rectangle((int(18*s),int(60*s),int(202*s),int(157*s)),int(16*s),fill='#172d28',outline=GOLD,width=round(7*s))
  text(d,(110*s,111*s),'BAR',round(67*s),LIGHT,True);line([(35,78),(185,78)],'#8eac84',3)
 elif name=='horseshoe':
  d.arc((int(38*s),int(30*s),int(184*s),int(199*s)),0,180,fill='#aa6b26',width=round(39*s))
  d.arc((int(41*s),int(18*s),int(177*s),int(189*s)),0,180,fill='#e4b855',width=round(29*s))
  d.rectangle((int(41*s),int(54*s),int(70*s),int(110*s)),fill='#e4b855');d.rectangle((int(148*s),int(54*s),int(177*s),int(110*s)),fill='#e4b855')
  for x,y in [(56,71),(55,106),(66,145),(109,169),(153,143),(162,108),(162,71)]:ell((x-5,y-5,x+5,y+5),'#5b4125',None)
 elif name=='plum':
  line([(115,73),(126,34)],'#3c653b',9);poly([(124,38),(158,27),(177,43),(159,62)],'#487f4c','#bfcba0')
  ell((40,57,177,191),'#4b315f',LIGHT);ell((46,64,141,174),'#735381',None);ell((66,78,89,112),'#b9a0b8',None)
 return im

def build():
 im=Image.new('RGB',(2048,2048),(238,222,185));d=ImageDraw.Draw(im)
 # Rectangles are stored in image pixels, top-left origin.
 rects={'marquee':[32,32,1984,304],'paytable':[32,376,1984,226],'deck':[32,646,1984,166],'medallion':[32,884,464,464],'meter':[32,1390,464,148],'coin_label':[32,1580,464,124],'button':[32,1750,220,220]}
 # Illuminated black enamel marquee with precisely drawn radial Art Deco filigree.
 x,y,w,h=rects['marquee'];d.rounded_rectangle((x,y,x+w,y+h),28,fill=DARK,outline=GOLD,width=10)
 d.rounded_rectangle((x+20,y+19,x+w-20,y+h-19),18,outline=LIGHT,width=3)
 for sign in [-1,1]:
  cx=x+w/2+sign*840
  for k in range(7):
   xx=x+w/2+sign*(700+k*27);d.line((cx,y+h/2,xx,y+36),fill=GOLD,width=4);d.line((cx,y+h/2,xx,y+h-36),fill=GOLD,width=4)
 text(d,(1024,y+116),'LAST JACKPOT',160,LIGHT,True)
 text(d,(1024,y+235),'D E L U X E   •   M E C H A N I C A L   R E E L S',39,GOLD,True)
 # Paytable is readable at close range and recognizable at room scale.
 x,y,w,h=rects['paytable'];d.rounded_rectangle((x,y,x+w,y+h),17,fill='#1b2824',outline=GOLD,width=8)
 sets=[('seven','JACKPOT','777'),('bell','150 CHIPS','3 BELLS'),('bar','50 CHIPS','3 BARS'),('cherry','10 CHIPS','CHERRIES')]
 for i,(s,title,sub) in enumerate(sets):
  left=x+i*w/4
  if i:d.line((left,y+21,left,y+h-21),fill=GOLD,width=3)
  icon=symbol(s,135);im.paste(icon,(round(left+19),round(y+42)),icon)
  text(d,(left+312,y+83),title,47,LIGHT,True);text(d,(left+312,y+150),sub,32,GOLD)
 x,y,w,h=rects['deck'];d.rounded_rectangle((x,y,x+w,y+h),19,fill='#182923',outline=GOLD,width=8)
 text(d,(x+335,y+45),'BET ONE',50,LIGHT,True);text(d,(x+960,y+45),'COLLECT',50,LIGHT,True);text(d,(x+1585,y+45),'SPIN REELS',50,LIGHT,True)
 text(d,(x+w/2,y+118),'PLAY A LITTLE  •  DREAM A LOT',35,GOLD)
 x,y,w,h=rects['medallion'];d.rectangle((x,y,x+w,y+h),fill='#142821')
 for r in [212,201,178]:d.ellipse((x+w/2-r,y+h/2-r,x+w/2+r,y+h/2+r),outline=GOLD,width=4)
 for k in range(32):
  a=k*math.tau/32
  d.line((x+w/2+math.cos(a)*181,y+h/2+math.sin(a)*181,x+w/2+math.cos(a)*198,y+h/2+math.sin(a)*198),fill=LIGHT,width=3)
 text(d,(x+w/2,y+190),'LJ',160,LIGHT,True);text(d,(x+w/2,y+306),'DELUXE',42,GOLD,True)
 x,y,w,h=rects['meter'];d.rounded_rectangle((x,y,x+w,y+h),12,fill='#111e1b',outline=GOLD,width=7)
 text(d,(x+99,y+49),'CHIP',31,GOLD,True);text(d,(x+321,y+74),'000',86,'#cfefb9',True)
 text(d,(x+100,y+96),'METER',29,GOLD)
 x,y,w,h=rects['coin_label'];d.rectangle((x,y,x+w,y+h),fill='#e4d4b2');text(d,(x+w/2,y+h/2),'INSERT CHIP',51,'#3c3428',True)
 x,y,w,h=rects['button'];d.ellipse((x+4,y+4,x+w-4,y+h-4),fill='#e8d6a6',outline=GOLD,width=8);text(d,(x+w/2,y+h/2),'SPIN',50,'#26372b',True)
 # Three individually arranged eight-symbol strips. Cylinder fronts land on row 4.
 symbols=[['bar','bell','horseshoe','cherry','seven','diamond','plum','bar'],['diamond','plum','bell','bar','seven','cherry','horseshoe','bell'],['cherry','horseshoe','bar','diamond','seven','bell','plum','bar']]
 for c,seq in enumerate(symbols):
  x,y,w,h=560+c*486,880,456,1136;rects[f'reel{c}']=[x,y,w,h]
  d.rectangle((x,y,x+w,y+h),fill='#f3e8c9')
  for r,s in enumerate(seq):
   yy=y+r*h/8;d.line((x+15,yy+2,x+w-15,yy+2),fill='#c7b68c',width=3)
   # The reel-strip UV width is twice the height, so the generated symbol is wider in pixels.
   icon=symbol(s,132).resize((288,132),Image.Resampling.LANCZOS);im.paste(icon,(x+(w-288)//2,round(yy+5)),icon)
  d.line((x+8,y,x+8,y+h),fill=GOLD,width=4);d.line((x+w-8,y,x+w-8,y+h),fill=GOLD,width=4)
 im.save(OUT/'slot-atlas.png');(OUT/'atlas-regions.json').write_text(json.dumps(rects,indent=2))
 # Subtle longitudinal walnut without dependencies on Blender procedural shaders.
 w,h=1024,512;rng=np.random.default_rng(974);yy,xx=np.mgrid[0:h,0:w];flow=yy+2.9*np.sin(xx*.010)+1.8*np.sin(xx*.033+yy*.02)
 grain=np.sin(flow*.54)+.26*np.sin(flow*2.2)+.25*np.sin(flow*.13)
 rgb=np.clip(np.array([99,48,24])[None,None,:]+grain[:,:,None]*np.array([10,7,4])[None,None,:]+rng.normal(0,.75,(h,w,1)),0,255).astype('uint8')
 Image.fromarray(rgb).save(OUT/'slot-walnut.png')
 print('Wrote original atlas and walnut texture')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=OUT);args=parser.parse_args();OUT=args.output_dir.resolve();OUT.mkdir(parents=True,exist_ok=True);build()
