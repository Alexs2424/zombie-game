import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import {
  ROULETTE_SEQUENCE,
  ROULETTE_GEOMETRY,
  RouletteMotion,
  createRouletteSpin,
  idleRoulettePose,
  roulettePocketAngle,
  sampleRouletteSpin,
} from "../lib/game/roulette-motion.ts";

const close = (a, b, tolerance = 1e-6) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test("wheel sequence and pivot agree with the shipped roulette GLB", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../docs/table-assets/asset-manifest.json", import.meta.url)),
  );
  assert.deepEqual([...ROULETTE_SEQUENCE], manifest.roulette.single_zero_order);
  assert.deepEqual([...ROULETTE_SEQUENCE].sort((a, b) => a - b),
    Array.from({ length: 37 }, (_, i) => i));
  const glb = readFileSync(new URL("../public/models/roulette-table.glb", import.meta.url));
  const jsonLength = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength));
  const wheel = gltf.nodes.find((node) => node.name === "roulette_wheel");
  assert.deepEqual(wheel.translation, [
    ROULETTE_GEOMETRY.centerX, ROULETTE_GEOMETRY.pivotY, ROULETTE_GEOMETRY.centerZ,
  ]);
  const ballIndex = gltf.nodes.findIndex((node) => node.name === "roulette_ball");
  assert.ok(!wheel.children.includes(ballIndex), "ball must share the conversion parent, not rotate twice");
});

test("every outcome, including zero, settles on its exact pocket under Babylon Y rotation", () => {
  let previous = idleRoulettePose();
  // Use the actual Babylon matrix implementation so an incorrect rotation sign fails.
  for (const number of [0, 4, 24, 7, ...ROULETTE_SEQUENCE]) {
    const motion = createRouletteSpin(number, previous);
    const pose = sampleRouletteSpin(motion, 1);
    const alpha = roulettePocketAngle(number);
    const expected = Vector3.TransformCoordinates(
      new Vector3(
        ROULETTE_GEOMETRY.pocketRadius * Math.cos(alpha),
        0,
        ROULETTE_GEOMETRY.pocketRadius * Math.sin(alpha),
      ),
      Matrix.RotationY(pose.wheelAngle),
    );
    close(pose.ballRadius * Math.cos(pose.ballAngle), expected.x);
    close(pose.ballRadius * Math.sin(pose.ballAngle), expected.z);
    close(pose.ballRadius, ROULETTE_GEOMETRY.pocketRadius);
    close(pose.ballHeight, ROULETTE_GEOMETRY.pocketBallHeight);
    // Landing remains on the near side, where the player can read the numbered rim.
    close(expected.x, 0);
    close(expected.z, -ROULETTE_GEOMETRY.pocketRadius);
    previous = pose;
  }
});

test("glTF conversion keeps the settled ball on the visible near side of the world-space wheel", () => {
  const conversion = Matrix.Compose(
    new Vector3(1, 1, -1), new Quaternion(0, 1, 0, 0), new Vector3(35, 0, 5),
  );
  const pivot = Vector3.TransformCoordinates(new Vector3(-0.735, 0.86, 0), conversion);
  close(pivot.x, 35.735);
  close(pivot.z, 5);
  const pose = sampleRouletteSpin(createRouletteSpin(24, idleRoulettePose()), 1);
  const ball = Vector3.TransformCoordinates(new Vector3(
    -0.735 + Math.cos(pose.ballAngle) * pose.ballRadius,
    pose.ballHeight,
    Math.sin(pose.ballAngle) * pose.ballRadius,
  ), conversion);
  close(ball.x, pivot.x);
  close(ball.z, 5 - ROULETTE_GEOMETRY.pocketRadius);
});

test("spin decelerates monotonically and the ball drops smoothly into the pocket", () => {
  const start = idleRoulettePose();
  const motion = createRouletteSpin(7, start);
  assert.deepEqual(sampleRouletteSpin(motion, 0), start);
  let previous = start, wheelStep = Infinity, ballStep = Infinity;
  for (let i = 1; i <= 300; i++) {
    const pose = sampleRouletteSpin(motion, i / 300);
    const dw = pose.wheelAngle - previous.wheelAngle;
    const db = pose.ballAngle - previous.ballAngle;
    assert.ok(dw >= 0 && dw <= wheelStep + 1e-10);
    assert.ok(db >= 0 && db <= ballStep + 1e-10);
    assert.ok(pose.ballRadius >= ROULETTE_GEOMETRY.pocketRadius - 1e-10);
    assert.ok(pose.ballRadius <= ROULETTE_GEOMETRY.trackRadius + 1e-10);
    assert.ok(Math.abs(pose.ballRadius - previous.ballRadius) < 0.006);
    assert.ok(Math.abs(pose.ballHeight - previous.ballHeight) < 0.006);
    assert.ok(Object.values(pose).every(Number.isFinite));
    wheelStep = dw; ballStep = db; previous = pose;
  }
  assert.ok(wheelStep < 0.000001 && ballStep < 0.000002);
  close(sampleRouletteSpin(motion, 0.6).ballRadius, ROULETTE_GEOMETRY.trackRadius);
  close(sampleRouletteSpin(motion, 0.94).ballRadius, ROULETTE_GEOMETRY.pocketRadius);
  assert.deepEqual(sampleRouletteSpin(motion, 10), sampleRouletteSpin(motion, 1));
});

test("remaining-time animation freezes on pause/death, holds results and continues repeated spins", () => {
  const run = {}, motion = new RouletteMotion();
  const first = { id: 1, number: 0, remaining: 6, resolved: false };
  assert.deepEqual(motion.update(run, first, 6), idleRoulettePose());
  first.remaining = 2.1;
  const paused = motion.update(run, first, 6);
  for (let i = 0; i < 50; i++) assert.deepEqual(motion.update(run, first, 6), paused);
  first.resolved = true;
  first.remaining = 0;
  const settled = motion.update(run, first, 6);
  assert.deepEqual(motion.update(run, null, 6), settled);
  const next = { id: 2, number: 24, remaining: 6, resolved: false };
  assert.deepEqual(motion.update(run, next, 6), settled);
  next.remaining = 0; next.resolved = true;
  const nextResult = motion.update(run, next, 6);
  assert.notEqual(nextResult.wheelAngle, settled.wheelAngle);
  close(Math.cos(nextResult.ballAngle + nextResult.wheelAngle), Math.cos(roulettePocketAngle(24)));
  close(Math.sin(nextResult.ballAngle + nextResult.wheelAngle), Math.sin(roulettePocketAngle(24)));
});

test("a new simulation object resets old angles even when the spin ID is reused", () => {
  const motion = new RouletteMotion();
  motion.update({}, { id: 1, number: 7, remaining: 0, resolved: true }, 6);
  const freshRun = {};
  assert.deepEqual(motion.update(freshRun, null, 6), idleRoulettePose());
  assert.deepEqual(
    motion.update(freshRun, { id: 1, number: 4, remaining: 6, resolved: false }, 6),
    idleRoulettePose(),
  );
});
