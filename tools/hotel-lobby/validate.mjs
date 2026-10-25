/** Audit actual glTF exports after Babylon's left-handed coordinate conversion. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import '@babylonjs/loaders/glTF/index.js';
import { HOTEL, stairPoint } from '../../lib/game/world.ts';
const names=process.argv.slice(2); if(!names.length) names.push('hotel-grand-stairs');
const engine=new NullEngine();
try {
  for(const name of names){
    const scene=new Scene(engine);
    try {
      const bytes=await readFile(new URL(`../../public/models/${name}.glb`,import.meta.url));
      const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
      for(const image of gltf.images??[]) assert.ok(image.bufferView!==undefined&&!image.uri,'embedded images');
      const asset=await LoadAssetContainerAsync(bytes,scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});asset.addAllToScene();
      const meshes=asset.meshes.filter(m=>m.getTotalVertices());let vertices=0,triangles=0;
      const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
      for(const mesh of meshes){
        mesh.computeWorldMatrix(true);vertices+=mesh.getTotalVertices();triangles+=mesh.getTotalIndices()/3;
        for(const attr of ['position','normal','uv']){const data=mesh.getVerticesData(attr);assert.ok(data?.length&&data.every(Number.isFinite),`${name} ${attr}`);}
        assert.ok(mesh.getIndices().every(i=>i>=0&&i<mesh.getTotalVertices()),'valid indices');
        min.minimizeInPlace(mesh.getBoundingInfo().boundingBox.minimumWorld);max.maximizeInPlace(mesh.getBoundingInfo().boundingBox.maximumWorld);
      }
      assert.ok(meshes.length<=10&&triangles<400000&&bytes.length<16*1024*1024,'asset budget');
      if(name==='hotel-grand-stairs'){
        assert.ok(min.x>-23&&max.x<15&&min.y>=-.001&&max.y<5.4,`stairs inside hotel bounds: ${min.asArray()} to ${max.asArray()}`);
        for(const stair of HOTEL.stairs) for(const t of [.08,.3,.5,.7,.92]){
          const p=stairPoint(stair,t);const ray=new Ray(new Vector3(p.x,p.y+.2,p.z),Vector3.Up(),1.5);
          assert.equal(scene.pickWithRay(ray,m=>meshes.includes(m))?.hit,false,'stair walking body clearance');
          for(const radius of [stair.innerRadius-.075,stair.outerRadius+.075]){
            const q=stairPoint(stair,t,radius);const direction=new Vector3(q.x-p.x,0,q.z-p.z).normalize();
            assert.ok(scene.pickWithRay(new Ray(new Vector3(p.x,p.y+.55,p.z),direction,2),m=>meshes.includes(m))?.hit,'visible solid guard at collision edge');
          }
        }
      }
      const report={status:'passed',asset:name,bytes:bytes.length,meshes:meshes.length,vertices,triangles,bounds:{min:min.asArray(),max:max.asArray()}};
      await writeFile(new URL(`../../docs/hotel-assets/lobby/${name}-validation.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
    }finally{scene.dispose();}
  }
}finally{engine.dispose();}
