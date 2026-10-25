import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/game/simulation.ts';
import {CASINO_SECRET_ANCHORS} from '../lib/game/casino.ts';
import {casePose,CASE_CLOSE_SECONDS} from '../lib/game/mystery-case.ts';
const idle={forward:0,strafe:0,sprint:false,fire:false};
const tick=(s,n)=>{for(let i=0;i<n*60;i++)s.step(1/60,idle);};
function ready(){const s=new Simulation();s.start();s.intermission=Infinity;s.speakeasy=true;s.refreshMap();s.player={...CASINO_SECRET_ANCHORS.mystery};s.points=800;s.purchase('mystery');tick(s,2.85);return s;}
test('the case offers for twenty seconds, then returns the gun before shutting',()=>{
 const s=ready();assert.ok(s.mysteryOffer);assert.equal(s.weapon,'pistol');
 tick(s,19);assert.ok(s.mysteryOffer);assert.equal(casePose(s.mystery).lift,1);
 s.pause();const pose=casePose(s.mystery);tick(s,5);assert.deepEqual(casePose(s.mystery),pose);s.resume();
 tick(s,1.1);assert.equal(s.mysteryOffer,null);assert.ok(s.mystery.closingRemaining>0);
 assert.equal(s.purchase('mystery'),false);tick(s,2);assert.equal(casePose(s.mystery).lid,0);assert.equal(casePose(s.mystery).visible,false);
 assert.equal(s.firearms.length,1);
});
test('accept removes the display immediately; declining lowers it back into the tray',()=>{
 const s=ready();assert.equal(s.purchase('mystery'),true);assert.equal(casePose(s.mystery).visible,false);assert.ok(s.mystery.closingRemaining>0);
 const rejected=ready();rejected.declineMystery();assert.equal(rejected.mystery.closingRemaining,CASE_CLOSE_SECONDS);assert.equal(casePose(rejected.mystery).visible,true);
 tick(rejected,.65);assert.equal(casePose(rejected.mystery).visible,false);assert.ok(casePose(rejected.mystery).lid>0);
});
