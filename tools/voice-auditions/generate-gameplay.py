"""Bounded six-line Frankie gameplay pilot. Completed takes are never regenerated."""
import datetime
import hashlib
import json
from pathlib import Path
import urllib.request
import urllib.error
import os
import shlex

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/audio/dialogue/frankie-pilot'
VOICE = 'pNInz6obpgDQGcFmaJgB'
LINES = [
 ('shotgun', "Good. Something they'll hear upstairs.", '[pleased]'),
 ('tommy', "Now that's a proper complaint department.", '[amused]'),
 ('new-gun', "Nice weight. Somebody's about to have a very bad evening.", '[confident]'),
 ('multikill-1', "You all came together? Saves me making calls.", '[sarcastic]'),
 ('multikill-2', "Look at this mess. I used to get overtime for this.", '[annoyed]'),
 ('multikill-3', "Anybody else? Come on. I'm already in a bad mood.", '[angry]'),
]

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
 OUT.mkdir(parents=True, exist_ok=True)
 key=local_key()
 if not key: raise SystemExit('Missing local ElevenLabs credential.')
 for slug,text,direction in LINES:
  clip=OUT/f'{slug}.mp3'; manifest=OUT/f'{slug}.json'; pending=OUT/f'{slug}.pending'
  if clip.exists() and manifest.exists():
   print(slug+': completed; skipped',flush=True);continue
  if pending.exists():raise SystemExit(slug+': uncertain request; inspect provider history before retrying.')
  payload={'text':direction+' '+text,'model_id':'eleven_v3','voice_settings':{'stability':0.5}}
  pending.write_text('Request may have been submitted. Do not retry automatically.\n')
  req=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',data=json.dumps(payload).encode(),headers={'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'})
  try:
   with urllib.request.urlopen(req,timeout=90) as response:
    data=response.read(); request_id=response.headers.get('request-id'); content_type=response.headers.get('Content-Type','')
   if 'audio' not in content_type or len(data)<1000:raise RuntimeError('Unexpected speech response; inspect before retrying.')
  except urllib.error.HTTPError as error:
   raise SystemExit(f'{slug}: provider HTTP {error.code}; stopped, no automatic retry.') from None
  except (urllib.error.URLError,TimeoutError):
   raise SystemExit(f'{slug}: connection failed or uncertain; stopped, inspect before retrying.') from None
  clip.write_bytes(data)
  manifest.write_text(json.dumps({'speaker':'Frankie Caruso','casting':'Adam stock voice; provisional gameplay audition, not final North Jersey casting','provider':'ElevenLabs','voice_id':VOICE,'request':payload,'subtitle':text,'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'request_id':request_id,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'processing':'Unprocessed provider MP3; gain controlled at runtime.'},indent=2)+'\n')
  pending.unlink()
  print(slug+f': generated {len(data)} bytes',flush=True)
if __name__=='__main__':main()
