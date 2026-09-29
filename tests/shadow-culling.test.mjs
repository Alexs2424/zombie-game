import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix, Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Frustum} from '@babylonjs/core/Maths/math.frustum.js';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera.js';
import {SpotLight} from '@babylonjs/core/Lights/spotLight.js';
import {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import {intersectsShadowFrustum} from '../lib/game/shadow-culling.ts';

const light = new Vector3(-17, 5.9, -4);
const view = Matrix.LookAtLH(light, light.add(new Vector3(.08, -1, .04)), Vector3.Up());
const projection = Matrix.PerspectiveFovLH(2.35, 1, .3, 28);
const planes = Frustum.GetPlanes(view.multiply(projection));
const box = (x, y, z, size = 1) => [
  {x: x - size / 2, y: y - size / 2, z: z - size / 2},
  {x: x + size / 2, y: y + size / 2, z: z + size / 2},
];

test('static casters under the light remain; distant rooms and geometry above it are culled', () => {
  assert.ok(intersectsShadowFrustum(...box(-17, 1, -4), planes, .05));
  assert.equal(intersectsShadowFrustum(...box(40, 1, 40), planes, .05), false);
  assert.equal(intersectsShadowFrustum(...box(-17, 12, -4), planes, .05), false);
  assert.equal(intersectsShadowFrustum(...box(-17, -35, -4), planes, .05), false);
});

test('casters straddling a light boundary or within normal-bias padding stay included', () => {
  const halfSpace = [{normal: {x: 1, y: 0, z: 0}, d: 0}];
  assert.ok(intersectsShadowFrustum(...box(0, 0, 0), halfSpace));
  assert.ok(intersectsShadowFrustum(...box(-.53, 0, 0), halfSpace, .05));
  assert.equal(intersectsShadowFrustum(...box(-.56, 0, 0), halfSpace, .05), false);
});

test('no box containing an in-frustum corner is rejected across the light volume', () => {
  let checked = 0;
  for (let x = -47; x <= 15; x += 2) for (let y = -24; y <= 8; y += 2)
    for (let z = -34; z <= 26; z += 2) {
      const [min, max] = box(x, y, z, 3);
      const corners = [min.x, max.x].flatMap(cx => [min.y, max.y].flatMap(cy =>
        [min.z, max.z].map(cz => new Vector3(cx, cy, cz))));
      if (!corners.some(corner => planes.every(plane => plane.dotCoordinate(corner) >= 0))) continue;
      checked++;
      assert.ok(intersectsShadowFrustum(min, max, planes, .05), `visible corner at ${x},${y},${z}`);
    }
  assert.ok(checked > 1000);
});

test('Babylon shadow projection initializes before rendering and matches homogeneous clip bounds', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    scene.activeCamera = new FreeCamera('camera', Vector3.Zero(), scene);
    const key = new SpotLight('chandelier', light, new Vector3(.08, -1, .04), 2.35, 1.35, scene);
    key.shadowMinZ = .3;
    key.shadowMaxZ = 28;
    const shadow = new ShadowGenerator(1024, key);
    shadow.normalBias = .04;
    const matrix = shadow.getTransformMatrix();
    assert.ok([...matrix.m].every(Number.isFinite));
    assert.equal(matrix.isIdentity(), false);
    const actualPlanes = Frustum.GetPlanes(matrix);
    assert.ok(intersectsShadowFrustum(...box(-17, 1, -4), actualPlanes, .05));
    assert.equal(intersectsShadowFrustum(...box(40, 1, 40), actualPlanes, .05), false);
    assert.equal(intersectsShadowFrustum(...box(-17, 12, -4), actualPlanes, .05), false);
    assert.equal(intersectsShadowFrustum(...box(-17, -35, -4), actualPlanes, .05), false);
    const m = matrix.m;
    let retained = 0, rejected = 0;
    for (let x = -45; x <= 15; x += 4) for (let y = -30; y <= 10; y += 2)
      for (let z = -34; z <= 26; z += 4) {
        const [min, max] = box(x, y, z, 1.3);
        const clipCorners = [min.x, max.x].flatMap(cx => [min.y, max.y].flatMap(cy =>
          [min.z, max.z].map(cz => [
            cx * m[0] + cy * m[4] + cz * m[8] + m[12],
            cx * m[1] + cy * m[5] + cz * m[9] + m[13],
            cx * m[2] + cy * m[6] + cz * m[10] + m[14],
            cx * m[3] + cy * m[7] + cz * m[11] + m[15],
          ])));
        // Raster clip space is -w..w on all axes for this WebGL projection.
        const outside = [0, 1, 2].some(axis =>
          clipCorners.every(c => c[axis] < -c[3]) || clipCorners.every(c => c[axis] > c[3]));
        const intersects = intersectsShadowFrustum(min, max, actualPlanes);
        assert.equal(intersects, !outside, `clip bounds at ${x},${y},${z}`);
        if (intersects) retained++; else rejected++;
      }
    assert.ok(retained > 100 && rejected > 100);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});
