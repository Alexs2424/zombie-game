import test from "node:test";
import assert from "node:assert/strict";
import {
  BAR_ANCHOR,
  PURCHASES,
  RULES,
  SPAWNS,
  Simulation,
  collides,
  dist,
  moveActor,
} from "../lib/game/simulation.ts";

const idle = { forward: 0, strafe: 0, sprint: false, fire: false };

function lounge({ shortcut = false, vip = false } = {}) {
  const s = new Simulation();
  s.start();
  s.intermission = 1e6;
  s.lounge = true;
  s.shortcut = shortcut;
  s.vip = vip;
  s.loungeAge = s.vipAge = 4;
  s.refreshMap();
  return s;
}

function walk(s, waypoints) {
  const player = { ...waypoints[0] };
  assert.equal(collides(player, RULES.playerRadius, s.rects), false);
  for (const target of waypoints.slice(1)) {
    moveActor(
      player,
      target.x - player.x,
      target.z - player.z,
      RULES.playerRadius,
      s.rects,
    );
    assert.ok(dist(player, target) < 1e-8, `Blocked approach: ${JSON.stringify({ player, target })}`);
  }
  s.player = player;
}

test("the lounge aisle and staff escape loop remain walkable with all furniture present", () => {
  const s = lounge({ shortcut: true, vip: true });
  walk(s, [
    { x: 3.2, z: -4.1 },
    { x: 16.8, z: -4.1 },
    { x: 12.8, z: -4.1 },
    { x: 12.8, z: 1.8 },
    { x: 11.7, z: 1.8 },
    { x: 11.7, z: 8.6 },
    { x: 3.2, z: 8.6 },
  ]);
});

test("bartender, SMG, VIP door, and staff shortcut can all be approached from the entrance", () => {
  const s = lounge();
  const entry = { x: 4.8, z: -4.1 };
  walk(s, [entry, { x: 12, z: -4.1 }, BAR_ANCHOR]);
  assert.equal(s.openBar(), true);
  s.closeBar();
  s.resume();

  const smg = PURCHASES.find((p) => p.id === "smg");
  walk(s, [entry, { x: smg.x, z: -4.1 }, smg]);
  s.points = 10000;
  assert.equal(s.purchase("smg"), true);

  const vip = PURCHASES.find((p) => p.id === "vip");
  walk(s, [entry, vip]);
  assert.equal(s.purchase("vip"), true);

  const shortcut = PURCHASES.find((p) => p.id === "shortcut");
  walk(s, [entry, { x: 12.8, z: -4.1 }, { x: 12.8, z: 1.8 },
    { x: 11.7, z: 1.8 }, { x: 11.7, z: shortcut.z }, shortcut]);
  assert.equal(s.purchase("shortcut"), true);
});

test("booths, table, stools, and counter stop a player moving directly through them", () => {
  const s = lounge();
  for (const [from, to] of [
    [{ x: 7, z: -4.8 }, { x: 7, z: -10.5 }],
    [{ x: 10.3, z: -2 }, { x: 10.3, z: 2 }],
    [{ x: 13.8, z: -2.8 }, { x: 13.8, z: 0.5 }],
    [{ x: 10, z: -6 }, { x: 10, z: -7.35 }],
    [{ x: 14.1, z: -6 }, { x: 14.1, z: -7.35 }],
    [{ x: 12, z: -7.3 }, { x: 12, z: -10.3 }],
    [{ x: 12, z: -10.3 }, { x: 12, z: -11.6 }],
  ]) {
    const p = { ...from };
    assert.equal(collides(p, RULES.playerRadius, s.rects), false);
    moveActor(p, to.x - p.x, to.z - p.z, RULES.playerRadius, s.rects);
    assert.ok(dist(p, to) > 0.5, `Furniture did not stop movement: ${JSON.stringify({ from, to, p })}`);
    assert.equal(collides(p, RULES.playerRadius, s.rects), false);
  }
});

test("furniture does not create a route into the lounge before its doors are purchased", () => {
  const s = new Simulation();
  for (const z of [-4.1, 8.6]) {
    const p = { x: 3.2, z };
    moveActor(p, 3, 0, RULES.playerRadius, s.rects);
    assert.ok(p.x < 4);
  }
  s.navigation.update({ x: 3.2, z: -4.1 });
  for (const p of [BAR_ANCHOR, { x: 5.3, z: -0.2 }, SPAWNS[3]]) {
    assert.equal(s.navigation.distance[s.navigation.index(p)], -1);
  }
  s.player = { ...BAR_ANCHOR };
  assert.equal(s.openBar(), false);
  assert.equal(s.spawnEnabled(3), false);
});

test("the real zombie flow field connects all enabled spawns to lounge activities and exits", () => {
  for (const shortcut of [false, true]) {
    for (const vip of [false, true]) {
      const s = lounge({ shortcut, vip });
      for (const target of [
        BAR_ANCHOR,
        { x: 5.3, z: -0.2 },
        { x: 15.2, z: -4.1 },
        { x: 11.7, z: 4 },
        { x: 5.3, z: 8.6 },
      ]) {
        assert.equal(collides(target, RULES.playerRadius, s.rects), false);
        s.navigation.update(target);
        for (const spawn of SPAWNS.filter((_, i) => s.spawnEnabled(i))) {
          assert.ok(s.navigation.distance[s.navigation.index(spawn)] >= 0,
            `No zombie route: ${JSON.stringify({ target, spawn, shortcut, vip })}`);
        }
      }
    }
  }
});

test("zombies walk around the bar, booth, and cocktail table without getting stuck or relocating", () => {
  for (const [from, target] of [
    [SPAWNS[3], BAR_ANCHOR],
    [{ x: 10.3, z: -2 }, { x: 10.3, z: 2 }],
    [{ x: 13.8, z: -3 }, { x: 13.8, z: 1 }],
  ]) {
    const s = lounge();
    s.player = { ...target };
    s.invulnerable = 100;
    s.refreshMap();
    const enemy = {
      ...from, id: 1, health: 80, maxHealth: 80, speed: 1.7,
      yaw: 0, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0,
    };
    s.enemies = [enemy];
    let approached = false;
    for (let time = 0; time < 40; time += 0.05) {
      const previous = { x: enemy.x, z: enemy.z };
      s.step(0.05, idle);
      assert.ok(dist(previous, enemy) <= enemy.speed * 0.05 + 1e-8, "Enemy relocated instead of finding a path");
      assert.equal(collides(enemy, RULES.enemyRadius, s.rects), false);
      if (dist(enemy, target) < 1.3) {
        approached = true;
        break;
      }
    }
    assert.ok(approached, `Pursuit stuck: ${JSON.stringify({ from, target, enemy })}`);
  }
});
