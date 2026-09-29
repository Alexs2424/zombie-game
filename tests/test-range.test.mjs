import test from 'node:test';
import assert from 'node:assert/strict';
import {createRange, refillRange, addRangeEnemies} from '../lib/game/test-range.ts';
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

test('adding enemies preserves the session and chooses free, separated positions',()=>{
 const s=createRange('blast');s.pause();s.health=43;s.inventory.pistol.mag=4;
 const player={...s.player};
 assert.equal(addRangeEnemies(s,5),5);
 assert.equal(addRangeEnemies(s,10,true),10);
 assert.equal(s.phase,'paused');assert.equal(s.health,43);assert.equal(s.inventory.pistol.mag,4);
 assert.deepEqual(s.player,player);assert.equal(new Set(s.enemies.map(e=>e.id)).size,15);
 for(const e of s.enemies){assert.equal(collides(e,.4,s.rects),false);assert.ok(Math.hypot(e.x-player.x,e.z-player.z)>=4);}
 assert.ok(s.enemies.slice(5).every(e=>e.speed===0));
 addRangeEnemies(s,100);assert.equal(s.enemies.length,60);
 assert.equal(addRangeEnemies(s,1),0);
 s.phase='dead';s.enemies=[];assert.equal(addRangeEnemies(s,5),0);
});
