import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,moveActor,WEAPONS,hasSight} from '../lib/game/simulation.ts';
import {PLACE_NUMBERS,BET_TARGETS,SECRET_CODE,KEYPAD_TARGETS,placeAmount,placeProfit} from '../lib/game/casino.ts';
const idle={forward:0,strafe:0,sprint:false,fire:false};
function setup(){const s=new Simulation();s.start();s.intermission=10000;s.lounge=s.vip=s.tables=true;s.refreshMap();s.player={x:35,z:-5};s.points=2000;return s;}
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
  s.player={x:35,z:-5};assert.equal(s.takeBets(),true);assert.equal(s.points,2000);assert.equal(s.earned,0);
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
  const s=setup();s.player={x:39.5,z:-4.1};s.random=()=>.5;
  assert.equal(s.enterSecretKey('spade'),false);
  const before={x:40,z:-4.1};moveActor(before,5,0,.32,s.rects);assert.ok(before.x<42);
  assert.equal(s.purchase('painting'),true);assert.equal(s.points,2000);
  s.enterSecretKey('heart');assert.equal(s.codeProgress,0);
  for(const key of SECRET_CODE){
    const b=KEYPAD_TARGETS.find(b=>b.key===key);
    s.yaw=Math.atan2(b.x-s.player.x,b.z-s.player.z);s.pitch=-Math.atan2(b.y-1.65,Math.hypot(b.x-s.player.x,b.z-s.player.z));s.fireCooldown=0;
    assert.equal(s.fire(),true);
  }
  assert.equal(s.speakeasy,true);assert.equal(s.codeProgress,8);assert.equal(s.inventory.pistol.mag,4);
  const after={x:40,z:-4.1};moveActor(after,5,0,.32,s.rects);assert.ok(after.x>44);
  assert.equal(hasSight({x:40,z:-4.1},{x:46,z:-4.1},s.rects),true);
  s.navigation.update({x:48,z:-7});assert.ok(s.navigation.distance[s.navigation.index({x:35,z:-5})]>=0);
});
test('mystery slot costs exactly 400, blocks duplicate spins, pauses and awards a special gun once',()=>{
  const s=setup();s.player={x:48,z:-7.3};assert.equal(s.purchase('mystery'),false);
  s.speakeasy=true;s.refreshMap();let i=0;s.random=()=>[.49999,.99][i++];
  assert.equal(s.purchase('mystery'),true);assert.equal(s.points,1600);assert.equal(s.purchase('mystery'),false);
  s.pause();tick(s,5);assert.equal(s.mystery.remaining,2.8);s.resume();tick(s,3);
  assert.equal(s.relics.rifle,true);assert.equal(s.weapon,'rifle');assert.equal(s.weaponDamage(),WEAPONS.rifle.damage*2);
  assert.equal(s.inventory.rifle.mag,s.capacity('rifle'));s.inventory.rifle.mag=1;tick(s,4);assert.equal(s.inventory.rifle.mag,1);
});
test('50% boundary loses without a weapon or refund, and insufficient funds never roll',()=>{
  const s=setup();s.speakeasy=true;s.refreshMap();s.player={x:48,z:-7.3};s.random=()=>.5;
  s.points=399;assert.equal(s.purchase('mystery'),false);assert.equal(s.mystery,null);
  s.points=400;assert.equal(s.purchase('mystery'),true);tick(s,3);
  assert.equal(s.points,0);assert.equal(s.mystery.reward,null);assert.deepEqual(s.relics,{});
  assert.equal(s.inventory.rifle.owned,false);
});
