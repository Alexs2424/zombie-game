import { CASINO_ROOMS } from "./casino-layout";
import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

/** Room finishes; the solid furniture is authored in Blender and has shared collision bounds. */
export function buildLoungeDecor(scene: Scene) {
  const material = (name: string, color: string, glow = 0) => {
    const m = new StandardMaterial(`Last Call ${name}`, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(0.16, 0.1, 0.05);
    m.maxSimultaneousLights = 8;
    if (glow) m.emissiveColor = m.diffuseColor.scale(glow);
    return m;
  };
  const brass = material("brushed champagne brass", "#c1a46a");
  brass.specularColor = new Color3(0.64, 0.47, 0.23);
  brass.specularPower = 64;
  const oxblood = material("oxblood silk panels", "#38212b");
  const walnut = material("espresso panel framing", "#251c1b");
  const ivory = material("opal sconce glass", "#f3d9a2", 0.65);
  const ceiling = material("lounge coffer recess", "#211e24");
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(`Last Call ${name}`, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.receiveShadows = true;
    return mesh;
  };

  // Original woven fan motif. One room-sized texture keeps the border continuous.
  const carpet = material("oxblood fan carpet", "#ffffff");
  carpet.specularColor = Color3.Black();
  const texture = new DynamicTexture("Last Call woven Art Deco carpet", { width: 1024, height: 1280 }, scene, true);
  const c = texture.getContext();
  c.fillStyle = "#351c29";
  c.fillRect(0, 0, 1024, 1280);
  for (let y = -50; y < 1340; y += 80) {
    for (let x = -60; x < 1090; x += 80) {
      const xx = x + (Math.round(y / 80) % 2) * 40;
      c.lineWidth = 1.2;
      c.strokeStyle = "#73533f";
      for (const r of [19, 25, 31]) {
        c.beginPath(); c.arc(xx, y, r, Math.PI, Math.PI * 2); c.stroke();
      }
      c.strokeStyle = "#694639";
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i * Math.PI) / 6;
        c.beginPath(); c.moveTo(xx, y); c.lineTo(xx + Math.cos(a) * 31, y + Math.sin(a) * 31); c.stroke();
      }
    }
  }
  // Restrained fiber variation, deterministic across reloads.
  for (let y = 0; y < 1280; y += 3) {
    c.fillStyle = y % 2 ? "rgba(238,205,159,.026)" : "rgba(0,0,0,.05)";
    c.fillRect(0, y, 1024, 1);
  }
  c.strokeStyle = "#b08a56";
  c.lineWidth = 4;
  c.strokeRect(22, 22, 980, 1236);
  c.lineWidth = 1.5;
  c.strokeRect(34, 34, 956, 1212);
  c.strokeRect(42, 42, 940, 1196);
  texture.update();
  texture.anisotropicFilteringLevel = 8;
  carpet.diffuseTexture = texture;
  const room = CASINO_ROOMS.lounge;
  const cx = (room.minX + room.maxX) / 2, cz = (room.minZ + room.maxZ) / 2;
  const width = room.maxX - room.minX, depth = room.maxZ - room.minZ;
  box("carpet", cx, -0.004, cz, width - 0.5, 0.036, depth - 0.5, carpet);

  // Apply the room finishes to its new enclosure. The two east-side passages
  // stay open; the detailed bar and booths keep their authored proportions.
  for (const [x, sections] of [
    [room.minX + 0.245, [[cz, depth - 0.5]]],
    [room.maxX - 0.245, [[-18, 3.5], [-8, 7.5], [2, 3.5]]],
  ] as [number, number[][]][]) {
    const sign = x < cx ? 1 : -1;
    for (const [z, length] of sections) {
      box("silk wall inset", x, 2.87, z, 0.035, 2.8, length, oxblood);
      for (const h of [1.47, 4.27])
        box("panel border", x + sign * 0.025, h, z, 0.03, 0.028, length, brass);
      for (let zz = z - length / 2 + 0.08; zz <= z + length / 2; zz += 2.3) {
        box("walnut pilaster", x + sign * 0.015, 2.83, zz, 0.045, 2.95, 0.12, walnut);
        box("pilaster inlay", x + sign * 0.045, 2.83, zz, 0.012, 2.78, 0.024, brass);
      }
    }
    for (const zz of [-18.2, -8.8, 2.2]) {
      box("sconce backplate", x + sign * 0.055, 2.76, zz, 0.05, 0.83, 0.29, brass);
      box("sconce shadow recess", x + sign * 0.092, 2.76, zz, 0.045, 0.72, 0.21, walnut);
      for (const dz of [-0.072, 0, 0.072])
        box("reeded opal sconce", x + sign * 0.15, 2.76, zz + dz,
          0.075, dz === 0 ? 0.61 : 0.47, 0.045, ivory);
    }
    for (const h of [4.36, 4.48])
      box("continuous crown", x, h, cz, 0.09, 0.038, depth - 0.5, brass);
  }
  for (const z of [room.minZ + 0.245, room.maxZ - 0.245]) {
    box("end silk inset", cx, 2.85, z, width - 0.5, 2.72, 0.04, oxblood);
    for (const y of [1.47, 4.23]) box("end gold border", cx, y, z, width - 0.5, 0.03, 0.06, brass);
  }
  box("coffer", cx, 4.79, cz, width - 0.5, 0.08, depth - 0.5, ceiling);
  for (let z = room.minZ + 2; z < room.maxZ; z += 5.2) {
    box("ceiling cross rail", cx, 4.7, z, width - 0.9, 0.11, 0.1, walnut);
    box("ceiling gold fillet", cx, 4.635, z, width - 1, 0.018, 0.024, brass);
  }
  for (const x of [room.minX + 0.72, room.maxX - 0.72]) {
    box("ceiling edge rail", x, 4.7, cz, 0.1, 0.11, depth - 1.5, walnut);
    box("ceiling edge inlay", x, 4.635, cz, 0.025, 0.018, depth - 1.5, brass);
  }
}
