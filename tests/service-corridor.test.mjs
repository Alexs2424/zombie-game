import test from "node:test";
import assert from "node:assert/strict";
import { SERVICE_RECTS, SERVICE_VIEWS } from "../lib/game/service-layout.ts";
import {
  Simulation, RULES, SPAWNS, collides, dist, moveActor, hasSight, wallDistance,
} from "../lib/game/simulation.ts";

const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
const enemy = (p) => ({ ...p, id: 1, health: 80, maxHealth: 80, speed: 1.7,
  yaw: 0, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0 });

function corridor({ lounge = true, shortcut = true, vip = true } = {}) {
  const s = new Simulation();
  s.start();
  s.intermission = 1e6;
  s.lounge = lounge;
  s.shortcut = shortcut;
  s.vip = vip;
  s.loungeAge = s.vipAge = 4;
  s.invulnerable = 100;
  s.refreshMap();
  return s;
}

function walk(s, waypoints) {
  const p = { ...waypoints[0] };
  assert.equal(collides(p, RULES.playerRadius, s.rects), false);
  for (const target of waypoints.slice(1)) {
    moveActor(p, target.x - p.x, target.z - p.z, RULES.playerRadius, s.rects);
    assert.ok(dist(p, target) < 1e-8, `Blocked route: ${JSON.stringify({ p, target })}`);
  }
}

test("the truck and every storage fixture stop actors without trapping them inside", () => {
  const s = corridor();
  for (const rect of SERVICE_RECTS) {
    const from = { x: rect.x, z: rect.z + (rect.z < 8 ? 1 : -1) * (rect.d / 2 + 0.6) };
    for (const radius of [RULES.playerRadius, RULES.enemyRadius]) {
      const p = { ...from };
      assert.equal(collides(p, radius, s.rects), false, rect.id);
      moveActor(p, rect.x - p.x, rect.z - p.z, radius, s.rects);
      assert.ok(dist(p, rect) > rect.d / 2, `Walked through ${rect.id}`);
      assert.equal(collides(p, radius, s.rects), false, rect.id);
      moveActor(p, from.x - p.x, from.z - p.z, radius, s.rects);
      assert.ok(dist(p, from) < 1e-8, `Could not back away from ${rect.id}`);
    }
  }
});

test("the full escape aisle and all three corridor entrances remain walkable", () => {
  const s = corridor();
  walk(s, [{ x: 3.2, z: 8.6 }, { x: 16.8, z: 8.6 },
    { x: 11.7, z: 8.6 }, { x: 11.7, z: 1.8 }, { x: 12.8, z: 1.8 },
    { x: 12.8, z: -4.1 }, { x: 3.2, z: -4.1 }]);
  for (const [name, [x, z]] of Object.entries(SERVICE_VIEWS))
    assert.equal(collides({ x, z }, RULES.playerRadius, s.rects), false, `${name} camera is inside cover`);
});

test("flow field connects enabled spawns and open doors to truck and storage approaches", () => {
  for (const shortcut of [false, true]) for (const vip of [false, true]) {
    const s = corridor({ shortcut, vip });
    const entrances = [{ x: 11.7, z: 2.2 },
      ...(shortcut ? [{ x: 3.2, z: 8.6 }] : []),
      ...(vip ? [{ x: 16.8, z: 8.6 }] : [])];
    for (const target of [
      { x: 5.1, z: 8.6 }, { x: 11.7, z: 4 }, { x: 14.5, z: 8.6 },
      { x: 6.5, z: 9.9 }, { x: 13.9, z: 9.6 },
    ]) {
      assert.equal(collides(target, RULES.playerRadius, s.rects), false);
      s.navigation.update(target);
      for (const from of [...entrances, ...SPAWNS.filter((_, i) => s.spawnEnabled(i))])
        assert.ok(s.navigation.distance[s.navigation.index(from)] >= 0,
          `Unreachable corridor: ${JSON.stringify({ from, target, shortcut, vip })}`);
    }
  }
});

test("locked shortcut and VIP exits still stop movement and isolate unpurchased rooms", () => {
  const s = corridor({ lounge: false, shortcut: false, vip: false });
  for (const [from, dx] of [[{ x: 3.2, z: 8.6 }, 2], [{ x: 15, z: 8.6 }, 2]]) {
    const p = { ...from };
    moveActor(p, dx, 0, RULES.playerRadius, s.rects);
    assert.ok(p.x < (from.x < 4 ? 4 : 16));
  }
  s.navigation.update({ x: 3.2, z: 8.6 });
  assert.equal(s.navigation.distance[s.navigation.index({ x: 11.7, z: 8.6 })], -1);
  assert.equal(s.navigation.distance[s.navigation.index({ x: 16.8, z: 8.6 })], -1);
});

test("zombies pursue around the truck and loaded pallet without relocation", () => {
  for (const [from, target] of [
    [{ x: 5, z: 3.7 }, { x: 8, z: 8.6 }],
    [{ x: 14.5, z: 3.8 }, { x: 14.5, z: 8.6 }],
    [{ x: 15.3, z: 9.65 }, { x: 11.7, z: 10.95 }],
    [SPAWNS[2], { x: 11.7, z: 4 }],
  ]) {
    const s = corridor();
    s.player = { ...target };
    s.refreshMap();
    const e = enemy(from);
    s.enemies = [e];
    assert.equal(collides(e, RULES.enemyRadius, s.rects), false, JSON.stringify(from));
    let reached = false;
    for (let elapsed = 0; elapsed < 40; elapsed += 0.05) {
      const before = { x: e.x, z: e.z };
      s.step(0.05, idle);
      assert.ok(dist(before, e) <= e.speed * 0.05 + 1e-8, "Zombie teleported instead of routing");
      assert.equal(collides(e, RULES.enemyRadius, s.rects), false);
      if (dist(e, target) < 1.3) { reached = true; break; }
    }
    assert.ok(reached, `Zombie failed to pursue: ${JSON.stringify({ from, target, e })}`);
  }
});

test("truck and cartons stop fired bullets while the open aisle permits a hit", () => {
  for (const [from, target, covered] of [
    [{ x: 8, z: 3.7 }, { x: 8, z: 8.6 }, true],
    [{ x: 14.5, z: 3.8 }, { x: 14.5, z: 8.6 }, true],
    [{ x: 11.7, z: 4 }, { x: 11.7, z: 8.6 }, false],
  ]) {
    const s = corridor();
    s.player = { ...from };
    s.yaw = 0;
    s.pitch = 0;
    const e = enemy(target);
    s.enemies = [e];
    assert.equal(hasSight(from, target, s.rects, 1.65), !covered);
    assert.equal(s.fire(), true);
    assert.equal(e.health < 80, !covered);
  }
  const s = corridor();
  assert.ok(wallDistance({ x: 13.9, y: 1, z: 9 }, { x: 0, y: 0, z: 1 }, s.rects) < 2);
  assert.ok(wallDistance({ x: 13.9, y: 1.65, z: 9 }, { x: 0, y: 0, z: 1 }, s.rects) > 2.5,
    "Low pallet should allow eye-height fire over the load");
});

test("the truck protects against grenade blast and bounces a thrown grenade", () => {
  const s = corridor();
  s.player = { x: 8, z: 3.7 };
  s.yaw = 0;
  s.pitch = 0;
  const e = enemy({ x: 8, z: 7.5 });
  e.speed = 0;
  s.enemies = [e];
  s.projectiles = [{ id: 1, x: 8, y: 0.2, z: 4.1, vx: 0, vy: 0, vz: 0, fuse: 0.01 }];
  s.step(0.05, idle);
  assert.equal(e.health, 80);
  assert.equal(s.throwGrenade(), true);
  for (let n = 0; n < 5; n++) s.step(0.05, idle);
  assert.ok(s.projectiles[0].z < 4.375);
  assert.ok(s.projectiles[0].vz < 0);
});
