/** Original cabinet attract sounds: soft reel mechanisms and worn electronic bells. */
export const SLOT_SOUND_NAMES = ["reel chatter", "sleepy chimes", "coin tray"] as const;

export function slotSoundSamples(sampleRate: number, variant: number): Float32Array {
  const kind = ((variant % 3) + 3) % 3;
  const samples = new Float32Array(Math.ceil(sampleRate * 1.45));
  const notes = [
    [440, 554.37],
    [523.25, 659.25, 587.33],
    [493.88, 392],
  ][kind];
  const ticks = kind === 2 ? [0.05, 0.13, 0.26, 0.4, 0.53] : [0.08, 0.21, 0.38];
  let seed = 713 + kind * 491;
  let softNoise = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    softNoise += 0.22 * (seed / 2147483648 - 1 - softNoise);
    // Low rolling motor under a few irregular, padded reel stops.
    const motorEnvelope = Math.min(1, t / 0.04) * Math.max(0, 1 - t / 0.68);
    let sample = motorEnvelope * (0.032 * softNoise +
      0.012 * Math.sin(2 * Math.PI * (83 * t - 9 * t * t)));
    for (const tick of ticks) {
      const age = t - tick;
      if (age >= 0 && age < 0.065) {
        sample += 0.035 * Math.sin(Math.PI * Math.min(1, age / 0.004) / 2) *
          Math.exp(-age / 0.013) * Math.sin(2 * Math.PI * (kind === 2 ? 1150 : 740) * age);
      }
    }
    for (let note = 0; note < notes.length; note++) {
      const age = t - (0.31 + note * 0.22);
      if (age < 0) continue;
      const attack = Math.min(1, age / 0.014);
      // The last note gently sags, like a tired machine still trying to attract a guest.
      const phase = 2 * Math.PI * notes[note] * (age - (note === notes.length - 1 ? 0.008 : 0) * age * age);
      sample += attack * Math.exp(-age / 0.19) *
        (0.14 * Math.sin(phase) + 0.025 * Math.sin(phase * 2.006));
    }
    const fade = Math.min(1, t / 0.012, (samples.length - 1 - i) / (sampleRate * 0.06));
    samples[i] = sample * Math.max(0, fade);
  }
  return samples;
}
