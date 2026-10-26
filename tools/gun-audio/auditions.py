"""Three fresh sound directions for three representative guns; never changes runtime assets.
Run --generate (network and configured key), then without flags to master cached sources.
Requires NumPy and macOS afconvert for mastering. Requests are cached and never auto-retried.
"""
import argparse
import hashlib
import json
import subprocess
import urllib.error
import urllib.request
import numpy as np
from generate import ROOT, ENDPOINT, key
from process import read, write, RATE

SOURCES = ROOT / 'assets/source/gun-audio/auditions-01'
OUTPUT = ROOT / 'docs/gun-audio/auditions-01'
CACHE = ROOT / 'outputs/gun-audio/auditions-01'
DESIGNS = {
    'a-dry': 'Dry documentary recording. Sharp pressure snap, lean body, detailed steel mechanism, very short decay. Unembellished, close and tactile.',
    'b-heavy': 'Premium action game recording. Violent crack, dense chesty powder blast, forceful midrange punch, short room slap. Powerful but believable, never a bass synth.',
    'c-vintage': 'Gritty 1970s crime thriller recording. Coarse explosive bark, warm rough-edged body, rattling old steel, slight analog tape compression. Dangerous and worn, not muffled.',
}
GUNS = {
    'revolver': 'a heavy six-shot .357 revolver',
    'shotgun': 'a 12 gauge pump shotgun',
    'tommy': 'a vintage .45 Thompson submachine gun firing ONE round in single shot mode',
}


def generate():
    secret = key()
    if not secret:
        raise SystemExit('No configured ElevenLabs key')
    SOURCES.mkdir(parents=True, exist_ok=True)
    for design, direction in DESIGNS.items():
        for gun, description in GUNS.items():
            name = f'{design}-{gun}'
            target = SOURCES / f'{name}.mp3'
            pending = SOURCES / f'{name}.pending'
            if target.exists():
                print(name + ': cached', flush=True)
                continue
            if pending.exists():
                raise SystemExit(name + ': uncertain previous request; inspect before retry')
            payload = {'text': f'{direction} One isolated gunshot from {description}, immediately at the start, then decay to silence. No multiple shots, reload, voices, music or comedy.', 'duration_seconds': 2.0, 'prompt_influence': .8, 'model_id': 'eleven_text_to_sound_v2'}
            assert len(payload['text']) < 450
            (SOURCES/f'{name}.request.json').write_text(json.dumps(payload,indent=2)+'\n')
            pending.write_text('Request started; do not automatically retry.\n')
            request = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode(), headers={'xi-api-key':secret,'Content-Type':'application/json'})
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    data=response.read()
                    receipt={'characterCost':response.headers.get('character-cost'),'bytes':len(data)}
                if len(data)<4000:
                    raise SystemExit('Unexpected response; pending marker retained')
                target.write_bytes(data)
                (SOURCES/f'{name}.receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
                pending.unlink()
                print(name+': generated',flush=True)
            except urllib.error.HTTPError as exc:
                pending.unlink()
                raise SystemExit(f'Provider HTTP {exc.code}; no automatic retry') from None
            except urllib.error.URLError:
                raise SystemExit('Network error; inspect pending request before retry') from None


def master():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    CACHE.mkdir(parents=True,exist_ok=True)
    records=[]
    for design in DESIGNS:
        reel=[]; cues=[]; elapsed=0
        for gun in GUNS:
            name=f'{design}-{gun}'
            source=SOURCES/f'{name}.mp3'
            digest=hashlib.sha256(source.read_bytes()).hexdigest()
            wav=CACHE/f'{name}-{digest[:12]}.wav'
            if not wav.exists():
                subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100',str(source),str(wav)],check=True)
            x=read(wav)
            # Same minimal mastering for all designs; do not force a common timbre.
            energy=np.sqrt(np.mean(x[:len(x)//44*44].reshape(-1,44)**2,axis=1))
            peak=int(np.argmax(energy)); start=peak
            while start>0 and energy[start-1]>energy[peak]*.10:
                start-=1
            start=max(0,start*44-44)
            duration=.65 if gun=='tommy' else 1.25
            x=x[start:start+int(duration*RATE)].copy()
            x-=x.mean()
            t=np.arange(len(x))/RATE
            x*=np.minimum(1,t/.0003)
            x[-1102:]*=np.linspace(1,0,min(len(x),1102))
            x*=.80/max(np.max(abs(x)),1e-9)
            assert np.isfinite(x).all() and np.max(abs(x))>.7
            write(OUTPUT/f'{name}.wav',x)
            records.append({'id':name,'sourceSha256':digest,'outputSha256':hashlib.sha256((OUTPUT/f'{name}.wav').read_bytes()).hexdigest(),'trimSeconds':start/RATE,'duration':len(x)/RATE,'peakDbfs':float(20*np.log10(max(abs(x))))})
            cues.append({'weapon':gun,'atSeconds':round(elapsed/RATE,3)})
            # Two identical isolated discharges; then an actual-cadence Thompson burst.
            offsets=[0,1.55] if gun!='tommy' else [0,1.1]+[2.2+i*.105 for i in range(6)]
            chapter=np.zeros(int((offsets[-1]+len(x)/RATE+.45)*RATE))
            for at in offsets:
                begin=int(at*RATE); chapter[begin:begin+len(x)]+=x*.65
            reel.append(chapter); elapsed+=len(chapter)
        mixed=np.concatenate(reel)
        # Keep the same gain across reels; only limit if overlapping bursts exceed headroom.
        mixed*=min(1,.9/max(abs(mixed)))
        write(OUTPUT/f'{design}.wav',mixed)
        (OUTPUT/f'{design}-cues.json').write_text(json.dumps(cues,indent=2)+'\n')
    manifest={'status':'auditions only; not installed in game','designs':DESIGNS,'weaponOrder':list(GUNS),'processing':'same onset trim, DC removal, tiny start fade, 25ms end fade, -1.94 dBFS sample ceiling; no added layers, EQ, saturation or pitch change','files':records}
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Nine candidates and three comparison reels mastered.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--generate',action='store_true')
    args=parser.parse_args()
    generate() if args.generate else master()
