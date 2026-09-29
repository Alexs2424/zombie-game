import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { createHotelLightMembership } from "../lib/game/hotel-light-membership.ts";

// Babylon batches mesh-added notifications after the current construction task.
const flushMeshEvents = () => new Promise((resolve) => setTimeout(resolve, 2));

function fixture(t) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const lights = [0, 1].map((i) => new PointLight(`hotel light ${i}`, Vector3.Zero(), scene));
  const scenery = new Mesh("hotel scenery", scene);
  const scans = [0, 0];
  lights.forEach((light, i) => {
    const resync = light._resyncMeshes.bind(light);
    light._resyncMeshes = () => { scans[i]++; resync(); };
  });
  const tracker = createHotelLightMembership(scene, lights);
  tracker.setStaticMeshes([scenery]);
  scans.fill(0);
  t.after(() => { tracker.dispose(); scene.dispose(); engine.dispose(); });
  const enemy = (id, z) => {
    const root = new TransformNode(`enemy ${id}`, scene);
    root.position.z = z;
    const mesh = new Mesh(`body ${id}`, scene);
    // Match createZombie: the scene receives the mesh before material/parent setup.
    mesh.material = new StandardMaterial(`zombie-${id}-skin`, scene);
    mesh.parent = root;
    return { root, mesh };
  };
  return { scene, lights, scenery, scans, tracker, enemy };
}

test("idle hotel lighting performs no repeated whole-scene light rescans", async (t) => {
  const { scene, lights, scenery, scans, tracker } = fixture(t);
  for (let i = 0; i < 200; i++) {
    const decoration = new Mesh(`scenery ${i}`, scene);
    decoration.material = new StandardMaterial(`scenery material ${i}`, scene);
    decoration.getAbsolutePosition = () => assert.fail("static scenery should not be position-tested");
  }
  await flushMeshEvents();
  for (let time = 0; time < 10; time += 0.5) tracker.update(time);
  assert.deepEqual(scans, [0, 0]);
  for (const light of lights) assert.deepEqual(light.includedOnlyMeshes.map((m) => m.name), [scenery.name]);
  assert.notEqual(lights[0].includedOnlyMeshes, lights[1].includedOnlyMeshes);
});

test("hotel lights follow enemy spawn, doorway crossings, and simulation clock reset", async (t) => {
  const { scene, lights, scenery, scans, tracker, enemy } = fixture(t);
  const visitor = enemy(1, 12);
  const casinoEnemy = enemy(2, 10);
  await flushMeshEvents();
  tracker.update(0);
  for (const light of lights) assert.deepEqual(light.includedOnlyMeshes.map((m) => m.name), [scenery.name, visitor.mesh.name]);
  assert.deepEqual(scans, [1, 1]);
  tracker.update(0.5);
  tracker.update(1);
  assert.deepEqual(scans, [1, 1], "unchanged enemy membership must not resync lights");

  visitor.root.position.z = 11;
  casinoEnemy.root.position.z = 11.1;
  scene.incrementRenderId();
  tracker.update(1.5);
  for (const light of lights) assert.deepEqual(light.includedOnlyMeshes.map((m) => m.name), [scenery.name, casinoEnemy.mesh.name]);
  assert.deepEqual(scans, [2, 2]);
  visitor.root.position.z = 20;
  scene.incrementRenderId();
  tracker.update(0);
  for (const light of lights) assert.deepEqual(light.includedOnlyMeshes.map((m) => m.name).sort(), [scenery.name, visitor.mesh.name, casinoEnemy.mesh.name].sort());
  assert.deepEqual(scans, [3, 3]);
});

test("furniture replacement, despawn, and tracker disposal retain correct light ownership", async (t) => {
  const { scene, lights, tracker, enemy } = fixture(t);
  const visitor = enemy(3, 20);
  const transient = enemy(5, 20);
  transient.root.dispose();
  await flushMeshEvents();
  tracker.update(0);
  const furniture = new Mesh("loaded hotel furniture", scene);
  tracker.setStaticMeshes([furniture]);
  for (const light of lights) assert.deepEqual(light.includedOnlyMeshes.map((m) => m.name), [furniture.name, visitor.mesh.name]);
  assert.notEqual(lights[0].includedOnlyMeshes, lights[1].includedOnlyMeshes);
  visitor.root.dispose();
  tracker.update(0.1);
  for (const light of lights) assert.deepEqual(light.includedOnlyMeshes.map((m) => m.name), [furniture.name]);

  tracker.dispose();
  enemy(4, 20);
  tracker.update(1);
  tracker.setStaticMeshes([]);
  for (const light of lights) assert.deepEqual(light.includedOnlyMeshes.map((m) => m.name), [furniture.name]);
});
