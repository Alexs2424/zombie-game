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
SOURCES = ROOT / 'assets/source/gun-audio'
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

# Per-gun material signatures: EQ focus, drive, tail, and brief inharmonic resonances.
# Resonances are accents inside the report, never a second shot or a reload cue.
PERSONALITIES = {
    'pistol': dict(label='dry snap / compact slide', focus=2100, color=1.0, drive=1.05, tail=.16, material=[1650, 2910, 4380], decay=.012, level=.12, beats=[.023]),
    'shotgun': dict(label='ragged thunder / heavy receiver', focus=210, color=1.8, drive=1.65, tail=.30, material=[190, 337, 760], decay=.036, level=.22, beats=[.033]),
    'smg': dict(label='pap / clipped stamped steel', focus=2900, color=1.4, drive=1.1, tail=.10, material=[2400, 3810, 6140], decay=.009, level=.13, beats=[.014, .036]),
    'rifle': dict(label='hard bark / steel bolt slap', focus=1100, color=1.4, drive=1.35, tail=.18, material=[740, 1590, 3130], decay=.014, level=.18, beats=[.029]),
    'revolver': dict(label='smoky low bark / iron frame', focus=380, color=1.9, drive=1.6, tail=.32, material=[390, 677, 1190], decay=.048, level=.18, beats=[.012]),
    'magnum': dict(label='bright whip crack / singing cylinder', focus=3400, color=1.6, drive=1.15, tail=.22, material=[2130, 3540, 5790], decay=.060, level=.19, beats=[.009]),
    'tommy': dict(label='chunky bark / hollow drum chatter', focus=470, color=2.1, drive=1.6, tail=.15, material=[185, 327, 920], decay=.023, level=.25, beats=[.018, .050]),
    'doublebarrel': dict(label='torn-air boom / walnut chest', focus=150, color=2.2, drive=1.9, tail=.34, material=[135, 237, 419], decay=.065, level=.26, beats=[.008]),
    'dual': dict(label='small hot cracks / glassy slide', focus=4300, color=1.6, drive=1.0, tail=.12, material=[3100, 4970, 7190], decay=.010, level=.13, beats=[.016]),
    'machinepistol': dict(label='rasping snap / tinny bolt chatter', focus=1900, color=2.0, drive=1.85, tail=.10, material=[1450, 2690, 4670], decay=.008, level=.21, beats=[.012, .026, .041]),
    'lever': dict(label='frontier crack / walnut knock', focus=720, color=1.5, drive=1.2, tail=.25, material=[260, 437, 793], decay=.033, level=.24, beats=[.016]),
    'autoshotgun': dict(label='compressed boom / gas-action chatter', focus=290, color=1.6, drive=1.45, tail=.22, material=[610, 1190, 2380], decay=.019, level=.22, beats=[.031, .072]),
    'sniper': dict(label='needle crack / long dark aftershock', focus=4700, color=1.3, drive=1.0, tail=.39, material=[175, 301, 541], decay=.082, level=.17, beats=[.020]),
    'lmg': dict(label='industrial thud / loose feed links', focus=650, color=1.9, drive=1.75, tail=.19, material=[580, 1370, 3290], decay=.020, level=.23, beats=[.021, .048, .070]),
    'launcher': dict(label='hollow thoomp / barrel cavity', focus=170, color=2.4, drive=1.0, tail=.28, material=[145, 283, 467], decay=.085, level=.32, beats=[.008]),
}

# A small comic subset; take three delivers the largest flourish (~one shot in three).
ODDBALLS = {
    'magnum': 'cash-register ding after the crack',
    'tommy': 'typewriter key clacks with a tiny carriage-return chirp',
    'lever': 'silver coin spinning and bouncing after the woody report',
    'launcher': 'oversized cork pop with a falling springy boing',
}


def oddball_accent(t, weapon, variant):
    y = np.zeros_like(t)
    if weapon not in ODDBALLS:
        return y
    amount = [.28, .45, 1.0][variant]

    def ring(at, frequency, decay, level, ratios=(1, 2.71, 4.13)):
        u = np.maximum(t-at, 0)
        gate = (t >= at)*(1-np.exp(-u/.0007))
        tone = sum(np.sin(2*np.pi*frequency*r*u)*np.exp(-u/(decay/(1+i*.5)))/(1+i*2)
                   for i, r in enumerate(ratios))
        return tone*gate*level*amount

    if weapon == 'magnum':
        # Recognizable register bell, separated from the pressure front.
        y += ring(.075, 1760*(1+variant*.015), .11, .24)
        if variant == 2:
            y += ring(.15, 2349, .08, .13)
    elif weapon == 'tommy':
        y += ring(.025, 1250, .006, .21, (1, 1.67, 3.4))
        y += ring(.052, 870, .008, .18, (1, 2.3, 4.7))
        if variant == 2:
            y += ring(.065, 2637, .025, .13)
    elif weapon == 'lever':
        # Accelerating coin bounces, short enough to finish before the next action.
        for i, at in enumerate([.06, .105, .137, .160]):
            y += ring(at, 2850+i*190+variant*40, .028, .19/(1+i*.3), (1, 1.49, 2.83))
    elif weapon == 'launcher':
        u = np.maximum(t-.045, 0)
        # A cork-sized upward pop falling into a short elastic barrel wobble.
        phase = 2*np.pi*(105*u + 390*.035*(1-np.exp(-u/.035)))
        wobble = 1+.22*np.sin(2*np.pi*27*u)*np.exp(-u/.12)
        y += np.sin(phase + .7*np.sin(2*np.pi*19*u))*wobble
        y *= (t >= .045)*(1-np.exp(-u/.001))*np.exp(-u/.10)*.38*amount
    return y


def material_accent(t, weapon, variant):
    profile = PERSONALITIES[weapon]
    seed = int.from_bytes(hashlib.sha256(weapon.encode()).digest()[:4], 'little') + variant
    rng = np.random.default_rng(seed)
    y = np.zeros_like(t)
    for i, at in enumerate(profile['beats']):
        elapsed = np.maximum(t - at * (1 + (variant-1)*.09), 0)
        gate = (t >= at * (1 + (variant-1)*.09)) * (1-np.exp(-elapsed/.0005))
        strike = np.zeros_like(t)
        for j, hz in enumerate(profile['material']):
            detune = 1 + rng.uniform(-.045, .045)
            tau = profile['decay'] * (1 + (variant-1)*.18) / (1+j*.3)
            strike += np.sin(2*np.pi*hz*detune*elapsed) * np.exp(-elapsed/tau) / (1+j)
        # A noisy impact makes the partials read as a struck material rather than a note.
        strike += rng.standard_normal(len(t)) * np.exp(-elapsed/.0025) * .30
        y += strike * gate * profile['level'] / (1+i*.35)
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
    profile = PERSONALITIES[weapon]
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
    # Small source timing differences plus distinct envelopes prevent carbon-copy waveforms.
    positions = np.arange(len(x)) * (1 + (variant-1)*.025)
    x = np.interp(positions, np.arange(len(x)), x, right=0)
    x -= x.mean()
    # Smooth spectral roll-offs remove subsonic energy and brittle top end.
    f = np.fft.rfftfreq(len(x), 1/RATE)
    curve = (f*f/(f*f+45**2)) / np.sqrt(1+(f/(8200 + variant*450))**6)
    focus = profile['focus'] * (1 + (variant-1)*.18)
    octave_distance = np.log2(np.maximum(f, 1)/focus)
    curve *= 1 + profile['color'] * np.exp(-.5*(octave_distance/.65)**2)
    x = np.fft.irfft(np.fft.rfft(x)*curve, n=len(x))
    x /= max(np.max(np.abs(x)), 1e-9)
    t = np.arange(len(x))/RATE
    # Short tactile pressure body, below the report. Each version has its own body tuning.
    hz = bass*(1+(variant-1)*.09)
    body = np.sin(2*np.pi*(hz*t + hz*.6*.018*(1-np.exp(-t/.018))))
    body *= (1-np.exp(-t/.0008))*np.exp(-t/(.035+weight*.16))
    x += body*weight*(1.8 + variant*.25)
    # Keep the source attack; progressively dry out its tail for gameplay cadence.
    x *= np.exp(-np.maximum(t-.035, 0)/(length*profile['tail']*(.82+variant*.18)))
    x = np.tanh(x*profile['drive']) / np.tanh(profile['drive'])
    x += material_accent(t, weapon, variant)
    x += oddball_accent(t, weapon, variant)
    x *= np.minimum(1, t/.0003)
    fade = min(int(.025*RATE), len(x))
    x[-fade:] *= np.linspace(1, 0, fade)
    x = np.tanh(x*1.05)
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
        wav = OUT / f'{weapon}-decoded.wav'
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
    previous = json.loads((DOC / 'provenance.json').read_text()) if (DOC / 'provenance.json').exists() else {}
    provenance = {'provider': 'ElevenLabs', 'model': 'eleven_text_to_sound_v2',
                  'sourceDocumentation': 'https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert',
                  'sourceFormat': 'mp3_44100_128', 'outputFormat': '44100 Hz mono PCM16 WAV',
                  'processing': 'personality pass 3 with selective comic accents: main transient trim; 45 Hz high-pass; weapon-specific resonant EQ, saturation and decay; three time/color/body variants; seeded inharmonic material accents; fades; -1.51 dBFS peak ceiling',
                  'personalities': PERSONALITIES, 'oddballAccents': ODDBALLS,
                  'oddballMix': 'four comic guns; strongest flourish on take 3, subtler takes 1 and 2; original synthesis, no additional provider requests',
                  'requests': previous.get('requests') or {w: json.loads((OUT/f'{w}.request.json').read_text()) for w in SIGNATURES},
                  'sources': {w: hashlib.sha256((SOURCES/f'{w}.mp3').read_bytes()).hexdigest() for w in SIGNATURES}, 'files': records}
    (DOC / 'provenance.json').write_text(json.dumps(provenance, indent=2)+'\n')
    print(f'Mastered {len(records)} reports; preview {len(preview)/RATE:.1f}s')


if __name__ == '__main__':
    main()
