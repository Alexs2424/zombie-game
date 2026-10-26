// Import the actual bytes through Babylon and verify both intended scales.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/index.js';

const project = new URL('../../', import.meta.url);
const engine = new NullEngine();
const scene = new Scene(engine);
const source = new Uint8Array(fs.readFileSync(new URL('public/models/casino-planter.glb', project)));
const asset = await LoadAssetContainerAsync(source, scene, {
  pluginExtension: '.glb', pluginOptions: { gltf: { skipMaterials: true } },
});
asset.addAllToScene();
const placement = new TransformNode('planter test placement', scene);
for (const node of asset.rootNodes) node.parent = placement;

function bounds() {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of asset.meshes) {
    if (!mesh.getTotalVertices()) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    const low = box.minimumWorld.asArray(), high = box.maximumWorld.asArray();
    min = min.map((value, axis) => Math.min(value, low[axis]));
    max = max.map((value, axis) => Math.max(value, high[axis]));
  }
  return { min, max, dimensions: max.map((value, axis) => value - min[axis]) };
}

const hotel = bounds();
assert.ok(Math.abs(hotel.min[1]) < 1e-5 && Math.abs(hotel.max[1] - 2.35) < 1e-5);
for (const axis of [0, 2]) assert.ok(hotel.min[axis] >= -.60001 && hotel.max[axis] <= .60001);
placement.scaling.set(1 / 1.2, 1.8 / 2.35, 1 / 1.2);
const casino = bounds();
assert.ok(Math.abs(casino.min[1]) < 1e-5 && Math.abs(casino.max[1] - 1.8) < 1e-5);
for (const axis of [0, 2]) assert.ok(casino.min[axis] >= -.50001 && casino.max[axis] <= .50001);
const report = {
  status: 'passed', hotel, casino,
  floorContact: 'Y=0 at both placements',
  loaderRoot: asset.rootNodes.map((node) => ({
    name: node.name, scale: node.scaling.asArray(), rotation: node.rotationQuaternion?.asArray(),
  })),
};
fs.writeFileSync(fileURLToPath(new URL('docs/planter-assets/babylon-runtime-audit.json', project)),
  JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
scene.dispose();
engine.dispose();
