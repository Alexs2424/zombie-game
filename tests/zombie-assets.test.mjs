import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { rotateLimb } from '../lib/game/zombie-pose.ts';

test('hit-volume rotations match Babylon shoulder and elbow transforms', () => {
  for (const x of [-2.8,-1.5,-.7]) for (const z of [-1.3,0,.9]) {
    const local=[.03,-.35,.13];
    const actual=Vector3.TransformCoordinates(Vector3.FromArray(local),Matrix.RotationYawPitchRoll(0,x,z));
    const expected=rotateLimb(local,x,z);
    assert.ok(Vector3.Distance(actual,Vector3.FromArray(expected))<1e-6);
  }
});

test('portable GLB carries palette tints, vertex shading, and batched parts', () => {
  const bytes = readFileSync(new URL('../public/models/casino-undead.glb', import.meta.url));
  assert.equal(bytes.toString('utf8', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.byteLength);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.ok(gltf.meshes.length <= 90, 'export should batch parts by material');
  for (const material of gltf.materials) {
    const tint = material.pbrMetallicRoughness.baseColorFactor;
    assert.equal(tint.length, 4, `${material.name} lost its palette tint`);
    assert.ok(tint.slice(0, 3).some(v => v < .9), `${material.name} exported as white`);
  }
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    for (const key of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0']) {
      assert.ok(Number.isInteger(primitive.attributes[key]), `${mesh.name} lost ${key}`);
    }
  }
});

test('all Blender variants contain valid modular geometry, wounds and outward normals', () => {
  const asset=JSON.parse(readFileSync(new URL('../public/models/zombies.json',import.meta.url)));
  assert.equal(asset.variants.length,3);
  for(const variant of asset.variants) {
    const parts=new Set(variant.meshes.map(m=>m.part));
    for(const name of ['body','head','jaw','leftArm','rightArm','leftForearm','rightForearm','leftLeg','rightLeg']) assert.ok(parts.has(name));
    for(const name of ['leftArm','rightArm','leftLeg','rightLeg']) {
      assert.ok(parts.has('wound_'+name));assert.ok(parts.has('stump_'+name));
    }
    for(const m of variant.meshes) {
      assert.equal(m.positions.length%3,0);assert.equal(m.indices.length%3,0);
      assert.ok(m.positions.every(Number.isFinite));
      assert.ok(m.indices.every(i=>Number.isInteger(i)&&i>=0&&i<m.positions.length/3));
    }
    // The jacket dominates the torso surface, so its aggregate normal must face out.
    const torso=variant.meshes.find(m=>m.part==='body'&&m.material==='suit');
    const normals=[];VertexData.ComputeNormals(torso.positions,torso.indices,normals);
    let outward=0;
    for(let i=0;i<normals.length;i+=3) outward+=torso.positions[i]*normals[i]+(torso.positions[i+1]-1.15)*normals[i+1]+torso.positions[i+2]*normals[i+2];
    assert.ok(outward>0,`${variant.name} normals point inward`);
  }
});

test('fidelity assets retain shading data and stay within the crowd rendering budget', () => {
  const path = new URL('../public/models/zombies.json', import.meta.url);
  const source = readFileSync(path);
  const asset = JSON.parse(source);
  assert.equal(asset.version, 2);
  assert.ok(source.byteLength < 4_000_000, 'keep the shared character download bounded');
  for (const variant of asset.variants) {
    let triangles = 0;
    let visibleGroups = 0;
    assert.match(variant.palette.skin, /^#[0-9a-f]{6}$/i);
    assert.match(variant.palette.suit, /^#[0-9a-f]{6}$/i);
    for (const m of variant.meshes) {
      const vertices = m.positions.length / 3;
      assert.equal(m.normals.length, vertices * 3);
      assert.equal(m.uvs.length, vertices * 2);
      assert.equal(m.colors.length, vertices * 4);
      assert.ok(m.normals.every(Number.isFinite));
      assert.ok(m.uvs.every(Number.isFinite));
      assert.ok(m.colors.every(c => Number.isFinite(c) && c >= 0 && c <= 1));
      assert.ok(asset.colors[m.material]);
      for (let i = 0; i < m.normals.length; i += 3) {
        assert.ok(Math.abs(Math.hypot(...m.normals.slice(i, i + 3)) - 1) < .002,
          `${variant.name}/${m.part} has a non-unit normal`);
      }
      triangles += m.indices.length / 3;
      if (!/^(wound_|stump_)/.test(m.part)) visibleGroups++;
    }
    assert.ok(triangles <= 18000, `${variant.name} exceeds the existing triangle budget`);
    assert.ok(visibleGroups <= 30, `${variant.name} adds too many visible draw groups`);
  }
  for (const surface of new Set(Object.values(asset.surfaces))) {
    for (const channel of ['color', 'normal', 'roughness']) {
      const bytes = readFileSync(new URL(`../public/textures/zombies/${surface}-${channel}.png`, import.meta.url));
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(bytes.readUInt32BE(16), 512);
      assert.equal(bytes.readUInt32BE(20), 512);
    }
  }
});
