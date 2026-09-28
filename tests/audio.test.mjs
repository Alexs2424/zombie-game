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
  start(time) {
    this.startTime = time;
  }
  stop(time) {
    this.stopTime = time;
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

test("roulette cues follow world pause routing and schedule only a brief opening rattle", async () => {
  await fixture((audio) => {
    audio.setActive(true);
    const context = audio.context;
    const outputs = [];
    for (const type of ["rouletteSpin", "rouletteWin", "rouletteJackpot", "rouletteMiss"]) {
      const before = context.nodes.length;
      audio.play({ type });
      const created = context.nodes.slice(before);
      const panners = created.filter((n) => n.kind === "panner");
      assert.ok(panners.length > 0, `${type} creates an audible cue`);
      for (const panner of panners) {
        const world = panner.outputs.find((n) => n.kind === "gain");
        assert.ok(world);
        assert.notEqual(world, audio.master, `${type} must not bypass world mute`);
        assert.equal(world.gain.value, 1);
        assert.ok(!panner.outputs.includes(audio.master));
        outputs.push(world);
      }
      if (type === "rouletteSpin") {
        const sources = created.filter((n) => n.kind === "source" || n.kind === "oscillator");
        assert.ok(sources.length > 0);
        assert.ok(sources.every((n) => n.stopTime <= context.currentTime + 1));
      }
    }
    // No render frame is needed to silence even a previously scheduled flurry.
    audio.setActive(false);
    assert.ok(outputs.every((world) => world.gain.value === 0));
    assert.equal(audio.master.gain.value, 0.45);
    audio.setActive(true);
    assert.ok(outputs.every((world) => world.gain.value === 1));
  });
});

test("card swaps and flush rewards stay audible on the UI bus while the world is paused", async () => {
  await fixture((audio) => {
    const context = audio.context;
    audio.setActive(true);
    audio.play({ type: "shot", weapon: "pistol" });
    const world = context.nodes
      .findLast((node) => node.kind === "panner")
      .outputs.find((node) => node.kind === "gain");
    audio.setActive(false);
    audio.setVolume(0.2);

    for (const type of ["cardSwap", "pokerFlush"]) {
      const before = context.nodes.length;
      audio.play({ type });
      const created = context.nodes.slice(before);
      const panners = created.filter((node) => node.kind === "panner");
      const sources = created.filter((node) => node.kind === "oscillator");
      assert.ok(panners.length > 0, `${type} creates a cue`);
      assert.ok(sources.length > 0);
      for (const output of panners)
        assert.deepEqual(output.outputs, [audio.master], `${type} uses only the UI bus`);
      assert.equal(world.gain.value, 0);
      assert.equal(audio.master.gain.value, 0.2);
      assert.ok(sources.every((source) =>
        source.startTime >= context.currentTime &&
        Number.isFinite(source.stopTime) &&
        source.stopTime > source.startTime,
      ));

      // The browser's ended callbacks release each short-lived cue graph.
      for (const source of sources) source.onended();
      assert.ok(created.every((node) => node.outputs.length === 0));
    }
  });
});

test("disposing during poker cues closes their context and prevents further scheduling", async () => {
  await fixture((audio) => {
    const context = audio.context;
    const ambientSources = context.nodes.filter(
      (node) => node.kind === "source" || node.kind === "oscillator",
    );
    audio.setActive(false);
    audio.play({ type: "cardSwap" });
    audio.play({ type: "pokerFlush" });
    const nodeCount = context.nodes.length;

    // Dispose before the queued flush melody finishes, without another frame.
    audio.dispose();
    assert.equal(context.state, "closed");
    assert.equal(audio.context, null);
    assert.ok(ambientSources.every((source) =>
      source.stopped && source.outputs.length === 0,
    ));
    audio.play({ type: "cardSwap" });
    audio.play({ type: "pokerFlush" });
    assert.equal(context.nodes.length, nodeCount);
    assert.doesNotThrow(() => audio.dispose());
  });
});
