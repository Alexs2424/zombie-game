import test from "node:test";
import assert from "node:assert/strict";
import { GameAudio } from "../lib/game/audio.ts";

// A graph-only Web Audio double: checks bus routing and immediate pause behavior,
// without claiming to measure the sound of the synthesized effects.
class Param {
  value = 0;
  setValueAtTime(v) {
    this.value = v;
  }
  setTargetAtTime(v) {
    this.value = v;
  }
  linearRampToValueAtTime(v) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v) {
    this.value = v;
  }
}
class AudioNode {
  outputs = [];
  gain = new Param();
  frequency = new Param();
  pan = new Param();
  Q = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  connect(node) {
    this.outputs.push(node);
    return node;
  }
  disconnect() {
    this.outputs = [];
  }
  start() {}
  stop() {
    this.stopped = true;
  }
}
class AudioContextDouble {
  currentTime = 10;
  sampleRate = 8000;
  state = "running";
  destination = new AudioNode();
  nodes = [];
  node(kind) {
    const n = new AudioNode();
    n.kind = kind;
    this.nodes.push(n);
    return n;
  }
  createGain() {
    return this.node("gain");
  }
  createDynamicsCompressor() {
    return this.node("compressor");
  }
  createConvolver() {
    return this.node("reverb");
  }
  createBufferSource() {
    return this.node("source");
  }
  createBiquadFilter() {
    return this.node("filter");
  }
  createOscillator() {
    return this.node("oscillator");
  }
  createStereoPanner() {
    return this.node("panner");
  }
  createBuffer(channels, length) {
    const data = Array.from(
      { length: channels },
      () => new Float32Array(length),
    );
    return { getChannelData: (channel) => data[channel] };
  }
  async close() {
    this.state = "closed";
  }
}
async function fixture(run) {
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = AudioContextDouble;
  const audio = new GameAudio();
  try {
    await audio.unlock();
    await run(audio);
  } finally {
    audio.dispose();
    globalThis.AudioContext = previous;
  }
}

test("pause silences world audio immediately while preserving shop and death cues", async () => {
  await fixture((audio) => {
    audio.setActive(true);
    audio.play({ type: "shot", weapon: "pistol" });
    const context = audio.context;
    const shotOutput = context.nodes.findLast((n) => n.kind === "panner");
    const worldBus = shotOutput.outputs.find((n) => n.kind === "gain");
    assert.equal(worldBus.gain.value, 1);
    // No render/update call: a hidden tab can stop requestAnimationFrame.
    audio.setActive(false);
    assert.equal(worldBus.gain.value, 0);
    assert.equal(audio.master.gain.value, 0.45);
    for (const type of ["purchase", "deny", "death"]) {
      audio.play({ type });
      const output = context.nodes.findLast((n) => n.kind === "panner");
      assert.deepEqual(output.outputs, [audio.master]);
    }
    audio.setVolume(0.2);
    assert.equal(audio.master.gain.value, 0.2);
    assert.equal(worldBus.gain.value, 0);
    audio.setActive(true);
    assert.equal(worldBus.gain.value, 1);
  });
});

test("ambient sources persist through pause and are stopped when the game disposes", async () => {
  await fixture((audio) => {
    const context = audio.context;
    const loops = context.nodes.filter(
      (n) => n.kind === "source" || n.kind === "oscillator",
    );
    assert.equal(loops.length, 3);
    audio.update(0.1, true, { x: 35, z: 0 }, 0, false, false);
    audio.setActive(false);
    assert.ok(loops.every((n) => !n.stopped));
    audio.dispose();
    assert.ok(loops.every((n) => n.stopped));
    assert.equal(context.state, "closed");
  });
});
