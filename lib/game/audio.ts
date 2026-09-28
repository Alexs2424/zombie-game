import type { GameEvent, V2 } from "./simulation";
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
  private voices = 0;
  private duckUntil = 0;
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
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(v, this.context.currentTime, 0.035);
  }
  setActive(playing: boolean) {
    this.active = playing;
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
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  }
  private burst(duration: number, volume: number, frequency: number, pan = 0) {
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
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  }
  play(event: GameEvent) {
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
    if (event.type === "grenadeThrow") this.burst(0.12, 0.1, 900);
    if (event.type === "explosion") {
      this.burst(0.65, 0.45, 220);
      this.tone(90, 0.7, 0.3, "sine", 25);
    }
    if (event.type === "shot") {
      const heavy = event.weapon === "shotgun",
        rifle = event.weapon === "rifle" || event.weapon === "revolver",
        smg = event.weapon === "smg";
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
  private roundStinger(start: boolean) {
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
    player: V2,
    yaw: number,
    moving: boolean,
    sprinting: boolean,
  ) {
    const c = this.context;
    if (!c || !this.master || !this.ambience || !this.ambienceFilter) return;
    if (playing !== this.active) this.setActive(playing);
    const tables = player.x > 28,
      staff = player.x > 4 && player.x < 16 && player.z > 3;
    const duck = c.currentTime < this.duckUntil ? 0.3 : 1;
    this.ambience.gain.setTargetAtTime(
      playing ? (staff ? 0.09 : 0.045) * duck : 0,
      c.currentTime,
      0.3,
    );
    this.ambienceFilter.frequency.setTargetAtTime(
      staff ? 680 : tables ? 240 : 380,
      c.currentTime,
      0.5,
    );
    if (!playing) return;
    this.ambientTimer -= dt;
    this.footTimer -= dt;
    if (moving && this.footTimer <= 0) {
      this.burst(
        0.085,
        staff ? 0.035 : 0.018,
        staff ? 1400 : 410,
        Math.sin(player.x + player.z) * 0.2,
      );
      this.footTimer = sprinting ? 0.29 : 0.43;
    }
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 7 + Math.random() * 7;
    const source =
      player.x < 4
        ? { x: -7, z: 0 }
        : tables
          ? { x: 35, z: 5 }
          : { x: 12, z: -9 };
    const distance = Math.hypot(source.x - player.x, source.z - player.z);
    const level = 0.045 * Math.max(0.1, 1 - distance / 18) * duck;
    const pan = Math.sin(
      Math.atan2(source.x - player.x, source.z - player.z) - yaw,
    );
    if (player.x < 4) {
      [659.25, 783.99, 987.77].forEach((n, i) =>
        this.tone(n, 0.55, level, "sine", undefined, i * 0.2, pan),
      );
      this.tone(1318.5, 0.8, level * 0.3, "sine", undefined, 0.4, pan);
    } else {
      this.burst(tables ? 0.5 : 0.15, level, tables ? 1800 : 2800, pan);
      this.tone(
        tables ? 880 : 1200,
        0.35,
        level * 0.5,
        "sine",
        undefined,
        0.15,
        pan,
      );
    }
  }
  threat(player: V2, enemy: V2, yaw: number, variant = 0, attack = false) {
    const c = this.context;
    if (!c || !this.master || c.state !== "running" || this.voices >= 4) return;
    const distance = Math.hypot(enemy.x - player.x, enemy.z - player.z);
    if (distance > 18) return;
    const pan = Math.sin(
      Math.atan2(enemy.x - player.x, enemy.z - player.z) - yaw,
    );
    const volume = (attack ? 0.18 : 0.12) * Math.max(0.08, 1 - distance / 19);
    const duration = attack ? 0.42 : 0.8 + (variant % 3) * 0.16;
    this.burst(duration, volume * 0.6, attack ? 1200 : 520, pan);
    const voice = c.createOscillator(),
      formant = c.createBiquadFilter(),
      gain = c.createGain(),
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
    panner.pan.value = pan;
    vibrato.frequency.value = 6 + (variant % 3);
    depth.gain.value = 9;
    vibrato.connect(depth);
    depth.connect(voice.frequency);
    voice.connect(formant);
    formant.connect(gain);
    gain.connect(panner);
    panner.connect(this.world!);
    if (this.reverb) panner.connect(this.reverb);
    this.voices++;
    voice.start();
    vibrato.start();
    voice.stop(c.currentTime + duration);
    vibrato.stop(c.currentTime + duration);
    voice.onended = () => {
      this.voices--;
      voice.disconnect();
      vibrato.disconnect();
      depth.disconnect();
      formant.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  }
  dispose() {
    for (const source of this.loops) {
      source.stop();
      source.disconnect();
    }
    this.loops = [];
    void this.context?.close();
    this.context = null;
  }
}
