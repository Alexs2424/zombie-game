import { Simulation, WEAPON_ORDER, WEAPONS } from './simulation.ts';
import { collides, hasSight } from './world.ts';
import { RANGE_SPAWN } from './test-range-layout.ts';
export type RangeScenario = 'targets' | 'pursuit' | 'blast' | 'empty';
export function refillRange(s: Simulation) {
  s.health = s.maxHealth;
  s.stamina = 100; s.staminaDelay = 0; s.sprintExhausted = false;
  s.grenades = 20;
  for (const id of WEAPON_ORDER) s.inventory[id] = {owned:true,mag:s.capacity(id),reserve:WEAPONS[id].reserve};
}
/** Fresh deterministic state; uses production movement, weapons, hits and damage. */
export function createRange(scenario: RangeScenario = 'targets') {
  const s = new Simulation(true);
  s.player = {...RANGE_SPAWN};
  s.yaw = 0;
  s.pitch = 0;
  s.start();
  s.points = 10000;
  s.intermission = Infinity;
  s.round = 1;
  refillRange(s);
  if (scenario === 'blast') s.player = {x:111,y:0,z:6,surfaceId:'ground'};
  const targets = scenario === 'targets' ? [[96,5],[98,10],[102,20]] : scenario === 'pursuit' ? [[95,16],[98,19],[101,22]] : [];
  s.enemies = targets.map(([x,z],i) => ({id:i+1,x,z,y:0,surfaceId:'ground',health:100,maxHealth:100,speed:scenario === 'targets'?0:1.7,yaw:Math.PI,attack:0,cooldown:0,stuck:0,flash:0,age:0}));
  s.nextId = 10;
  s.refreshMap();
  return s;
}

export const RANGE_ENEMY_LIMIT = 60;
/** Add actors without changing the current run or spawning inside cover/the player. */
export function addRangeEnemies(s: Simulation, count: number, stationary = false) {
  if (!s.testRange || s.phase === 'dead' || !Number.isFinite(count)) return 0;
  const wanted = Math.min(Math.max(0, Math.floor(count)), RANGE_ENEMY_LIMIT - s.enemies.length);
  const candidates = [];
  for (let x = 92; x <= 116; x += 1.5) for (let z = -2; z <= 28; z += 1.5) {
    const p = {x, z, y: 0, surfaceId: 'ground'};
    const dx = x - s.player.x, dz = z - s.player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 4 || collides(p, .4, s.rects)) continue;
    const forward = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw);
    const score = Math.abs(distance - 8) + (forward < 0 ? 30 : 0) + (hasSight(s.player, p, s.rects) ? 0 : 20);
    candidates.push({p, score});
  }
  candidates.sort((a,b) => a.score - b.score);
  let added = 0;
  for (const {p} of candidates) {
    if (added >= wanted) break;
    if (s.enemies.some(e => Math.hypot(e.x-p.x, e.z-p.z) < 1.2)) continue;
    s.enemies.push({...p, id:s.nextId++, health:100, maxHealth:100,
      speed:stationary ? 0 : 1.7, yaw:Math.atan2(s.player.x-p.x,s.player.z-p.z),
      attack:0, cooldown:0, stuck:0, flash:0, age:0});
    added++;
  }
  return added;
}
