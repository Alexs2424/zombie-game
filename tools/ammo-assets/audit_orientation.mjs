// Read-only import audit using the same loader and left-handed scene as the game.
// Texture decoding is skipped in the headless engine; Python audits the image.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/index.js';

const project = new URL('../../', import.meta.url);
const engine = new NullEngine();
const scene = new Scene(engine);
const source = new Uint8Array(fs.readFileSync(new URL('public/models/pistol-ammo-display.glb', project)));
const asset = await LoadAssetContainerAsync(source, scene, {
  pluginExtension: '.glb', pluginOptions: { gltf: { skipMaterials: true } },
});
asset.addAllToScene();
let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const mesh of asset.meshes) {
  if (!mesh.getTotalVertices()) continue;
  mesh.computeWorldMatrix(true);
  const box = mesh.getBoundingInfo().boundingBox;
  const low = box.minimumWorld.asArray(), high = box.maximumWorld.asArray();
  min = min.map((value, axis) => Math.min(value, low[axis]));
  max = max.map((value, axis) => Math.max(value, high[axis]));
}
assert.ok(min.every((value, axis) => Math.abs(value - [-1.25, -.8, 0][axis]) < 1e-5));
assert.ok(max.every((value, axis) => Math.abs(value - [1.25, .8, .339][axis]) < 1e-5));
const report = {
  status: 'passed', defaultImport: { min, max }, front: 'Babylon +Z with retained loader root',
  southWallPlacementYaw: 0,
  loaderRoot: asset.rootNodes.map((node) => ({
    name: node.name, scale: node.scaling.asArray(), rotation: node.rotationQuaternion?.asArray(),
  })),
};
fs.writeFileSync(fileURLToPath(new URL('docs/ammo-assets/babylon-orientation-audit.json', project)),
  JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
scene.dispose();
engine.dispose();
