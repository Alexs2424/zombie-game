import { Scene } from "@babylonjs/core/scene";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

/** Small articulated casino characters, with shoulder/hip pivots and modeled clothing. */
export function createCharacter(scene: Scene, id: number, bartender = false) {
  const root = new TransformNode(bartender ? "Marlowe" : `guest-${id}`, scene);
  const owned: StandardMaterial[] = [];
  const mat = (name: string, color: string) => {
    const m = new StandardMaterial(`${id}-${name}`, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor.set(0.07, 0.07, 0.07);
    m.maxSimultaneousLights = 8;
    owned.push(m);
    return m;
  };
  const suit = mat(
    "tailored jacket",
    bartender ? "#562831" : ["#3c4941", "#655748", "#334b57"][id % 3],
  );
  const skin = mat(
    "skin",
    bartender ? "#ba9479" : ["#8c9b7e", "#9ba087", "#84917a"][id % 3],
  );
  const shirt = mat("shirt", bartender ? "#c7bc9f" : "#969886"),
    dark = mat("leather", "#20251f"),
    hair = mat("hair", "#302c27"),
    detail = mat("details", "#bc9b59");
  const eye = mat("eyes", bartender ? "#34362a" : "#be9b59");
  if (!bartender) eye.emissiveColor.set(0.17, 0.09, 0.015);
  const sphere = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: StandardMaterial,
    parent: TransformNode = root,
  ) => {
    const m = MeshBuilder.CreateSphere(
      name,
      { diameter: 1, segments: 12 },
      scene,
    );
    m.position.set(x, y, z);
    m.scaling.set(w, h, d);
    m.material = material;
    m.parent = parent;
    m.receiveShadows = true;
    return m;
  };
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: StandardMaterial,
    parent: TransformNode = root,
  ) => {
    const m = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    m.position.set(x, y, z);
    m.material = material;
    m.parent = parent;
    m.receiveShadows = true;
    return m;
  };
  const capsule = (
    name: string,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    material: StandardMaterial,
    parent: TransformNode = root,
  ) => {
    const m = MeshBuilder.CreateCapsule(
      name,
      {
        radius: r,
        height: h,
        tessellation: 10,
        subdivisions: 2,
        capSubdivisions: 3,
      },
      scene,
    );
    m.position.set(x, y, z);
    m.material = material;
    m.parent = parent;
    m.receiveShadows = true;
    return m;
  };
  const body = MeshBuilder.CreateCylinder(
    "tailored torso",
    { diameterTop: 0.5, diameterBottom: 0.39, height: 0.59, tessellation: 12 },
    scene,
  );
  body.position.y = 1.12;
  body.scaling.z = 0.64;
  body.parent = root;
  body.material = suit;
  body.receiveShadows = true;
  sphere("shoulder", -0.21, 1.36, 0, 0.2, 0.18, 0.29, suit);
  sphere("shoulder", 0.21, 1.36, 0, 0.2, 0.18, 0.29, suit);
  sphere("hips", 0, 0.8, 0, 0.39, 0.22, 0.27, dark);
  capsule("neck", 0, 1.48, 0, 0.072, 0.18, skin);
  sphere("head", 0, 1.68, 0.015, 0.35, 0.43, 0.34, skin);
  sphere("jaw", 0, 1.56, 0.055, 0.28, 0.2, 0.28, skin);
  sphere("nose", 0, 1.665, 0.196, 0.075, 0.12, 0.085, skin);
  for (const side of [-1, 1]) {
    sphere("ear", side * 0.173, 1.67, 0.006, 0.064, 0.12, 0.058, skin);
    sphere("eye socket", side * 0.072, 1.723, 0.165, 0.094, 0.047, 0.036, hair);
    sphere("eye", side * 0.072, 1.72, 0.188, 0.047, 0.025, 0.012, eye);
    const brow = box(
      "brow",
      side * 0.075,
      1.758,
      0.166,
      0.105,
      0.021,
      0.019,
      hair,
    );
    brow.rotation.z = side * 0.14;
    const lapel = box(
      "folded lapel",
      side * 0.104,
      1.31,
      0.163,
      0.075,
      0.235,
      0.028,
      shirt,
    );
    lapel.rotation.z = side * 0.28;
  }
  sphere("hair cap", 0, 1.835, -0.012, 0.36, 0.16, 0.32, hair);
  box("mouth", 0, 1.589, 0.183, 0.105, 0.021, 0.013, hair);
  box("shirt front", 0, 1.16, 0.17, 0.12, 0.42, 0.021, shirt);
  box("tie", 0, 1.23, 0.19, 0.036, 0.24, 0.017, bartender ? dark : suit);
  for (let i = 0; i < 3; i++)
    sphere(
      "vest button",
      0.07,
      1.1 - i * 0.09,
      0.177,
      0.027,
      0.027,
      0.018,
      detail,
    );
  box("belt", 0, 0.855, 0.145, 0.35, 0.04, 0.024, dark);
  box("belt buckle", 0, 0.855, 0.163, 0.07, 0.049, 0.018, detail);
  const legs = [-1, 1].map((side) => {
    const hip = new TransformNode("hip", scene);
    hip.parent = root;
    hip.position.set(side * 0.108, 0.8, 0);
    capsule("trouser thigh", 0, -0.2, 0, 0.086, 0.42, dark, hip);
    capsule("trouser shin", 0, -0.53, 0.008, 0.071, 0.37, dark, hip);
    sphere("shoe", 0, -0.73, 0.066, 0.18, 0.14, 0.31, dark, hip);
    return hip;
  });
  const arms = [-1, 1].map((side) => {
    const shoulder = new TransformNode("shoulder pivot", scene);
    shoulder.parent = root;
    shoulder.position.set(side * 0.286, 1.35, 0);
    capsule(
      "upper sleeve",
      0,
      -0.14,
      0,
      0.077,
      0.32,
      bartender ? shirt : suit,
      shoulder,
    );
    const forearm = new TransformNode("elbow", scene);
    forearm.parent = shoulder;
    forearm.position.y = -0.285;
    forearm.rotation.x = -0.24;
    capsule(
      "lower sleeve",
      0,
      -0.135,
      0,
      0.067,
      0.29,
      bartender ? shirt : suit,
      forearm,
    );
    capsule("cuff", 0, -0.268, 0, 0.069, 0.066, shirt, forearm);
    sphere("hand", 0, -0.337, 0.018, 0.13, 0.16, 0.075, skin, forearm);
    sphere(
      "thumb",
      side * 0.06,
      -0.315,
      0.024,
      0.047,
      0.081,
      0.055,
      skin,
      forearm,
    );
    shoulder.rotation.x = bartender ? -0.8 : -0.7;
    return shoulder;
  });
  if (bartender) {
    box("bow tie", 0, 1.414, 0.15, 0.13, 0.05, 0.035, dark);
    box("moustache", 0, 1.615, 0.197, 0.107, 0.018, 0.016, hair);
    box("name badge", -0.12, 1.245, 0.174, 0.11, 0.048, 0.024, detail);
  } else if (id % 3 === 1) {
    const hat = MeshBuilder.CreateCylinder(
      "casino fedora",
      { diameter: 0.37, height: 0.13, tessellation: 16 },
      scene,
    );
    hat.parent = root;
    hat.position.y = 1.93;
    hat.material = hair;
    const brim = MeshBuilder.CreateCylinder(
      "hat brim",
      { diameter: 0.49, height: 0.025, tessellation: 18 },
      scene,
    );
    brim.parent = root;
    brim.position.y = 1.875;
    brim.scaling.z = 0.85;
    brim.material = dark;
  }
  // Keep shoulder/hip/elbow pivots, but draw each rigid material group once.
  // MergeMeshes bakes world transforms, so restore that parent’s local space.
  const groups = new Map<TransformNode, Map<StandardMaterial, Mesh[]>>();
  for (const mesh of root.getChildMeshes()) {
    if (!(mesh instanceof Mesh) || !(mesh.parent instanceof TransformNode))
      continue;
    const parent = mesh.parent;
    const byMaterial =
      groups.get(parent) ?? new Map<StandardMaterial, Mesh[]>();
    const material = mesh.material as StandardMaterial;
    const meshes = byMaterial.get(material) ?? [];
    meshes.push(mesh);
    byMaterial.set(material, meshes);
    groups.set(parent, byMaterial);
  }
  for (const [parent, byMaterial] of groups)
    for (const meshes of byMaterial.values()) {
      if (meshes.length < 2) continue;
      const inverse = Matrix.Invert(parent.computeWorldMatrix(true));
      const merged = Mesh.MergeMeshes(meshes, true, true);
      if (!merged) continue;
      merged.bakeTransformIntoVertices(inverse);
      merged.parent = parent;
      // Rebuild normals after baking non-uniformly scaled sphere primitives.
      const positions = merged.getVerticesData(VertexBuffer.PositionKind)!;
      const normals = new Float32Array(positions.length);
      VertexData.ComputeNormals(positions, merged.getIndices()!, normals);
      merged.setVerticesData(VertexBuffer.NormalKind, normals);
      merged.receiveShadows = true;
      merged.isPickable = false;
    }
  const shadow = MeshBuilder.CreateDisc(
    "contact shadow",
    { radius: 0.37, tessellation: 18 },
    scene,
  );
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.material = dark;
  return {
    root,
    arms,
    legs,
    shadow,
    material: suit,
    materials: owned,
  };
}
