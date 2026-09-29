/** Validate the actual exported furniture through the same Babylon loader as the game. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(await readFile(path.join(root, "docs/hotel-assets/reception-asset-manifest.json"), "utf8"));
const engine = new NullEngine({ renderWidth: 64, renderHeight: 64, textureSize: 512 });
const reports = [];
for (const expected of manifest.assets) {
  const data = await readFile(path.join(root, "public/models", expected.file));
  assert.equal(data.toString("ascii", 0, 4), "glTF");
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const scene = new Scene(engine);
  const asset = await LoadAssetContainerAsync(new Uint8Array(data), scene, { pluginExtension: ".glb", name: expected.file });
  asset.addAllToScene();
  const meshes = asset.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    const positions = mesh.getVerticesData("position");
    const uvs = mesh.getVerticesData("uv");
    assert.ok(positions?.every(Number.isFinite), expected.file + " has finite positions");
    assert.ok(uvs?.length >= mesh.getTotalVertices() * 2, expected.file + " has UVs");
    assert.ok(mesh.getIndices().every((i) => i >= 0 && i < mesh.getTotalVertices()), expected.file + " has valid triangle indices");
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bounds.minimumWorld);
    max = Vector3.Maximize(max, bounds.maximumWorld);
  }
  const [width, depth, height] = expected.expected_fixture;
  assert.ok(Math.abs(min.y) < .005, expected.file + " rests on the floor");
  assert.ok(Math.max(Math.abs(min.x), Math.abs(max.x)) <= width / 2 + .002, expected.file + " fits fixture width");
  assert.ok(Math.max(Math.abs(min.z), Math.abs(max.z)) <= depth / 2 + .002, expected.file + " fits fixture depth");
  assert.ok(max.y <= height + .002 && max.y >= height * .85, expected.file + " occupies fixture height");
  assert.ok(max.x - min.x >= width * .85, expected.file + " occupies fixture width");
  assert.ok(meshes.length <= 16, expected.file + " batches by material");
  assert.ok(gltf.images?.every((im) => im.bufferView != null), expected.file + " embeds textures");
  reports.push({ file: expected.file, bytes: data.length, meshes: meshes.length, materials: asset.materials.length, triangles: meshes.reduce((n, m) => n + m.getTotalIndices() / 3, 0), boundsBabylon: [min.asArray(), max.asArray()], expectedFixture: expected.expected_fixture, embeddedImages: gltf.images?.length ?? 0, finiteVertices: true, uvs: true, validIndices: true });
  asset.dispose();
  scene.dispose();
}
engine.dispose();
await writeFile(path.join(root, "docs/hotel-assets/reception-validation-report.json"), JSON.stringify({ loader: "Babylon NullEngine, GLTF AUTO left-handed conversion", assets: reports }, null, 2) + "\n");
console.log(JSON.stringify(reports, null, 2));
