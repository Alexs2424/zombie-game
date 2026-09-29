import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

/** Short pressure flash, rolling dust and ballistic fragments; no expanding solid ball. */
export function createExplosion(scene: Scene, origin: {x:number;y:number;z:number}, started: number, seed: number) {
  const material = (name: string, color: string, glow = false) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(color); m.specularColor.set(0,0,0);
    if (glow) { m.emissiveColor = m.diffuseColor; m.disableLighting = true; }
    return m;
  };
  const flashMaterial=material("blast hot core", "#ffd79a", true);
  const dustMaterial=material("blast dust", "#655e51");
  const shardMaterial=material("blast fragments", "#453c2f");
  const soft=new DynamicTexture("soft blast plume",{width:128,height:128},scene,false);
  const ctx=soft.getContext(),gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,"rgba(255,255,255,1)");gradient.addColorStop(.25,"rgba(255,255,255,.85)");
  gradient.addColorStop(.65,"rgba(255,255,255,.3)");gradient.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);soft.hasAlpha=true;soft.update();
  for(const m of [flashMaterial,dustMaterial]) { m.diffuseTexture=soft;m.useAlphaFromDiffuseTexture=true;m.backFaceCulling=false; }
  dustMaterial.emissiveColor.set(.12,.11,.09);
  const flash=MeshBuilder.CreatePlane("pressure flash",{size:1},scene);
  flash.billboardMode=Mesh.BILLBOARDMODE_ALL;
  flash.material=flashMaterial;flash.position.set(origin.x,origin.y,origin.z);flash.isPickable=false;
  const light=new PointLight("blast light",new Vector3(origin.x,origin.y+.3,origin.z),scene);
  light.diffuse=new Color3(1,.65,.3);light.range=9;
  const particles=Array.from({length:20},(_,i)=>{
    const dust=i<8;
    const mesh=dust ? MeshBuilder.CreatePlane("rolling blast dust",{size:1},scene)
      : MeshBuilder.CreateBox("tumbling debris",{size:.045+(i%3)*.018},scene);
    if(dust) mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;
    mesh.material=dust?dustMaterial:shardMaterial;mesh.isPickable=false;
    const angle=i*2.399+seed*.7, speed=dust?.7+(i%3)*.3:2+(i%5)*.6;
    return {mesh,dust,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,vy:dust?.4+(i%3)*.15:1.5+(i%4)*.6};
  });
  return {
    started,
    update(time: number) {
      const t=Math.max(0,time-started);
      flash.setEnabled(t<.16); flash.scaling.setAll(.35+Math.min(t,.16)*13);
      flashMaterial.alpha=Math.max(0,1-t/.16);
      light.intensity=8*Math.max(0,1-t/.2)**2;
      for(const p of particles) {
        const {mesh,dust}=p;
        const travel=dust?1-Math.exp(-t*2):t;
        mesh.position.set(origin.x+p.vx*travel,Math.max(origin.y-.08,origin.y+p.vy*t-(dust?0:4.9*t*t)),origin.z+p.vz*travel);
        if(dust) {
          mesh.scaling.set(.5+t*1.8,.4+t*1.3,1);
          mesh.visibility=Math.min(1,t/.08)*Math.max(0,1-t/2.2)*.65;
        } else {
          mesh.rotation.set(t*8+p.vx,t*11,t*6);
          mesh.visibility=Math.max(0,1-Math.max(0,t-.5)/.6);
        }
      }
    },
    dispose() { flash.dispose();light.dispose();for(const p of particles)p.mesh.dispose();for(const m of [flashMaterial,dustMaterial,shardMaterial])m.dispose();soft.dispose(); },
  };
}
