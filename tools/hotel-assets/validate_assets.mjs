import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/index.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const manifest=JSON.parse(await readFile(path.join(root,'docs/hotel-assets/asset-manifest.json'),'utf8'));
const names=(await readdir(path.join(root,'public/models'))).filter(n=>/^hotel-.*\.glb$/.test(n)||['tommy.glb','hands-tommy.glb'].includes(n));
const engine=new NullEngine({renderWidth:64,renderHeight:64,textureSize:192});
const reports=[];
for(const name of names){
 const data=await readFile(path.join(root,'public/models',name));
 assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
 const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 const scene=new Scene(engine);assert.equal(scene.useRightHandedSystem,false);
 const asset=await LoadAssetContainerAsync(new Uint8Array(data),scene,{pluginExtension:'.glb',name});
 asset.addAllToScene();
 const meshes=asset.meshes.filter(m=>m.getTotalVertices()>0);
 let min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
 for(const mesh of meshes){
  const pos=mesh.getVerticesData('position'),uv=mesh.getVerticesData('uv');
  assert.ok(pos?.every(Number.isFinite),name+' finite vertex positions');
  assert.ok(uv?.length>=mesh.getTotalVertices()*2,name+' UV coordinates');
  const indices=mesh.getIndices();assert.ok(indices.every(i=>i>=0&&i<mesh.getTotalVertices()),name+' valid triangle indices');
  mesh.computeWorldMatrix(true);const box=mesh.getBoundingInfo().boundingBox;
  min=Vector3.Minimize(min,box.minimumWorld);max=Vector3.Maximize(max,box.maximumWorld);
 }
 const conversion=asset.meshes.find(m=>m.name==='__root__');conversion.computeWorldMatrix(true);
 const forward=Vector3.TransformNormal(new Vector3(0,0,1),conversion.getWorldMatrix());
 assert.ok(forward.z>.999,'Babylon AUTO loader retains raw glTF +Z forward');
 if(name==='tommy.glb'){
  for(const n of ['Magazine','Bolt'])assert.ok(asset.transformNodes.some(x=>x.name===n),n+' exact animation pivot');
  assert.ok(Math.abs(max.z-.48)<1e-4,'Tommy muzzle reaches +Z 0.48');
  assert.ok(min.z<-.51,'Tommy stock extends behind receiver');
 }
 if(name==='hands-tommy.glb')for(const n of ['RightHand','LeftHand'])assert.ok(asset.transformNodes.some(x=>x.name===n),n+' exact wrist pivot');
 if(name.startsWith('hotel-'))assert.ok(Math.abs(min.y)<=.005,name+' rests at floor origin');
 const fixture=manifest.assets.find(a=>a.file===name)?.expected_fixture;
 if(fixture){
  assert.ok(Math.max(Math.abs(min.x),Math.abs(max.x))<=fixture[0]/2+.002,name+' authored fixture width');
  assert.ok(Math.max(Math.abs(min.z),Math.abs(max.z))<=fixture[1]/2+.002,name+' authored fixture depth');
  assert.ok(max.y<=fixture[2]+.002,name+' authored fixture height');
  assert.ok(max.x-min.x>=fixture[0]*.85,name+' occupies authored fixture width');
  assert.ok(max.y>=fixture[2]*.85,name+' occupies authored fixture height');
 }
 reports.push({file:name,bytes:data.length,meshes:meshes.length,materials:asset.materials.length,triangles:meshes.reduce((s,m)=>s+m.getTotalIndices()/3,0),boundsBabylon:[min.asArray(),max.asArray()],embeddedImages:json.images?.length??0,uvs:true,validIndices:true,finiteVertices:true});
 asset.dispose();scene.dispose();
}
engine.dispose();
await writeFile(path.join(root,'docs/hotel-assets/validation-report.json'),JSON.stringify({loader:'Babylon NullEngine with actual GLTF AUTO left-handed conversion',assets:reports},null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
