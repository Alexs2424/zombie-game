/** Validate the shipped model through the same left-handed Babylon loader as the game.
 * Run with Node >= 22.13: node --experimental-strip-types tools/bar-assets/validate_runtime.mjs
 * Images are deliberately skipped: this audits world geometry, transforms and ray intersections.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { Ray } from "@babylonjs/core/Culling/ray.js";
import "@babylonjs/loaders/glTF/index.js";
import { LOUNGE_RECTS } from "../../lib/game/lounge-layout.ts";

const modelUrl = new URL("../../public/models/last-call-lounge.glb", import.meta.url);
const reportUrl = new URL("../../docs/bar-assets/runtime-validation.json", import.meta.url);
const bytes = await readFile(modelUrl);
const engine = new NullEngine();
const scene = new Scene(engine);

try {
  assert.equal(scene.useRightHandedSystem, false, "Match the game's left-handed world");
  const asset = await LoadAssetContainerAsync(bytes, scene, {
    pluginExtension: ".glb",
    name: "last-call-lounge.glb",
    pluginOptions: { gltf: { skipMaterials: true } },
  });
  asset.addAllToScene();
  const meshes = asset.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
  assert.ok(meshes.length > 0, "The GLB has no renderable geometry");

  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const footprints = LOUNGE_RECTS.map((rect) => ({ ...rect, vertices: 0 }));
  let vertexCount = 0;
  let triangleCount = 0;
  for (const mesh of meshes) {
    // Do not detach or reset the glTF conversion root; that would conceal an X flip.
    const world = mesh.computeWorldMatrix(true);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    assert.ok(positions?.length, `No CPU-readable positions for ${mesh.name}`);
    triangleCount += mesh.getTotalIndices() / 3;
    for (let i = 0; i < positions.length; i += 3) {
      const p = Vector3.TransformCoordinates(Vector3.FromArray(positions, i), world);
      assert.ok([p.x, p.y, p.z].every(Number.isFinite), `Non-finite vertex in ${mesh.name}`);
      min.minimizeInPlace(p);
      max.maximizeInPlace(p);
      vertexCount++;
      for (const rect of footprints) {
        if (Math.abs(p.x - rect.x) <= rect.w / 2 + 0.002 &&
            Math.abs(p.z - rect.z) <= rect.d / 2 + 0.002 &&
            p.y >= 0.05 && p.y <= rect.h + 0.002) {
          rect.vertices++;
        }
      }
    }
    mesh.freezeWorldMatrix();
  }
  const limits = { x: [4.2, 15.8], y: [0, 4.85], z: [-12, 3] };
  for (const axis of ["x", "y", "z"]) {
    assert.ok(min[axis] >= limits[axis][0] - 0.002 && max[axis] <= limits[axis][1] + 0.002,
      `Loaded ${axis.toUpperCase()} bounds [${min[axis]}, ${max[axis]}] exceed lounge limits ${limits[axis]}`);
  }
  for (const rect of footprints) {
    assert.ok(rect.vertices >= 12, `Missing model geometry in collision footprint ${rect.id}`);
  }

  const rayChecks = [];
  function checkRay(name, origin, direction, length, expectedAxis, expectedRange) {
    const ray = new Ray(Vector3.FromArray(origin), Vector3.FromArray(direction), length);
    const hit = scene.pickWithRay(ray, (mesh) => meshes.includes(mesh), false);
    if (!expectedRange) {
      assert.ok(!hit?.hit, `${name} is blocked by ${hit?.pickedMesh?.name} at ${hit?.pickedPoint}`);
      rayChecks.push({ name, clear: true });
      return;
    }
    assert.ok(hit?.hit && hit.pickedPoint, `${name} missed the expected furniture`);
    const value = hit.pickedPoint[expectedAxis];
    assert.ok(value >= expectedRange[0] && value <= expectedRange[1],
      `${name} hit ${expectedAxis}=${value}; expected ${expectedRange}`);
    rayChecks.push({ name, point: hit.pickedPoint.asArray(), mesh: hit.pickedMesh.name });
  }
  checkRay("bar front faces the bartender approach", [12, 0.8, -7.3], [0, 0, -1], 2, "z", [-8.4, -8.1]);
  checkRay("countertop is under the bar world position", [11.7, 2.5, -8.7], [0, -1, 0], 2.5, "y", [1.25, 1.85]);
  checkRay("backbar stands against the south wall", [12, 2.4, -10.3], [0, 0, -1], 1.7, "z", [-11.95, -11.2]);
  checkRay("main entrance-to-VIP aisle", [4.8, 0.8, -4.1], [1, 0, 0], 10.4);
  checkRay("bartender approach", [12, 0.8, -4.1], [0, 0, -1], 3.2);
  checkRay("staff passage gap", [11.7, 0.8, 1.8], [0, 0, 1], 2.2);

  const report = {
    status: "passed",
    file: fileURLToPath(modelUrl),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    engine: "Babylon.js NullEngine",
    coordinateSystem: "default left-handed scene with original glTF conversion root preserved",
    bounds: { min: min.asArray(), max: max.asArray(), allowed: limits },
    meshCount: meshes.length,
    vertexCount,
    triangleCount,
    collisionFootprints: footprints.map(({ id, vertices }) => ({ id, vertices })),
    rayChecks,
    materialsSkipped: true,
  };
  // Never write a successful report until every engine-level check has passed.
  await mkdir(new URL(".", reportUrl), { recursive: true });
  await writeFile(reportUrl, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  scene.dispose();
  engine.dispose();
}
