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
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import "@babylonjs/loaders/glTF/index.js";
import { SERVICE_ASSET_MOUNTS, SERVICE_RECTS } from "../../lib/game/service-layout.ts";
import { SERVICE_OFFSET } from "../../lib/game/casino-layout.ts";

const engine = new NullEngine();
const scene = new Scene(engine);
const reports = [];
const footprints = SERVICE_RECTS.map((rect) => ({ ...rect, vertices: 0 }));
const allMeshes = [];
const worldPoint = ([x, y, z]) => new Vector3(x + SERVICE_OFFSET.x, y, z + SERVICE_OFFSET.z);
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
    const placement = new TransformNode(`${name} relocated placement`, scene);
    placement.position.set(SERVICE_OFFSET.x, 0, SERVICE_OFFSET.z);
    for (const node of [...asset.meshes, ...asset.transformNodes].filter(node => !node.parent))
      node.parent = placement;
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
      : { x: [SERVICE_ASSET_MOUNTS.west - .1, SERVICE_ASSET_MOUNTS.east + .1],
        y: [0, SERVICE_ASSET_MOUNTS.ceiling],
        z: [SERVICE_ASSET_MOUNTS.south, SERVICE_ASSET_MOUNTS.north + .05] };
    for (const axis of ["x", "y", "z"]) {
      const offset = axis === "y" ? 0 : SERVICE_OFFSET[axis];
      assert.ok(min[axis] >= limits[axis][0] + offset - .025 && max[axis] <= limits[axis][1] + offset + .025,
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
    const hit = scene.pickWithRay(new Ray(worldPoint(origin), Vector3.FromArray(direction), length),
      (mesh) => allMeshes.includes(mesh), false);
    assert.equal(Boolean(hit?.hit), expectedHit, `${name}: unexpected ${hit?.pickedMesh?.name ?? "miss"}`);
    rayChecks.push({ name, hit: Boolean(hit?.hit), ...(hit?.hit ? { point: hit.pickedPoint.asArray() } : {}) });
    return hit;
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
  const stripe = scene.pickWithRay(new Ray(worldPoint([4.75, .1, 7.59]), new Vector3(0, -1, 0), .1),
    (mesh) => allMeshes.includes(mesh), false);
  assert.ok(stripe?.hit && stripe.pickedPoint.y >= .018 && stripe.pickedPoint.y <= .024,
    "Floor paint must sit above the runtime concrete and expansion joints without floating");
  rayChecks.push({ name: "floor paint clears concrete and joints", hit: true, point: stripe.pickedPoint.asArray() });
  // Inspect the shipped geometry at the actual wall faces, including its backs.
  // The former room-sized gap must contain no fire or electrical equipment.
  const { south, north, west, east, ceiling } = SERVICE_ASSET_MOUNTS;
  const fire = rayCheck("fire backplate touches south wall", [9.03, 1.7, south - .02], [0, 0, 1], .05, true);
  assert.ok(Math.abs(fire.pickedPoint.z - (south + SERVICE_OFFSET.z)) < .002);
  const panel = rayCheck("switchgear backplate touches north wall", [8.12, 2, north + .02], [0, 0, -1], .05, true);
  assert.ok(Math.abs(panel.pickedPoint.z - (north + SERVICE_OFFSET.z)) < .002);
  const sign = rayCheck("receiving sign touches north wall", [10.1, 2.92, north + .02], [0, 0, -1], .05, true);
  assert.ok(Math.abs(sign.pickedPoint.z - (north + SERVICE_OFFSET.z)) < .002);
  rayCheck("old fire position is clear", [9.03, 1.23, 3], [0, 0, 1], .6);
  rayCheck("old switchgear position is clear", [8.12, 2, 11.5], [0, 0, 1], .5);
  rayCheck("pipe enters west wall", [west, 4.12, 5.3], [0, 0, 1], .3, true);
  rayCheck("pipe returns into east wall", [east, 3.36, 5.3], [0, 0, 1], .3, true);
  const anchor = rayCheck("pipe suspension touches ceiling", [5.3, ceiling + .02, 5.44], [0, -1, 0], .04, true);
  assert.ok(Math.abs(anchor.pickedPoint.y - ceiling) < .002);
  const report = { status: "passed", engine: "Babylon.js NullEngine", coordinateSystem: "default left-handed; glTF roots preserved",
    assets: reports, collisionFootprints: footprints.map(({ id, vertices }) => ({ id, vertices })), rayChecks,
    materialsSkippedDuringGeometryAudit: true };
  await writeFile(new URL("../../docs/service-assets/runtime-validation.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  scene.dispose(); engine.dispose();
}
