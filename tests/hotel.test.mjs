import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, RULES, collides, moveActor } from "../lib/game/simulation.ts";
import { HOTEL, stairPoint } from "../lib/game/world.ts";

const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
const DT = 0.05;

function quiet() {
  const s = new Simulation();
  s.start();
  s.intermission = 1e6;
  s.random = () => 0.5;
  return s;
}

function tick(s, seconds) {
  for (let n = 0; n < Math.ceil(seconds / DT); n++) s.step(DT, idle);
}

function enemy(position, options = {}) {
  return {
    id: 1,
    ...position,
    health: 500,
    maxHealth: 500,
    speed: 1.7,
    yaw: 0,
    attack: 0,
    cooldown: 0,
    stuck: 0,
    flash: 0,
    age: 0,
    ...options,
  };
}

function close(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

function aimAt(s, target) {
  const dx = target.x - s.player.x;
  const dz = target.z - s.player.z;
  s.yaw = Math.atan2(dx, dz);
  s.pitch = Math.atan2((s.player.y ?? 0) + 1.65 - target.y, Math.hypot(dx, dz));
}

function ground(x, z) { return { x, z, y: 0, surfaceId: "ground" }; }
function upper(x, z) { return { x, z, y: HOTEL.floorY, surfaceId: "hotel-upper" }; }

function moveTo(s, actor, target, radius = RULES.playerRadius) {
  moveActor(actor, target.x - actor.x, target.z - actor.z, radius, s.rects);
  close(actor.x, target.x, 0.06, "walking reached target x");
  close(actor.z, target.z, 0.06, "walking reached target z");
}

function followStair(s, actor, stair, from, to) {
  const steps = Math.ceil(Math.abs(to - from) * 120);
  for (let i = 1; i <= steps; i++) {
    const t = from + (to - from) * i / steps;
    const target = stairPoint(stair, t);
    moveTo(s, actor, target);
    close(actor.y ?? 0, target.y, 0.06, `${stair.id} foot height at t=${t}`);
    assert.equal(collides(actor, RULES.playerRadius, s.rects), false,
      `${stair.id} leaves a supported actor at t=${t}`);
  }
}

function climb(s, stair) {
  const bottom = stairPoint(stair, 0);
  const actor = ground(bottom.x - stair.side, bottom.z);
  moveTo(s, actor, bottom);
  followStair(s, actor, stair, 0, 1);
  moveTo(s, actor, { x: stair.cx - stair.side, z: stair.cz + 4 });
  assert.equal(actor.surfaceId, "hotel-upper");
  close(actor.y, HOTEL.floorY, 1e-6, "stair exit meets upper floor");
  return actor;
}

test("hotel entrance connects the casino and lobby at ground height in both directions", () => {
  const s = quiet();
  const actor = ground(HOTEL.entrance.x, 10.5);
  moveTo(s, actor, { x: HOTEL.entrance.x, z: 17 });
  close(actor.y, 0, 1e-6, "lobby is ground level");
  moveTo(s, actor, { x: HOTEL.entrance.x, z: 10.5 });
  close(actor.y, 0, 1e-6, "casino is ground level");

  // Exercise the input path too: movement through Simulation.step must use the world.
  s.player = ground(HOTEL.entrance.x, 10.5);
  s.yaw = 0;
  const walk = { ...idle, forward: 1 };
  for (let i = 0; i < 24; i++) s.step(DT, walk);
  assert.ok(s.player.z > 15.5, JSON.stringify(s.player));
  close(s.player.y, 0, 1e-6, "input walking preserves lobby height");
  s.yaw = Math.PI;
  for (let i = 0; i < 24; i++) s.step(DT, walk);
  close(s.player.z, 10.5, 0.06, "input walking returns through entrance");
});

for (const stair of HOTEL.stairs) {
  test(`${stair.id} supports a continuous walk up and back down`, () => {
    const s = quiet();
    const actor = climb(s, stair);
    moveTo(s, actor, stairPoint(stair, 1));
    followStair(s, actor, stair, 1, 0);
    moveTo(s, actor, { x: stair.cx - stair.side, z: stair.cz - 4 });
    assert.equal(actor.surfaceId, "ground");
    close(actor.y, 0, 1e-6, "descending stair returns to lobby");
  });
}

test("the upper walkway joins both stair landings into a traversable loop", () => {
  const s = quiet();
  const [left, right] = HOTEL.stairs;
  const actor = climb(s, left);
  moveTo(s, actor, { x: right.cx - right.side, z: right.cz + 4 });
  close(actor.y, HOTEL.floorY, 1e-6, "walkway stays upstairs");
  assert.equal(actor.surfaceId, "hotel-upper");
  moveTo(s, actor, stairPoint(right, 1));
  followStair(s, actor, right, 1, 0);
  moveTo(s, actor, { x: right.cx - right.side, z: right.cz - 4 });
  close(actor.y, 0, 1e-6, "other stair returns to lobby");
});

test("mezzanine guards prevent an oversized diagonal movement from dropping to the lobby", () => {
  const s = quiet();
  const actor = upper(-4, 32);
  moveActor(actor, 2, -8, RULES.playerRadius, s.rects);
  close(actor.y, HOTEL.floorY, 1e-6, "guard keeps actor upstairs");
  assert.equal(actor.surfaceId, "hotel-upper");
  assert.ok(actor.z > 30.5 + RULES.playerRadius, JSON.stringify(actor));
  assert.equal(collides(actor, RULES.playerRadius, s.rects), false);
});

for (const stair of HOTEL.stairs) {
  test(`${stair.id} rails block radial exits and the lobby cannot enter through its side`, () => {
    const s = quiet();
    const bottom = stairPoint(stair, 0);
    const actor = ground(bottom.x - stair.side, bottom.z);
    moveTo(s, actor, bottom);
    followStair(s, actor, stair, 0, 0.5);
    moveActor(actor, stair.side * 5, 0, RULES.playerRadius, s.rects);
    const radius = Math.hypot(actor.x - stair.cx, actor.z - stair.cz);
    assert.ok(radius <= stair.outerRadius - RULES.playerRadius + 0.02,
      `outer rail retained actor: ${JSON.stringify(actor)}`);
    close(actor.y, 2, 0.06, "radial movement cannot change stair progress");
    assert.equal(actor.surfaceId, stair.id);

    const below = ground(stair.cx + stair.side * (stair.innerRadius - 0.6), stair.cz);
    assert.equal(collides(below, RULES.playerRadius, s.rects), false);
    moveActor(below, stair.side * 4, 0, RULES.playerRadius, s.rects);
    close(below.y, 0, 1e-6, "side approach cannot jump onto mid-stair");
    assert.equal(below.surfaceId, "ground");
    assert.ok(Math.hypot(below.x - stair.cx, below.z - stair.cz) < stair.innerRadius,
      `closed stair side retained lobby actor: ${JSON.stringify(below)}`);
  });
}

test("an enemy directly below the player takes the stairs and eventually lands an attack", () => {
  const s = quiet();
  s.player = upper(-4, 35);
  const pursuer = enemy(ground(-4, 35));
  s.enemies = [pursuer];
  s.refreshMap();
  let climbed = false;
  let attacked = false;
  for (let i = 0; i < 100 / DT; i++) {
    const before = { ...pursuer };
    s.step(DT, idle);
    const movement = Math.hypot(pursuer.x - before.x, pursuer.z - before.z,
      (pursuer.y ?? 0) - (before.y ?? 0));
    assert.ok(movement < 0.18, `pursuit must walk rather than teleport: ${movement}`);
    if ((pursuer.y ?? 0) > 0.5 && (pursuer.y ?? 0) < 3.5) {
      climbed = true;
      assert.ok(pursuer.surfaceId?.startsWith("hotel-stair"), JSON.stringify(pursuer));
    }
    if (s.events.some(event => event.type === "hurt")) { attacked = true; break; }
  }
  assert.ok(climbed, "enemy must physically traverse an intermediate stair height");
  assert.ok(attacked, `enemy should reach and attack the player: ${JSON.stringify(pursuer)}`);
  close(pursuer.y, HOTEL.floorY, 0.2, "attacking enemy reached player floor");
});

test("stacked actors cannot start or finish zombie melee attacks through the floor", () => {
  for (const playerUpstairs of [false, true]) {
    for (const attack of [0, 0.02]) {
      const s = quiet();
      s.player = playerUpstairs ? upper(-4, 35) : ground(-4, 35);
      s.enemies = [enemy(playerUpstairs ? ground(-4, 35) : upper(-4, 35),
        { speed: 0, attack })];
      tick(s, 1.2);
      assert.equal(s.health, RULES.health);
      assert.equal(s.events.some(event => event.type === "hurt"), false);
      assert.equal(s.events.some(event => event.type === "zombieAttack"), false);
    }
  }
});

test("upstairs gunfire uses elevated muzzle and enemy hit volumes", () => {
  const s = quiet();
  s.player = upper(-8, 35);
  const upstairs = enemy(upper(-4, 35), { speed: 0 });
  const downstairs = enemy(ground(-4, 35), { id: 2, speed: 0 });
  s.enemies = [downstairs, upstairs];
  aimAt(s, { x: upstairs.x, z: upstairs.z, y: HOTEL.floorY + 1.23 });
  assert.equal(s.fire(), true);
  assert.ok(upstairs.health < 500, "upper body receives aimed bullet");
  assert.equal(downstairs.health, 500, "lower actor sharing XZ is not hit");
});

test("the mezzanine floor blocks aimed bullets in both vertical directions", () => {
  for (const playerUpstairs of [false, true]) {
    const s = quiet();
    s.player = playerUpstairs ? upper(-4, 35) : ground(-4, 35);
    const target = enemy(playerUpstairs ? ground(-3, 35) : upper(-3, 35), { speed: 0 });
    s.enemies = [target];
    aimAt(s, { x: target.x, z: target.z, y: target.y + 1.23 });
    const magazine = s.inventory.pistol.mag;
    assert.equal(s.fire(), true);
    assert.equal(s.inventory.pistol.mag, magazine - 1);
    assert.equal(target.health, 500, "solid floor must occlude the aimed hit volume");
  }
});

test("a grenade thrown upstairs begins at the player's elevated hand height", () => {
  const s = quiet();
  s.player = upper(-4, 35);
  assert.equal(s.throwGrenade(), true);
  close(s.projectiles[0].y, HOTEL.floorY + 1.5, 1e-6, "grenade hand height");
});

test("an upstairs grenade bounces on the mezzanine and its blast cannot cross the floor", () => {
  const s = quiet();
  s.player = upper(-8, 35);
  const upstairs = enemy(upper(-3.5, 35), { speed: 0 });
  const downstairs = enemy(ground(-3.5, 35), { id: 2, speed: 0 });
  s.enemies = [upstairs, downstairs];
  s.projectiles = [{ id: 1, x: -4, y: HOTEL.floorY + 0.5, z: 35,
    vx: 0, vy: -3, vz: 0, fuse: 1.4 }];
  let bounced = false;
  for (let i = 0; i < 1.6 / DT && s.projectiles.length; i++) {
    const previousVy = s.projectiles[0].vy;
    s.step(DT, idle);
    const grenade = s.projectiles[0];
    if (grenade) {
      assert.ok(grenade.y >= HOTEL.floorY + 0.07,
        `grenade must remain on upper floor: ${JSON.stringify(grenade)}`);
      if (previousVy < 0 && grenade.vy > 0) bounced = true;
    }
  }
  assert.ok(bounced, "descending grenade rebounds from upper floor");
  assert.equal(s.projectiles.length, 0);
  assert.equal(s.events.filter(event => event.type === "explosion").length, 1);
  assert.ok(upstairs.health < 500, "blast reaches same-floor target");
  assert.equal(downstairs.health, 500, "floor shields target directly beneath blast");
});

test("sprint input descends each curved stair and retraces the same path upstairs without height jumps", () => {
  for (const stair of HOTEL.stairs) {
    const s = quiet();
    const route = [
      upper(stair.cx - stair.side, stair.cz + 4),
      ...Array.from({ length: 33 }, (_, i) => stairPoint(stair, 1 - i / 32)),
      ground(stair.cx - stair.side, stair.cz - 4),
    ];
    s.player = { ...route[0] };
    const sprint = { ...idle, forward: 1, sprint: true };
    let maxDisplacement = 0;
    for (const [waypoints, direction] of [[route.slice(1), -1], [route.slice(0, -1).reverse(), 1]]) {
      for (const target of waypoints) {
        for (let attempts = 0; attempts < 6; attempts++) {
          const dx = target.x - s.player.x, dz = target.z - s.player.z;
          const remaining = Math.hypot(dx, dz);
          if (remaining < 1e-6) break;
          s.yaw = Math.atan2(dx, dz);
          const before = { ...s.player };
          const dt = Math.min(DT, remaining / RULES.sprint);
          s.step(dt, sprint);
          const heightChange = (s.player.y ?? 0) - (before.y ?? 0);
          const displacement = Math.hypot(s.player.x - before.x, s.player.z - before.z, heightChange);
          maxDisplacement = Math.max(maxDisplacement, displacement);
          assert.equal(s.sprinting, true);
          assert.ok(displacement <= 0.38, `one sprint frame cannot teleport: ${displacement}`);
          assert.ok(Math.abs(heightChange) <= 0.14, `one sprint frame cannot snap height: ${heightChange}`);
          assert.ok(heightChange * direction >= -0.001, "height follows stair travel direction");
        }
        close(s.player.x, target.x, 0.03, "sprint reaches curve waypoint x");
        close(s.player.z, target.z, 0.03, "sprint reaches curve waypoint z");
        close(s.player.y, target.y, 0.04, "sprint foot height follows curve waypoint");
      }
      close(s.player.y, direction === -1 ? 0 : HOTEL.floorY, 1e-6,
        "sprint crosses the stair landing at the correct height");
      assert.equal(s.player.surfaceId, direction === -1 ? "ground" : "hotel-upper");
    }
    assert.ok(maxDisplacement > 0.3, "route exercises full-duration sprint frames");
  }
});

test("blocking the left stair makes an enemy physically reach the player using the right stair", () => {
  const s = quiet();
  const [left, right] = HOTEL.stairs;
  s.player = upper(-4, 35);
  const pursuer = enemy(ground(-4, 35));
  s.enemies = [pursuer];
  // Cross the full radial width at the left stair's midpoint, leaving the other route open.
  s.rects = [...s.rects, {
    id: "test-left-stair-closure", x: left.cx + left.side * 4, z: left.cz,
    w: left.outerRadius - left.innerRadius + 0.8, d: 1.2, h: 8,
  }];
  s.navigation.rebuild(s.rects);
  s.navigation.update(s.player);
  let usedRightStair = false;
  let attacked = false;
  for (let i = 0; i < 100 / DT; i++) {
    const before = { ...pursuer };
    s.step(DT, idle);
    const displacement = Math.hypot(pursuer.x - before.x, pursuer.z - before.z,
      (pursuer.y ?? 0) - (before.y ?? 0));
    assert.ok(displacement < 0.18, "blocked-route recovery must walk rather than teleport");
    if ((pursuer.y ?? 0) > 0.5 && (pursuer.y ?? 0) < 3.5) {
      assert.equal(pursuer.surfaceId, right.id, "pursuit must use the open stair");
      usedRightStair = true;
    }
    if (s.events.some(event => event.type === "hurt")) { attacked = true; break; }
  }
  assert.ok(usedRightStair, "enemy traverses the unblocked stair");
  assert.ok(attacked, `enemy reaches the upstairs player: ${JSON.stringify(pursuer)}`);
  close(pursuer.y, HOTEL.floorY, 0.2, "enemy finishes on the upper floor");
});
