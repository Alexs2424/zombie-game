/** Audit the counter through the same glTF conversion and fixture as the game. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import { HOTEL_FIXTURES } from "../../lib/game/hotel-fixtures.ts";
import "@babylonjs/loaders/glTF/index.js";

const file = new URL("../../public/models/hotel-service-counter.glb", import.meta.url);
const data = await readFile(file);
assert.equal(data.toString("ascii", 0, 4), "glTF");
assert.equal(data.readUInt32LE(8), data.length);
const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
assert.ok(gltf.images.length === 2 && gltf.images.every((image) => image.bufferView != null));
const engine = new NullEngine({ renderWidth: 64, renderHeight: 64, textureSize: 512 });
const scene = new Scene(engine);
const asset = await LoadAssetContainerAsync(new Uint8Array(data), scene, { pluginExtension: ".glb" });
asset.addAllToScene();
const meshes = asset.meshes.filter((mesh) => mesh.getTotalVertices());
let min = new Vector3(Infinity, Infinity, Infinity);
let max = new Vector3(-Infinity, -Infinity, -Infinity);
for (const mesh of meshes) {
  assert.ok(mesh.getVerticesData("position").every(Number.isFinite));
  assert.equal(mesh.getVerticesData("uv").length, mesh.getTotalVertices() * 2);
  assert.ok(mesh.getIndices().every((index) => index >= 0 && index < mesh.getTotalVertices()));
  mesh.computeWorldMatrix(true);
  const bounds = mesh.getBoundingInfo().boundingBox;
  min = Vector3.Minimize(min, bounds.minimumWorld);
  max = Vector3.Maximize(max, bounds.maximumWorld);
}
const fixture = HOTEL_FIXTURES.find((item) => item.kind === "service-counter");
assert.ok(Math.abs(min.y) < .002, "The counter rests on its floor origin.");
assert.ok(Math.max(Math.abs(min.x), Math.abs(max.x)) <= fixture.w / 2 + .002);
assert.ok(Math.max(Math.abs(min.z), Math.abs(max.z)) <= fixture.d / 2 + .002);
assert.ok(max.y <= fixture.h + .002 && max.y >= fixture.h * .95);
assert.ok(meshes.length <= 10, "The cabinet retains a small material-batch count.");
const report = {
  file: "hotel-service-counter.glb", loader: "Babylon NullEngine with glTF AUTO conversion",
  triangles: meshes.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0),
  meshes: meshes.length, bytes: data.length, boundsBabylon: [min.asArray(), max.asArray()],
  fixture: { width: fixture.w, depth: fixture.d, height: fixture.h },
  embeddedTextures: gltf.images.length, finitePositions: true, validIndices: true, uvs: true,
};
await writeFile(new URL("../../docs/hotel-assets/service-counter-validation.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
asset.dispose();
scene.dispose();
engine.dispose();
