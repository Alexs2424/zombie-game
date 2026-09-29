import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/index.js';
import {KEYPAD_TARGETS,SUIT_GLYPHS,BET_TARGETS,CRAPS_FELT_Y} from '../lib/game/casino.ts';

test('Blender keypad targets and printed felt betting areas match the loaded geometry',async()=>{
  const engine=new NullEngine();const scene=new Scene(engine);
  try {
    for(const name of ['secret-keypad','craps-table']) {
      const a=await LoadAssetContainerAsync(new Uint8Array(readFileSync(new URL(`../public/models/${name}.glb`,import.meta.url))),scene,{pluginExtension:'.glb'});
      a.addAllToScene();const root=new TransformNode(name,scene);
      root.position.set(name==='secret-keypad'?41.64:35,0,name==='secret-keypad'?-4.1:-3);
      root.rotation.y=name==='secret-keypad'?-Math.PI/2:0;
      for(const mesh of a.rootNodes)mesh.parent=root;
      if(name==='secret-keypad') for(const target of KEYPAD_TARGETS) {
        const label=SUIT_GLYPHS[target.key]??(target.key==='reset'?'↺':target.key);
        const mesh=a.meshes.find(m=>m.name===`Shoot button ${label}`);assert.ok(mesh);
        mesh.computeWorldMatrix(true);const p=mesh.getAbsolutePosition();
        assert.ok(Math.abs(p.z-target.z)<.001);assert.ok(Math.abs(p.y-target.y)<.001);assert.ok(Math.abs(p.x-target.x)<.08);
      }
      else for(const target of BET_TARGETS) {
        const mesh=a.meshes.find(m=>m.name==='Craps printed felt');assert.ok(mesh);mesh.computeWorldMatrix(true);
        const bounds=mesh.getBoundingInfo().boundingBox;
        assert.ok(Math.abs(bounds.maximumWorld.y-CRAPS_FELT_Y)<.001);
        assert.ok(target.x-target.halfWidth>bounds.minimumWorld.x && target.x+target.halfWidth<bounds.maximumWorld.x);
        assert.ok(target.z-target.halfDepth>bounds.minimumWorld.z && target.z+target.halfDepth<bounds.maximumWorld.z);
        assert.equal(target.y,CRAPS_FELT_Y);
      }
      a.dispose();root.dispose();
    }
  } finally {scene.dispose();engine.dispose();}
});
