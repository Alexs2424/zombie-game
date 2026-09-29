import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/loaders/glTF/index.js';
import { createChipTemplate } from '../lib/game/chip-template.ts';

const bytes = () => new Uint8Array(readFileSync(new URL('../public/models/casino-chip.glb', import.meta.url)));
const near = (actual, expected, label, epsilon = 2e-6) => {
  assert.equal(actual.length, expected.length, `${label}: length`);
  for (let i = 0; i < actual.length; i++)
    assert.ok(Math.abs(actual[i] - expected[i]) <= epsilon, `${label}[${i}]: ${actual[i]} != ${expected[i]}`);
};

test('full casino-chip GLB keeps every vertex, normal, UV, triangle and material after hierarchy baking', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const container = await LoadAssetContainerAsync(bytes(), scene, { pluginExtension: '.glb' });
    const meshes = container.meshes.filter(mesh => mesh.getTotalVertices());
    assert.equal(meshes.length, 16);
    assert.ok(container.rootNodes[0].computeWorldMatrix(true).determinant() < 0, 'Actual glTF import has a mirrored root');
    const originals = meshes.map(mesh => ({
      mesh, positions: [...mesh.getVerticesData(VertexBuffer.PositionKind)],
      normals: [...mesh.getVerticesData(VertexBuffer.NormalKind)],
      uvs: [...mesh.getVerticesData(VertexBuffer.UVKind)], indices: [...mesh.getIndices()],
      parent: mesh.parent, material: mesh.material,
    }));
    const materials = [...new Set(meshes.map(mesh => mesh.material))];
    const positions = [], normals = [], uvs = [], indices = [], ranges = [];
    for (const material of materials) {
      const start = indices.length;
      for (const source of originals.filter(source => source.material === material)) {
        const world = source.mesh.computeWorldMatrix(true), offset = positions.length / 3;
        for (let i = 0; i < source.positions.length; i += 3) {
          positions.push(...Vector3.TransformCoordinates(Vector3.FromArray(source.positions, i), world).asArray());
          normals.push(...Vector3.TransformNormal(Vector3.FromArray(source.normals, i), world).asArray());
        }
        uvs.push(...source.uvs);
        const mirrored = world.determinant() < 0;
        for (let i = 0; i < source.indices.length; i += 3) {
          indices.push(offset + source.indices[i], offset + source.indices[i + (mirrored ? 2 : 1)],
            offset + source.indices[i + (mirrored ? 1 : 2)]);
        }
      }
      ranges.push({ material, start, count: indices.length - start });
    }
    const template = createChipTemplate(container);
    assert.equal(template.getTotalVertices(), 4092);
    assert.equal(template.getTotalIndices(), 3512 * 3);
    assert.equal(template.getChildren().length, 0);
    assert.equal(template.isEnabled(), false);
    assert.equal(template.sideOrientation, meshes[0].sideOrientation);
    assert.ok(template.material instanceof MultiMaterial);
    assert.deepEqual([...template.material.subMaterials], materials, 'Material identities are retained');
    assert.equal(template.subMeshes.length, 4, 'One submesh per material');
    near(template.getVerticesData(VertexBuffer.PositionKind), positions, 'baked position');
    near(template.getVerticesData(VertexBuffer.NormalKind), normals, 'baked normal');
    near(template.getVerticesData(VertexBuffer.UVKind), uvs, 'unchanged UV');
    assert.deepEqual([...template.getIndices()], indices, 'All triangle indices preserve mirrored winding');
    template.subMeshes.forEach((submesh, i) => {
      assert.equal(submesh.getMaterial(), ranges[i].material);
      assert.equal(submesh.indexStart, ranges[i].start);
      assert.equal(submesh.indexCount, ranges[i].count);
    });
    template.computeWorldMatrix(true);
    const bounds = template.getBoundingInfo().boundingBox;
    near(bounds.minimumWorld.asArray(), [0, 1, 2].map(axis => Math.min(...positions.filter((_, i) => i % 3 === axis))), 'minimum bounds');
    near(bounds.maximumWorld.asArray(), [0, 1, 2].map(axis => Math.max(...positions.filter((_, i) => i % 3 === axis))), 'maximum bounds');
    for (const source of originals) {
      assert.deepEqual([...source.mesh.getVerticesData(VertexBuffer.PositionKind)], source.positions);
      assert.deepEqual([...source.mesh.getVerticesData(VertexBuffer.NormalKind)], source.normals);
      assert.deepEqual([...source.mesh.getVerticesData(VertexBuffer.UVKind)], source.uvs);
      assert.deepEqual([...source.mesh.getIndices()], source.indices);
      assert.equal(source.mesh.parent, source.parent);
      assert.equal(source.mesh.material, source.material);
      assert.equal(scene.meshes.includes(source.mesh), false, 'Source container remains off-scene');
    }
    container.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});

test('placed chip copies share full geometry and materials while remaining independently movable and visible', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const container = await LoadAssetContainerAsync(bytes(), scene, { pluginExtension: '.glb' });
    const template = createChipTemplate(container), parent = new TransformNode('held chips', scene);
    parent.position.set(.27, -.23, .53); parent.rotation.set(.65, 0, -.18);
    const chips = Array.from({ length: 82 }, (_, i) => {
      const chip = template.clone(`chip ${i}`, null, true);
      chip.position.set(2, .81 + .012 * i, -3);
      chip.rotation.y = i * .12;
      chip.setEnabled(true);
      assert.equal(chip.geometry, template.geometry);
      assert.equal(chip.material, template.material);
      assert.equal(chip.getChildren().length, 0);
      assert.equal(chip.getTotalVertices(), 4092);
      assert.equal(chip.subMeshes.length, 4);
      return chip;
    });
    chips[0].parent = parent;
    const originalPlacement = new TransformNode('original hierarchy placement', scene);
    originalPlacement.parent = parent;
    originalPlacement.position.copyFrom(chips[0].position);
    originalPlacement.rotation.copyFrom(chips[0].rotation);
    const original = container.instantiateModelsToScene(name => `reference:${name}`, false, { doNotInstantiate: true });
    for (const root of original.rootNodes) root.parent = originalPlacement;
    const denomination = originalPlacement.getChildMeshes().find(mesh => mesh.name === 'reference:Denomination');
    assert.ok(denomination);
    const originalPosition = Vector3.FromArray(denomination.getVerticesData(VertexBuffer.PositionKind), 30);
    const expected = Vector3.TransformCoordinates(originalPosition, denomination.computeWorldMatrix(true));
    const actual = Vector3.TransformCoordinates(Vector3.FromArray(chips[0].getVerticesData(VertexBuffer.PositionKind), 30), chips[0].computeWorldMatrix(true));
    near(actual.asArray(), expected.asArray(), 'held chip matches the placed original glTF hierarchy');
    chips[0].setEnabled(false);
    chips[1].visibility = .48;
    assert.equal(chips[2].isEnabled(), true);
    assert.equal(chips[2].visibility, 1);
    assert.equal(template.isEnabled(), false);
    chips[0].dispose();
    assert.equal(chips[2].getTotalVertices(), 4092, 'Disposing one chip retains shared geometry');
    container.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});
