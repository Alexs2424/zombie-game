import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, RULES, WEAPONS, WEAPON_ORDER, SPAWNS, ALL_SPAWNS, collides, moveActor } from '../lib/game/simulation.ts';
import { HOTEL_RULES, HOTEL_ANCHORS, HOTEL_SPAWNS, HOTEL_SERVICE_DOORS } from '../lib/game/hotel-gameplay.ts';
import { raycastWorld } from '../lib/game/world.ts';

const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
function quiet() {
  const s = new Simulation(); s.start(); s.intermission = 1e6;
  s.random = () => .5; return s;
}
function tick(s, seconds) { for (let i=0; i<Math.ceil(seconds/.05); i++) s.step(.05,idle); }
function at(s, id) {
  const p=HOTEL_ANCHORS[id];
  s.player={...p,surfaceId:p.y===4?'hotel-upper':'ground'};
}
function buyHotel(s) { s.points=2000; at(s,'hotel'); assert.equal(s.purchase('hotel'),true); }
function readyBell(s) { buyHotel(s); s.hotelAge=4; at(s,'hotelBell'); }
function killAmbush(s) { for(const e of s.enemies) if(e.hotelAmbush && e.health>0) s.damageEnemy(e,10000,false); }
function finish(s) {
  for(let i=0;i<1200 && s.hotelChallenge.phase==='active';i++) { killAmbush(s); s.step(.05,idle); }
  assert.equal(s.hotelChallenge.phase,'complete');
}
function dummy(x,z) { return {id:100+x,x,z,y:0,surfaceId:'ground',health:100,maxHealth:100,speed:0,yaw:0,attack:0,cooldown:0,stuck:0,flash:0,age:0}; }

test('hotel gate charges 2000 chips once and unlocks both floors for this run',()=>{
  const s=quiet(); at(s,'hotel');
  const blocked={...s.player}; moveActor(blocked,0,8,RULES.playerRadius,s.rects); assert.ok(blocked.z<12);
  s.points=1999; assert.equal(s.purchase('hotel'),false); assert.equal(s.points,1999); assert.equal(s.hotel,false);
  s.points=2500; assert.equal(s.purchase('hotel'),true); assert.equal(s.points,500); assert.equal(s.hotelAge,0);
  assert.equal(s.purchase('hotel'),false); assert.equal(s.points,500);
  moveActor(s.player,0,8,RULES.playerRadius,s.rects); assert.ok(s.player.z>17); assert.equal(s.player.y,0);
  assert.equal(s.rects.some(r=>r.id==='hotel'),false);
});
test('hotel interactions reject distance, wrong floor, locked access and pause',()=>{
  const s=quiet(); s.points=5000; assert.equal(s.purchase('hotel'),false);
  at(s,'hotelBell'); assert.equal(s.purchase('hotelBell'),false);
  buyHotel(s); at(s,'hotelBell'); s.player.y=0; s.player.surfaceId='ground'; assert.equal(s.purchase('hotelBell'),false);
  at(s,'hotelBell'); s.pause(); assert.equal(s.purchase('hotelBell'),false); s.resume();
  assert.equal(s.purchase('hotelBell'),true); assert.equal(s.purchase('hotelBell'),false);
  assert.equal(s.events.filter(e=>e.type==='hotelBell').length,1);
});
test('hotel entrances are delayed, valid on both floors, and connected after purchase',()=>{
  const s=quiet();
  for(let i=SPAWNS.length;i<ALL_SPAWNS.length;i++) assert.equal(s.spawnEnabled(i),false);
  buyHotel(s);
  for(let i=SPAWNS.length;i<ALL_SPAWNS.length;i++) assert.equal(s.spawnEnabled(i),false);
  tick(s,HOTEL_RULES.spawnGrace+.1);
  for(let i=SPAWNS.length;i<ALL_SPAWNS.length;i++) {
    assert.equal(s.spawnEnabled(i),true); assert.equal(collides(ALL_SPAWNS[i],.35,s.rects),false);
    assert.ok(s.navigation.distance[s.navigation.index(ALL_SPAWNS[i])]>=0);
  }
  assert.ok(HOTEL_SPAWNS.some(p=>p.y===0)); assert.ok(HOTEL_SPAWNS.some(p=>p.y===4));
});
test('hotel normal-wave spawns keep their floor identity and add modest pressure',()=>{
  const s=quiet(); buyHotel(s); s.hotelAge=4; s.round=3; s.waveRemaining=4; s.random=()=>.999;
  assert.equal(s.spawn(),true); const e=s.enemies[0];
  assert.equal(e.surfaceId,'hotel-upper'); assert.equal(e.y,4); assert.equal(e.hotelAmbush,undefined);
  assert.equal(s.waveRemaining,3); assert.ok(e.speed>2.1); assert.ok(e.health>100);
});
test('bell ambush owns a finite budget and pauses regular spawning without clearing existing enemies',()=>{
  const s=quiet(); readyBell(s); s.round=3; s.intermission=0; s.waveRemaining=7; s.spawnTimer=.3;
  s.enemies=[dummy(-8,-8)];
  assert.equal(s.purchase('hotelBell'),true); tick(s,8);
  assert.equal(s.waveRemaining,7); assert.equal(s.spawnTimer,.3); assert.equal(s.round,3);
  assert.ok(s.enemies.some(e=>e.id===92));
  assert.ok(s.hotelChallengeAlive>0); assert.ok(s.hotelChallengeAlive<=HOTEL_RULES.ambushCap);
  assert.equal(s.hotelChallenge.pending+s.hotelChallengeAlive,HOTEL_RULES.ambushCount);
  assert.ok(s.hotelChallenge.remaining<35 && s.hotelChallenge.remaining>26);
});
test('ambush respects both concurrent caps and cannot spend pending budget with no capacity',()=>{
  const s=quiet(); readyBell(s); s.enemies=Array.from({length:RULES.cap},(_,i)=>dummy(-15+i*.8,-8));
  assert.equal(s.purchase('hotelBell'),true); tick(s,3);
  assert.equal(s.enemies.length,RULES.cap); assert.equal(s.hotelChallenge.pending,12); assert.equal(s.hotelChallengeAlive,0);
  s.enemies=[]; tick(s,12); assert.ok(s.hotelChallengeAlive<=6); assert.ok(s.enemies.length<=14);
});
test('surviving the timer alone cannot unlock the reward while ambush enemies remain',()=>{
  const s=quiet(); readyBell(s); s.invulnerable=1e6; assert.equal(s.purchase('hotelBell'),true); tick(s,36);
  assert.equal(s.hotelChallenge.remaining,0); assert.equal(s.hotelChallenge.phase,'active');
  assert.equal(s.inventory.tommy.owned,false); assert.ok(s.hotelChallenge.pending+s.hotelChallengeAlive>0);
});
test('clearing all twelve ambush enemies early still requires 35 seconds upstairs',()=>{
  const s=quiet(); readyBell(s); assert.equal(s.purchase('hotelBell'),true);
  for(let i=0;i<450;i++) { killAmbush(s); s.step(.05,idle); }
  killAmbush(s); assert.equal(s.hotelChallenge.pending,0); assert.equal(s.hotelChallengeAlive,0);
  assert.ok(s.hotelChallenge.remaining>10); assert.equal(s.inventory.tommy.owned,false);
  finish(s); assert.equal(s.inventory.tommy.owned,true);
});
test('successful service grants and equips Tommy once, with no free retry chip farming',()=>{
  const s=quiet(); readyBell(s); s.points=123; assert.equal(s.purchase('hotelBell'),true); finish(s);
  assert.equal(s.points,123); assert.equal(s.earned,0); assert.equal(s.kills,12);
  assert.equal(s.weapon,'tommy'); assert.deepEqual(s.inventory.tommy,{owned:true,mag:50,reserve:250});
  assert.equal(s.events.filter(e=>e.type==='hotelComplete').length,1);
  s.inventory.tommy.mag=1; s.inventory.tommy.reserve=2;
  assert.equal(s.purchase('hotelBell'),false); tick(s,1);
  assert.deepEqual(s.inventory.tommy,{owned:true,mag:1,reserve:2});
});
test('leaving the restaurant fails once, preserves survivors and allows retry only after they clear',()=>{
  const s=quiet(); readyBell(s); assert.equal(s.purchase('hotelBell'),true); tick(s,3);
  const alive=s.hotelChallengeAlive; assert.ok(alive>0);
  s.player={x:-15,z:34,y:4,surfaceId:'hotel-stair-left'}; s.step(.05,idle);
  assert.equal(s.hotelChallenge.phase,'failed'); assert.equal(s.hotelChallenge.pending,0);
  assert.equal(s.hotelChallengeAlive,alive); assert.match(s.lastMessage,/ring the bell to retry/);
  at(s,'hotelBell'); assert.equal(s.purchase('hotelBell'),false);
  killAmbush(s); s.step(.05,idle); assert.equal(s.purchase('hotelBell'),true);
  assert.equal(s.hotelChallenge.attempt,2); assert.equal(s.hotelChallenge.pending,12);
  assert.equal(s.events.filter(e=>e.type==='hotelFail').length,1);
});
test('pause freezes all challenge and hotel timers; death fails safely without granting a reward',()=>{
  const s=quiet(); readyBell(s); assert.equal(s.purchase('hotelBell'),true); tick(s,1);
  s.pause(); const saved=JSON.stringify(s.hotelChallenge),age=s.hotelAge; tick(s,40);
  assert.equal(JSON.stringify(s.hotelChallenge),saved); assert.equal(s.hotelAge,age);
  s.resume(); s.hurt(1000); assert.equal(s.phase,'dead'); assert.equal(s.hotelChallenge.phase,'failed');
  const failed=JSON.stringify(s.hotelChallenge); tick(s,50); assert.equal(JSON.stringify(s.hotelChallenge),failed);
  assert.equal(s.inventory.tommy.owned,false);
});
test('Tommy is slot six, fires automatically, reloads conservatively and supports upgrades/refill',()=>{
  const s=quiet(); readyBell(s); s.purchase('hotelBell'); finish(s);
  assert.equal(WEAPON_ORDER[5],'tommy'); assert.equal(WEAPONS.tommy.magazine,50);
  s.fireCooldown=0; assert.equal(s.fire(),true); assert.equal(s.inventory.tommy.mag,49);
  tick(s,.15); assert.equal(s.fire(),true); assert.equal(s.inventory.tommy.mag,48);
  s.inventory.tommy.reserve=1; assert.equal(s.reload(),true); tick(s,3.1);
  assert.equal(s.inventory.tommy.mag,49); assert.equal(s.inventory.tommy.reserve,0);
  s.upgrades.tommy=true; assert.equal(s.capacity('tommy'),75); assert.ok(s.weaponDamage('tommy')>30);
  at(s,'tommyAmmo'); s.points=499; assert.equal(s.purchase('tommyAmmo'),false);
  s.points=500; assert.equal(s.purchase('tommyAmmo'),true); assert.equal(s.points,0);
  assert.equal(s.inventory.tommy.reserve,250); assert.equal(s.inventory.tommy.mag,49);
});
test('jukebox toggles freely only within the unlocked hotel and resets with a new run',()=>{
  const s=quiet(); at(s,'jukebox'); assert.equal(s.purchase('jukebox'),false);
  buyHotel(s); at(s,'jukebox'); const points=s.points;
  assert.equal(s.purchase('jukebox'),true); assert.equal(s.jukeboxOn,true);
  assert.equal(s.purchase('jukebox'),true); assert.equal(s.jukeboxOn,false); assert.equal(s.points,points);
  const fresh=quiet(); assert.equal(fresh.hotel,false); assert.equal(fresh.hotelAge,0);
  assert.equal(fresh.jukeboxOn,false); assert.equal(fresh.hotelChallenge.phase,'idle');
  assert.equal(fresh.inventory.tommy.owned,false); assert.equal(fresh.upgrades.tommy,false);
});

test('regular intermission resumes after success, with its wave budget intact',()=>{
  const s=quiet(); readyBell(s); s.intermission=5; s.waveRemaining=3; s.round=2;
  s.purchase('hotelBell'); tick(s,3); assert.equal(s.intermission,5); assert.equal(s.waveRemaining,3);
  finish(s); assert.ok(s.intermission>4.9 && s.intermission<=5); assert.equal(s.waveRemaining,3);
  tick(s,1); assert.ok(s.intermission<4.1); assert.equal(s.round,2);
});

test('restoring chips cannot purchase ammo for an unearned Tommy or activate the bell downstairs',()=>{
  const s=quiet(); buyHotel(s); at(s,'tommyAmmo'); s.points=1e5;
  assert.equal(s.purchase('tommyAmmo'),false); assert.equal(s.points,1e5);
  at(s,'hotelBell'); s.player.y=0; s.player.surfaceId='ground';
  assert.equal(s.nearestPurchase()?.id==='hotelBell',false); assert.equal(s.purchase('hotelBell'),false);
  assert.equal(s.hotelChallenge.phase,'idle');
});

test('upstairs service door panels stop eye-height bullets without blocking their spawn points',()=>{
  const s=quiet(); buyHotel(s);
  for(const spawn of HOTEL_SPAWNS.filter(p=>p.y>0)) {
    const nx=Math.sin(spawn.door.yaw), nz=Math.cos(spawn.door.yaw);
    const eye={x:spawn.door.x+nx,z:spawn.door.z+nz,y:spawn.y+1.65};
    const hit=raycastWorld(eye,{x:-nx,y:0,z:-nz},s.rects,1.1);
    assert.ok(hit && hit.distance<1.01,spawn.id);
    assert.equal(collides(spawn,.35,s.rects),false,spawn.id);
    assert.equal(HOTEL_SERVICE_DOORS.some(p=>p.id.endsWith(spawn.id)),true);
  }
});
