import test from 'node:test';
import assert from 'node:assert/strict';
import {createRange, refillRange} from '../lib/game/test-range.ts';
import {moveActor, collides, hasSight} from '../lib/game/world.ts';

test('range resets real loadout and damage state without automatic waves',()=>{
 const s=createRange(); assert.equal(s.invulnerable,0); assert.equal(s.enemies.length,3);
 assert.ok(Object.values(s.inventory).every(w=>w.owned));
 s.health=12;s.grenades=0;refillRange(s);assert.equal(s.health,100);assert.equal(s.grenades,20);
 const fresh=createRange();assert.deepEqual(fresh.enemies,createRange().enemies);assert.equal(fresh.intermission,Infinity);
});
test('range movement is bounded and cover blocks line of sight',()=>{
 const s=createRange('blast');assert.equal(collides(s.player,.3,s.rects),false);
 const p={...s.player};moveActor(p,2,0,.3,s.rects);assert.ok(Math.abs(p.x-113)<1e-6);
 moveActor(p,100,0,.3,s.rects);assert.ok(p.x<118);
 assert.equal(hasSight({x:111,z:10},{x:111,z:14},s.rects),false);
 assert.equal(hasSight({x:98,z:10},{x:98,z:14},s.rects),true);
});
test('scenario selection creates only the requested actors',()=>{
 assert.equal(createRange('empty').enemies.length,0);
 assert.equal(createRange('blast').enemies.length,0);
 assert.ok(createRange('pursuit').enemies.every(e=>e.speed>0));
 assert.ok(createRange('targets').enemies.every(e=>e.speed===0));
});
