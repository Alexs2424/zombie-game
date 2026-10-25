import { CASE_OPEN_SECONDS, CASE_OFFER_SECONDS, CASE_CLOSE_SECONDS, type CaseState } from "./mystery-case.ts";
import { CASINO_SECRET_ANCHORS } from "./casino.ts";
import type { GameEvent, V2 } from "./simulation";
import type { WorldPosition } from "./world";
import { HOTEL_FIXTURES } from "./hotel-fixtures.ts";
import { SlotAudioDirector, slotSourceAudible, type SlotCue } from "./slot-audio-director.ts";
import { slotSoundSamples, SLOT_SOUND_NAMES } from "./slot-sounds.ts";
import { WeaponCueDirector, WeaponSounds } from "./weapon-audio.ts";
import type { WeaponId } from "./simulation";

type ZombieCue = "chase" | "last" | "horde" | "attack" | "death";
type ZombieSource = WorldPosition & { health?: number };
const ZOMBIE_SOUNDS: Record<ZombieCue, string[]> = {
  chase: ["chase-01", "chase-medium-01", "chase-medium-02"],
  last: [
    "scream-elevenlabs-high-01", "scream-elevenlabs-high-02",
    "scream-elevenlabs-high-03", "scream-elevenlabs-high-04",
  ],
  horde: ["horde-01"],
  attack: ["attack-medium-01"],
  death: ["death-medium-01"],
};

export class GameAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  volume = 0.45;
  private noise: AudioBuffer | null = null;
  private ambience: GainNode | null = null;
  private world: GainNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;
  private reverb: ConvolverNode | null = null;
  private loops: AudioScheduledSourceNode[] = [];
  private ambientTimer = 2;
  private footTimer = 0;
  private active = false;
  private duckUntil = 0;
  private slotDirector = new SlotAudioDirector();
  private slotBuffers: AudioBuffer[] = [];
  private slotSequence = 0;
  private lastSlotPlayback = "none";
  private slotVoice: {
    stop: () => void;
    source: SlotCue["source"];
    gain: GainNode;
    panner: StereoPannerNode;
    filter: BiquadFilterNode;
  } | null = null;
  get slotStatus() {
    return `Slots · last cue: ${this.lastSlotPlayback}`;
  }
  /** Sampled 1970s arsenal: lazily loaded per weapon, cue-locked to the viewmodel animation. */
  readonly weapons = new WeaponSounds(() =>
    this.context && this.world ? { context: this.context, world: this.world, reverb: this.reverb } : null,
  );
  private weaponCues = new WeaponCueDirector(this.weapons);
  private listener = { player: { x: 0, z: 0 } as V2, yaw: 0 };
  private zombieBuffers = new Map<string, AudioBuffer>();
  private zombieLoading: Promise<void> | null = null;
  private zombieFetch: AbortController | null = null;
  private lastZombieSample: Partial<Record<ZombieCue, string>> = {};
  private playedLastZombieSamples = new Set<string>();
  private nextZombieAttack = 0;
  private nextZombieDeath = 0;
  private hotelBellBuffer: AudioBuffer | null = null;
  private hotelBellLoading: Promise<void> | null = null;
  private hotelBellFetch: AbortController | null = null;
  private hotelBellVoice: { stop: () => void } | null = null;
  private stickFallbackStop: (() => void) | null = null;
  private mysterySlotBuffer: AudioBuffer | null = null;
  private caseBuffers = new Map<string, AudioBuffer>();
  private caseState: CaseState | null = null;
  private caseStage = "";
  private mysterySlotLoading: Promise<void> | null = null;
  private mysterySlotFetch: AbortController | null = null;
  private mysterySlotVoice: { stop: () => void; spatial?: (volume:number,pan:number)=>void } | null = null;
  private recordTimer = 0;
  private recordStep = 0;
  private lastZombiePlayback = "none";
  get zombieStatus() {
    return `${this.zombieBuffers.size}/${Object.values(ZOMBIE_SOUNDS).flat().length} clips ready · last cue: ${this.lastZombiePlayback}`;
  }
  private zombieVoices = new Map<AudioScheduledSourceNode, {
    stop: () => void;
    enemy: ZombieSource;
    kind: ZombieCue;
    gain: GainNode;
    panner: StereoPannerNode;
  }>();
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.world = this.context.createGain();
      this.world.gain.value = this.active ? 1 : 0;
      this.world.connect(this.master);
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
      this.reverb = this.context.createConvolver();
      const impulse = this.context.createBuffer(
        2,
        this.context.sampleRate * 1.8,
        this.context.sampleRate,
      );
      for (let channel = 0; channel < 2; channel++) {
        const samples = impulse.getChannelData(channel);
        for (let i = 0; i < samples.length; i++)
          samples[i] =
            (Math.random() * 2 - 1) *
            Math.pow(1 - i / samples.length, 3) *
            0.35;
      }
      this.reverb.buffer = impulse;
      const wet = this.context.createGain();
      wet.gain.value = 0.12;
      this.reverb.connect(wet);
      wet.connect(this.world);
      this.noise = this.context.createBuffer(
        1,
        this.context.sampleRate * 0.5,
        this.context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.slotBuffers = SLOT_SOUND_NAMES.map((_, variant) => {
        const samples = slotSoundSamples(this.context!.sampleRate, variant);
        const buffer = this.context!.createBuffer(1, samples.length, this.context!.sampleRate);
        buffer.getChannelData(0).set(samples);
        return buffer;
      });
      const air = this.context.createBufferSource();
      air.buffer = this.noise;
      air.loop = true;
      this.ambienceFilter = this.context.createBiquadFilter();
      this.ambienceFilter.type = "lowpass";
      this.ambienceFilter.frequency.value = 350;
      this.ambience = this.context.createGain();
      this.ambience.gain.value = 0;
      air.connect(this.ambienceFilter);
      this.ambienceFilter.connect(this.ambience);
      this.ambience.connect(this.world);
      air.start();
      this.loops.push(air);
      for (const frequency of [55, 110.3]) {
        const hum = this.context.createOscillator(),
          gain = this.context.createGain();
        hum.frequency.value = frequency;
        gain.gain.value = 0.09;
        hum.connect(gain);
        gain.connect(this.ambience);
        hum.start();
        this.loops.push(hum);
      }
    }
    if (this.context.state === "suspended") await this.context.resume();
    // Loading never blocks mouse capture or entry. Failed files retain the
    // synthesized fallback, and all in-game playback remains local.
    void this.weapons.preload("pistol");
    if (!this.zombieLoading) this.zombieLoading = this.loadZombieSounds(this.context);
    if (!this.hotelBellLoading) this.hotelBellLoading = this.loadHotelBell(this.context);
    if (!this.mysterySlotLoading) this.mysterySlotLoading = this.loadMysterySlot(this.context);
  }
  private async loadZombieSounds(context: AudioContext) {
    this.zombieFetch = new AbortController();
    const signal = this.zombieFetch.signal;
    await Promise.all(Object.values(ZOMBIE_SOUNDS).flat().map(async (name) => {
      try {
        const response = await fetch(`/audio/zombies/${name}.wav`, { signal });
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (this.context === context && !signal.aborted)
          this.zombieBuffers.set(name, buffer);
      } catch {
        // Network/decoding failure must not interrupt the game.
      }
    }));
  }
  private async loadHotelBell(context: AudioContext) {
    this.hotelBellFetch = new AbortController();
    const signal = this.hotelBellFetch.signal;
    try {
      const response = await fetch("/audio/restaurant/restaurant-bell-01.wav", { signal });
      if (!response.ok) return;
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (this.context === context && !signal.aborted) this.hotelBellBuffer = buffer;
    } catch {
      // Keep the original synthesized bell if loading or decoding fails.
    }
  }
  private async loadMysterySlot(context: AudioContext) {
    this.mysterySlotFetch = new AbortController();
    const signal = this.mysterySlotFetch.signal;
    await Promise.all(["opening", "offer", "closing", "take"].map(async cue => {
      try {
        const response = await fetch(`/audio/velvet-case/${cue}.wav`, { signal });
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (this.context === context && !signal.aborted) {
          this.caseBuffers.set(cue, buffer);
          if (cue === "opening") this.mysterySlotBuffer = buffer;
        }
      } catch { /* The procedural opening cue remains available if loading fails. */ }
    }));
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(v, this.context.currentTime, 0.035);
  }
  setActive(playing: boolean) {
    this.active = playing;
    this.weapons.setActive(playing);
    if (!playing) {
      this.caseStage="";
      this.stopZombieVoices();
      this.slotVoice?.stop();
      this.hotelBellVoice?.stop();
      this.mysterySlotVoice?.stop();
      this.stickFallbackStop?.();
    }
    if (this.world && this.context)
      this.world.gain.setTargetAtTime(
        playing ? 1 : 0,
        this.context.currentTime,
        0.035,
      );
  }
  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    end?: number,
    delay = 0,
    pan = 0,
    ui = false,
    onEnded?: () => void,
  ) {
    const c = this.context;
    if (!c || !this.master || c.state !== "running") return;
    const oscillator = c.createOscillator(),
      gain = c.createGain();
    const start = c.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (end)
      oscillator.frequency.exponentialRampToValueAtTime(end, start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    const panner = c.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(ui ? this.master : this.world!);
    if (this.reverb && !ui) panner.connect(this.reverb);
    oscillator.start(start);
    oscillator.stop(start + duration);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      oscillator.disconnect();
      gain.disconnect();
      panner.disconnect();
      onEnded?.();
    };
    oscillator.onended = cleanup;
    return () => { oscillator.stop(); cleanup(); };
  }
  private burst(duration: number, volume: number, frequency: number, pan = 0, onEnded?: () => void) {
    const c = this.context;
    if (!c || !this.noise || !this.master || c.state !== "running") return;
    const source = c.createBufferSource(),
      gain = c.createGain(),
      filter = c.createBiquadFilter(),
      panner = c.createStereoPanner();
    source.buffer = this.noise;
    source.loop = duration > 0.5;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.world!);
    if (this.reverb) panner.connect(this.reverb);
    source.start();
    source.stop(c.currentTime + duration);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
      onEnded?.();
    };
    source.onended = cleanup;
    return () => { source.stop(); cleanup(); };
  }
  /** Per-frame weapon cue timing (reload beats, lever/bolt cycles, LMG belt run-out). */
  weaponFrame(dt: number, s: { weapon: WeaponId; reloadRemaining: number; reloadDuration: number; mag: number; playing: boolean }) {
    this.weaponCues.update(dt, s);
  }
  play(event: GameEvent) {
    if (event.type === "melee" && event.weapon === "stick") {
      if (!this.active) return;
      this.stickFallbackStop?.();
    }
    if (event.type === "shot" && event.weapon) this.weaponCues.shot(event.weapon);
    if (this.weapons.event(event, this.listener.player, this.listener.yaw)) return;
    if (event.type === "hotelBell") this.playHotelBell();
    // Case audio follows simulation time in updateMystery, including pause/resume.
    if (event.type === "hotelComplete") {
      [196, 246.94, 293.66, 392].forEach((note, i) => this.tone(note, 0.65, 0.11, "triangle", undefined, i * 0.14));
      this.tone(1174.66, 0.8, 0.055, "sine", undefined, 0.5);
    }
    if (event.type === "hotelFail") this.tone(185, 0.8, 0.09, "triangle", 92.5);
    if (event.type === "jukebox") this.burst(0.18, 0.045, 1200);
    if (event.type === "cardSwap") {
      this.tone(860, 0.045, 0.045, "triangle", 480, 0, -0.12, true);
      this.tone(610, 0.06, 0.04, "triangle", 260, 0.065, 0.12, true);
    }
    if (event.type === "pokerFlush") {
      [392, 493.88, 587.33, 783.99].forEach((note, i) =>
        this.tone(note, 0.35, 0.085, "sine", undefined, i * 0.11, 0, true),
      );
      this.tone(1567.98, 0.5, 0.045, "triangle", undefined, 0.38, 0, true);
    }
    if (event.type === "knife") this.burst(0.18, 0.13, 1800);
    if (event.type === "melee") {
      if (event.weapon === "stick") {
        const stop = this.burst(0.25, 0.13, 1300, 0, () => {
          if (this.stickFallbackStop === stop) this.stickFallbackStop = null;
        });
        this.stickFallbackStop = stop ?? null;
      } else this.burst(0.25, 0.13, event.weapon === "axe" ? 700 : 1300);
    }
    if (event.type === "stickBreak") {
      this.burst(0.22, 0.4, 2600);
      this.tone(340, 0.16, 0.1, "triangle", 90);
    }
    if (event.type === "dry") this.burst(0.025, 0.12, 2600);
    if (event.type === "grenadeThrow") this.burst(0.12, 0.1, 900);
    if (event.type === "explosion") {
      this.burst(0.09, 0.55, 2400);
      this.burst(0.8, 0.4, 180);
      this.tone(110, 0.8, 0.35, "sine", 38);
    }
    if (event.type === "shot") {
      const heavy = event.weapon === "shotgun",
        rifle = event.weapon === "rifle" || event.weapon === "revolver",
        smg = event.weapon === "smg" || event.weapon === "tommy";
      if (event.weapon === "tommy") {
        this.tone(125, 0.12, 0.22, "triangle", 48);
        this.burst(0.045, 0.12, 1600);
      }
      this.burst(
        heavy ? 0.25 : rifle ? 0.18 : smg ? 0.075 : 0.14,
        heavy ? 0.75 : rifle ? 0.6 : smg ? 0.32 : 0.45,
        heavy ? 1600 : rifle ? 2200 : smg ? 3900 : 3300,
      );
      this.tone(
        heavy ? 90 : rifle ? 110 : smg ? 200 : 160,
        smg ? 0.08 : 0.14,
        0.25,
        "triangle",
        35,
      );
    }
    if (event.type === "hit")
      this.tone(event.headshot ? 1250 : 840, 0.035, 0.06, "triangle");
    if (event.type === "purchase") {
      this.tone(540, 0.25, 0.12, "sine", 1080, 0, 0, true);
    }
    if (event.type === "deny")
      this.tone(150, 0.13, 0.08, "square", 100, 0, 0, true);
    if (event.type === "reload") this.burst(0.09, 0.12, 2300);
    if (event.type === "hurt") {
      this.burst(0.18, 0.28, 350);
      this.tone(75, 0.25, 0.2);
    }
    if (event.type === "diceRoll") {
      [0, 0.13, 0.3, 0.52, 0.8].forEach((delay, i) =>
        this.tone(850 - i * 60, 0.07, 0.08, "triangle", 350, delay),
      );
      this.burst(0.6, 0.055, 1900);
    }
    if (event.type === "diceWin")
      [523.25, 659.25, 783.99].forEach((n, i) =>
        this.tone(n, 0.55, 0.12, "triangle", undefined, i * 0.13),
      );
    if (event.type === "diceCurse") {
      this.tone(155, 0.95, 0.22, "sawtooth", 42);
      this.burst(0.65, 0.14, 280);
    }
    if (event.type === "rouletteSpin") {
      // A brief ball rattle and slowing pocket ticks. The simulation owns the
      // six-second spin; scheduling only this opening flurry avoids an audio
      // timer continuing the whole spin while the game is paused.
      [0, 0.055, 0.12, 0.19, 0.275, 0.375, 0.5, 0.65, 0.83].forEach(
        (delay, i) => {
          this.tone(
            1760 - i * 95,
            0.035,
            0.045 + i * 0.003,
            "triangle",
            390,
            delay,
            Math.sin(i * 1.2) * 0.3,
          );
        },
      );
      this.burst(0.42, 0.065, 2600);
      this.tone(170, 0.8, 0.035, "sine", 75);
    }
    if (event.type === "rouletteWin") {
      // Bright, compact chip/bell reward, distinct from the dice triad.
      [659.25, 987.77, 1318.51].forEach((note, i) => {
        this.tone(note, 0.3, 0.095, "sine", undefined, i * 0.105);
        this.tone(note * 2.01, 0.12, 0.027, "triangle", undefined, i * 0.105);
      });
    }
    if (event.type === "rouletteJackpot") {
      [523.25, 659.25, 783.99, 1046.5].forEach((note, i) =>
        this.tone(note, 0.32, 0.1, "triangle", undefined, i * 0.105),
      );
      [523.25, 783.99, 1046.5].forEach((note) =>
        this.tone(note, 0.55, 0.07, "sine", undefined, 0.46),
      );
      this.burst(0.18, 0.045, 3700);
    }
    if (event.type === "rouletteMiss") {
      // A settled ball and soft falling pair, without implying another charge.
      this.burst(0.11, 0.045, 900);
      this.tone(330, 0.18, 0.065, "triangle", 245);
      this.tone(220, 0.26, 0.055, "sine", 165, 0.15);
    }
    if (event.type === "round") this.roundStinger(true);
    if (event.type === "roundClear") this.roundStinger(false);
    if (event.type === "death")
      this.tone(180, 1, 0.2, "sawtooth", 40, 0, 0, true);
  }
  updateMystery(state: CaseState | null, playing: boolean, player: WorldPosition, yaw: number) {
    if (state !== this.caseState) { this.mysterySlotVoice?.stop(); this.caseStage=""; this.caseState=state; }
    const stage = !state ? "" : !state.resolved ? "opening" : (state.closingRemaining??0)>0 ? (state.taken ? "take" : "closing") : !state.claimed && (state.offerRemaining??0)>0 ? "offer" : "";
    if (!playing || !stage) { this.mysterySlotVoice?.stop(); this.caseStage=""; return; }
    if (stage !== this.caseStage) {
      this.mysterySlotVoice?.stop();
      const offset = stage === "opening" ? CASE_OPEN_SECONDS-state!.remaining : stage === "offer" ? CASE_OFFER_SECONDS-state!.offerRemaining! : CASE_CLOSE_SECONDS-state!.closingRemaining!;
      this.playMysterySlot(stage, offset);
      if (this.mysterySlotVoice) this.caseStage=stage;
    }
    const anchor=CASINO_SECRET_ANCHORS.mysteryCabinet, distance=Math.hypot(anchor.x-player.x,anchor.z-player.z);
    const pan=Math.sin(Math.atan2(anchor.x-player.x,anchor.z-player.z)-yaw);
    this.mysterySlotVoice?.spatial?.(.65*Math.max(0,1-distance/15)**2,pan);
  }
  private playMysterySlot(cue = "opening", offset = 0) {
    const c = this.context;
    if (!c || !this.world || !this.active || c.state !== "running") return;
    this.mysterySlotVoice?.stop();
    this.slotVoice?.stop();
    const buffer=this.caseBuffers.get(cue) ?? (cue === "opening" ? this.mysterySlotBuffer : null);
    if (buffer) {
      if (cue !== "offer" && offset >= buffer.duration) return;
      const source = c.createBufferSource(), gain = c.createGain();
      source.buffer = buffer;
      source.loop = cue === "offer";
      const panner=c.createStereoPanner();
      gain.gain.value = 0.65;
      source.connect(gain);
      gain.connect(panner); panner.connect(this.world);
      let stopped=false;
      const voice = { stop: () => { if(stopped)return;stopped=true;source.stop(); cleanup(); },
        spatial:(volume:number,pan:number)=>{gain.gain.setTargetAtTime(volume,c.currentTime,.05);panner.pan.setTargetAtTime(pan,c.currentTime,.05);} };
      const cleanup = () => {
        if (this.mysterySlotVoice === voice) this.mysterySlotVoice = null;
        source.disconnect(); gain.disconnect(); panner.disconnect();
      };
      source.onended = cleanup;
      this.mysterySlotVoice = voice;
      source.start(0, source.loop ? offset % buffer.duration : offset);
      return;
    }
    if (cue !== "opening") return;
    // Short original mechanical fallback if the opening sample is unavailable.
    let remaining = 6;
    const ended = () => {
      if (--remaining === 0 && this.mysterySlotVoice === voice) this.mysterySlotVoice = null;
    };
    const stops = [0, 0.13, 0.3, 0.52, 0.8].map((delay, i) =>
      this.tone(850 - i * 60, 0.07, 0.08, "triangle", 350, delay, 0, false, ended),
    );
    stops.push(this.burst(0.6, 0.055, 1900, 0, ended));
    const voice = { stop: () => {
      for (const stop of stops) stop?.();
      if (this.mysterySlotVoice === voice) this.mysterySlotVoice = null;
    } };
    this.mysterySlotVoice = voice;
  }
  private playHotelBell() {
    const c = this.context;
    if (!c || !this.world || !this.active || c.state !== "running") return;
    this.hotelBellVoice?.stop();
    this.duckUntil = c.currentTime + 2;
    if (this.hotelBellBuffer) {
      const source = c.createBufferSource(), gain = c.createGain();
      source.buffer = this.hotelBellBuffer;
      gain.gain.value = 0.65;
      source.connect(gain);
      gain.connect(this.world);
      const voice = { stop: () => { source.stop(); cleanup(); } };
      const cleanup = () => {
        if (this.hotelBellVoice === voice) this.hotelBellVoice = null;
        source.disconnect();
        gain.disconnect();
      };
      source.onended = cleanup;
      this.hotelBellVoice = voice;
      source.start();
      return;
    }
    let remaining = 3;
    const ended = () => {
      if (--remaining === 0 && this.hotelBellVoice === voice) this.hotelBellVoice = null;
    };
    const stops = [
      this.tone(1568, 1.1, 0.15, "sine", undefined, 0, 0, false, ended),
      this.tone(2352, 0.65, 0.065, "sine", undefined, 0, 0, false, ended),
      this.tone(98, 1.6, 0.16, "triangle", 49, 0.25, 0, false, ended),
    ];
    const voice = { stop: () => {
      for (const stop of stops) stop?.();
      if (this.hotelBellVoice === voice) this.hotelBellVoice = null;
    } };
    this.hotelBellVoice = voice;
  }
  resetHotel() {
    this.hotelBellVoice?.stop();
    this.recordTimer = 0;
    this.recordStep = 0;
  }
  private roundStinger(start: boolean) {
    this.stopZombieVoices();
    this.slotVoice?.stop();
    this.duckUntil = (this.context?.currentTime ?? 0) + 2.5;
    // Original casino-horror cues: low impact and tense rising bells / falling resolution.
    this.burst(start ? 1.1 : 0.7, start ? 0.26 : 0.13, start ? 180 : 700);
    this.tone(start ? 58 : 110, 1.8, 0.26, "sine", start ? 35 : 55);
    const notes = start ? [146.83, 155.56, 220, 207.65] : [440, 329.63, 261.63];
    notes.forEach((note, i) => {
      const delay = i * (start ? 0.24 : 0.3);
      this.tone(note, 1.3, 0.13, "triangle", note * 0.985, delay);
      this.tone(note * 2.01, 0.85, 0.04, "sine", undefined, delay);
    });
  }
  /** A restrained room bed plus spatial machine/chip details, all original synthesis. */
  update(
    dt: number,
    playing: boolean,
    player: WorldPosition,
    yaw: number,
    moving: boolean,
    sprinting: boolean,
  ) {
    this.listener.player = player;
    this.listener.yaw = yaw;
    const c = this.context;
    if (!c || !this.master || !this.ambience || !this.ambienceFilter) return;
    if (playing !== this.active) this.setActive(playing);
    const hotel = player.z > 12;
    const tables = !hotel && player.x > 28,
      staff = !hotel && player.x > 4 && player.x < 16 && player.z > 3;
    const duck = c.currentTime < this.duckUntil ? 0.3 : 1;
    this.ambience.gain.setTargetAtTime(
      playing ? (hotel ? 0.024 : staff ? 0.09 : 0.045) * duck : 0,
      c.currentTime,
      0.3,
    );
    this.ambienceFilter.frequency.setTargetAtTime(
      hotel ? 190 : staff ? 680 : tables ? 240 : 380,
      c.currentTime,
      0.5,
    );
    if (!playing) return;
    this.updateSlots(dt, player, yaw, moving);
    for (const voice of this.zombieVoices.values()) {
      if (voice.kind !== "death" && (voice.enemy.health ?? 1) <= 0) {
        voice.stop();
        continue;
      }
      const spatial = this.zombieSpatial(voice.kind, player, voice.enemy, yaw);
      voice.panner.pan.setTargetAtTime(spatial.pan, c.currentTime, 0.08);
      voice.gain.gain.setTargetAtTime(spatial.gain * duck, c.currentTime, 0.12);
    }
    this.ambientTimer -= dt;
    this.footTimer -= dt;
    if (moving && this.footTimer <= 0) {
      this.burst(
        0.085,
        hotel && (player.y ?? 0) < 3.9 ? 0.03 : staff ? 0.035 : 0.018,
        hotel && (player.y ?? 0) < 3.9 ? 1100 : staff ? 1400 : 410,
        Math.sin(player.x + player.z) * 0.2,
      );
      this.footTimer = sprinting ? 0.29 : 0.43;
    }
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 7 + Math.random() * 7;
    if (hotel) {
      // Distant service crockery and an old elevator chime, never a nearby
      // false enemy cue. The music has its own attenuated source below.
      const pan = Math.sin(Math.atan2(-4 - player.x, 49 - player.z) - yaw);
      this.burst(0.12, 0.013 * duck, 2400, pan);
      this.tone(587.33, 0.65, 0.01 * duck, "sine", undefined, 0.13, pan);
      this.tone(440, 0.8, 0.008 * duck, "sine", undefined, 0.42, pan);
      return;
    }
    // Actual cabinet pass-bys replace the old room-wide slot melody.
    if (player.x < 4) return;
    const source = tables ? { x: 35, z: 5 } : { x: 12, z: -9 };
    const distance = Math.hypot(source.x - player.x, source.z - player.z);
    const level = 0.045 * Math.max(0.1, 1 - distance / 18) * duck;
    const pan = Math.sin(
      Math.atan2(source.x - player.x, source.z - player.z) - yaw,
    );
    this.burst(tables ? 0.5 : 0.15, level, tables ? 1800 : 2800, pan);
    this.tone(tables ? 880 : 1200, 0.35, level * 0.5, "sine", undefined, 0.15, pan);
  }
  private updateSlots(dt: number, player: V2, yaw: number, moving: boolean) {
    const c = this.context!;
    const suppressed = c.state !== "running" || c.currentTime < this.duckUntil ||
      this.zombieVoices.size > 0 || !!this.mysterySlotVoice;
    const cue = this.slotDirector.update(dt, {
      playing: this.active, player, moving, suppressed: suppressed || !!this.slotVoice,
    });
    if (cue && this.slotBuffers.length) {
      const variant = (cue.variant + this.slotSequence++) % this.slotBuffers.length;
      const source = c.createBufferSource(), gain = c.createGain(),
        panner = c.createStereoPanner(), filter = c.createBiquadFilter();
      source.buffer = this.slotBuffers[variant];
      gain.gain.value = 0;
      filter.type = "lowpass";
      filter.Q.value = 0.55;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.world!);
      const voice = {
        stop: () => { source.stop(); cleanup(); },
        source: cue.source, gain, panner, filter,
      };
      const cleanup = () => {
        if (this.slotVoice === voice) this.slotVoice = null;
        source.disconnect();
        gain.disconnect();
        panner.disconnect();
        filter.disconnect();
      };
      source.onended = cleanup;
      this.slotVoice = voice;
      this.lastSlotPlayback = `${cue.source.id} · ${SLOT_SOUND_NAMES[variant]}`;
      source.start();
    }
    const voice = this.slotVoice;
    if (voice) {
      const distance = Math.hypot(voice.source.x - player.x, voice.source.z - player.z);
      const pan = Math.sin(Math.atan2(voice.source.x - player.x, voice.source.z - player.z) - yaw);
      voice.panner.pan.setTargetAtTime(pan, c.currentTime, 0.06);
      const audible = slotSourceAudible(voice.source, player, 5);
      voice.gain.gain.setTargetAtTime(audible ? 0.65 * Math.pow(Math.max(0, 1 - distance / 5), 1.4) : 0, c.currentTime, 0.06);
      voice.filter.frequency.setTargetAtTime(Math.max(900, 3800 - distance * 450), c.currentTime, 0.08);
    }
  }
  resetSlots() {
    this.caseStage=""; this.caseState=null;
    this.stickFallbackStop?.();
    this.mysterySlotVoice?.stop();
    this.weapons.stop();
    this.weaponCues.reset();
    this.slotVoice?.stop();
    this.slotDirector.reset();
    this.slotSequence = 0;
    this.lastSlotPlayback = "none";
  }
  /** Original swung lounge instrumental; driven by gameplay frames, no timers. */
  updateHotel(dt: number, playing: boolean, jukeboxOn: boolean, player: WorldPosition, yaw: number) {
    if (!jukeboxOn) { this.recordTimer = 0; this.recordStep = 0; return; }
    if (!playing || !this.context || this.context.state !== "running") return;
    this.recordTimer -= dt;
    if (this.recordTimer > 0) return;
    const step = this.recordStep++ % 64;
    // Two swung eighth notes per beat at 96 BPM.
    this.recordTimer += step % 2 ? 0.2083 : 0.4167;
    const box = HOTEL_FIXTURES.find(f => f.kind === "jukebox")!;
    const dx = box.x - player.x, dz = box.z - player.z;
    const distance = Math.hypot(dx, dz, player.y ?? 0);
    const level = 0.075 * Math.max(0, 1 - distance / 24) ** 1.6
      * ((player.y ?? 0) > 3.8 ? 0.25 : 1)
      * (player.z < 12 ? 0.18 : 1)
      * (this.context.currentTime < this.duckUntil ? 0.25 : 1);
    if (level < 0.002) return;
    const pan = Math.sin(Math.atan2(dx, dz) - yaw) * 0.8;
    const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
    const chords = [[48, 55, 58, 63], [53, 60, 63, 68], [50, 57, 60, 65], [43, 53, 59, 62]];
    const chord = chords[Math.floor(step / 16)];
    const melody = [75, 0, 72, 70, 67, 0, 70, 72, 75, 79, 77, 0, 75, 72, 70, 0,
      77, 0, 75, 72, 68, 0, 72, 75, 77, 80, 79, 77, 75, 0, 72, 0,
      77, 0, 74, 72, 69, 0, 72, 74, 77, 81, 79, 0, 77, 74, 72, 0,
      74, 0, 71, 69, 67, 0, 65, 62, 71, 74, 77, 0, 74, 71, 67, 0];
    if (melody[step]) {
      const f = frequency(melody[step]);
      this.tone(f, 0.27, level * 0.55, "triangle", f * 0.998, 0, pan);
      this.tone(f * 2, 0.11, level * 0.1, "sine", undefined, 0, pan);
    }
    if (step % 4 === 0) {
      this.tone(frequency(chord[0] - (step % 8 ? 5 : 12)), 0.4, level * 0.85, "sine", undefined, 0, pan);
      for (const note of chord.slice(1)) this.tone(frequency(note), 0.28, level * 0.22, "triangle", undefined, 0.012, pan);
    }
    if (step % 4 === 2) this.burst(0.045, level * 0.13, 3300, pan);
  }
  private zombieSpatial(kind: ZombieCue, player: WorldPosition, enemy: WorldPosition, yaw: number) {
    const distance = Math.hypot(enemy.x - player.x, enemy.z - player.z, (enemy.y ?? 0) - (player.y ?? 0));
    return {
      pan: Math.sin(Math.atan2(enemy.x - player.x, enemy.z - player.z) - yaw),
      gain: (kind === "horde" ? 0.34 : kind === "last" ? 0.52 : kind === "death" ? 0.4 : 0.48) *
        Math.max(0, 1 - distance / (kind === "last" ? 24 : 18)),
    };
  }
  canPlayZombieCue() {
    const c = this.context;
    return !!(c && this.world && this.active && c.state === "running" &&
      c.currentTime >= this.duckUntil && this.zombieVoices.size === 0);
  }
  zombieCue(kind: ZombieCue, player: WorldPosition, enemy: ZombieSource, yaw: number, variant = 0) {
    const c = this.context;
    if (!c || !this.world || !this.canPlayZombieCue() ||
        (kind !== "death" && (enemy.health ?? 1) <= 0)) return false;
    const spatial = this.zombieSpatial(kind, player, enemy, yaw);
    if (spatial.gain <= 0) return false;
    this.slotVoice?.stop();
    const choices = ZOMBIE_SOUNDS[kind].filter((name) => this.zombieBuffers.has(name));
    let candidates = choices;
    if (kind === "last") {
      // Give every survivor scream a turn before starting another cycle.
      const unused = choices.filter((name) => !this.playedLastZombieSamples.has(name));
      if (unused.length) candidates = unused;
      else this.playedLastZombieSamples.clear();
    }
    const alternatives = candidates.filter((name) => name !== this.lastZombieSample[kind]);
    const pool = alternatives.length ? alternatives : candidates;
    const name = pool[Math.abs(Math.floor(variant)) % pool.length];
    if (!name) {
      this.lastZombiePlayback = `${kind} (synth fallback)`;
      this.synthesizedThreat(kind, player, enemy, yaw, variant);
      return true;
    }
    const source = c.createBufferSource(), gain = c.createGain(),
      panner = c.createStereoPanner();
    source.buffer = this.zombieBuffers.get(name)!;
    // Tiny pitch variation preserves the performance without cartoon squeaks.
    source.playbackRate.value = 0.98 + (Math.abs(variant) % 5) * 0.01;
    gain.gain.value = spatial.gain;
    panner.pan.value = spatial.pan;
    source.connect(gain);
    gain.connect(panner);
    panner.connect(this.world);
    // Baked short fades keep these voices dry and leave the casino mix room.
    const cleanup = () => {
      this.zombieVoices.delete(source);
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    source.onended = cleanup;
    this.zombieVoices.set(source, {
      stop: () => { source.stop(); cleanup(); }, enemy, kind, gain, panner,
    });
    this.lastZombieSample[kind] = name;
    if (kind === "last") this.playedLastZombieSamples.add(name);
    source.start();
    this.lastZombiePlayback = `${kind} (AI clip)`;
    return true;
  }
  zombieAttack(player: WorldPosition, enemy: ZombieSource, yaw: number) {
    const c = this.context;
    if (!c || !this.active || c.state !== "running" || (enemy.health ?? 1) <= 0 ||
        this.zombieSpatial("attack", player, enemy, yaw).gain <= 0 ||
        c.currentTime < Math.max(this.nextZombieAttack, this.duckUntil) ||
        [...this.zombieVoices.values()].some(voice => voice.kind === "attack")) return;
    // An actual attack must not wait behind a long chase or survivor performance.
    this.stopZombieVoices();
    if (this.zombieCue("attack", player, enemy, yaw))
      this.nextZombieAttack = c.currentTime + 1.6;
  }
  zombieDeath(player: WorldPosition, position: WorldPosition, yaw: number) {
    // Kill events retain a position even after the enemy leaves the simulation.
    // Cancel a dying source's unfinished performance before applying throttles.
    for (const voice of this.zombieVoices.values())
      if (voice.kind !== "death" && (voice.enemy.health ?? 1) <= 0) voice.stop();
    const c = this.context;
    if (!c || !this.active || c.state !== "running" ||
        this.zombieSpatial("death", player, position, yaw).gain <= 0 ||
        c.currentTime < Math.max(this.nextZombieDeath, this.duckUntil) ||
        [...this.zombieVoices.values()].some(voice => voice.kind === "attack" || voice.kind === "death")) return;
    this.stopZombieVoices();
    if (this.zombieCue("death", player, { ...position }, yaw))
      this.nextZombieDeath = c.currentTime + 1.2;
  }
  private stopZombieVoices() {
    for (const voice of [...this.zombieVoices.values()]) voice.stop();
  }
  resetZombies() {
    this.stopZombieVoices();
    this.nextZombieAttack = 0;
    this.nextZombieDeath = 0;
    this.lastZombieSample = {};
    this.playedLastZombieSamples.clear();
    this.lastZombiePlayback = "none";
    this.duckUntil = 0;
  }
  private synthesizedThreat(kind: ZombieCue, player: WorldPosition, enemy: ZombieSource, yaw: number, variant = 0) {
    const c = this.context;
    if (!c || !this.master || c.state !== "running") return;
    const attack = kind === "attack";
    const spatial = this.zombieSpatial(kind, player, enemy, yaw);
    const volume = attack ? 0.375 : 0.25;
    const duration = attack ? 0.42 : 0.8 + (variant % 3) * 0.16;
    const stopBurst = this.burst(duration, volume * spatial.gain * 0.6, attack ? 1200 : 520, spatial.pan);
    const voice = c.createOscillator(),
      formant = c.createBiquadFilter(),
      gain = c.createGain(),
      spatialGain = c.createGain(),
      panner = c.createStereoPanner();
    const vibrato = c.createOscillator(),
      depth = c.createGain();
    const pitch = (attack ? 105 : 62) + (variant % 5) * 7;
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(pitch, c.currentTime);
    voice.frequency.exponentialRampToValueAtTime(
      pitch * 0.58,
      c.currentTime + duration,
    );
    formant.type = "bandpass";
    formant.frequency.setValueAtTime(
      attack ? 780 : 400 + (variant % 3) * 90,
      c.currentTime,
    );
    formant.frequency.exponentialRampToValueAtTime(
      230,
      c.currentTime + duration,
    );
    formant.Q.value = 1.2;
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    panner.pan.value = spatial.pan;
    spatialGain.gain.value = spatial.gain;
    vibrato.frequency.value = 6 + (variant % 3);
    depth.gain.value = 9;
    vibrato.connect(depth);
    depth.connect(voice.frequency);
    voice.connect(formant);
    formant.connect(gain);
    gain.connect(spatialGain);
    spatialGain.connect(panner);
    panner.connect(this.world!);
    if (this.reverb) panner.connect(this.reverb);
    voice.start();
    vibrato.start();
    voice.stop(c.currentTime + duration);
    vibrato.stop(c.currentTime + duration);
    const cleanup = () => {
      this.zombieVoices.delete(voice);
      stopBurst?.();
      voice.disconnect();
      vibrato.disconnect();
      depth.disconnect();
      formant.disconnect();
      gain.disconnect();
      spatialGain.disconnect();
      panner.disconnect();
    };
    voice.onended = cleanup;
    this.zombieVoices.set(voice, {
      stop: () => { voice.stop(); vibrato.stop(); cleanup(); },
      enemy, kind, gain: spatialGain, panner,
    });
  }
  dispose() {
    this.mysterySlotFetch?.abort();
    this.mysterySlotBuffer = null;
    this.caseBuffers.clear();
    this.mysterySlotLoading = null;
    this.resetHotel();
    this.hotelBellFetch?.abort();
    this.hotelBellBuffer = null;
    this.hotelBellLoading = null;
    this.resetSlots();
    this.weapons.dispose();
    this.slotBuffers = [];
    this.stopZombieVoices();
    this.zombieFetch?.abort();
    this.zombieBuffers.clear();
    this.zombieLoading = null;
    for (const source of this.loops) {
      source.stop();
      source.disconnect();
    }
    this.loops = [];
    void this.context?.close();
    this.context = null;
  }
}
