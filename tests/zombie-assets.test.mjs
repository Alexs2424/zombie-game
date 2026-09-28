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
    // The single torso jacket ellipsoid makes an unambiguous winding regression check.
    const torso=variant.meshes.find(m=>m.part==='body'&&m.material==='suit');
    const normals=[];VertexData.ComputeNormals(torso.positions,torso.indices,normals);
    let outward=0;
    for(let i=0;i<normals.length;i+=3) outward+=torso.positions[i]*normals[i]+(torso.positions[i+1]-1.15)*normals[i+1]+torso.positions[i+2]*normals[i+2];
    assert.ok(outward>0,`${variant.name} normals point inward`);
  }
});
