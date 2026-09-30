import type { GameEvent, WeaponId } from './simulation';

export const FRANKIE_LINES = [
  { id: 'shotgun', text: "Good. Something they'll hear upstairs." },
  { id: 'tommy', text: "Now that's a proper complaint department." },
  { id: 'new-gun', text: "Nice weight. Somebody's about to have a very bad evening." },
  { id: 'multikill-1', text: 'You all came together? Saves me making calls.' },
  { id: 'multikill-2', text: 'Look at this mess. I used to get overtime for this.' },
  { id: 'multikill-3', text: "Anybody else? Come on. I'm already in a bad mood." },
] as const;
export type CharacterLine = typeof FRANKIE_LINES[number];
const MELEE = new Set<WeaponId>(['stick', 'axe']);

/** Solo pilot: current kill events belong to the local player, not future teammates. */
export class CharacterDialogueDirector {
  private owned = new Set<WeaponId>();
  private kills: number[] = [];
  private last = -Infinity;
  private uses = new Map<string, { at: number; count: number }>();
  private rotation = 0;

  reset(owned: WeaponId[]) {
    this.owned = new Set(owned);
    this.kills = [];
    this.last = -Infinity;
    this.uses.clear();
    this.rotation = 0;
  }

  /** No queue: if speech is busy or an event is stale, let that reaction go. */
  update(now: number, playing: boolean, events: readonly GameEvent[], owned: WeaponId[], busy = false): CharacterLine | null {
    const fresh = owned.filter(id => !this.owned.has(id) && !MELEE.has(id));
    for (const id of owned) this.owned.add(id);
    if (!playing || events.some(e => e.type === 'death')) {
      this.kills = [];
      return null;
    }
    this.kills = this.kills.filter(at => now - at <= 4);
    for (const event of events) if (event.type === 'kill') this.kills.push(now);
    const streak = this.kills.length >= 4;
    if (streak) this.kills = []; // Four new kills required for another opportunity.
    if (busy || now - this.last < 12) return null;
    let line: CharacterLine | undefined;
    if (fresh.length) {
      const weapon = fresh[fresh.length - 1];
      line = FRANKIE_LINES[weapon === 'shotgun' || weapon === 'autoshotgun' || weapon === 'doublebarrel' ? 0 : weapon === 'tommy' ? 1 : 2];
    } else if (streak) {
      for (let i = 0; i < 3; i++) {
        const candidate = FRANKIE_LINES[3 + ((this.rotation + i) % 3)];
        if (this.available(candidate, now)) { line = candidate; this.rotation = (this.rotation + i + 1) % 3; break; }
      }
    }
    if (!line || !this.available(line, now)) return null;
    this.uses.set(line.id, { at: now, count: (this.uses.get(line.id)?.count ?? 0) + 1 });
    this.last = now;
    return line;
  }
  private available(line: CharacterLine, now: number) {
    const use = this.uses.get(line.id);
    return !use || (use.count < 2 && now - use.at >= 180);
  }
}

/** Preloaded, local speech through the game's master volume; no runtime API calls. */
export class CharacterSpeech {
  private buffers = new Map<string, AudioBuffer>();
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private loading: Promise<void> | null = null;
  private abort = new AbortController();
  private disposed = false;
  caption = '';
  get busy() { return this.source !== null; }
  preload(context: AudioContext) {
    if (this.loading || this.disposed) return this.loading;
    this.loading = Promise.all(FRANKIE_LINES.map(async line => {
      if (this.buffers.has(line.id)) return;
      try {
        const response = await fetch(`/audio/dialogue/frankie-pilot/${line.id}.mp3`, { signal: this.abort.signal });
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (!this.disposed) this.buffers.set(line.id, buffer);
      } catch { /* Unavailable speech must never interrupt gameplay. */ }
    })).then(() => { this.loading = null; });
    return this.loading;
  }
  play(line: CharacterLine, context: AudioContext, output: AudioNode) {
    const buffer = this.buffers.get(line.id);
    if (!buffer || this.busy || this.disposed || context.state !== 'running') return false;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.85;
    source.connect(gain); gain.connect(output);
    this.source = source; this.gain = gain;
    this.caption = `Frankie: ${line.text}`;
    source.onended = () => { if (this.source === source) this.stop(); };
    source.start();
    return true;
  }
  stop() {
    const source = this.source;
    this.source = null;
    this.caption = '';
    if (source) { source.onended = null; source.stop(); source.disconnect(); }
    this.gain?.disconnect(); this.gain = null;
  }
  dispose() { this.disposed = true; this.abort.abort(); this.stop(); this.buffers.clear(); }
}
