import test from "node:test";
import assert from "node:assert/strict";
import { STATIC_RECTS } from "../lib/game/simulation.ts";
import { SlotAudioDirector, slotSourceAudible } from "../lib/game/slot-audio-director.ts";
import { SLOT_MACHINE_SOURCES } from "../lib/game/slot-machines.ts";
import { SLOT_ISLANDS } from "../lib/game/casino-layout.ts";

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

test("all 48 speakers share the eight-bank layout and face out of every island", () => {
  assert.equal(SLOT_MACHINE_SOURCES.length, 48);
  assert.equal(new Set(SLOT_MACHINE_SOURCES.map((cabinet) => cabinet.id)).size, 48);
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

test("walking past either face of all eight islands chooses the closest actual cabinet", () => {
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
  const island = SLOT_ISLANDS[0];
  assert.equal(director.update(1, state({ player: { x: island.x, z: island.z } })), null);
  assert.equal(director.update(1, state({ player: { x: island.x, z: island.z - island.d / 2 - 0.6 } })), null);
  assert.equal(director.update(1, state({ player: inFront(a, 3.49) }))?.source.id, a.id);
});

test("the relocated lounge wall occludes nearby speakers", () => {
  const wallSource = { ...a, x: -32, z: -7, side: -1 };
  assert.equal(slotSourceAudible(wallSource, { x: -34, z: -7 }), false);
  assert.equal(slotSourceAudible(wallSource, { x: -32.5, z: -7 }), true);
});

test("a clear sightline through a new door stays audible beneath the lintel", () => {
  const doorwaySource = { ...a, x: -32, z: -2, side: -1 };
  assert.equal(slotSourceAudible(doorwaySource, { x: -34, z: -2 }), true);
});

test("active sound tails can use a wider radius while still respecting walls and cabinet fronts", () => {
  assert.equal(slotSourceAudible(a, inFront(a, 4)), false);
  assert.equal(slotSourceAudible(a, inFront(a, 4), 5), true);
  assert.equal(slotSourceAudible(a, inFront(a, 5.1), 5), false);
  assert.equal(slotSourceAudible(a, { x: SLOT_ISLANDS[0].x, z: SLOT_ISLANDS[0].z }, 5), false);
  assert.equal(slotSourceAudible({ ...a, x: -32, z: -7, side: -1 }, { x: -34, z: -7 }, 5), false);
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
