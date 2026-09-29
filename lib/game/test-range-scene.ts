import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { RANGE_RECTS } from './test-range-layout';
export function buildTestRange(scene: Scene) {
  const mat = (name:string, hex:string) => {const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(hex);m.emissiveColor=m.diffuseColor.scale(.35);return m;};
  const floor=mat('range concrete','#657174'), wall=mat('range walls','#445258'), stripe=mat('range markings','#d2ae65');
  const ground=MeshBuilder.CreateGround('range floor',{width:28,height:34},scene);ground.position.set(104,0,13);ground.material=floor;
  for(const r of RANGE_RECTS){const m=MeshBuilder.CreateBox(r.id,{width:r.w,height:r.h,depth:r.d},scene);m.position.set(r.x,r.h/2,r.z);m.material=wall;}
  function label(text:string,x:number,z:number,width=5){
    const t=new DynamicTexture(`range ${text}`,{width:1024,height:128},scene,false);t.drawText(text,null,86,'bold 64px sans-serif','#f6e8c7','#263638',true);
    const m=mat(`label ${text}`,'#ffffff');m.diffuseTexture=t;m.emissiveTexture=t;m.backFaceCulling=false;
    const p=MeshBuilder.CreateGround(text,{width,height:width/8},scene);p.position.set(x,.018,z);p.material=m;
  }
  label('FIRING LINE',98,-1,9);label('BLAST / COVER',111,2,9);
  for(const d of [5,10,20]){const m=MeshBuilder.CreateBox(`${d} metre line`,{width:15,height:.012,depth:.05},scene);m.position.set(98,.01,d);m.material=stripe;label(`${d} METRES`,98,d-1);}
  label('FULL HEIGHT COVER',111,10,6);label('LOW COVER',111,18,5);
}
