import test from "node:test";
import assert from "node:assert/strict";
import { STATIC_RECTS } from "../lib/game/simulation.ts";
import { SlotAudioDirector, slotSourceAudible } from "../lib/game/slot-audio-director.ts";
import { SLOT_MACHINE_SOURCES } from "../lib/game/slot-machines.ts";

const source = (id) => SLOT_MACHINE_SOURCES.find((cabinet) => cabinet.id === id);
const a = source("slots-a:west:1");
const b = source("slots-b:west:1");
const inFront = (cabinet, distance = 1) => ({ x: cabinet.x + cabinet.side * distance, z: cabinet.z });
const state = (overrides = {}) => ({
  playing: true,
  moving: true,
  suppressed: false,
  player: inFront(a),
  ...overrides,
});

test("all twelve speakers share the unchanged cabinet layout and face out of both islands", () => {
  assert.equal(SLOT_MACHINE_SOURCES.length, 12);
  assert.equal(new Set(SLOT_MACHINE_SOURCES.map((cabinet) => cabinet.id)).size, 12);
  for (const island of STATIC_RECTS.filter((rect) => rect.id.startsWith("slots-"))) {
    const cabinets = SLOT_MACHINE_SOURCES.filter((cabinet) => cabinet.islandId === island.id);
    assert.equal(cabinets.length, 6);
    for (const side of [-1, 1]) {
      const bank = cabinets.filter((cabinet) => cabinet.side === side);
      assert.equal(bank.length, 3);
      for (let row = 0; row < 3; row++) {
        const cabinet = bank[row];
        assert.equal(cabinet.rootX, island.x + side * (island.w / 2 - 0.7));
        assert.equal(cabinet.rootZ, island.z - island.d / 2 + 0.7 + row * (island.d - 1.4) / 2);
        assert.equal(cabinet.z, cabinet.rootZ);
        assert.ok((cabinet.x - island.x) * side > island.w / 2);
        assert.equal(cabinet.variant, (row + (side > 0 ? 1 : 0)) % 2);
        assert.equal(cabinet.modelVariant, cabinet.variant ? "burgundy" : "emerald");
      }
    }
  }
});

test("walking past either bank of either island chooses the closest actual cabinet", () => {
  for (const cabinet of SLOT_MACHINE_SOURCES) {
    const cue = new SlotAudioDirector().update(0.1, state({ player: inFront(cabinet) }));
    assert.equal(cue?.source.id, cabinet.id);
    assert.equal(cue.variant, cabinet.variant);
    assert.deepEqual(cue.source, cabinet);
    assert.notEqual(cue.source, cabinet, "cue owns its source snapshot");
  }
});

test("the audible radius is 3.5m and cabinet backs and island ends stay silent", () => {
  const director = new SlotAudioDirector();
  assert.equal(director.update(1, state({ player: inFront(a, 3.51) })), null);
  assert.equal(director.update(1, state({ player: { x: -7, z: 0 } })), null);
  assert.equal(director.update(1, state({ player: { x: -7, z: -3.1 } })), null);
  assert.equal(director.update(1, state({ player: inFront(a, 3.49) }))?.source.id, a.id);
});

test("lounge and staff partitions occlude nearby cabinet speakers", () => {
  for (const player of [{ x: 4.3, z: 3.5 }, { x: 4.3, z: 5 }, { x: 4.3, z: 6.5 }]) {
    const closest = SLOT_MACHINE_SOURCES.filter((cabinet) => cabinet.islandId === "slots-b" && cabinet.side === 1)
      .sort((left, right) => Math.hypot(left.x - player.x, left.z - player.z) - Math.hypot(right.x - player.x, right.z - player.z))[0];
    assert.ok(Math.hypot(closest.x - player.x, closest.z - player.z) < 3.5);
    assert.equal(new SlotAudioDirector().update(1, state({ player })), null);
  }
  assert.equal(new SlotAudioDirector().update(1, state({ player: { x: 3.3, z: 5 } }))?.source.id, "slots-b:east:1");
});

test("a clear sightline through the partition opening is audible", () => {
  assert.equal(new SlotAudioDirector().update(1, state({ player: { x: 4.2, z: 7.6 } }))?.source.id, "slots-b:east:2");
});

test("active sound tails can use a wider radius while still respecting walls and cabinet fronts", () => {
  assert.equal(slotSourceAudible(a, inFront(a, 4)), false);
  assert.equal(slotSourceAudible(a, inFront(a, 4), 5), true);
  assert.equal(slotSourceAudible(a, inFront(a, 5.1), 5), false);
  assert.equal(slotSourceAudible(a, { x: -7, z: 0 }, 5), false);
  assert.equal(slotSourceAudible(source("slots-b:east:1"), { x: 4.3, z: 5 }, 5), false);
});

test("all cabinets share four seconds of quiet between greetings", () => {
  const director = new SlotAudioDirector();
  assert.equal(director.update(0.1, state())?.source.id, a.id);
  assert.equal(director.update(3.9, state({ player: inFront(b) })), null);
  assert.equal(director.update(0.101, state({ player: inFront(b) }))?.source.id, b.id);
});

test("each cabinet requires a twenty-second cooldown even after leaving its bank", () => {
  const director = new SlotAudioDirector();
  assert.equal(director.update(0.1, state())?.source.id, a.id);
  assert.equal(director.update(1, state({ player: inFront(a, 5) })), null);
  assert.equal(director.update(1, state()), null);
  assert.equal(director.update(18.01, state())?.source.id, a.id);
});

test("hysteresis prevents threshold jitter and neighboring cabinets from taking turns", () => {
  const director = new SlotAudioDirector();
  assert.equal(director.update(0.1, state())?.source.id, a.id);
  assert.equal(director.update(25, state({ player: inFront(a, 3.6) })), null);
  assert.equal(director.update(1, state({ player: inFront(a, 3.4) })), null);
  assert.equal(director.update(25, state()), null, "staying at the nearest cabinet does not wake adjacent ones");
  assert.equal(director.update(1, state({ player: inFront(a, 4.51) })), null);
  assert.equal(director.update(1, state())?.source.id, a.id);
});

test("standing still never triggers a greeting or consumes the first walking greeting", () => {
  const director = new SlotAudioDirector();
  assert.equal(director.update(30, state({ moving: false })), null);
  assert.equal(director.update(0.1, state())?.source.id, a.id);
  assert.equal(director.update(100, state({ moving: false })), null);
  assert.equal(director.update(0.1, state()), null);
});

test("combat suppression preserves the greeting until nearby walking can be heard", () => {
  const director = new SlotAudioDirector();
  assert.equal(director.update(30, state({ suppressed: true })), null);
  assert.equal(director.update(0.1, state({ moving: false })), null);
  assert.equal(director.update(0.1, state())?.source.id, a.id);
  assert.equal(director.update(30, state({ player: inFront(b), suppressed: true })), null);
  assert.equal(director.update(0.1, state({ player: inFront(b) }))?.source.id, b.id);
});

test("pausing freezes cooldowns and resumes without a stored playback event", () => {
  const director = new SlotAudioDirector();
  assert.equal(director.update(0.1, state())?.source.id, a.id);
  assert.equal(director.update(100, state({ playing: false, player: inFront(b) })), null);
  assert.equal(director.update(3.9, state({ player: inFront(b) })), null);
  assert.equal(director.update(0.101, state({ moving: false, player: inFront(b) })), null);
  assert.equal(director.update(0.1, state({ player: inFront(b) }))?.source.id, b.id);
});

test("paused position changes do not rearm a previously visited cabinet", () => {
  const director = new SlotAudioDirector();
  director.update(0.1, state());
  director.update(100, state({ playing: false, player: inFront(a, 5) }));
  assert.equal(director.update(30, state()), null);
});

test("reset clears cooldown and visit state, while invalid time updates are inert", () => {
  const director = new SlotAudioDirector();
  assert.equal(director.update(0.1, state())?.source.id, a.id);
  director.reset();
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(director.update(dt, state()), null);
  assert.equal(director.update(0.1, state())?.source.id, a.id);
});
