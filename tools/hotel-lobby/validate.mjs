/** Audit actual glTF exports after Babylon's left-handed coordinate conversion. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import '@babylonjs/loaders/glTF/index.js';
import { HOTEL_FIXTURES } from '../../lib/game/hotel-fixtures.ts';
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
      for(const material of gltf.materials??[]){
        if(['Hotel satin walnut','Hotel forest velvet'].includes(material.name)){
          assert.ok(material.normalTexture,'authored surface normal map');
          assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture,'authored surface roughness');
        }
        if(material.name.startsWith('Hotel marble slab')) assert.equal(material.pbrMetallicRoughness.metallicRoughnessTexture.texCoord,1,'room-space polish map');
      }
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
      const fixture=HOTEL_FIXTURES.find(f=>`hotel-${f.kind}`===name);
      if(fixture){
        assert.ok(Math.abs(min.y)<.001,'furniture rests at floor origin');
        assert.ok(Math.max(Math.abs(min.x),Math.abs(max.x))<=fixture.w/2+.002,'fixture width');
        assert.ok(Math.max(Math.abs(min.z),Math.abs(max.z))<=fixture.d/2+.002,'fixture depth');
        assert.ok(max.y<=fixture.h+.002&&max.y>=fixture.h*.85,'fixture height');
      }
      if(name==='hotel-grand-floor'){
        assert.ok(min.y>=0&&max.y<.027,'floor below furniture contact shadows');
        for(const mesh of meshes.filter(m=>m.name.includes('marble slab'))){
          const uv=mesh.getVerticesData('uv2'),p=mesh.getVerticesData('position');
          assert.equal(uv?.length,mesh.getTotalVertices()*2,'floor wear UV2');
          for(let i=0;i<p.length/3;i++){
            const world=Vector3.TransformCoordinates(Vector3.FromArray(p,i*3),mesh.getWorldMatrix());
            assert.ok(Math.abs(uv[i*2]-(world.x+23)/38)<.0001&&Math.abs(uv[i*2+1]-(1-(world.z-15)/36))<.0001,'baked lighting and wear share room coordinates');
          }
        }
        for(const [x,z] of [[-4,30],[-4,32],[0,26],[-12,21],[8,40]]){
          const hit=scene.pickWithRay(new Ray(new Vector3(x,1,z),Vector3.Down(),2),m=>meshes.includes(m));
          assert.ok(hit?.hit&&hit.getNormal(true).y>.99,'upward-facing continuous floor');
        }
      }
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
