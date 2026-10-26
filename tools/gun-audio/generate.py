"""Generate a bounded gunshot palette. Cached requests are never repeated automatically."""
import argparse
import json
import os
from pathlib import Path
import shlex
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/gun-audio'
ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128'
SIGNATURES = {
    'pistol': 'a compact 9mm pistol: sharp dry pop, solid midrange punch, tiny steel slide clack',
    'shotgun': 'a pump action 12 gauge shotgun: massive short chesty boom, ripping air blast, gritty low end',
    'smg': 'a compact 9mm submachine gun firing ONE round in single fire mode: very tight pap, short bright snap and small metal bolt',
    'rifle': 'a battle rifle firing ONE round: fierce whip crack, hard midrange bark, tight low punch',
    'revolver': 'an old heavy .45 revolver: thunderous dry bark, deep punch and brief ringing steel',
    'magnum': 'a .357 magnum revolver: exceptionally sharp explosive crack and heavy concussive body',
    'tommy': 'a vintage Thompson .45 submachine gun firing ONE round only: chunky low barking report, heavy receiver clack',
    'doublebarrel': 'a short double barrel 12 gauge shotgun firing ONE barrel: immense rough ripping blast with deep wooden chest resonance',
    'dual': 'a small vintage pocket pistol: snappy dry bright crack, tiny slide tick, lean body',
    'machinepistol': 'a stamped steel 9mm machine pistol firing ONE round only: aggressive short metallic snap, buzzing bolt clack',
    'lever': 'a vintage lever action rifle: hard dry whip crack, hollow walnut stock knock and warm body',
    'autoshotgun': 'a semi automatic 12 gauge shotgun firing ONE round only: broad crunchy blast, tight bass, short gas bolt clack',
    'sniper': 'a powerful bolt action military rifle: piercing explosive crack, long heavy body fading naturally',
    'lmg': 'a belt fed 7.62 machine gun firing ONE round only: deep brutal bark, metallic carrier clank and belt link tick',
    'launcher': 'a vintage 40mm grenade launcher discharge: hollow wooden THOOMP, low air puff, heavy breech knock; no explosion',
}


def key():
    values = {}
    for line in (ROOT / '.env').read_text().splitlines():
        name, sep, value = line.strip().removeprefix('export ').partition('=')
        if sep and name.strip() == 'ELEVENLABS_API_KEY':
            values[name.strip()] = shlex.split(value, comments=True)[0]
    return os.environ.get('ELEVENLABS_API_KEY') or values.get('ELEVENLABS_API_KEY') or ''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--weapon', choices=SIGNATURES)
    parser.add_argument('--edition', choices=['original', 'natural'], default='original')
    args = parser.parse_args()
    output = OUT if args.edition == 'original' else OUT / 'natural'
    secret = key()
    if not secret:
        raise SystemExit('No ElevenLabs key configured')
    output.mkdir(parents=True, exist_ok=True)
    for weapon, signature in SIGNATURES.items():
        if args.weapon and args.weapon != weapon:
            continue
        target = output / f'{weapon}.mp3'
        marker = output / f'{weapon}.pending'
        if target.exists():
            print(f'{weapon}: cached', flush=True)
            continue
        if marker.exists():
            raise SystemExit(f'{weapon}: prior request outcome uncertain; inspect before retrying')
        payload = {'text': f'One isolated close microphone gunshot of {signature}. Exactly ONE shot immediately at the start, followed by decay into silence. Cinematic gritty 1970s crime film firearm sound effect for a first person game. Dry recording, no music, no voices, no ambience, no reload, no repeated shots, no distant echoes.', 'duration_seconds': 2.0, 'prompt_influence': 0.65, 'model_id': 'eleven_text_to_sound_v2'}
        if args.edition == 'natural':
            payload['text'] = f'Dry authentic recording: {signature}. ONE shot immediately, natural powder crack, real action noise, decay to silence. Close shooter perspective. No cinematic bass, tones, comedy, reload, voices or ambience.'
            payload['prompt_influence'] = 0.8
        (output / f'{weapon}.request.json').write_text(json.dumps(payload, indent=2) + '\n')
        marker.write_text('Request started; do not automatically retry.\n')
        req = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode(), headers={'xi-api-key': secret, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=90) as response:
                data = response.read()
                cost = response.headers.get('character-cost')
            if len(data) < 4000:
                raise SystemExit('Unexpected audio response; inspect before retrying')
            target.write_bytes(data)
            (output / f'{weapon}.receipt.json').write_text(json.dumps({'provider': 'ElevenLabs', 'format': 'mp3_44100_128', 'characterCost': cost, 'bytes': len(data)}, indent=2) + '\n')
            marker.unlink()
            print(f'{weapon}: generated {len(data)} bytes', flush=True)
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read()).get('detail', {})
                status = detail.get('status', 'unknown') if isinstance(detail, dict) else 'unknown'
            except Exception:
                status = 'unknown'
            marker.unlink()
            raise SystemExit(f'ElevenLabs HTTP {exc.code}, status {status}') from None
        except urllib.error.URLError:
            raise SystemExit('Network request failed; no credentials printed. Inspect pending request before retry.') from None


if __name__ == '__main__':
    main()
