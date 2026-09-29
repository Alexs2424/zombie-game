import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";

/** All trim and canvas move together when the portrait exposes the keypad. */
export function createCashierPortrait(scene: Scene) {
  const root = new TransformNode("sliding portrait", scene);
  const material = (name: string, color: string) => {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.specularColor.set(.18, .14, .08);
    mat.maxSimultaneousLights = 8;
    return mat;
  };
  const walnut = material("portrait ebony walnut", "#261b15");
  const bronze = material("portrait antique bronze", "#8e6531");
  const gold = material("portrait raised gilding", "#c6a05c");
  const linen = material("portrait linen slip", "#9f967e");
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.parent = root;
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
  };
  box("portrait solid backing", 0, 0, 0, 1.94, 2.74, .10, walnut);
  // Four concentric moldings surround a true 2:3 canvas without covering it.
  for (const [w, h, rail, z, mat] of [
    [1.94, 2.74, .065, .064, bronze],
    [1.82, 2.62, .026, .094, gold],
    [1.76, 2.56, .050, .077, walnut],
    [1.66, 2.46, .025, .091, linen],
  ] as const) {
    for (const side of [-1, 1]) {
      box("portrait vertical molding", side * (w - rail) / 2, 0, z, rail, h, .045, mat);
      box("portrait horizontal molding", 0, side * (h - rail) / 2, z, w - rail * 2, rail, .045, mat);
    }
  }
  for (const x of [-.90, .90]) for (const y of [-1.30, 1.30]) {
    box("portrait corner inlay", x, y, .10, .11, .025, .014, gold);
    box("portrait corner inlay", x, y, .10, .025, .11, .014, gold);
  }
  const paint = material("cashier proprietor oil painting", "#ffffff");
  const texture = new Texture("/textures/art/cashier-proprietor.png", scene);
  texture.anisotropicFilteringLevel = 8;
  paint.diffuseTexture = texture;
  paint.emissiveTexture = texture;
  paint.emissiveColor.set(.16, .16, .16);
  paint.specularColor.set(.025, .025, .025);
  const canvas = MeshBuilder.CreatePlane("cashier painted canvas", { width: 1.6, height: 2.4 }, scene);
  canvas.parent = root;
  canvas.position.z = .092;
  canvas.rotation.y = Math.PI;
  canvas.material = paint;
  canvas.isPickable = false;
  return root;
}
