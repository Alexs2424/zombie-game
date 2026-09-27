import type { GameEvent, V2 } from "./simulation";
export class GameAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  volume = 0.45;
  private noise: AudioBuffer | null = null;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.noise = this.context.createBuffer(
        1,
        this.context.sampleRate * 0.5,
        this.context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === "suspended") await this.context.resume();
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    end?: number,
  ) {
    const c = this.context;
    if (!c || !this.master || c.state !== "running") return;
    const oscillator = c.createOscillator(),
      gain = c.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, c.currentTime);
    if (end)
      oscillator.frequency.exponentialRampToValueAtTime(
        end,
        c.currentTime + duration,
      );
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    oscillator.stop(c.currentTime + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
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
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
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
    if (event.type === "shot") {
      const heavy = event.weapon === "shotgun";
      this.burst(heavy ? 0.25 : 0.14, heavy ? 0.8 : 0.5, heavy ? 1600 : 3300);
      this.tone(heavy ? 90 : 160, 0.14, 0.35, "triangle", 35);
    }
    if (event.type === "hit")
      this.tone(event.headshot ? 1250 : 840, 0.035, 0.06, "triangle");
    if (event.type === "purchase") {
      this.tone(540, 0.25, 0.12, "sine", 1080);
    }
    if (event.type === "deny") this.tone(150, 0.13, 0.08, "square", 100);
    if (event.type === "reload") this.burst(0.09, 0.12, 2300);
    if (event.type === "hurt") {
      this.burst(0.18, 0.28, 350);
      this.tone(75, 0.25, 0.2);
    }
    if (event.type === "round") this.tone(220, 0.7, 0.1, "triangle", 440);
    if (event.type === "death") this.tone(180, 1, 0.2, "sawtooth", 40);
  }
  threat(player: V2, enemy: V2, yaw: number) {
    const distance = Math.hypot(enemy.x - player.x, enemy.z - player.z);
    if (distance > 12) return;
    const angle = Math.atan2(enemy.x - player.x, enemy.z - player.z) - yaw;
    this.burst(0.25, 0.09 * (1 - distance / 14), 240, Math.sin(angle));
  }
  dispose() {
    void this.context?.close();
    this.context = null;
  }
}
