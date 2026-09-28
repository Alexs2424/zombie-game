import test from "node:test";
import assert from "node:assert/strict";
import { ZombieAudioDirector } from "../lib/game/zombie-audio-director.ts";

const enemy = (id = 1, x = 6, z = 0) => ({ id, x, z, health: 100 });
const state = (overrides = {}) => ({
  playing: true,
  round: 1,
  roundCueRemaining: 0,
  waveRemaining: 2,
  player: { x: 0, z: 0 },
  enemies: [enemy()],
  ...overrides,
});

test("chase cues select the nearest living source within 8m and stay sparse", () => {
  const director = new ZombieAudioDirector(() => 0.5);
  const snapshot = state({
    enemies: [enemy(3, 9), enemy(2, 8), { ...enemy(1, 1), health: 0 }],
  });
  assert.equal(director.update(1, snapshot), null);
  const cue = director.update(0.5, snapshot);
  assert.deepEqual(cue, {
    kind: "chase",
    enemyId: 2,
    position: { x: 8, z: 0 },
  });
  snapshot.enemies[1].z = 2;
  assert.equal(cue.position.z, 0, "cue position is independent of moving enemies");
  assert.equal(director.update(6.5, snapshot), null, "8m range is radial");
  snapshot.enemies[1].z = 0;
  assert.equal(director.update(0.1, snapshot)?.kind, "chase");
  assert.equal(director.update(6.49, snapshot), null);
  assert.equal(director.update(0.02, snapshot)?.kind, "chase");
});

test("a lone spawned zombie is not the last zombie while more spawns remain", () => {
  const director = new ZombieAudioDirector(() => 0);
  const snapshot = state();
  assert.equal(director.update(10, snapshot)?.kind, "chase");
  assert.equal(director.update(5, snapshot)?.kind, "chase");
  snapshot.waveRemaining = 0;
  assert.equal(director.update(5, state({ enemies: [] })), null);
  assert.equal(director.update(1, snapshot), null);
  assert.equal(director.update(0.25, snapshot)?.kind, "last");
});

test("last-survivor cue waits for the same survivor, plays once per round, and rearms next round", () => {
  const director = new ZombieAudioDirector(() => 0);
  const snapshot = state({ waveRemaining: 0, enemies: [enemy(1, 12)] });
  director.update(2, state({ enemies: [] }));
  assert.equal(director.update(1, snapshot), null);
  snapshot.enemies = [enemy(2, 12)];
  assert.equal(director.update(0.5, snapshot), null);
  assert.equal(director.update(0.75, snapshot)?.enemyId, 2);
  assert.equal(director.update(20, snapshot), null);
  director.update(1, state({ enemies: [] }));
  assert.equal(director.update(20, snapshot), null);
  snapshot.round = 2;
  assert.equal(director.update(1, snapshot), null);
  assert.equal(director.update(0.25, snapshot)?.kind, "last");
});

test("a distant final survivor keeps its cue available until it is audible", () => {
  const director = new ZombieAudioDirector(() => 0);
  const snapshot = state({ waveRemaining: 0, enemies: [enemy(1, 18.1)] });
  assert.equal(director.update(20, snapshot), null);
  snapshot.enemies[0].x = 18;
  assert.equal(director.update(1, snapshot), null);
  assert.equal(director.update(0.25, snapshot)?.kind, "last");
});

test("horde means at least five living zombies within 10m, with a 12–18s cadence", () => {
  const director = new ZombieAudioDirector(() => 0.5);
  const snapshot = state({
    enemies: [enemy(1, 9), enemy(2, 9), enemy(3, 9), enemy(4, 9), enemy(5, 10.1)],
  });
  assert.equal(director.update(2, snapshot), null);
  snapshot.enemies[4].x = 10;
  assert.equal(director.update(0.5, snapshot), null);
  assert.equal(director.update(0.5, snapshot)?.kind, "horde");
  assert.equal(director.update(14.9, snapshot), null);
  assert.equal(director.update(0.1, snapshot)?.kind, "horde");
  snapshot.enemies[4].health = 0;
  assert.equal(director.update(20, snapshot), null);
});

test("chase, horde and final-survivor cues share a cooldown", () => {
  const director = new ZombieAudioDirector(() => 0);
  const snapshot = state({ enemies: Array.from({ length: 5 }, (_, i) => enemy(i)) });
  assert.equal(director.update(2, snapshot)?.kind, "horde");
  snapshot.enemies = [enemy()];
  snapshot.waveRemaining = 0;
  assert.equal(director.update(4.9, snapshot), null);
  assert.equal(director.update(0.1, snapshot)?.kind, "last");
  assert.equal(director.update(4.9, snapshot), null);
  assert.equal(director.update(0.1, snapshot)?.kind, "chase");
});

test("pause freezes both cooldowns and the final-survivor hold", () => {
  const director = new ZombieAudioDirector(() => 0);
  const snapshot = state({ waveRemaining: 0 });
  director.update(2, state({ enemies: [] }));
  assert.equal(director.update(1, snapshot), null);
  assert.equal(director.update(100, { ...snapshot, playing: false }), null);
  assert.equal(director.update(0.24, snapshot), null);
  assert.equal(director.update(0.01, snapshot)?.kind, "last");
  assert.equal(director.update(100, { ...snapshot, playing: false }), null);
  assert.equal(director.update(4.9, snapshot), null);
  assert.equal(director.update(0.1, snapshot)?.kind, "chase");
});

test("round stingers suppress all cues and survivor holds begin after the stinger", () => {
  const director = new ZombieAudioDirector(() => 0);
  const snapshot = state({ waveRemaining: 0, roundCueRemaining: 3.8 });
  assert.equal(director.update(10, snapshot), null);
  snapshot.roundCueRemaining = 0;
  assert.equal(director.update(1, snapshot), null);
  assert.equal(director.update(0.25, snapshot)?.kind, "last");
});

test("fresh-run reset clears used survivor cues and restores the initial quiet period", () => {
  const director = new ZombieAudioDirector(() => 0);
  const snapshot = state({ waveRemaining: 0 });
  assert.equal(director.update(2, snapshot)?.kind, "last");
  director.reset();
  assert.equal(director.update(1.25, snapshot), null);
  assert.equal(director.update(0.25, snapshot)?.kind, "last");
  assert.equal(director.update(Number.NaN, snapshot), null);
  assert.equal(director.update(-5, snapshot), null);
});
