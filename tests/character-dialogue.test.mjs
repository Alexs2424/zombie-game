import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterDialogueDirector, CharacterSpeech, FRANKIE_LINES } from '../lib/game/character-dialogue.ts';
const kills = n => Array.from({length:n},()=>({type:'kill'}));
const director = () => { const d=new CharacterDialogueDirector();d.reset(['pistol']);return d; };

test('new ownership triggers specific gun speech; resupply and melee never do',()=>{
 const d=director();
 assert.equal(d.update(0,true,[],['pistol','shotgun'])?.id,'shotgun');
 assert.equal(d.update(200,true,[{type:'purchase',weapon:'shotgun'}],['pistol','shotgun']),null);
 assert.equal(d.update(201,true,[{type:'pickup',weapon:'axe'}],['pistol','shotgun','axe']),null);
 assert.equal(d.update(202,true,[],['pistol','shotgun','axe','tommy'])?.id,'tommy');
});
test('four kills within four seconds; hits and slow kills do not count',()=>{
 const d=director();
 assert.equal(d.update(0,true,kills(2),['pistol']),null);
 assert.equal(d.update(5,true,kills(2),['pistol']),null);
 assert.equal(d.update(6,true,[{type:'hit'}],['pistol']),null);
 assert.equal(d.update(7,true,kills(2),['pistol'])?.id,'multikill-1');
 assert.equal(d.update(8,true,kills(4),['pistol']),null);
 assert.equal(d.update(30,true,[],['pistol']),null);
 assert.equal(d.update(31,true,kills(4),['pistol'])?.id,'multikill-2');
});
test('pause, death and busy speech drop reactions instead of replaying stale events',()=>{
 const d=director();
 assert.equal(d.update(0,true,kills(4),['pistol'],true),null);
 assert.equal(d.update(1,true,[],['pistol']),null);
 assert.equal(d.update(2,true,[...kills(4),{type:'death'}],['pistol']),null);
 assert.equal(d.update(3,false,kills(4),['pistol','shotgun']),null);
 assert.equal(d.update(4,true,[],['pistol','shotgun']),null);
});
test('line cooldown, two-use cap and new-run reset',()=>{
 const d=director();
 for (const time of [0,12,24,180,192,204]) assert.ok(d.update(time,true,kills(4),['pistol']));
 assert.equal(d.update(400,true,kills(4),['pistol']),null);
 d.reset(['pistol']);
 assert.equal(d.update(401,true,kills(4),['pistol'])?.id,'multikill-1');
});
test('weapon reaction wins over simultaneous kill streak',()=>{
 const d=director();
 assert.equal(d.update(0,true,kills(4),['pistol','smg'])?.id,'new-gun');
 assert.equal(d.update(20,true,[],['pistol','smg']),null);
});
test('speech loads once, plays through output, prevents overlap and cleans up',async()=>{
 const oldFetch=globalThis.fetch;let loads=0;let starts=0;let stops=0;let connects=0;
 globalThis.fetch=async()=>{loads++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};};
 const context={state:'running',decodeAudioData:async()=>({duration:2}),createBufferSource:()=>({connect(){},disconnect(){},start(){starts++;},stop(){stops++;},onended:null}),createGain:()=>({gain:{value:0},connect(){connects++;},disconnect(){}})};
 try {
  const s=new CharacterSpeech();await s.preload(context);await s.preload(context);
  assert.equal(loads,6);
  assert.equal(s.play(FRANKIE_LINES[0],context,{}),true);
  assert.match(s.caption,/Frankie:/);assert.equal(s.play(FRANKIE_LINES[1],context,{}),false);
  assert.equal(starts,1);assert.equal(connects,1);
  s.stop();assert.equal(stops,1);assert.equal(s.caption,'');assert.equal(s.busy,false);
  s.dispose();assert.equal(s.play(FRANKIE_LINES[0],context,{}),false);
 }finally{globalThis.fetch=oldFetch;}
});
test('missing audio and suspended contexts fail silently',async()=>{
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:false});
 try{const s=new CharacterSpeech();await s.preload({});assert.equal(s.play(FRANKIE_LINES[0],{state:'running'},{}),false);s.dispose();}
 finally{globalThis.fetch=oldFetch;}
});

test('real simulation purchase and kills reach the director without synthetic trigger events',async()=>{
 const {Simulation,WEAPON_ORDER,PURCHASES}=await import('../lib/game/simulation.ts');
 const {createRange,addRangeEnemies}=await import('../lib/game/test-range.ts');
 const owned=s=>WEAPON_ORDER.filter(id=>s.inventory[id].owned);
 const s=new Simulation();s.start();s.points=10000;
 const d=director();d.reset(owned(s));
 const shop=PURCHASES.find(p=>p.id==='shotgun');s.player={...s.player,x:shop.x,z:shop.z};
 assert.equal(s.purchase('shotgun'),true);
 assert.equal(d.update(0,true,s.events,owned(s))?.id,'shotgun');
 const r=createRange('empty');addRangeEnemies(r,4,true);r.events=[];
 for(const enemy of r.enemies)r.damageEnemy(enemy,1000,false);
 assert.equal(r.kills,4);
 d.reset(owned(r));
 assert.equal(d.update(1,true,r.events,owned(r))?.id,'multikill-1');
});
