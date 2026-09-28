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
  box("carpet", 10, -0.004, -4.5, 11.5, 0.036, 14.7, carpet);

  // Thin overlays sit against existing collision walls; openings remain untouched.
  for (const x of [4.285, 15.715]) {
    const sign = x < 10 ? 1 : -1;
    for (const [z, depth] of [[-9, 5.65], [0.3, 4.55]]) {
      box("silk wall inset", x, 2.87, z, 0.035, 2.8, depth, oxblood);
      for (const h of [1.47, 4.27]) box("panel border", x + sign * 0.025, h, z, 0.03, 0.028, depth, brass);
      for (const zz of [z - depth / 2 + 0.08, z + depth / 2 - 0.08]) {
        box("walnut pilaster", x + sign * 0.015, 2.83, zz, 0.045, 2.95, 0.12, walnut);
        box("pilaster inlay", x + sign * 0.045, 2.83, zz, 0.012, 2.78, 0.024, brass);
      }
      const zz = z < -3 ? -7.1 : 1.45;
      box("sconce backplate", x + sign * 0.055, 2.76, zz, 0.05, 0.83, 0.29, brass);
      box("sconce shadow recess", x + sign * 0.092, 2.76, zz, 0.045, 0.72, 0.21, walnut);
      for (const dz of [-0.072, 0, 0.072]) {
        box("reeded opal sconce", x + sign * 0.15, 2.76, zz + dz, 0.075, dz === 0 ? 0.61 : 0.47, 0.045, ivory);
      }
    }
    for (const h of [4.36, 4.48]) box("continuous crown", x, h, -4.5, 0.09, 0.038, 14.65, brass);
  }
  for (const [x, width] of [[7, 5.8], [14.7, 2.4]]) {
    box("north silk inset", x, 2.85, 2.755, width, 2.72, 0.04, oxblood);
    for (const y of [1.47, 4.23]) box("north gold border", x, y, 2.72, width, 0.03, 0.025, brass);
  }
  box("coffer", 10, 4.79, -4.5, 11.4, 0.08, 14.6, ceiling);
  for (const z of [-10.7, -4.55, 1.65]) {
    box("ceiling cross rail", 10, 4.7, z, 10.6, 0.11, 0.1, walnut);
    box("ceiling gold fillet", 10, 4.635, z, 10.5, 0.018, 0.024, brass);
  }
  for (const x of [4.72, 15.28]) {
    box("ceiling edge rail", x, 4.7, -4.5, 0.1, 0.11, 12.4, walnut);
    box("ceiling edge inlay", x, 4.635, -4.5, 0.025, 0.018, 12.4, brass);
  }
}
