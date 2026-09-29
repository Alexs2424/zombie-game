import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../lib/game/simulation.ts';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createZombie, animateZombie, animateZombieDeath } from '../lib/game/zombies.ts';

test('revamped body variants collapse above either floor and preserve wounds, missing limbs and shading', () => {
  const asset = JSON.parse(readFileSync(new URL('../public/models/zombies.json', import.meta.url)));
  // Geometry and material metadata are real; headless rendering needs no HTTP textures.
  delete asset.surfaces;
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    for (let id=0; id<6; id++) {
      const v = createZombie(scene,id,asset);
      const e = {...setup().e,id,y:id<3?0:4,yaw:1.1,wounds:{body:2},missing:{leftArm:true,rightLeg:true}};
      for (const age of [0,.25,.6,.95,2,5.25,6]) {
        animateZombieDeath(v,e,age);
        assert.equal(v.pivots.leftArm.isEnabled(),false);
        assert.equal(v.pivots.rightLeg.isEnabled(),false);
        assert.equal(v.wounds.find(w=>w.stump&&w.region==='leftArm').mesh.isEnabled(),true);
        v.root.computeWorldMatrix(true);
        for (const mesh of v.root.getChildMeshes()) {
          if (!mesh.isEnabled()) continue;
          mesh.computeWorldMatrix(true);
          assert.ok(mesh.getBoundingInfo().boundingBox.minimumWorld.y >= e.y-.001, `${id} age ${age}: ${mesh.name} below floor`);
          assert.equal(mesh.useVertexColors,true);
        }
        assert.ok(v.materials.every(m=>Math.abs(m.alpha-(age<=4.5?1:(6-age)/1.5))<1e-6));
      }
      animateZombie(v,{...e,health:50});
      assert.ok(v.materials.every(m=>m.alpha===1));
      assert.ok(v.materials.find(m=>m.name.endsWith('-eye')).emissiveColor.r>0);
      v.root.dispose();v.shadow.dispose();v.materials.forEach(m=>m.dispose());
    }
  } finally { scene.dispose();engine.dispose(); }
});

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
