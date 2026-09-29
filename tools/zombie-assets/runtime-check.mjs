import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createZombie, animateZombie } from '../../lib/game/zombies.ts';
import { zombiePose, zombieHitVolumes, LIMBS } from '../../lib/game/zombie-pose.ts';
const bytes=readFileSync(process.argv[2]);
const asset=JSON.parse(bytes);
const engine=new NullEngine(); const scene=new Scene(engine);
const views=Array.from({length:14},(_,i)=>createZombie(scene,i,asset));
assert.equal(scene.textures.length,6);
const sharedSkin=views[0].skin.diffuseTexture;
const assertNear=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-5,label+': '+a+' != '+b);
let cases=0, limbSamples=0;
for(let id=0;id<3;id++) for(let style=0;style<3;style++) {
 for(const timing of [{attack:.65,cooldown:0},{attack:.325,cooldown:0},{attack:.001,cooldown:0},{attack:0,cooldown:1}]) {
  for(const missing of [{},{leftArm:true,leftLeg:true},{leftArm:true,rightArm:true,leftLeg:true,rightLeg:true}]) {
   const v=views[id],e={id,x:1,y:3,z:2,yaw:.3,age:4,speed:.8,attackStyle:style,flash:0,missing,wounds:{body:1,leftArm:2,leftLeg:2},...timing};
   animateZombie(v,e);const pose=zombiePose(e);const volumes=zombieHitVolumes(e);
   assertNear(v.root.position.y,3+pose.drop,'hotel elevation'); assertNear(v.shadow.position.y,3.025,'contact shadow');
   for(let i=0;i<2;i++) {
    const arm=LIMBS[i],leg=LIMBS[i+2],fore=i?'rightForearm':'leftForearm';
    assert.equal(v.pivots[arm].isEnabled(),!missing[arm]);assert.equal(v.pivots[fore].isEnabled(),!missing[arm]);
    assert.equal(v.pivots[leg].isEnabled(),!missing[leg]);
    pose.arms[i].forEach((q,j)=>assertNear(v.pivots[arm].rotation.asArray()[j],q,'attack arm'));
    assertNear(v.pivots[fore].rotation.x,pose.elbows[i],'attack elbow');
    for(const region of [arm,leg]) {
     if(missing[region]) { assert.ok(!volumes.some(w=>w.region===region));continue; }
     const regionVolumes=volumes.filter(w=>w.region===region);
     const lengths=region===arm?[.13,.3,.46,.62]:[.15,.34,.53,.7];
     regionVolumes.forEach((volume,k)=>{
      const lowerArm=region===arm&&lengths[k]>.28;
      const pivot=v.pivots[lowerArm?fore:region];pivot.computeWorldMatrix(true);
      const actual=Vector3.TransformCoordinates(new Vector3(0,-lengths[k]+(lowerArm?.28:0),0),pivot.getWorldMatrix());
      const [x,y,z]=volume.center;
      const expected=new Vector3(e.x+x*Math.cos(e.yaw)+z*Math.sin(e.yaw),e.y+y,e.z-x*Math.sin(e.yaw)+z*Math.cos(e.yaw));
      assert.ok(Vector3.Distance(actual,expected)<1e-5,region+' visible pivot/hit volume disagree');limbSamples++;
     });
    }
   }
   for(const wound of v.wounds) {
    const lost=!!missing[wound.region];
    assert.equal(wound.mesh.isEnabled(),wound.stump?lost:!lost&&!!e.wounds[wound.region]);
   }
   cases++;
  }
 }
}
for(const v of views) {
 assert.equal(v.skin.diffuseTexture,sharedSkin);
 for(const mesh of v.root.getChildMeshes()) assert.equal(mesh.getVerticesData('position').length,mesh.getVerticesData('normal').length);
}
const counts={meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length};
for(const v of views) {v.root.dispose();v.shadow.dispose();for(const m of v.materials)m.dispose();}
assert.equal(scene.meshes.length,0);assert.equal(scene.textures.length,6);assert.equal(scene.materials.length,0);
const replacement=createZombie(scene,15,asset);assert.equal(replacement.skin.diffuseTexture,sharedSkin);assert.equal(scene.textures.length,6);
scene.dispose();assert.equal(scene.textures.length,0);engine.dispose();
console.log(JSON.stringify({status:'passed',assetSha256:createHash('sha256').update(bytes).digest('hex'),attackCases:cases,limbWorldSamples:limbSamples,checks:['14-enemy construction','windup/strike/recovery across all variants and styles','hotel elevation','wound/stump visibility','severed hierarchy','visible limb and hit-volume alignment','shared textures','material disposal','respawn','scene disposal'],counts},null,2));
