"""Build the selected B sound bank. --generate fetches missing sources; default masters locally.
NumPy and macOS afconvert required. Existing approved B clips are reused verbatim as sources.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import urllib.request
import urllib.error
import numpy as np
from generate import ROOT, ENDPOINT, key
from process import read, write, RATE, oddball_accent
from auditions import DESIGNS

SOURCES=ROOT/'assets/source/gun-audio/production-b'
CACHE=ROOT/'outputs/gun-audio/production-b'
DOC=ROOT/'docs/gun-audio'
DEST=ROOT/'public/audio/weapons'
GUNS={
'pistol':'a compact steel 9mm pistol: taut sharp pop and crisp slide snap',
'shotgun':'a 12 gauge pump shotgun',
'smg':'a compact 9mm SMG in single fire: short cutting pap and light steel bolt',
'rifle':'a full-power battle rifle: explosive whip crack and hard broad bark',
'revolver':'a heavy six-shot .357 revolver',
'magnum':'a long-barrel large-frame magnum: bright concussive crack, thick pressure body',
'tommy':'a vintage .45 Thompson submachine gun firing ONE round in single shot mode',
'doublebarrel':'a short side-by-side 12 gauge firing one barrel: ragged wide blast and deep chest punch',
'dual':'a tiny vintage pocket pistol: lean biting snap and small quick slide clack',
'machinepistol':'a stamped 9mm machine pistol in single fire: aggressive tight crack and dry bolt rasp',
'lever':'a walnut lever rifle: crisp frontier crack, firm middle body, subtle stock knock',
'autoshotgun':'a gas-operated 12 gauge: broad dense blast and quick cycling bolt',
'sniper':'a long military bolt rifle: piercing sharp crack, powerful long powder body',
'lmg':'a belt-fed 7.62 machine gun in single fire: heavy chesty bark, carrier clank and link tick',
'launcher':'a break-open 40mm launcher: forceful hollow low THOOMP with brief pressurized air; no explosion',
'flare':'a vintage flare pistol: sharp primer pop, hollow soft launch puff and short sizzling hiss; no explosion',
}
FOLEY={
'stick-impact':'One hard impact of a long wooden casino craps rake hitting a padded heavy target. Dry woody whack, sharp cane flex, solid body thud. Close detailed game foley. No voices, animal sounds, music, gunshots or repeated impacts.',
'axe-impact':'One heavy fire axe chopping into dense wet timber. Deep physical impact, hard crunchy split, short dull steel vibration. Forceful close game foley. No voices, animal sounds, music, gunshots or repeated impacts.',
'axe-swing':'One fast heavy fire axe swinging through air. Broad low rushing whoosh, weighty handle movement, no impact. Close isolated game foley. No voices, animal sounds, music or repeated swings.',
}

def generate():
 SOURCES.mkdir(parents=True,exist_ok=True); CACHE.mkdir(parents=True,exist_ok=True)
 secret=key()
 if not secret: raise SystemExit('No configured key')
 for name in list(GUNS)+list(FOLEY):
  target=SOURCES/f'{name}.mp3'
  if target.exists(): continue
  if name in ('revolver','shotgun','tommy'):
   source=ROOT/f'assets/source/gun-audio/auditions-01/b-heavy-{name}'
   for suffix in ('.mp3','.request.json'):
    shutil.copyfile(str(source)+suffix,SOURCES/f'{name}{suffix}')
   print(name+': reused approved B source',flush=True); continue
  pending=CACHE/f'{name}.pending'
  if pending.exists(): raise SystemExit(name+': uncertain request; inspect before retry')
  prompt=FOLEY[name] if name in FOLEY else f'{DESIGNS["b-heavy"]} One isolated shot from {GUNS[name]}, immediately then silence. No repeated shots, reload, voices, animals, music or comedy.'
  assert len(prompt)<450,(name,len(prompt))
  payload={'text':prompt,'duration_seconds':2.0,'prompt_influence':.8,'model_id':'eleven_text_to_sound_v2'}
  (SOURCES/f'{name}.request.json').write_text(json.dumps(payload,indent=2)+'\n')
  pending.write_text('Request started; do not retry automatically.\n')
  req=urllib.request.Request(ENDPOINT,data=json.dumps(payload).encode(),headers={'xi-api-key':secret,'Content-Type':'application/json'})
  try:
   with urllib.request.urlopen(req,timeout=90) as response:
    data=response.read(); cost=response.headers.get('character-cost')
   if len(data)<4000: raise SystemExit('Unexpected audio response; pending marker retained')
   target.write_bytes(data)
   (SOURCES/f'{name}.receipt.json').write_text(json.dumps({'characterCost':cost,'bytes':len(data)},indent=2)+'\n')
   pending.unlink();print(name+': generated',flush=True)
  except urllib.error.HTTPError as exc:
   pending.unlink();raise SystemExit(f'Provider HTTP {exc.code}; no automatic retry') from None
  except urllib.error.URLError:
   raise SystemExit('Network failure; pending marker retained') from None


def decode(name):
 source=SOURCES/f'{name}.mp3';digest=hashlib.sha256(source.read_bytes()).hexdigest()
 path=CACHE/f'{name}-{digest[:12]}.wav'
 if not path.exists(): subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100',str(source),str(path)],check=True)
 return read(path),digest


def trim(x,duration,swing=False):
 energy=np.sqrt(np.mean(x[:len(x)//44*44].reshape(-1,44)**2,axis=1))
 peak=int(np.argmax(energy));start=peak
 # Swings retain their lead-in; impacts retain 1ms before their pressure front.
 threshold=.025 if swing else .10
 while start>0 and energy[start-1]>energy[peak]*threshold:start-=1
 start=max(0,start*44-(int(.04*RATE) if swing else 44))
 x=x[start:start+int(duration*RATE)].copy();x-=x.mean()
 x*=np.minimum(1,np.arange(len(x))/RATE/.0003)
 fade=min(1102,len(x));x[-fade:]*=np.linspace(1,0,fade)
 x*=.8/max(abs(x))
 return x,start/RATE


def main():
 CACHE.mkdir(parents=True,exist_ok=True);DOC.mkdir(parents=True,exist_ok=True)
 records=[];reel=[];cues=[];elapsed=0
 def save(weapon,name,x,source,trim_at):
  path=DEST/weapon/f'{name}.wav';write(path,x)
  records.append({'file':f'{weapon}/{name}.wav','source':source,'duration':len(x)/RATE,'trimSeconds':trim_at,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 for gun in list(GUNS)+list(FOLEY):
  raw,digest=decode(gun)
  duration=.65 if gun in ('tommy','smg','machinepistol','lmg') else 1.25
  base,at=trim(raw,duration,gun=='axe-swing')
  shots=[]
  count=3 if gun in GUNS or gun=='stick-impact' else 2 if gun=='axe-impact' else 1
  for v in range(count):
   # First take preserves the selected B mastering exactly; other takes vary subtly.
   x=base.copy() if v==0 else np.interp(np.arange(len(base))*(1+v*.008),np.arange(len(base)),base,right=0)
   if gun in GUNS:
    x+=oddball_accent(np.arange(len(x))/RATE,gun,v)
   fade=min(1102,len(x))
   if v: x[-fade:]*=np.linspace(1,0,fade)
   x*=.8/max(abs(x))
   if gun in GUNS: weapon=gun;name=f'report-{v+1}'
   elif gun.endswith('-impact'):weapon=gun.split('-')[0];name=f'impact-{v+1}'
   else:weapon='axe';name='swing'
   save(weapon,name,x,gun,at);shots.append(x)
   if gun=='doublebarrel':
    n=int(.009*RATE);both=np.pad(x,(0,n))+np.pad(base*.92,(n,0));both*=.8/max(abs(both))
    save(gun,f'report-double-{v+1}',both,gun,at)
  cues.append({'weapon':gun,'atSeconds':round(elapsed,3)})
  chapter=np.concatenate([shots[0]*.65,np.zeros(int(.3*RATE))]);reel.append(chapter);elapsed+=len(chapter)/RATE
 preview=np.concatenate(reel);write(DOC/'selected-b-preview.wav',preview)
 (DOC/'selected-b-cues.json').write_text(json.dumps(cues,indent=2)+'\n')
 manifest={'direction':'B heavy action, selected by user','model':'eleven_text_to_sound_v2','processing':'B audition mastering: onset trim, DC removal, tiny start fade, 25ms end fade, 0.8 peak; first take unchanged, later takes slight time variation. Existing brief unpitched jokes only on Thompson/launcher take 3.', 'sources':{n:{'sha256':hashlib.sha256((SOURCES/f'{n}.mp3').read_bytes()).hexdigest(),'request':json.loads((SOURCES/f'{n}.request.json').read_text())} for n in list(GUNS)+list(FOLEY)},'files':records}
 (DOC/'selected-b-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(f'Installed {len(records)} cues; {len(GUNS)} firearms plus melee foley.')

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--generate',action='store_true');args=parser.parse_args()
 generate() if args.generate else main()
