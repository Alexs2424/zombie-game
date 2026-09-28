/** Audit the shipped Blender exports through the game's actual left-handed loader.
 * node --experimental-strip-types tools/service-assets/validate_runtime.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { Ray } from "@babylonjs/core/Culling/ray.js";
import "@babylonjs/loaders/glTF/index.js";
import { SERVICE_RECTS } from "../../lib/game/service-layout.ts";

const engine = new NullEngine();
const scene = new Scene(engine);
const reports = [];
const footprints = SERVICE_RECTS.map((rect) => ({ ...rect, vertices: 0 }));
const allMeshes = [];
try {
  assert.equal(scene.useRightHandedSystem, false);
  for (const name of ["service-truck", "service-props"]) {
    const bytes = await readFile(new URL(`../../public/models/${name}.glb`, import.meta.url));
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
    assert.ok(gltf.materials.length > 3, "Expected authored PBR material families");
    for (const image of gltf.images ?? []) {
      assert.equal(image.uri, undefined, "All textures must be embedded");
      assert.ok(Number.isInteger(image.bufferView));
    }
    const asset = await LoadAssetContainerAsync(bytes, scene, {
      pluginExtension: ".glb", name: `${name}.glb`,
      pluginOptions: { gltf: { skipMaterials: true } },
    });
    asset.addAllToScene();
    const meshes = asset.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
    assert.ok(meshes.length > 0);
    allMeshes.push(...meshes);
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    let vertices = 0, triangles = 0;
    for (const mesh of meshes) {
      const world = mesh.computeWorldMatrix(true);
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
      const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
      assert.ok(positions?.length && normals?.length, `Geometry/normals missing: ${mesh.name}`);
      assert.ok(normals.every(Number.isFinite));
      triangles += mesh.getTotalIndices() / 3;
      for (let i = 0; i < positions.length; i += 3) {
        const p = Vector3.TransformCoordinates(Vector3.FromArray(positions, i), world);
        assert.ok(p.asArray().every(Number.isFinite));
        min.minimizeInPlace(p); max.maximizeInPlace(p); vertices++;
        for (const rect of footprints) {
          if (Math.abs(p.x - rect.x) <= rect.w / 2 + .02 &&
              Math.abs(p.z - rect.z) <= rect.d / 2 + .02 && p.y >= .08 && p.y <= rect.h + .02) {
            rect.vertices++;
          }
        }
      }
      mesh.freezeWorldMatrix();
    }
    const limits = name === "service-truck"
      ? { x: [5.05, 10.55], y: [0, 2.95], z: [4.375, 6.925] }
      : { x: [4.25, 15.8], y: [0, 4.8], z: [3.2, 11.97] };
    for (const axis of ["x", "y", "z"]) {
      assert.ok(min[axis] >= limits[axis][0] - .025 && max[axis] <= limits[axis][1] + .025,
        `${name}: ${axis} bounds ${min[axis]}..${max[axis]} exceed ${limits[axis]}`);
    }
    assert.ok(bytes.length < 10 * 1024 * 1024, `${name} exceeds 10 MiB budget`);
    assert.ok(triangles < 150000, `${name} exceeds triangle budget`);
    assert.ok(meshes.length <= 32, `${name} is not consolidated by material`);
    reports.push({ name, sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length, meshes: meshes.length, vertices, triangles,
      materials: gltf.materials.length, embeddedTextures: gltf.images?.length ?? 0,
      bounds: { min: min.asArray(), max: max.asArray() } });
  }
  for (const rect of footprints) assert.ok(rect.vertices >= 24, `Empty collision footprint: ${rect.id}`);
  const rayChecks = [];
  function rayCheck(name, origin, direction, length, expectedHit = false) {
    const hit = scene.pickWithRay(new Ray(Vector3.FromArray(origin), Vector3.FromArray(direction), length),
      (mesh) => allMeshes.includes(mesh), false);
    assert.equal(Boolean(hit?.hit), expectedHit, `${name}: unexpected ${hit?.pickedMesh?.name ?? "miss"}`);
    rayChecks.push({ name, hit: Boolean(hit?.hit), ...(hit?.hit ? { point: hit.pickedPoint.asArray() } : {}) });
  }
  for (const y of [.35, .85, 1.65]) {
    rayCheck(`cross-room door aisle at height ${y}`, [4.4, y, 8.6], [1, 0, 0], 11.2);
    rayCheck(`lounge passage at height ${y}`, [11.7, y, 3.2], [0, 0, 1], 6.3);
  }
  rayCheck("truck cargo side", [8.6, 1.7, 8.2], [0, 0, -1], 4, true);
  rayCheck("truck cab front", [4.6, 1.35, 5.65], [1, 0, 0], 3, true);
  // Aim at the loaded boxes, not the intentional seams between the cartons
  // or the empty space above the middle shelf's shallow totes.
  rayCheck("stacked pallet cartons", [14.12, .8, 8.6], [0, 0, -1], 4, true);
  rayCheck("north shelf cartons", [6.5, .6, 9.8], [0, 0, 1], 2, true);
  const stripe = scene.pickWithRay(new Ray(new Vector3(4.75, .1, 7.59), new Vector3(0, -1, 0), .1),
    (mesh) => allMeshes.includes(mesh), false);
  assert.ok(stripe?.hit && stripe.pickedPoint.y >= .018 && stripe.pickedPoint.y <= .024,
    "Floor paint must sit above the runtime concrete and expansion joints without floating");
  rayChecks.push({ name: "floor paint clears concrete and joints", hit: true, point: stripe.pickedPoint.asArray() });
  const report = { status: "passed", engine: "Babylon.js NullEngine", coordinateSystem: "default left-handed; glTF roots preserved",
    assets: reports, collisionFootprints: footprints.map(({ id, vertices }) => ({ id, vertices })), rayChecks,
    materialsSkippedDuringGeometryAudit: true };
  await writeFile(new URL("../../docs/service-assets/runtime-validation.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  scene.dispose(); engine.dispose();
}
