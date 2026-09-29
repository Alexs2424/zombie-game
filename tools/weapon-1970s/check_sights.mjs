import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/index.js';
import {SIGHTS,aimPose} from '../../lib/game/weapon-aim.ts';
const engine=new NullEngine();
for(const id of Object.keys(SIGHTS)) {
  if(id==='sniper')continue;
  const scene=new Scene(engine),p=aimPose(id);
  const a=await LoadAssetContainerAsync(new Uint8Array(readFileSync(`public/models/${id}.glb`)),scene,{pluginExtension:'.glb'});
  a.addAllToScene();const root=new TransformNode(id,scene);
  root.position.set(p.x,p.y,p.z);root.rotation.x=p.pitch;
  for(const n of a.rootNodes)n.parent=root;
  if(id==='dual') {
    const right=a.transformNodes.find(n=>n.name==='Right pistol')??a.meshes.find(n=>n.name==='Right pistol');
    right.position.x-=.21;right.position.y+=.015;
  }
  const hits=[];
  for(const mesh of a.meshes) {
    mesh.computeWorldMatrix(true);
    const hit=new Ray(new Vector3(0,.001,0),new Vector3(0,0,1),2).intersectsMesh(mesh,false);
    if(hit.hit)hits.push([mesh.name,Math.round(hit.distance*1000)]);
  }
  console.log(id,JSON.stringify(hits.sort((a,b)=>a[1]-b[1])));
  assert.deepEqual(hits,[],`${id}: receiver geometry blocks the sight line`);
  scene.dispose();
}
engine.dispose();
