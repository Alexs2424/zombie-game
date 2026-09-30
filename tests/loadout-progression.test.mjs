import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,WEAPONS,zombieHealth} from '../lib/game/simulation.ts';
import {CASINO_SECRET_ANCHORS} from '../lib/game/casino.ts';
const idle={forward:0,strafe:0,sprint:false,fire:false};
function tick(s,t){for(let i=0;i<t*60;i++)s.step(1/60,idle);}
function offer(){const s=new Simulation();s.start();s.intermission=Infinity;s.speakeasy=true;s.refreshMap();s.player={...CASINO_SECRET_ANCHORS.mystery};s.points=400;s.random=()=>0;s.purchase('mystery');tick(s,3);return s;}
test('a third firearm replaces the active firearm and retains the other gun ammo',()=>{
 const s=new Simulation();s.start();s.acquireWeapon('shotgun');s.inventory.pistol.mag=3;
 s.acquireWeapon('rifle');assert.deepEqual(s.firearms,['pistol','rifle']);assert.equal(s.inventory.shotgun.owned,false);assert.equal(s.inventory.pistol.mag,3);
 s.cycleWeapon(1);assert.equal(s.weapon,'pistol');s.cycleWeapon(-1);assert.equal(s.weapon,'rifle');
 s.acquireWeapon('axe');s.acquireWeapon('lmg');assert.deepEqual(s.firearms,['pistol','lmg']);assert.equal(s.inventory.axe.owned,true);
 s.acquireWeapon('lmg');assert.equal(s.firearms.length,2);
});
test('mystery reveal never grants or equips before explicit acceptance',()=>{
 const s=offer();assert.equal(s.weapon,'pistol');assert.equal(s.inventory.magnum.owned,false);assert.equal(s.mysteryOffer,'magnum');
 s.pause();const left=s.mystery.offerRemaining;tick(s,5);assert.equal(s.mystery.offerRemaining,left);s.resume();
 assert.equal(s.purchase('mystery'),true);assert.equal(s.points,0);assert.equal(s.weapon,'magnum');assert.equal(s.mysteryOffer,null);
 assert.equal(s.purchase('mystery'),false,'accepted reward cannot be claimed twice for free');
});
test('declining or letting a mystery offer expire preserves the loadout',()=>{
 const s=offer();assert.equal(s.declineMystery(),true);assert.deepEqual(s.firearms,['pistol']);
 const expired=offer();tick(expired,21);assert.equal(expired.mysteryOffer,null);assert.deepEqual(expired.firearms,['pistol']);
});
test('round health keeps increasing and weapon damage has meaningful kill thresholds',()=>{
 assert.equal(zombieHealth(1),80);assert.equal(zombieHealth(10),260);
 assert.ok(zombieHealth(30)>zombieHealth(20));assert.ok(zombieHealth(20)>300);
 const hits=(gun,round)=>Math.ceil(zombieHealth(round)/(WEAPONS[gun].damage*WEAPONS[gun].pellets));
 assert.ok(hits('pistol',10)>hits('rifle',10));assert.ok(hits('rifle',10)>hits('sniper',10));
 assert.ok(hits('shotgun',10)<hits('pistol',10));assert.ok(hits('sniper',30)>hits('sniper',10));
});
