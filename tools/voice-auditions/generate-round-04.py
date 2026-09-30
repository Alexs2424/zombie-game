"""Generate bounded ElevenLabs voice-design previews; no permanent voice creation."""
import argparse
import base64
import datetime
import json
import os
import shlex
from pathlib import Path
import sys
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/voice-auditions/round-04.json'
ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-voice/design'


def local_key():
    """Load only recognized credential fields; never execute a dotenv file."""
    settings = {}
    env_file = ROOT / '.env'
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            line = line.strip().removeprefix('export ')
            name, separator, value = line.partition('=')
            name = name.strip()
            if separator and name in {'ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY_FILE'}:
                values = shlex.split(value, comments=True)
                if len(values) != 1:
                    raise RuntimeError(f'{name} must contain one quoted or unquoted value.')
                settings[name] = values[0]
    # Explicit process configuration takes precedence over local files.
    env_key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
    env_path = os.environ.get('ELEVENLABS_API_KEY_FILE', '').strip()
    if env_key:
        return env_key
    if env_path:
        return Path(env_path).expanduser().read_text().strip()
    if settings.get('ELEVENLABS_API_KEY'):
        return settings['ELEVENLABS_API_KEY']
    if settings.get('ELEVENLABS_API_KEY_FILE'):
        return Path(settings['ELEVENLABS_API_KEY_FILE']).expanduser().read_text().strip()
    return ''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--character', help='Generate only the named character')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--output', type=Path, default=ROOT / 'outputs/voice-auditions/round-04')
    args = parser.parse_args()
    data = json.loads(SOURCE.read_text())
    characters = [c for c in data['characters'] if not args.character or c['id'] == args.character]
    if not characters:
        parser.error('Unknown character')
    for character in characters:
        if not 20 <= len(character['prompt']) <= 1000:
            parser.error('Voice description must contain 20–1000 characters')
        if not 100 <= len(character['preview_text']) <= 1000:
            parser.error('Preview text must contain 100–1000 characters')
        if character['id'] not in {'frankie', 'eve', 'leon', 'vivian', 'voss', 'marlowe'}:
            parser.error('Unexpected character ID')
    if args.dry_run:
        for c in characters:
            print(f"{c['id']}: {len(c['preview_text'])} preview characters; one request, three candidates expected")
        print('Local validation passed. No requests made; no credits used.')
        return
    key = local_key()
    if not key:
        parser.error('Configure ELEVENLABS_API_KEY or ELEVENLABS_API_KEY_FILE locally. Never paste credentials into chat.')
    for c in characters:
        parent = args.output / c['id']
        if parent.exists() and list(parent.glob('*/manifest.json')):
            print(f"{c['id']}: existing completed audition; skipped")
            continue
        parent.mkdir(parents=True, exist_ok=True)
        pending = parent / 'request-pending.json'
        if pending.exists():
            raise RuntimeError(f"{c['id']}: uncertain previous request. Inspect provider history before retrying.")
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        take = parent / timestamp
        take.mkdir()
        payload = {
            'voice_description': c['prompt'], 'text': c['preview_text'],
            'model_id': data['model_id'], 'auto_generate_text': False,
            'stream_previews': False, 'should_enhance': False,
            'guidance_scale': 5, 'loudness': 0.5,
        }
        (take / 'request.json').write_text(json.dumps(payload, indent=2) + '\n')
        with pending.open('x') as handle:
            json.dump({'take': timestamp, 'status': 'request_may_have_been_submitted'}, handle)
        request = urllib.request.Request(
            ENDPOINT, data=json.dumps(payload).encode(), method='POST',
            headers={'Content-Type': 'application/json', 'xi-api-key': key},
        )
        print(f"{c['id']}: requesting voice previews", flush=True)
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                result = json.load(response)
                request_id = response.headers.get('request-id')
        except urllib.error.HTTPError as error:
            # Retain a sanitized provider diagnostic without exposing the key.
            try:
                detail = json.loads(error.read()).get('detail', {})
            except (ValueError, AttributeError):
                detail = {}
            diagnostic = {'http_status': error.code}
            if isinstance(detail, dict):
                diagnostic.update({field: str(detail[field]).replace(key, '[redacted]')
                                   for field in ('status', 'message') if field in detail})
            (take / 'provider-error.json').write_text(json.dumps(diagnostic, indent=2) + '\n')
            print(json.dumps(diagnostic), file=sys.stderr)
            raise RuntimeError(f"Provider returned HTTP {error.code}; no automatic retry. Check account access/credits and provider history.") from None
        except (urllib.error.URLError, TimeoutError):
            raise RuntimeError('Network failure; no automatic retry because generation may have occurred.') from None
        # Preserve a successful response before processing; never print encoded audio.
        (take / 'response.json').write_text(json.dumps(result))
        previews = result.get('previews', [])
        if not previews:
            raise RuntimeError('Provider returned no previews. Saved response for inspection.')
        manifest = {
            'character': c['id'], 'provider': 'ElevenLabs', 'created_at': timestamp,
            'model_id': data['model_id'], 'request_id': request_id,
            'text': result.get('text'), 'listening_review': 'pending', 'previews': [],
        }
        for index, preview in enumerate(previews):
            media = preview.get('media_type', '')
            if media not in {'audio/mpeg', 'audio/mp3', 'mp3'}:
                raise RuntimeError(f'Unexpected media type {media!r}; response retained, no mislabeled audio written.')
            audio = base64.b64decode(preview['audio_base_64'], validate=True)
            if not audio:
                raise RuntimeError('Empty audio returned')
            filename = f"{c['id']}-{index + 1}.mp3"
            (take / filename).write_bytes(audio)
            manifest['previews'].append({
                'file': filename, 'generated_voice_id': preview['generated_voice_id'],
                'duration_secs': preview.get('duration_secs'), 'media_type': media,
                'language': preview.get('language'), 'selection': 'unreviewed',
            })
        (take / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        pending.unlink()
        print(f"{c['id']}: saved {len(previews)} previews to {take}", flush=True)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        print(f'Audition stopped: {error}', file=sys.stderr)
        sys.exit(1)
