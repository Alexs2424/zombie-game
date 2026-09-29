import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../lib/game/simulation.ts';
import { BET_TARGETS } from '../lib/game/casino.ts';
import { CRAPS_TABLES, CASINO_ANCHORS } from '../lib/game/casino-layout.ts';
import { SIGHTS, aimPose } from '../lib/game/weapon-aim.ts';
import { WEAPON_SOUNDS } from '../lib/game/weapon-audio.ts';
import { VIEWMODELS } from '../lib/game/weapon-viewmodels.ts';

function game() {
  const s = new Simulation();s.start();s.intermission=9999;
  s.player={x:CRAPS_TABLES[0].x,z:CRAPS_TABLES[0].approachZ};s.points=2000;
  return s;
}
test('both printed banks on each table highlight exactly the place box that receives the click',()=>{
  const s=game();s.toggleChips();
  for(const t of BET_TARGETS) {
    const table=CRAPS_TABLES.find(table=>table.id===t.tableId);
    s.player={x:table.x,z:table.approachZ};
    s.yaw=Math.atan2(t.x-s.player.x,t.z-s.player.z);
    s.pitch=Math.atan2(1.65-t.y,Math.hypot(t.x-s.player.x,t.z-s.player.z));
    assert.equal(s.aimedBetTarget(),t);
    assert.equal(s.placeAimedBet(),true);
    assert.equal(s.betBanksByTable[t.tableId][t.number],t.bank);
  }
  s.pitch=-.1;assert.equal(s.aimedBetTarget(),undefined);
  s.pitch=.5;s.player={...CASINO_ANCHORS.spawn};assert.equal(s.placeAimedBet(),false);
});
test('chips stow on current, unavailable, and cycled weapon selection',()=>{
  const s=game();
  for(const id of ['pistol','lmg']) {
    s.toggleChips();s.switchWeapon(id);
    assert.equal(s.holdingChips,false);assert.equal(s.weapon,'pistol');
  }
  s.toggleChips();s.cycleWeapon(1);assert.equal(s.holdingChips,false);
  s.toggleChips();s.stowChips();assert.equal(s.holdingChips,false);
});
test('aim drops for reload, chips and melee, then resumes after reload while held',()=>{
  const s=game();s.aimHeld=true;assert.equal(s.aiming,true);
  s.inventory.pistol.mag=3;s.reload();assert.equal(s.aiming,false);
  for(let i=0;i<40;i++)s.step(.05,{forward:0,strafe:0,sprint:false,fire:false});
  assert.equal(s.aiming,true);s.toggleChips();assert.equal(s.aiming,false);
  s.stowChips();s.inventory.axe.owned=true;s.switchWeapon('axe');s.aimHeld=true;assert.equal(s.aiming,false);
});
test('both authored sight anchors project onto the camera centreline',()=>{
  for(const [id,sights] of Object.entries(SIGHTS)) {
    const p=aimPose(id),c=Math.cos(p.pitch),s=Math.sin(p.pitch);
    for(const [x,y,z] of [sights.rear,sights.front]) {
      assert.ok(Math.abs(x+p.x)<1e-9,id);
      assert.ok(Math.abs(y*c-z*s+p.y)<1e-9,id);
      assert.ok(y*s+z*c+p.z>.05,id);
    }
  }
});
test('every animation sound cue is included in its weapon preload manifest',()=>{
  for(const [id,spec] of Object.entries(VIEWMODELS)) {
    for(const [,cue] of [...spec.reloadCues,...(spec.shotCues??[])])
      assert.ok(WEAPON_SOUNDS[id].includes(cue),`${id}/${cue}`);
  }
  for(const id of ['lever','autoshotgun']) for(const name of ['reload-start','reload-end']) assert.ok(WEAPON_SOUNDS[id].includes(name));
});
