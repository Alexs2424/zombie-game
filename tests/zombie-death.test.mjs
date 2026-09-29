import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../lib/game/simulation.ts';

const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
function setup() {
  const s = new Simulation(); s.start(); s.intermission = 1000;
  const e = { id: 50, x: -12, z: -3, y: 4, health: 50, maxHealth: 50,
    speed: 0, yaw: 0, age: 1, attack: 0, cooldown: 0, stuck: 0, flash: 0,
    missing: { leftArm: true } };
  s.enemies = [e];
  return { s, e };
}
test('a kill retains its floor and missing limbs without duplicate rewards or live enemies', () => {
  const { s, e } = setup();
  s.damageEnemy(e, 100, false);
  const points = s.points;
  s.damageEnemy(e, 100, false);
  s.step(.05, idle);
  assert.equal(s.enemies.length, 0);
  assert.equal(s.kills, 1);
  assert.equal(s.points, points);
  assert.equal(s.corpses.length, 1);
  assert.equal(s.corpses[0].enemy.y, 4);
  assert.equal(s.corpses[0].enemy.missing.leftArm, true);
});
test('corpse lifetime freezes on pause, expires after the fade, and resets with a new run', () => {
  const { s, e } = setup(); s.damageEnemy(e, 100, true);
  s.pause(); s.step(.05, idle);
  assert.equal(s.corpses[0].age, 0);
  s.resume();
  for (let i=0;i<100;i++) s.step(.05, idle);
  assert.equal(s.corpses.length, 1);
  for (let i=0;i<22;i++) s.step(.05, idle);
  assert.equal(s.corpses.length, 0);
  assert.equal(new Simulation().corpses.length, 0);
});
