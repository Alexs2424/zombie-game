"""Regenerate the labeled Blender contact sheet and a short original-foley showcase."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/weapon-1970s-assets'
ids=['magnum','tommy','doublebarrel','dual','machinepistol','lever','autoshotgun','sniper','lmg','launcher','stick','axe']
names=['HIGH ROLLER','CHICAGO TYPEWRITER','DOUBLE OR NOTHING','SNAKE EYES','THE ENFORCER','SILVER DOLLAR','LAST CALL','EYE IN THE SKY','HOUSE EDGE','DEBT COLLECTOR','STICKMAN','FIRE EXIT']
sheet=Image.new('RGB',(1800,1440),'#141b18');d=ImageDraw.Draw(sheet)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia.ttf',22)
for i,(wid,name) in enumerate(zip(ids,names)):
    x=(i%3)*600;y=(i//3)*360
    im=Image.open(DOC/f'{wid}-three.jpg');im.thumbnail((590,305))
    sheet.paste(im,(x+(600-im.width)//2,y))
    d.text((x+28,y+322),name,font=font,fill='#dfc994')
sheet.save(DOC/'arsenal-blender.jpg',quality=90)

hud=Image.new('RGB',(1800,1440),'#141b18');hd=ImageDraw.Draw(hud)
for i,(wid,name) in enumerate(zip(ids,names)):
    x=(i%3)*600;y=(i//3)*360
    im=Image.open(ROOT/f'public/ui/weapons/{wid}-card.webp').convert('RGBA');im.thumbnail((550,285))
    hud.paste(im,(x+(600-im.width)//2,y+10),im)
    hd.text((x+28,y+322),name,font=font,fill='#dfc994')
hud.save(DOC/'arsenal-hud-art.jpg',quality=90)

for name in ['craps-hover','craps-bet','lmg-aim','lmg-reload','lmg-reload-done','sniper-aim']:
    capture=ROOT/f'outputs/weapon-final/{name}.png'
    if capture.exists():
        im=Image.open(capture).convert('RGB');im.thumbnail((1280,720))
        im.save(DOC/f'review-{name}.jpg',quality=88)

sr=44100;mix=np.zeros(sr*32,dtype=np.float64);cues=[]
def play(wid,name,at,gain=.55):
    rate,a=wavfile.read(ROOT/f'public/audio/weapons/{wid}/{name}.wav');assert rate==sr
    a=a.astype(np.float64)/32768*gain;idx=round(at*sr)
    mix[idx:idx+len(a)]+=a
    cues.append({'weapon':wid,'cue':name,'seconds':at})
play('magnum','fire',.3);play('magnum','eject',1.25,.35)
for i in range(6):play('tommy',f'fire-{i%3+1}',3+i*.085,.42)
play('doublebarrel','fire-alt',5)
play('dual','fire-right-1',7);play('dual','fire-left-1',7.22)
for i in range(5):play('machinepistol',f'fire-{i%3+1}',9+i*.055,.38)
play('lever','fire',11);play('lever','cycle',11.16,.3);play('lever','cycle-close',11.32,.3)
play('autoshotgun','fire',13);play('autoshotgun','fire',13.3)
play('sniper','fire',15);play('sniper','bolt-open',15.3,.3);play('sniper','bolt-close',15.66,.3)
for i in range(8):play('lmg',f'fire-{i%3+1}',18+i*.11,.4)
play('lmg','belt-end',19,.3)
play('launcher','fire',21);play('launcher','flight',21.1,.3);play('launcher','explode',21.9,.5)
play('stick','swing',25);play('stick','impact-1',25.28);play('stick','break',25.34)
play('axe','swing',28);play('axe','impact-1',28.48)
peak=np.max(np.abs(mix));mix*=min(1,.92/peak)
wavfile.write(DOC/'weapon-sound-showcase.wav',sr,(mix*32767).astype(np.int16))
(DOC/'sound-showcase-cues.json').write_text(json.dumps(cues,indent=2))
print('Refreshed Blender contact sheet and 32-second foley showcase; peak',np.max(np.abs(mix)))
