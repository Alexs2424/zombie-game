import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/index.js';
import {KEYPAD_TARGETS,SUIT_GLYPHS,BET_TARGETS,CRAPS_FELT_Y,CASINO_SECRET_ANCHORS} from '../lib/game/casino.ts';
import {CRAPS_TABLES} from '../lib/game/casino-layout.ts';

test('Blender keypad targets and both printed felt betting areas match the loaded geometry',async()=>{
  const engine=new NullEngine();const scene=new Scene(engine);
  const placements=[
    {asset:'secret-keypad',id:'keypad',...CASINO_SECRET_ANCHORS.keypad},
    ...CRAPS_TABLES.map(table=>({asset:'craps-table',...table})),
  ];
  try {
    for(const placement of placements) {
      const a=await LoadAssetContainerAsync(new Uint8Array(readFileSync(new URL(`../public/models/${placement.asset}.glb`,import.meta.url))),scene,{pluginExtension:'.glb'});
      a.addAllToScene();const root=new TransformNode(placement.id,scene);
      root.position.set(placement.x,0,placement.z);
      root.rotation.y=placement.id==='keypad'?-Math.PI/2:0;
      for(const mesh of a.rootNodes)mesh.parent=root;
      if(placement.id==='keypad') for(const target of KEYPAD_TARGETS) {
        const label=SUIT_GLYPHS[target.key]??(target.key==='reset'?'↺':target.key);
        const mesh=a.meshes.find(m=>m.name===`Shoot button ${label}`);assert.ok(mesh);
        mesh.computeWorldMatrix(true);const p=mesh.getAbsolutePosition();
        assert.ok(Math.abs(p.z-target.z)<.001);assert.ok(Math.abs(p.y-target.y)<.001);assert.ok(Math.abs(p.x-target.x)<.08);
      }
      else {
        const targets=BET_TARGETS.filter(target=>target.tableId===placement.id);
        assert.equal(targets.length,12,`${placement.id} has two banks of six place-bet targets`);
        for(const target of targets) {
          const mesh=a.meshes.find(m=>m.name==='Craps printed felt');assert.ok(mesh);mesh.computeWorldMatrix(true);
          const bounds=mesh.getBoundingInfo().boundingBox;
          assert.ok(Math.abs(bounds.maximumWorld.y-CRAPS_FELT_Y)<.001);
          assert.ok(target.x-target.halfWidth>bounds.minimumWorld.x && target.x+target.halfWidth<bounds.maximumWorld.x);
          assert.ok(target.z-target.halfDepth>bounds.minimumWorld.z && target.z+target.halfDepth<bounds.maximumWorld.z);
          assert.equal(target.y,CRAPS_FELT_Y);
        }
      }
      a.dispose();root.dispose();
    }
  } finally {scene.dispose();engine.dispose();}
});
