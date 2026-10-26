import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { Simulation, WEAPONS, WEAPON_ORDER, MYSTERY_WEAPONS, PURCHASES } from "../lib/game/simulation.ts";
import { EXTRA_WEAPONS, MYSTERY_POOL, isMelee, weaponSpeed, AXE_CABINET } from "../lib/game/weapon-expansion.ts";
import { VIEWMODELS } from "../lib/game/weapon-viewmodels.ts";
import { WEAPON_SOUNDS } from "../lib/game/weapon-audio.ts";

const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
const tick = (s, seconds) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.05) s.step(0.05, idle);
};
function quiet() {
  const s = new Simulation();
  s.start();
  s.intermission = 1e6;
  s.player = { x: -12, z: -5 };
  s.yaw = 0;
  s.pitch = 0;
  return s;
}
function enemy(id, x, z, health = 1000) {
  return { id, x, z, health, maxHealth: health, speed: 0, yaw: Math.PI, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 5 };
}
function give(s, id) {
  s.inventory[id] = { owned: true, mag: s.capacity(id), reserve: WEAPONS[id].reserve };
  s.switchWeapon(id);
  s.fireCooldown = 0;
}
const SPEC_IDS = ["magnum", "tommy", "doublebarrel", "dual", "machinepistol", "lever", "autoshotgun", "sniper", "lmg", "launcher"];

test("the Velvet Fortune awards exactly the ten 1970s firearms from the spec", () => {
  assert.deepEqual([...MYSTERY_POOL], SPEC_IDS);
  assert.deepEqual(MYSTERY_WEAPONS, SPEC_IDS);
  for (const id of SPEC_IDS) {
    assert.ok(WEAPON_ORDER.includes(id));
    assert.equal(isMelee(id), false);
  }
  assert.ok(!MYSTERY_WEAPONS.includes("stick") && !MYSTERY_WEAPONS.includes("axe"));
  // The poker table's revolver keeps its id; the High Roller ships as `magnum`.
  assert.equal(WEAPONS.revolver.name, "THE DEAD MAN’S HAND");
  assert.equal(WEAPONS.magnum.name, "HIGH ROLLER");
});

test("gameplay targets from the spec: capacities, reserves, rates and mobility", () => {
  const cap = Object.fromEntries(SPEC_IDS.map((id) => [id, EXTRA_WEAPONS[id].magazine]));
  assert.deepEqual(cap, { magnum: 6, tommy: 50, doublebarrel: 2, dual: 16, machinepistol: 32, lever: 8, autoshotgun: 5, sniper: 5, lmg: 60, launcher: 1 });
  assert.equal(WEAPONS.lmg.reserve, 240);
  assert.equal(WEAPONS.launcher.reserve, 8);
  const firearms = SPEC_IDS.filter((id) => id !== "launcher");
  const bullet = firearms.filter((id) => WEAPONS[id].pellets === 1);
  // Bolt action: highest single-shot damage, balanced by the slowest cadence.
  assert.equal(bullet.reduce((a, b) => (WEAPONS[a].damage >= WEAPONS[b].damage ? a : b)), "sniper");
  // The Enforcer: smallest automatic interval; Eye in the Sky: the longest shot-to-shot delay.
  assert.equal(firearms.reduce((a, b) => (WEAPONS[a].interval <= WEAPONS[b].interval ? a : b)), "machinepistol");
  assert.equal(firearms.reduce((a, b) => (WEAPONS[a].interval >= WEAPONS[b].interval ? a : b)), "sniper");
  assert.equal(firearms.reduce((a, b) => (WEAPONS[a].spread <= WEAPONS[b].spread ? a : b)), "sniper");
  // House Edge: longest firearm reload and a 22% movement penalty.
  assert.equal(firearms.reduce((a, b) => (WEAPONS[a].reload >= WEAPONS[b].reload ? a : b)), "lmg");
  assert.ok(Math.abs(weaponSpeed("lmg") - 0.78) < 1e-9);
  assert.ok(weaponSpeed("dual") > 1 && weaponSpeed("tommy") < 1);
  assert.ok(WEAPONS.doublebarrel.pellets > WEAPONS.autoshotgun.pellets);
  assert.ok(WEAPONS.doublebarrel.spread > WEAPONS.autoshotgun.spread);
});

test("Double or Nothing: primary spends one shell, alternate fire spends both at once", () => {
  const s = quiet();
  give(s, "doublebarrel");
  assert.equal(s.fire(), true);
  assert.equal(s.inventory.doublebarrel.mag, 1);
  assert.equal(s.events.filter((e) => e.type === "shot").at(-1).alternate, false);
  s.inventory.doublebarrel.mag = 2;
  s.fireCooldown = 0;
  assert.equal(s.fire(true), true);
  assert.equal(s.inventory.doublebarrel.mag, 0);
  assert.equal(s.events.filter((e) => e.type === "shot").at(-1).alternate, true);
});

test("Snake Eyes fires left and right pistols in sequence", () => {
  const s = quiet();
  give(s, "dual");
  const sides = [];
  for (let i = 0; i < 4; i++) {
    s.fireCooldown = 0;
    s.fire();
    sides.push(s.events.filter((e) => e.type === "shot").at(-1).side);
  }
  assert.deepEqual(sides, [0, 1, 0, 1]);
  assert.equal(s.inventory.dual.mag, 12);
});

test("Silver Dollar and Last Call load one cartridge at a time and firing interrupts the reload", () => {
  for (const id of ["lever", "autoshotgun"]) {
    const s = quiet();
    give(s, id);
    s.inventory[id].mag = 0;
    assert.equal(s.reload(), true);
    tick(s, WEAPONS[id].reload + 0.05);
    assert.equal(s.inventory[id].mag, 1, `${id} loads a single round per cycle`);
    assert.ok(s.reloadRemaining > 0, `${id} keeps loading`);
    assert.ok(s.events.some((e) => e.type === "reloadDone"));
    s.fireCooldown = 0;
    assert.equal(s.fire(), true, `${id} can fire mid-reload`);
    assert.equal(s.reloadRemaining, 0);
    assert.equal(s.inventory[id].mag, 0);
  }
});

test("penetration: Silver Dollar reaches three zombies in a line, Eye in the Sky four, pistols one", () => {
  for (const [id, expected] of [["lever", 3], ["sniper", 4], ["magnum", 1]]) {
    const s = quiet();
    s.random = () => 0.5;
    give(s, id);
    s.enemies = [1, 2, 3, 4, 5].map((k) => enemy(k, -12, -5 + k * 1.1));
    s.fire();
    assert.equal(s.enemies.filter((e) => e.health < 1000).length, expected, id);
  }
});

test("automatic weapons bloom under a held trigger and settle when released", () => {
  const s = quiet();
  give(s, "tommy");
  for (let i = 0; i < 12; i++) {
    s.fireCooldown = 0;
    s.fire();
  }
  assert.ok(s.bloom > 0.02);
  tick(s, 1);
  assert.equal(s.bloom, 0);
  give(s, "sniper");
  s.fire();
  assert.equal(s.bloom, 0);
});

test("an empty gun with no reserve clicks dry instead of reloading", () => {
  const s = quiet();
  give(s, "magnum");
  s.inventory.magnum = { owned: true, mag: 0, reserve: 0 };
  assert.equal(s.fire(), false);
  assert.ok(s.events.some((e) => e.type === "dry" && e.weapon === "magnum"));
  assert.equal(s.reloadRemaining, 0);
});

test("Stickman sweeps a 2.8 m, 100-degree fan, only successful hits wear it, and it breaks after three", () => {
  const s = quiet();
  give(s, "magnum");
  s.stickTaken = true;
  s.inventory.stick = { owned: true, mag: 3, reserve: 0 };
  s.switchWeapon("stick");
  // A miss is free.
  s.enemies = [];
  s.fire();
  tick(s, 0.7);
  assert.equal(s.inventory.stick.mag, 3);
  // 45 degrees off-axis is inside the fan, 60 degrees is outside, 3.2 m is out of reach.
  const at = (deg, r) => ({ x: -12 + Math.sin((deg * Math.PI) / 180) * r, z: -5 + Math.cos((deg * Math.PI) / 180) * r });
  for (let swing = 1; swing <= 3; swing++) {
    const a = at(45, 2), b = at(-60, 2), c = at(0, 3.2), d = at(-10, 1.2);
    s.enemies = [enemy(1, a.x, a.z), enemy(2, b.x, b.z), enemy(3, c.x, c.z), enemy(4, d.x, d.z)];
    s.fireCooldown = 0;
    s.fire();
    tick(s, 0.35);
    const hit = s.events.filter((e) => e.type === "meleeHit").at(-1);
    assert.equal(hit.count, 2, "two zombies inside the fan");
    assert.equal(s.enemies.find((e) => e.id === 2).health, 1000);
    assert.equal(s.enemies.find((e) => e.id === 3).health, 1000);
    assert.equal(s.inventory.stick.mag, 3 - swing);
    tick(s, 0.4);
  }
  assert.ok(s.events.some((e) => e.type === "stickBreak"));
  assert.equal(s.inventory.stick.owned, false);
  assert.equal(s.weapon, "magnum", "returns to the last owned firearm");
  assert.equal(s.purchaseInfo("stick").reason, "Rake already taken");
  assert.ok(!MYSTERY_WEAPONS.includes("stick"));
});

test("Fire Exit hangs in the relocated supply room, chops one zombie hard and never breaks", () => {
  const s = quiet();
  const p = PURCHASES.find((p) => p.id === "axe");
  assert.ok(Math.abs(p.x - AXE_CABINET.x) < 0.01 && p.z < AXE_CABINET.z);
  s.player = { x: p.x, z: p.z };
  s.points = 0;
  assert.equal(s.purchase("axe"), false);
  s.hotel = true; s.doorsOpen.supply = true; s.refreshMap();
  assert.equal(s.purchase("axe"), true);
  assert.equal(s.weapon, "axe");
  assert.equal(s.purchase("axe"), false);
  s.player = { x: -12, z: -5 };
  s.yaw = 0;
  for (let i = 0; i < 5; i++) {
    s.enemies = [enemy(1, -12, -3.6), enemy(2, -11.8, -3.4)];
    s.fireCooldown = 0;
    assert.equal(s.fire(), true);
    assert.equal(s.switchWeapon("pistol"), undefined);
    assert.equal(s.weapon, "axe", "no firearm use during the swing");
    tick(s, 1.2);
    assert.equal(s.enemies.filter((e) => e.health < 1000).length, 1, "single target");
  }
  assert.equal(s.inventory.axe.owned, true);
});

test("Debt Collector lobs one 40 mm round that bursts on impact, falls off with distance and can hurt the shooter", () => {
  const s = quiet();
  give(s, "launcher");
  s.enemies = [enemy(1, -12, 1, 400), enemy(2, -9.4, 1.4, 400)];
  s.fire();
  assert.equal(s.inventory.launcher.mag, 0);
  assert.equal(s.projectiles.length, 1);
  s.fireCooldown = 0;
  assert.equal(s.fire(), false, "no automatic follow-up");
  tick(s, 1.6);
  const boom = s.events.find((e) => e.type === "explosion");
  assert.equal(boom.weapon, "launcher");
  const [near, far] = s.enemies;
  assert.ok(near.health < far.health && far.health < 400);
  // Point blank: the splash reaches the player too.
  const t = quiet();
  give(t, "launcher");
  t.pitch = 1.2;
  const health = t.health;
  t.fire();
  tick(t, 2);
  assert.ok(t.health < health);
});

test("launcher starts at the upstairs hand and its blast cannot cross the hotel floor", () => {
  const s = quiet();
  s.hotel = true;
  s.refreshMap();
  s.player = { x: -4, z: 40, y: 4, surfaceId: "hotel-upper" };
  give(s, "launcher");
  s.pitch = 1.2;
  const downstairs = { ...enemy(99, -4, 40, 400), y: 0 };
  s.enemies = [downstairs];
  s.fire();
  assert.equal(s.projectiles[0].y, 5.5);
  tick(s, .5);
  assert.ok(s.events.some(e => e.type === "explosion" && e.weapon === "launcher"));
  assert.equal(downstairs.health, 400);
});

test("every Mystery Box weapon and special has a model, a viewmodel rig, foley and HUD art", () => {
  for (const id of [...SPEC_IDS, "stick", "axe"]) {
    assert.ok(existsSync(new URL(`../public/models/${id}.glb`, import.meta.url)), `${id}.glb`);
    assert.ok(existsSync(new URL(`../assets/source/weapons-1970s/${id}.blend`, import.meta.url)), `${id}.blend`);
    assert.ok(VIEWMODELS[id], `${id} viewmodel`);
    for (const name of WEAPON_SOUNDS[id]) assert.ok(existsSync(new URL(`../public/audio/weapons/${id}/${name}.wav`, import.meta.url)), `${id}/${name}`);
    for (const kind of ["side", "card"]) assert.ok(existsSync(new URL(`../public/ui/weapons/${id}-${kind}.webp`, import.meta.url)), `${id} ${kind}`);
  }
  for (const id of SPEC_IDS)
    for (const name of ["dry", "pickup"]) assert.ok(WEAPON_SOUNDS[id].includes(name), `${id} ${name}`);
  for (const id of ["stick", "axe"]) for (const name of ["swing", "pickup"]) assert.ok(WEAPON_SOUNDS[id].includes(name));
  assert.ok(WEAPON_SOUNDS.stick.includes("break"));
  const glb = readFileSync(new URL("../public/models/magnum.glb", import.meta.url));
  assert.equal(glb.toString("ascii", 0, 4), "glTF");
});

test("viewmodel choreography stays finite and cue points are ordered inside each reload", () => {
  for (const [id, spec] of Object.entries(VIEWMODELS)) {
    const cues = spec.reloadCues.map(([at]) => at);
    assert.deepEqual([...cues].sort((a, b) => a - b), cues, id);
    assert.ok(cues.every((c) => c > 0 && c < 1), id);
    for (const reload of [0, 0.1, 0.33, 0.5, 0.71, 0.99]) {
      for (const since of [0, 0.02, 0.2, 0.5, 1.5]) {
        const pose = spec.animate({
          time: 3.2, sinceShot: since, shots: 7, lastAlt: false, lastSide: 1, interval: 0.2, reloading: reload > 0, reload,
          reloadDuration: 2, sinceReloadDone: 9, reloadBlend: reload > 0 ? 1 : 0, mag: 1, capacity: 6,
          melee: isMelee(id) ? reload : -1, meleeHit: true, equip: 2, moving: true, sprinting: false,
        });
        const values = [...pose.pos, ...pose.rot];
        for (const n of Object.values(pose.nodes)) values.push(...(n.pos ?? []), ...(n.rot ?? []));
        for (const h of [pose.left, pose.right]) if (h) values.push(...(h.pos ?? []), ...(h.rot ?? []));
        assert.ok(values.every(Number.isFinite), `${id} ${reload} ${since}`);
      }
    }
  }
});
