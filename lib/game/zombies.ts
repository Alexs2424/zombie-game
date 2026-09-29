import { Scene } from "@babylonjs/core/scene.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { LIMBS, zombiePose, type HitRegion } from "./zombie-pose.ts";
import type { Enemy } from "./simulation";

type ZombieMesh = {
  part: string; material: string; positions: number[]; indices: number[];
  normals?: number[]; uvs?: number[]; colors?: number[];
};
type ZombieAsset = {
  colors: Record<string, string>;
  surfaces?: Record<string, string>;
  roughness?: Record<string, number>;
  variants: { name: string; palette?: Record<string, string>; meshes: ZombieMesh[] }[];
};
// Surface maps belong to the scene; per-enemy material disposal keeps them alive.
const surfaceTextures = new WeakMap<Scene, Map<string, Texture>>();
const preparedMeshes = new WeakMap<ZombieMesh, VertexData>();
function surfaceTexture(scene: Scene, surface: string, channel: 'color' | 'normal') {
  let textures = surfaceTextures.get(scene);
  if (!textures) { textures = new Map(); surfaceTextures.set(scene, textures); }
  const key = `${surface}-${channel}`;
  let texture = textures.get(key);
  if (!texture) {
    texture = new Texture(`/textures/zombies/${key}.png`, scene);
    texture.gammaSpace = channel === 'color';
    texture.anisotropicFilteringLevel = 4;
    if (channel === 'normal') texture.level = surface === 'skin' ? .8 : .38;
    textures.set(key, texture);
  }
  return texture;
}
function prepareMesh(data: ZombieMesh) {
  let vd = preparedMeshes.get(data);
  if (!vd) {
    vd = new VertexData(); vd.positions = data.positions; vd.indices = data.indices;
    vd.normals = data.normals ?? [];
    if (!data.normals) VertexData.ComputeNormals(data.positions, data.indices, vd.normals);
    if (data.uvs) vd.uvs = data.uvs;
    if (data.colors) vd.colors = data.colors;
    preparedMeshes.set(data, vd);
  }
  return vd;
}
export async function loadZombieAsset(): Promise<ZombieAsset> {
  const response = await fetch('/models/zombies.json');
  if (!response.ok) throw new Error(`Zombie models: ${response.status}`);
  return response.json();
}

export function createZombie(scene: Scene, id: number, asset: ZombieAsset) {
  const variant = asset.variants[id % 3];
  const root = new TransformNode(`${variant.name}-${id}`, scene);
  const materials = Object.fromEntries(Object.entries(asset.colors).map(([name, hex]) => {
    const m = new StandardMaterial(`zombie-${id}-${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    if (variant.palette?.[name]) m.diffuseColor = Color3.FromHexString(variant.palette[name]);
    else if (name === 'suit') m.diffuseColor = Color3.FromHexString(['#364e49', '#593e49', '#3b425a'][id % 3]);
    else if (name === 'skin') m.diffuseColor = Color3.FromHexString(['#849574', '#a0a082', '#819393'][id % 3]);
    m.specularColor.set(name === 'blood' ? .22 : .045, .025, .025);
    const roughness = asset.roughness?.[name] ?? .85;
    m.specularPower = 8 + 120 * (1 - roughness) ** 2;
    const surface = asset.surfaces?.[name];
    if (surface) {
      m.diffuseTexture = surfaceTexture(scene, surface, 'color');
      m.bumpTexture = surfaceTexture(scene, surface, 'normal');
    }
    m.maxSimultaneousLights = 8;
    if (name === 'eye') m.emissiveColor.set(.65,.38,.08);
    return [name,m];
  }));
  const pivots: Record<string, TransformNode> = { body: root };
  const pivot = (name: string, position: number[], parent = root) => {
    const node = new TransformNode(name, scene);
    node.parent = parent; node.position.set(position[0], position[1], position[2]);
    pivots[name] = node; return node;
  };
  const head = pivot('head',[0,1.48,0]);
  const jaw = pivot('jaw',[0,.13,.035],head);
  for (let i=0;i<2;i++) {
    const side = i ? 1 : -1;
    const arm = pivot(LIMBS[i],[side*.3,1.36,0]);
    pivot(i ? 'rightForearm' : 'leftForearm',[0,-.28,0],arm);
    pivot(LIMBS[i+2],[side*.11,.8,0]);
  }
  const wounds: { mesh: Mesh; region: HitRegion; stump: boolean }[] = [];
  for (const data of variant.meshes) {
    const mesh = new Mesh(data.part, scene);
    prepareMesh(data).applyToMesh(mesh); mesh.material=materials[data.material];
    mesh.useVertexColors = !!data.colors;
    mesh.isPickable=false; mesh.receiveShadows=true;
    if (data.part.startsWith('wound_') || data.part.startsWith('stump_')) {
      const stump = data.part.startsWith('stump_');
      const region = data.part.slice(6) as HitRegion;
      mesh.parent = stump ? root : pivots[region];
      mesh.setEnabled(false); wounds.push({mesh,region,stump});
    } else mesh.parent=pivots[data.part];
  }
  const shadow=MeshBuilder.CreateDisc('contact shadow',{radius:.37,tessellation:18},scene);
  shadow.rotation.x=Math.PI/2;shadow.material=materials.dark;shadow.isPickable=false;
  return {root,pivots,head,jaw,wounds,shadow,materials:Object.values(materials),skin:materials.skin};
}
export function animateZombie(v: ReturnType<typeof createZombie>, e: Enemy) {
  const pose=zombiePose(e);
  v.root.position.set(e.x,(e.y ?? 0)+pose.drop,e.z);v.root.rotation.set(0,e.yaw,0);
  v.shadow.scaling.setAll(1);
  v.shadow.visibility = 1;
  for (const material of v.materials) {
    material.alpha = 1;
    if (material.name.endsWith('-eye')) material.emissiveColor.set(.65,.38,.08);
  }
  v.shadow.rotation.z = 0;
  for (let i=0;i<2;i++) {
    const arm=v.pivots[LIMBS[i]], leg=v.pivots[LIMBS[i+2]];
    arm.setEnabled(!e.missing?.[LIMBS[i]]);leg.setEnabled(!e.missing?.[LIMBS[i+2]]);
    arm.rotation.set(...pose.arms[i] as [number,number,number]);
    v.pivots[i ? 'rightForearm' : 'leftForearm'].rotation.x=pose.elbows[i];
    leg.rotation.x=pose.legs[i];
  }
  for (const wound of v.wounds) {
    const missing = wound.region !== 'head' && wound.region !== 'body' && !!e.missing?.[wound.region];
    wound.mesh.setEnabled(wound.stump ? missing : !missing && !!e.wounds?.[wound.region]);
    if (!wound.stump) {
      const spread = Math.min(1.8,1+(e.wounds?.[wound.region] ?? 0)*.12);
      wound.mesh.scaling.set(spread,1,1);
    }
  }
  // Snarl, crooked grin, and slack-jawed gasp; open wider during the strike.
  v.jaw.rotation.x = -.08 - (e.id%3)*.09 - (pose.attacking ? .3 : Math.sin(e.age*2.5)*.035);
  v.head.rotation.z = Math.sin(e.age*1.6+e.id)*.045 + (e.id%3-1)*.04;
  v.head.rotation.x = e.flash > 0 ? -.16 : pose.attacking ? .09 : 0;
  v.skin.emissiveColor.set(e.flash>0?.16:0,0,0);
  v.shadow.position.set(e.x,(e.y ?? 0)+.025,e.z);
}

/** Collapse over the existing Blender limb pivots, then fade the resting body. */
export function animateZombieDeath(v: ReturnType<typeof createZombie>, e: Enemy, age: number) {
  animateZombie(v, e);
  const t = Math.min(1, age / .95);
  const fall = t * t * (3 - 2 * t);
  const direction = e.id % 2 ? 1 : -1;
  const buckle = Math.sin(t * Math.PI) * .22;
  v.root.position.y = v.root.position.y*(1-fall) + ((e.y ?? 0)+.24)*fall - buckle;
  v.root.rotation.x = direction * Math.PI / 2 * fall;
  v.root.rotation.y += (e.id % 3 - 1) * .18 * fall;
  const settleAge = Math.max(0, age-.95);
  if (age > .95) v.root.position.y += Math.abs(Math.sin(settleAge*18))*Math.exp(-settleAge*12)*.025;
  for (let i=0;i<2;i++) {
    const arm = v.pivots[LIMBS[i]], leg = v.pivots[LIMBS[i+2]];
    arm.rotation.x *= 1-fall;
    arm.rotation.z = arm.rotation.z*(1-fall)+(i ? .25 : -.25)*fall;
    v.pivots[i ? 'rightForearm' : 'leftForearm'].rotation.x *= 1-fall;
    leg.rotation.x = leg.rotation.x*(1-fall) + direction*.12*fall;
  }
  v.head.rotation.x = direction*.12*fall;
  v.jaw.rotation.x = -.2;
  // Use the revamped model's visible bounds, including hands and shoes. A
  // fixed torso height clips larger variants and bodies with missing limbs.
  let lowest = Infinity;
  v.root.computeWorldMatrix(true);
  for (const mesh of v.root.getChildMeshes()) {
    if (!mesh.isEnabled()) continue;
    mesh.computeWorldMatrix(true);
    lowest = Math.min(lowest, mesh.getBoundingInfo().boundingBox.minimumWorld.y);
  }
  const floor = (e.y ?? 0) + .015;
  if (Number.isFinite(lowest)) v.root.position.y += Math.max(0, floor-lowest);
  const alpha = Math.max(0, 1-Math.max(0,age-4.5)/1.5);
  for (const material of v.materials) {
    material.alpha = alpha;
    material.emissiveColor.set(0,0,0);
  }
  v.shadow.scaling.set(1,1+fall*1.8,1);
  v.shadow.visibility = .2 * alpha;
  v.shadow.rotation.z = -e.yaw;
  v.shadow.position.z = e.z + Math.cos(e.yaw)*direction*.65*fall;
  v.shadow.position.x = e.x + Math.sin(e.yaw)*direction*.65*fall;
}
