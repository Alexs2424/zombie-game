"""Master cached ElevenLabs MP3s into mono game reports and an audition reel.
Requires numpy and macOS afconvert. No network calls. Raw sources stay in outputs/.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import shutil
import wave
import numpy as np
from generate import ROOT, OUT, SIGNATURES

RATE = 44100
DEST = ROOT / 'public/audio/weapons'
DOC = ROOT / 'docs/gun-audio'
SOURCES = ROOT / 'assets/source/gun-audio/natural'
OUT = OUT / 'natural'
# Maximum tails and bass weight: rapid guns recover quickly between reports.
PROFILES = {
    'pistol': (.42, 115, .10), 'shotgun': (.85, 65, .22),
    'smg': (.24, 155, .06), 'rifle': (.44, 105, .12),
    'revolver': (.70, 85, .18), 'magnum': (.75, 95, .19),
    'tommy': (.32, 100, .13), 'doublebarrel': (.95, 58, .25),
    'dual': (.32, 170, .07), 'machinepistol': (.22, 180, .05),
    'lever': (.62, 110, .12), 'autoshotgun': (.65, 75, .18),
    'sniper': (1.05, 85, .16), 'lmg': (.40, 80, .17),
    'launcher': (.65, 120, .12),
}

# Only these two guns receive a comic take. The other two takes remain straight.
ODDBALLS = {
    'tommy': 'brief mechanical typewriter carriage zip after the report',
    'launcher': 'oversized champagne-cork pop with a breathy pressure release',
}


def oddball_accent(t, weapon, variant):
    y = np.zeros_like(t)
    if weapon not in ODDBALLS or variant != 2:
        return y
    rng = np.random.default_rng(1907 if weapon == 'tommy' else 1940)
    noise = rng.standard_normal(len(t))
    f = np.fft.rfftfreq(len(t), 1/RATE)
    if weapon == 'tommy':
        # A quick ratcheting friction zip, with no bell or musical note.
        u = np.maximum(t-.055, 0)
        curve = np.exp(-.5*((f-2300)/1300)**2)
        y = np.fft.irfft(np.fft.rfft(noise)*curve, n=len(t))
        y *= (t>=.055)*(1-np.exp(-u/.002))*np.exp(-u/.025)
        y *= (.4+.6*np.sin(2*np.pi*155*u)**8)*.30
    else:
        # Comic scale comes from air and an overlarge pop, not a descending sine boing.
        u = np.maximum(t-.035, 0)
        curve = 1/(1+(f/750)**4)
        y = np.fft.irfft(np.fft.rfft(noise)*curve, n=len(t))
        y *= (t>=.035)*(1-np.exp(-u/.001))*np.exp(-u/.045)*1.2
    return y


def read(path):
    with wave.open(str(path), 'rb') as w:
        assert w.getsampwidth() == 2 and w.getframerate() == RATE
        return np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, w.getnchannels()).mean(axis=1) / 32768


def write(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as w:
        w.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        w.writeframes(np.round(x * 32767).astype('<i2').tobytes())


def master(source, weapon, variant):
    length, bass, weight = PROFILES[weapon]
    # Locate the main pressure front, retaining 1ms pre-roll. This removes model lead-in.
    frame = 44
    energy = np.sqrt(np.mean(source[:len(source)//frame*frame].reshape(-1, frame)**2, axis=1))
    peak = int(np.argmax(energy))
    start = peak
    while start > 0 and energy[start-1] > energy[peak] * .12:
        start -= 1
    start = max(0, start * frame - 44)
    x = source[start:start+int(length*RATE)].copy()
    x = np.pad(x, (0, max(0, int(length*RATE)-len(x))))
    # Keep the recorded/generated texture; no synthesized bass or metal partials.
    positions = np.arange(len(x)) * (1 + (variant-1)*.012)
    x = np.interp(positions, np.arange(len(x)), x, right=0)
    x -= x.mean()
    f = np.fft.rfftfreq(len(x), 1/RATE)
    curve = f*f/(f*f+35**2) / np.sqrt(1+(f/(10000+variant*300))**8)
    x = np.fft.irfft(np.fft.rfft(x)*curve, n=len(x))
    x /= max(np.max(np.abs(x)), 1e-9)
    t = np.arange(len(x))/RATE
    # Preserve the pressure front and most natural decay; dry out only the late tail.
    x *= np.exp(-np.maximum(t-.09, 0)/(length*.42))
    x += oddball_accent(t, weapon, variant)
    x *= np.minimum(1, t/.0003)
    fade = min(int(.025*RATE), len(x))
    x[-fade:] *= np.linspace(1, 0, fade)
    x *= .84/max(np.max(np.abs(x)), 1e-9)
    return x, start/RATE


def main():
    DOC.mkdir(parents=True, exist_ok=True)
    SOURCES.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    records, reel, cues = [], [], []
    cursor = 0
    for weapon in SIGNATURES:
        mp3 = SOURCES / f'{weapon}.mp3'
        if not mp3.exists():
            shutil.copyfile(OUT / f'{weapon}.mp3', mp3)
            shutil.copyfile(OUT / f'{weapon}.request.json', SOURCES / f'{weapon}.request.json')
        digest = hashlib.sha256(mp3.read_bytes()).hexdigest()[:12]
        wav = OUT / f'{weapon}-{digest}-decoded.wav'
        if not wav.exists():
            subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', str(mp3), str(wav)], check=True)
        source = read(wav)
        if np.max(np.abs(source)) < .01:
            raise ValueError(f'{weapon}: silent source')
        shots = []
        for variant in range(3):
            x, trim = master(source, weapon, variant)
            name = f'report-{variant+1}'
            write(DEST / weapon / f'{name}.wav', x)
            shots.append(x)
            records.append({'file': f'{weapon}/{name}.wav', 'duration': len(x)/RATE, 'sourceTrimSeconds': trim,
                            'peakDbfs': round(20*np.log10(np.max(np.abs(x))), 2), 'clippedSamples': int(np.sum(np.abs(x)>=1)),
                            'sha256': hashlib.sha256((DEST / weapon / f'{name}.wav').read_bytes()).hexdigest()})
            if weapon == 'doublebarrel':
                offset = int(.009*RATE)
                double = np.pad(x, (0, offset)) + np.pad(shots[0]*.92, (offset, 0))
                double *= .84/np.max(np.abs(double))
                write(DEST / weapon / f'report-double-{variant+1}.wav', double)
                records.append({'file': f'{weapon}/report-double-{variant+1}.wav', 'duration': len(double)/RATE,
                                'peakDbfs': round(20*np.log10(np.max(np.abs(double))), 2), 'clippedSamples': 0,
                                'sha256': hashlib.sha256((DEST / weapon / f'report-double-{variant+1}.wav').read_bytes()).hexdigest()})
        cues.append({'weapon': weapon, 'atSeconds': round(cursor/RATE, 3)})
        # All three takes, then a short burst for automatic weapons.
        interval = {'smg': .085, 'tommy': .11, 'machinepistol': .07, 'lmg': .12}.get(weapon)
        spacing = max(.65, PROFILES[weapon][0]+.15)
        offsets = [0, spacing, 2*spacing] + ([3*spacing+i*interval for i in range(6)] if interval else [])
        chapter = np.zeros(int((offsets[-1]+PROFILES[weapon][0]+.65)*RATE))
        for i, at in enumerate(offsets):
            x = shots[i%3]; start = int(at*RATE)
            chapter[start:start+len(x)] += x*.65
        reel.append(chapter); cursor += len(chapter)
    preview = np.concatenate(reel)
    preview *= min(1, .9/max(np.max(np.abs(preview)), 1e-9))
    write(DOC / 'gun-sound-preview.wav', preview)
    (DOC / 'preview-cues.json').write_text(json.dumps(cues, indent=2)+'\n')
    # Compact sampler of the most contrasting identities, in a stable listening order.
    sampler, sampler_cues, elapsed = [], [], 0
    for weapon in ['revolver', 'magnum', 'tommy', 'doublebarrel', 'machinepistol', 'launcher']:
        shot = read(DEST / weapon / 'report-1.wav') * .75
        chapter = np.concatenate([shot, np.zeros(int(.4*RATE))])
        sampler_cues.append({'weapon': weapon, 'atSeconds': round(elapsed/RATE, 3)})
        sampler.append(chapter)
        elapsed += len(chapter)
    write(DOC / 'personality-preview.wav', np.concatenate(sampler))
    (DOC / 'personality-preview-cues.json').write_text(json.dumps(sampler_cues, indent=2)+'\n')

    odd_reel, odd_cues, elapsed = [], [], 0
    for weapon in ODDBALLS:
        odd_cues.append({'weapon': weapon, 'accent': ODDBALLS[weapon], 'atSeconds': round(elapsed/RATE, 3)})
        for variant in (1, 2, 3):
            shot = read(DEST / weapon / f'report-{variant}.wav') * .75
            chapter = np.concatenate([shot, np.zeros(int(.25*RATE))])
            odd_reel.append(chapter)
            elapsed += len(chapter)
    write(DOC / 'oddball-preview.wav', np.concatenate(odd_reel))
    (DOC / 'oddball-preview-cues.json').write_text(json.dumps(odd_cues, indent=2)+'\n')
    provenance = {'provider': 'ElevenLabs', 'model': 'eleven_text_to_sound_v2',
                  'sourceDocumentation': 'https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert',
                  'sourceFormat': 'mp3_44100_128', 'outputFormat': '44100 Hz mono PCM16 WAV',
                  'processing': 'natural pass: fresh sources, onset trim, mild 35 Hz high-pass and treble rolloff, subtle time variation, late-tail control and fades; no synthesized bass, resonant EQ or saturation; -1.51 dBFS peak ceiling',
                  'oddballAccents': ODDBALLS,
                  'oddballMix': 'only take 3 of Thompson and launcher; other takes and all other guns have no comic layer',
                  'requests': {w: json.loads((SOURCES/f'{w}.request.json').read_text()) for w in SIGNATURES},
                  'sources': {w: hashlib.sha256((SOURCES/f'{w}.mp3').read_bytes()).hexdigest() for w in SIGNATURES}, 'files': records}
    (DOC / 'provenance.json').write_text(json.dumps(provenance, indent=2)+'\n')
    print(f'Mastered {len(records)} reports; preview {len(preview)/RATE:.1f}s')


if __name__ == '__main__':
    main()
