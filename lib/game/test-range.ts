import { Simulation, WEAPON_ORDER, WEAPONS } from './simulation.ts';
import { RANGE_SPAWN } from './test-range-layout.ts';
export type RangeScenario = 'targets' | 'pursuit' | 'blast' | 'empty';
export function refillRange(s: Simulation) {
  s.health = s.maxHealth;
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
