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
  playbackRate = new Param();
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
  async decodeAudioData(data) {
    return { duration: 3, name: new TextDecoder().decode(data) };
  }
  async close() {
    this.state = "closed";
  }
}
async function fixture(run, samples = false) {
  const previous = globalThis.AudioContext;
  const previousFetch = globalThis.fetch;
  globalThis.AudioContext = AudioContextDouble;
  globalThis.fetch = async (url) => ({
    ok: samples,
    arrayBuffer: async () => new TextEncoder().encode(url).buffer,
  });
  const audio = new GameAudio();
  try {
    await audio.unlock();
    await audio.zombieLoading;
    await run(audio);
  } finally {
    audio.dispose();
    globalThis.AudioContext = previous;
    globalThis.fetch = previousFetch;
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

const player = { x: 0, z: 0 };
test("jukebox is opt-in, local, and cannot schedule music while paused", async () => {
  await fixture((audio) => {
    audio.setActive(true);
    const count = () => audio.context.nodes.filter(n => n.kind === "oscillator").length;
    const near = { x: 11, y: 0, z: 25 };
    const baseline = count();
    audio.updateHotel(1, true, false, near, 0);
    audio.updateHotel(1, false, true, near, 0);
    assert.equal(count(), baseline);
    audio.updateHotel(.05, true, true, near, 0);
    assert.ok(count() > baseline);
    const sounding = count();
    const outputs = audio.context.nodes.filter(n => n.kind === "panner").slice(-6);
    assert.ok(outputs.every(n => n.outputs.includes(audio.world)));
    audio.setActive(false);
    audio.updateHotel(20, false, true, near, 0);
    assert.equal(count(), sounding);
    assert.equal(audio.world.gain.value, 0);
    audio.updateHotel(1, true, false, near, 0);
    audio.setActive(true);
    audio.updateHotel(.05, true, true, { x: -9, y: 0, z: -8 }, 0);
    assert.equal(count(), sounding, "distant casino does not schedule inaudible music");
  });
});

test("hotel bell and reward cues use the pausable world bus with finite notes", async () => {
  await fixture((audio) => {
    audio.setActive(true);
    for (const type of ["hotelBell", "hotelComplete", "hotelFail", "jukebox"]) audio.play({ type });
    const output = audio.context.nodes.findLast(n => n.kind === "panner");
    assert.ok(output.outputs.includes(audio.world));
    const notes = audio.context.nodes.filter(n => n.kind === "oscillator" && n.stopTime !== undefined);
    assert.ok(notes.length > 0);
    assert.ok(notes.every(n => Number.isFinite(n.stopTime) && n.stopTime <= audio.context.currentTime + 2));
    audio.setActive(false);
    assert.equal(audio.world.gain.value, 0);
  });
});

const sampledSources = (audio) => audio.context.nodes.filter(
  (node) => node.kind === "source" && node.buffer?.name,
);

test("sampled zombie voices are local, spatial, restrained, and limited to one", async () => {
  await fixture((audio) => {
    assert.equal(audio.zombieBuffers.size, 3);
    audio.setActive(true);
    const enemy = { x: 3, z: 0 };
    audio.zombieCue("chase", player, enemy, 0, 2);
    const [source] = sampledSources(audio);
    assert.match(source.buffer.name, /^\/audio\/zombies\/chase-0[12]\.wav$/);
    const gain = source.outputs[0];
    const panner = gain.outputs[0];
    const world = panner.outputs[0];
    assert.ok(gain.gain.value > 0 && gain.gain.value < 0.5);
    assert.equal(panner.pan.value, 1);
    assert.equal(world.gain.value, 1);
    audio.zombieCue("horde", player, enemy, 0);
    audio.zombieAttack(player, enemy, 0);
    assert.equal(sampledSources(audio).length, 1);
    const oscillatorCount = audio.context.nodes.filter((n) => n.kind === "oscillator").length;
    assert.equal(oscillatorCount, 2); // only the two room-hum oscillators
    enemy.x = -3;
    audio.update(0.1, true, player, 0, false, false);
    assert.equal(panner.pan.value, -1);
    audio.setActive(false);
    assert.equal(source.stopped, true);
    assert.equal(audio.zombieVoices.size, 0);
    assert.equal(world.gain.value, 0);
    audio.setActive(true);
    assert.equal(audio.zombieVoices.size, 0); // no stale voice resumes
  }, true);
});

test("zombie cues vary pitch and honor stinger priority and fresh-run reset", async () => {
  await fixture((audio) => {
    audio.setActive(true);
    audio.zombieCue("last", player, { x: 1, z: 0 }, 0, 1);
    const first = sampledSources(audio)[0];
    first.onended();
    audio.zombieCue("last", player, { x: 1, z: 0 }, 0, 2);
    const second = sampledSources(audio)[1];
    assert.notEqual(first.playbackRate.value, second.playbackRate.value);
    audio.play({ type: "roundClear" });
    assert.equal(second.stopped, true);
    audio.zombieCue("horde", player, { x: 1, z: 0 }, 0);
    assert.equal(sampledSources(audio).length, 2);
    audio.resetZombies();
    audio.zombieCue("horde", player, { x: 1, z: 0 }, 0);
    assert.equal(sampledSources(audio).length, 3);
    audio.dispose();
    assert.equal(audio.zombieVoices.size, 0);
    assert.equal(audio.zombieBuffers.size, 0);
  }, true);
});

test("missing samples degrade safely and swarm attack events are rate limited", async () => {
  await fixture((audio) => {
    assert.equal(audio.zombieBuffers.size, 0);
    const count = () => audio.context.nodes.filter((n) => n.kind === "oscillator").length;
    audio.zombieCue("chase", player, { x: 2, z: 0 }, 0);
    assert.equal(count(), 2); // inactive
    audio.setActive(true);
    audio.zombieCue("chase", player, { x: 2, z: 0 }, 0);
    assert.equal(count(), 4); // original voice and vibrato fallback
    audio.zombieAttack(player, { x: 2, z: 0 }, 0);
    const afterAttack = count();
    for (let i = 0; i < 14; i++) audio.zombieAttack(player, { x: 2, z: 0 }, 0);
    assert.equal(count(), afterAttack);
    audio.context.currentTime += 1.7;
    audio.zombieAttack(player, { x: 2, z: 0 }, 0);
    assert.equal(count(), afterAttack + 2);
  });
});

test("late downloads after disposal cannot repopulate decoded zombie buffers", async () => {
  const previous = globalThis.AudioContext;
  const previousFetch = globalThis.fetch;
  globalThis.AudioContext = AudioContextDouble;
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  globalThis.fetch = async () => { await pending; return {
    ok: true, arrayBuffer: async () => new ArrayBuffer(0),
  }; };
  const audio = new GameAudio();
  try {
    await audio.unlock();
    const loading = audio.zombieLoading;
    audio.dispose();
    finish();
    await loading;
    assert.equal(audio.zombieBuffers.size, 0);
    assert.equal(audio.context, null);
  } finally {
    globalThis.AudioContext = previous;
    globalThis.fetch = previousFetch;
  }
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
