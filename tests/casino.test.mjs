import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,moveActor,WEAPONS,MYSTERY_WEAPONS,hasSight,SPAWN_RECORDS,ALL_SPAWNS,collides} from '../lib/game/simulation.ts';
import {PLACE_NUMBERS,BET_TARGETS,SECRET_CODE,KEYPAD_TARGETS,placeAmount,placeProfit,CASINO_SECRET_ANCHORS,SECRET_DOOR} from '../lib/game/casino.ts';
import { CRAPS_TABLES } from '../lib/game/casino-layout.ts';
const primary = {x:CRAPS_TABLES[0].x,z:CRAPS_TABLES[0].approachZ};
const idle={forward:0,strafe:0,sprint:false,fire:false};
function setup(){const s=new Simulation();s.start();s.intermission=10000;s.doorsOpen.lounge=s.doorsOpen.vip=s.doorsOpen.cashier=true;s.refreshMap();s.player={...primary};s.points=2000;return s;}
function tick(s,t){for(let i=0;i<Math.ceil(t/.05);i++)s.step(.05,idle);}
test('standard place-bet increments and exact profits for every box',()=>{
  assert.deepEqual(PLACE_NUMBERS.map(n=>placeAmount(n,25)),[25,25,30,30,25,25]);
  assert.deepEqual(PLACE_NUMBERS.map(n=>placeProfit(n,placeAmount(n,25))),[45,35,35,35,35,45]);
  for(const n of PLACE_NUMBERS)for(const chip of [25,50,100])assert.equal(placeProfit(n,placeAmount(n,chip))%1,0);
});
test('physical aim places one stake, held chips cannot shoot, cashing out returns principal only',()=>{
  const s=setup();s.toggleChips();const b=BET_TARGETS[2];
  s.yaw=Math.atan2(b.x-s.player.x,b.z-s.player.z);s.pitch=Math.atan2(1.65-b.y,Math.hypot(b.x-s.player.x,b.z-s.player.z));
  assert.equal(s.placeAimedBet(),true);assert.equal(s.points,1970);assert.equal(s.bets[6],30);
  assert.equal(s.fire(),false);assert.equal(s.inventory.pistol.mag,12);
  s.player={x:22,z:0};assert.equal(s.takeBets(),false);assert.equal(s.placeBet(4),false);
  s.player={...primary};assert.equal(s.takeBets(),true);assert.equal(s.points,2000);assert.equal(s.earned,0);
  s.takeBets();assert.equal(s.points,2000);
});
test('all standard number payouts resolve once, keeping other numbers on the felt',()=>{
  for(const n of PLACE_NUMBERS){
    const s=setup();s.toggleChips();for(const number of PLACE_NUMBERS)s.placeBet(number);
    const before=s.points, stake={...s.bets};
    let i=0;const dice=n<=6?[1,n-1]:[6,n-6];s.random=()=>(dice[i++]-1+.1)/6;
    s.purchase('craps');tick(s,1.7);
    assert.equal(s.points,before+placeProfit(n,stake[n]));assert.deepEqual(s.bets,stake);
    tick(s,5);assert.equal(s.points,before+placeProfit(n,stake[n]));
  }
});
test('the hidden door is solid until the actual shot sequence unlocks it',()=>{
  const s=setup();s.player={x:40.5,z:-16.1};s.random=()=>.5;
  assert.equal(s.enterSecretKey('spade'),false);
  const before={x:41,z:-16.1};moveActor(before,5,0,.32,s.rects);assert.ok(before.x<43);
  assert.equal(s.purchase('painting'),true);assert.equal(s.points,2000);
  s.enterSecretKey('heart');assert.equal(s.codeProgress,0);
  for(const key of SECRET_CODE){
    const b=KEYPAD_TARGETS.find(b=>b.key===key);
    s.yaw=Math.atan2(b.x-s.player.x,b.z-s.player.z);s.pitch=-Math.atan2(b.y-1.65,Math.hypot(b.x-s.player.x,b.z-s.player.z));s.fireCooldown=0;
    assert.equal(s.fire(),true);
  }
  assert.equal(s.speakeasy,true);assert.equal(s.codeProgress,8);assert.equal(s.inventory.pistol.mag,4);
  const after={x:41,z:-16.1};moveActor(after,5,0,.32,s.rects);assert.ok(after.x>45);
  assert.equal(hasSight({x:41,z:-16.1},{x:47,z:-16.1},s.rects),true);
  s.navigation.update(CASINO_SECRET_ANCHORS.mystery);assert.ok(s.navigation.distance[s.navigation.index(primary)]>=0);
});
test('mystery slot costs exactly 400, blocks duplicate spins, pauses and awards a special gun once',()=>{
  const s=setup();s.player={...CASINO_SECRET_ANCHORS.mystery};assert.equal(s.purchase('mystery'),false);
  s.speakeasy=true;s.refreshMap();let i=0;s.random=()=>[.49999,.99][i++];
  assert.equal(s.purchase('mystery'),true);assert.equal(s.points,1600);assert.equal(s.purchase('mystery'),false);
  assert.deepEqual(s.events.filter(event=>event.type==='mysterySpin'),
    [{type:'mysterySpin',position:CASINO_SECRET_ANCHORS.mysteryCabinet}]);
  assert.equal(s.events.some(event=>event.type==='diceRoll'),false,'Pulling the slot handle must not play craps dice');
  s.pause();tick(s,5);assert.equal(s.mystery.remaining,2.8);s.resume();tick(s,3);
  // .99 selects the last of the ten 1970s firearms: The Debt Collector.
  assert.equal(s.weapon,'launcher');assert.equal(s.inventory.launcher.owned,true);assert.equal(s.weaponDamage(),WEAPONS.launcher.damage);
  assert.equal(s.inventory.launcher.mag,s.capacity('launcher'));s.inventory.launcher.mag=0;tick(s,4);assert.equal(s.inventory.launcher.mag,0);
});
test('50% boundary loses without a weapon or refund, and insufficient funds never roll',()=>{
  const s=setup();s.speakeasy=true;s.refreshMap();s.player={...CASINO_SECRET_ANCHORS.mystery};s.random=()=>.5;
  s.points=399;assert.equal(s.purchase('mystery'),false);assert.equal(s.mystery,null);
  assert.equal(s.events.some(event=>event.type==='mysterySpin'),false,'Rejected pulls must be silent');
  s.points=400;assert.equal(s.purchase('mystery'),true);tick(s,3);
  assert.equal(s.points,0);assert.equal(s.mystery.reward,null);assert.deepEqual(s.relics,{});
  assert.ok(MYSTERY_WEAPONS.every(id=>!s.inventory[id].owned));
});

test('both craps tables independently retain physical stakes, settle profits and lock one roll per round',()=>{
  const s=setup();s.round=3;s.intermission=0;s.waveRemaining=1;s.spawnTimer=100;s.holdingChips=true;
  for(const t of CRAPS_TABLES){s.player={x:t.x,z:t.approachZ};assert.equal(s.placeBet(6),true);assert.equal(s.betsByTable[t.id][6],30);}
  s.random=()=>.34; // 3 + 3 pays the place six.
  for(const t of CRAPS_TABLES){s.player={x:t.x,z:t.approachZ};assert.equal(s.purchase(t.id),true);assert.equal(s.diceTables[t.id].quickWager,false);}
  assert.equal(s.events.filter(event=>event.type==='diceRoll').length,2);
  assert.equal(s.events.some(event=>event.type==='mysterySpin'),false,'Craps must retain its dice cue');
  assert.equal(s.points,1940);tick(s,1.7);assert.equal(s.points,2010);
  for(const t of CRAPS_TABLES){s.player={x:t.x,z:t.approachZ};assert.equal(s.betsByTable[t.id][6],30);assert.equal(s.purchase(t.id),false);assert.equal(s.placeBet(4),false);assert.equal(s.takeBets(),true);assert.deepEqual(s.betsByTable[t.id],{});}
  assert.equal(s.points,2070);assert.equal(s.earned,70);
});
test('secret room opening enables its own delayed spawns and never opens the cashier rear area',()=>{
  const s=setup();const indices=SPAWN_RECORDS.flatMap((r,i)=>r.room==='speakeasy'?[i]:[]);assert.ok(indices.length);
  for(const i of indices)assert.equal(s.spawnEnabled(i),false);
  s.player={...CASINO_SECRET_ANCHORS.painting};assert.equal(s.purchase('painting'),true);
  for(const key of SECRET_CODE)assert.equal(s.enterSecretKey(key),true);
  assert.equal(s.rects.some(r=>r.id===SECRET_DOOR.id),false);for(const i of indices)assert.equal(s.spawnEnabled(i),false);
  tick(s,3.1);for(const i of indices)assert.equal(s.spawnEnabled(i),true);
  s.navigation.update(CASINO_SECRET_ANCHORS.mystery);
  for(const i of indices)assert.ok(s.navigation.distance[s.navigation.index(ALL_SPAWNS[i])]>=0);
  assert.equal(collides({x:35,z:-7},.32,s.rects),true);
  const p={x:45,z:-9};moveActor(p,-12,0,.32,s.rects);assert.ok(p.x>43,'Secret wall must seal cashier staff side');
});
