import test from 'node:test';
import assert from 'node:assert/strict';
import {createRange} from '../lib/game/test-range.ts';
const idle={forward:0,strafe:0,sprint:false,fire:false};
function advance(s,seconds,input=idle){for(let i=0;i<seconds*60;i++)s.step(1/60,input);}
test('sprinting depletes stamina and exhaustion prevents continuous sprint',()=>{
 const s=createRange('empty');
 advance(s,5.1,{...idle,forward:1,sprint:true});
 assert.equal(s.sprintExhausted,true);assert.equal(s.sprinting,false);assert.ok(s.stamina<1);
 advance(s,.8);assert.ok(s.stamina<1);
 advance(s,1);assert.ok(s.stamina>0 && s.stamina<30);
 s.step(1/60,{...idle,forward:1,sprint:true});assert.equal(s.sprinting,false);
 advance(s,1);s.step(1/60,{...idle,forward:1,sprint:true});assert.equal(s.sprinting,true);
});
test('aiming, idle sprint input and firing do not drain stamina',()=>{
 for(const mode of ['aim','idle','fire']){
  const s=createRange('empty');s.aimHeld=mode==='aim';
  advance(s,1,{...idle,forward:mode==='idle'?0:1,sprint:true,fire:mode==='fire'});
  assert.equal(s.stamina,100);assert.equal(s.sprinting,false);
 }
});
test('pause freezes stamina and new scenarios reset it',()=>{
 const s=createRange('empty');advance(s,2,{...idle,forward:1,sprint:true});
 const stamina=s.stamina;s.pause();advance(s,10);assert.equal(s.stamina,stamina);
 s.resume();advance(s,6);assert.equal(s.stamina,100);assert.equal(createRange().stamina,100);
});
