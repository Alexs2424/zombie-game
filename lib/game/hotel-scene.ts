import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { HOTEL, HOTEL_RECTS, stairPoint } from "./world";
import { buildHotelProps } from "./hotel-props";
import { loadHotelFurniture } from "./hotel-assets";
import { loadHotelEntry } from "./hotel-entry-assets";
import { buildHotelRenovation } from "./hotel-renovation-scene";
import { createHotelLightMembership } from "./hotel-light-membership";
import { HOTEL_FIXTURES } from "./hotel-fixtures";
import {
  HOTEL_AMMO_CRATE,
  HOTEL_GATE,
  HOTEL_RULES,
  HOTEL_SPAWNS,
} from "./hotel-gameplay";
import type { Simulation } from "./simulation";

type Point = { x: number; z: number };

/** Ear clipping also handles the concave outline of the upper landing. */
function triangulate(outline: readonly Point[]) {
  const area = outline.reduce((sum, a, i) => {
    const b = outline[(i + 1) % outline.length];
    return sum + a.x * b.z - b.x * a.z;
  }, 0);
  const remaining = outline.map((_, index) => index);
  if (area < 0) remaining.reverse();
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const triangles: number[] = [];
  while (remaining.length > 3) {
    let clipped = false;
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[(i + remaining.length - 1) % remaining.length];
      const b = remaining[i];
      const c = remaining[(i + 1) % remaining.length];
      if (cross(outline[a], outline[b], outline[c]) < 1e-8) continue;
      const contains = remaining.some(
        (p) =>
          p !== a &&
          p !== b &&
          p !== c &&
          cross(outline[a], outline[b], outline[p]) >= -1e-8 &&
          cross(outline[b], outline[c], outline[p]) >= -1e-8 &&
          cross(outline[c], outline[a], outline[p]) >= -1e-8,
      );
      if (contains) continue;
      triangles.push(a, b, c); // Upward normals in Babylon's left-handed XZ plane.
      remaining.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped)
      throw new Error("Hotel surface outline cannot be triangulated");
  }
  triangles.push(remaining[0], remaining[1], remaining[2]);
  return triangles;
}

/**
 * Hotel architecture. All walkable outlines and guards come from world.ts;
 * visible stair treads sit over the simulation's smooth curved ramps.
 * Static geometry is merged by material to keep the larger map inexpensive.
 */
export function buildHotel(scene: Scene, onEntryLoaded?: () => void) {
  const batches = new Map<StandardMaterial, Mesh[]>();
  const ownedMeshes: Mesh[] = [];
  const materials: StandardMaterial[] = [];
  const textures: DynamicTexture[] = [];
  const lights: (PointLight | SpotLight)[] = [];
  const material = (name: string, hex: string, glow = 0.045) => {
    const m = new StandardMaterial(`hotel ${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = m.diffuseColor.scale(glow);
    m.specularColor = new Color3(0.09, 0.085, 0.075);
    m.maxSimultaneousLights = 8;
    materials.push(m);
    return m;
  };
  const stone = material("warm limestone", "#c7bfab", 0.025);
  const ivory = material("ivory plaster", "#d6cdbb", 0.025);
  const teal = material("forest green", "#304a3f");
  const tread = material("stair limestone", "#c4bca8", 0.025);
  const brass = material("aged brass", "#aa8c53");
  const dark = material("dark trim", "#233834");
  const ceiling = material("ceiling", "#c1b8a6", 0.025);
  const lamp = material("warm diffuser", "#efd8a0", 0.9);
  const walnut = material("architectural walnut", "#3a2a22", 0.02);
  const crystal = material("chandelier cut glass", "#bdbea4", 0.12);
  crystal.specularColor.set(0.7, 0.64, 0.45);
  crystal.specularPower = 80;
  const carpet = material("restaurant carpet", "#665954", 0.03);
  carpet.specularColor = Color3.Black();
  const carpetTexture = new DynamicTexture(
    "hotel woven restaurant carpet",
    { width: 256, height: 256 },
    scene,
    true,
  );
  const carpetContext = carpetTexture.getContext() as CanvasRenderingContext2D;
  carpetContext.fillStyle = "#676352";
  carpetContext.fillRect(0, 0, 256, 256);
  carpetContext.strokeStyle = "#978865";
  carpetContext.lineWidth = 2;
  for (const inset of [8, 25])
    carpetContext.strokeRect(inset, inset, 256 - inset * 2, 256 - inset * 2);
  carpetContext.fillStyle = "#b09b73";
  for (let x = 42; x < 240; x += 43)
    for (let z = 42; z < 240; z += 43) {
      carpetContext.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
  carpetTexture.update();
  carpetTexture.uScale = 0.5;
  carpetTexture.vScale = 0.5;
  carpetTexture.anisotropicFilteringLevel = 4;
  carpet.diffuseTexture = carpetTexture;
  textures.push(carpetTexture);
  // Marble veining is deterministic and softly colored; the room keeps its
  // pools of warm light instead of becoming a bright white showroom.
  const marble = new DynamicTexture("hotel marble veining", 512, scene, true);
  const marbleCtx = marble.getContext() as CanvasRenderingContext2D;
  marbleCtx.fillStyle = "#c5c2b5";
  marbleCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 24; i++) {
    marbleCtx.strokeStyle = i % 3 ? "#b6b5aa" : "#a7aa9c";
    marbleCtx.lineWidth = i % 3 ? 1.2 : 2.4;
    marbleCtx.beginPath();
    for (let j = 0; j <= 12; j++) {
      const x = (j * 512) / 12,
        y = (i * 37 + Math.sin(j * 0.8 + i) * 34 + x * 0.4) % 512;
      if (j === 0) marbleCtx.moveTo(x, y);
      else marbleCtx.lineTo(x, y);
    }
    marbleCtx.stroke();
  }
  marbleCtx.strokeStyle = "#858b80";
  marbleCtx.lineWidth = 3;
  marbleCtx.strokeRect(0, 0, 512, 512);
  marble.update();
  marble.uScale = 0.33;
  marble.vScale = 0.33;
  marble.anisotropicFilteringLevel = 4;
  stone.diffuseTexture = marble;
  stone.specularColor.set(0.16, 0.14, 0.11);
  textures.push(marble);
  const marbleFloor = new PBRMaterial("hotel polished ivory marble floor", scene);
  marbleFloor.albedoColor = Color3.FromHexString("#d9d2c0");
  marbleFloor.albedoTexture = marble;
  marbleFloor.metallic = 0;
  marbleFloor.roughness = 0.3;
  marbleFloor.environmentIntensity = 0.65;
  marbleFloor.maxSimultaneousLights = 8;
  brass.specularColor = new Color3(0.45, 0.36, 0.2);
  brass.specularPower = 48;

  const batch = (mesh: Mesh, m: StandardMaterial) => {
    mesh.material = m;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    const list = batches.get(m) ?? [];
    list.push(mesh);
    batches.set(m, list);
    return mesh;
  };
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: StandardMaterial,
    yaw = 0,
  ) => {
    const mesh = MeshBuilder.CreateBox(
      `hotel ${name}`,
      { width: w, height: h, depth: d },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    return batch(mesh, m);
  };
  const slab = (
    name: string,
    polygon: readonly Point[],
    bottom: number,
    top: number,
    m: StandardMaterial,
  ) => {
    const vertices: number[] = [];
    const indices: number[] = [];
    // Duplicate face vertices so slab edges remain crisp rather than smoothed.
    const triangle = (
      a: Point,
      ay: number,
      b: Point,
      by: number,
      c: Point,
      cy: number,
    ) => {
      const at = vertices.length / 3;
      vertices.push(a.x, ay, a.z, b.x, by, b.z, c.x, cy, c.z);
      indices.push(at, at + 1, at + 2);
    };
    const triangles = triangulate(polygon);
    for (let i = 0; i < triangles.length; i += 3) {
      const [a, b, c] = triangles
        .slice(i, i + 3)
        .map((index) => polygon[index]);
      triangle(a, top, b, top, c, top);
      triangle(c, bottom, b, bottom, a, bottom);
    }
    const area = polygon.reduce((sum, a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      return sum + a.x * b.z - b.x * a.z;
    }, 0);
    const order = area > 0 ? [...polygon] : [...polygon].reverse();
    for (let i = 0; i < order.length; i++) {
      const a = order[i],
        b = order[(i + 1) % order.length];
      triangle(a, bottom, b, top, a, top);
      triangle(a, bottom, b, bottom, b, top);
    }
    const data = new VertexData();
    data.positions = vertices;
    data.indices = indices;
    const uvs: number[] = [];
    for (let i = 0; i < vertices.length; i += 3)
      uvs.push(vertices[i], vertices[i + 2]);
    data.uvs = uvs;
    const normals: number[] = [];
    VertexData.ComputeNormals(vertices, indices, normals);
    data.normals = normals;
    const mesh = new Mesh(`hotel ${name}`, scene);
    data.applyToMesh(mesh);
    return batch(mesh, m);
  };
  const cylinder = (
    name: string,
    x: number,
    y: number,
    z: number,
    diameter: number,
    h: number,
    m: StandardMaterial,
    top = diameter,
    segments = 16,
  ) => {
    const mesh = MeshBuilder.CreateCylinder(
      `hotel ${name}`,
      {
        diameterBottom: diameter,
        diameterTop: top,
        height: h,
        tessellation: segments,
      },
      scene,
    );
    mesh.position.set(x, y, z);
    return batch(mesh, m);
  };
  const ring = (
    name: string,
    x: number,
    y: number,
    z: number,
    diameter: number,
    thickness: number,
    m: StandardMaterial,
  ) => {
    const mesh = MeshBuilder.CreateTorus(
      `hotel ${name}`,
      { diameter, thickness, tessellation: 48 },
      scene,
    );
    mesh.position.set(x, y, z);
    return batch(mesh, m);
  };
  const strip = (
    name: string,
    a: Point,
    b: Point,
    y: number,
    width: number,
    m: StandardMaterial,
    height = 0.035,
  ) => {
    const dx = b.x - a.x,
      dz = b.z - a.z;
    return box(
      name,
      (a.x + b.x) / 2,
      y,
      (a.z + b.z) / 2,
      Math.hypot(dx, dz),
      height,
      width,
      m,
      -Math.atan2(dz, dx),
    );
  };
  const sign = (
    name: string,
    lines: string[],
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    yaw = 0,
    background = "#233834",
  ) => {
    const texHeight = Math.round((768 * height) / width);
    const texture = new DynamicTexture(
      `hotel ${name}`,
      { width: 768, height: texHeight },
      scene,
      false,
    );
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 768, texHeight);
    ctx.strokeStyle = "#c9b17a";
    ctx.lineWidth = 3;
    ctx.strokeRect(9, 9, 750, texHeight - 18);
    ctx.fillStyle = "#f1e3bb";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
      let size = Math.min(58, (texHeight * 0.65) / lines.length);
      ctx.font = `500 ${size}px Georgia`;
      size *= Math.min(1, 690 / Math.max(1, ctx.measureText(line).width));
      ctx.font = `500 ${size}px Georgia`;
      ctx.fillText(line, 384, (texHeight * (i + 0.5)) / lines.length);
    });
    texture.update();
    const m = material(`sign ${name}`, "#ffffff", 0);
    m.diffuseTexture = texture;
    m.emissiveTexture = texture;
    m.specularColor = Color3.Black();
    const mesh = MeshBuilder.CreatePlane(
      `hotel ${name}`,
      { width, height, sideOrientation: Mesh.FRONTSIDE },
      scene,
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    mesh.material = m;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    ownedMeshes.push(mesh);
    textures.push(texture);
    return mesh;
  };

  const foyer = HOTEL.foyer;
  const foyerPolygon = [
    { x: foyer.minX, z: foyer.minZ },
    { x: foyer.maxX, z: foyer.minZ },
    { x: foyer.maxX, z: foyer.maxZ },
    { x: foyer.minX, z: foyer.maxZ },
  ];
  const lobbyFloor = slab("lobby floor", HOTEL.lobbyPolygon, -0.28, 0, stone);
  batches.get(stone)!.splice(batches.get(stone)!.indexOf(lobbyFloor), 1);
  lobbyFloor.material = marbleFloor;
  lobbyFloor.freezeWorldMatrix();
  ownedMeshes.push(lobbyFloor);
  // Foyer meets the existing casino at y=0: no step or raised threshold.
  slab("entrance floor", foyerPolygon, -0.26, -0.003, stone);
  slab(
    "upper walkway",
    HOTEL.upperPolygon,
    HOTEL.floorY - 0.28,
    HOTEL.floorY,
    stone,
  );
  slab(
    "lobby ceiling",
    HOTEL.lobbyPolygon,
    HOTEL.ceilingY,
    HOTEL.ceilingY + 0.24,
    ceiling,
  );
  // The floor overlap joins walking surfaces; the ceiling starts at the wall
  // so its raw front edge cannot protrude above the entrance cornice.
  slab("foyer ceiling",foyerPolygon.map(point=>({...point,z:Math.max(point.z,HOTEL.entrance.z)})),4.77,4.96,ceiling);

  const upperMinZ = Math.min(...HOTEL.upperPolygon.map((p) => p.z));
  const upperMaxZ = Math.max(...HOTEL.upperPolygon.map((p) => p.z));
  const upperCenterZ = (upperMinZ + upperMaxZ) / 2;
  const lobbyMaxZ = Math.max(...HOTEL.lobbyPolygon.map((p) => p.z));
  const restaurantInset = HOTEL.upperPolygon.map((p) => ({
    x: HOTEL.center.x + (p.x - HOTEL.center.x) * 0.94,
    z: upperCenterZ + (p.z - upperCenterZ) * 0.92,
  }));
  slab(
    "restaurant carpet inset",
    restaurantInset,
    HOTEL.floorY + 0.005,
    HOTEL.floorY + 0.018,
    carpet,
  );
  for (let i = 0; i < restaurantInset.length; i++) {
    strip(
      "restaurant carpet border",
      restaurantInset[i],
      restaurantInset[(i + 1) % restaurantInset.length],
      HOTEL.floorY + 0.023,
      0.045,
      brass,
      0.014,
    );
  }

  for (const rect of HOTEL_RECTS) {
    // These footprints are rendered by buildHotelProps, not as architecture.
    if (
      rect.id.startsWith("hotel-prop-") ||
      rect.id === "hotel-entry-lintel" ||
      rect.id === HOTEL_AMMO_CRATE.id ||
      rect.id.startsWith("hotel-gallery-") || rect.id.startsWith("hotel-salon-column-")
    )
      continue;
    const base = rect.baseY ?? 0;
    const yaw = -(rect.yaw ?? 0);
    if (rect.id.includes("rail")) {
      box(
        `${rect.id} guard`,
        rect.x,
        base + rect.h / 2,
        rect.z,
        rect.w,
        rect.h,
        rect.d,
        teal,
        yaw,
      );
      box(
        `${rect.id} handrail`,
        rect.x,
        base + rect.h - 0.005,
        rect.z,
        rect.w + 0.025,
        0.085,
        rect.d + 0.045,
        brass,
        yaw,
      );
      box(
        `${rect.id} base`,
        rect.x,
        base + 0.07,
        rect.z,
        rect.w + 0.01,
        0.14,
        rect.d + 0.025,
        dark,
        yaw,
      );
      const axis = rect.yaw ?? 0;
      const c = Math.cos(axis),
        s = Math.sin(axis);
      const count = Math.max(1, Math.round(rect.w / 0.65));
      for (let i = 0; i < count; i++) {
        const offset = ((i + 0.5) * rect.w) / count - rect.w / 2;
        const x = rect.x + c * offset,
          z = rect.z + s * offset;
        box(
          "deco rail baluster",
          x,
          base + rect.h / 2,
          z,
          0.045,
          rect.h - 0.09,
          rect.d + 0.04,
          brass,
          yaw,
        );
        box(
          "deco rail collar",
          x,
          base + rect.h * 0.63,
          z,
          0.17,
          0.12,
          rect.d + 0.055,
          brass,
          yaw,
        );
      }
      box(
        "deco rail middle ribbon",
        rect.x,
        base + rect.h * 0.35,
        rect.z,
        rect.w,
        0.027,
        rect.d + 0.025,
        brass,
        yaw,
      );
      continue;
    }
    box(
      rect.id,
      rect.x,
      base + rect.h / 2,
      rect.z,
      rect.w,
      rect.h,
      rect.d,
      ivory,
      yaw,
    );
    if (base > 1 && !rect.id.startsWith("hotel-service-door-")) continue;
    box(
      `${rect.id} lower panel`,
      rect.x,
      base + 0.65,
      rect.z,
      rect.w + 0.02,
      1.3,
      rect.d + 0.035,
      teal,
      yaw,
    );
    box(
      `${rect.id} dado`,
      rect.x,
      base + 1.31,
      rect.z,
      rect.w + 0.035,
      0.055,
      rect.d + 0.065,
      brass,
      yaw,
    );
    box(
      `${rect.id} cornice`,
      rect.x,
      base + rect.h - 0.16,
      rect.z,
      rect.w + 0.08,
      0.16,
      rect.d + 0.09,
      stone,
      yaw,
    );
    if (rect.id.startsWith("hotel-wall-")) {
      box(
        `${rect.id} upper belt`,
        rect.x,
        HOTEL.floorY + 0.16,
        rect.z,
        rect.w + 0.05,
        0.23,
        rect.d + 0.085,
        dark,
        yaw,
      );
      box(
        `${rect.id} upper molding`,
        rect.x,
        HOTEL.floorY + 0.31,
        rect.z,
        rect.w + 0.065,
        0.05,
        rect.d + 0.1,
        brass,
        yaw,
      );
      const c = Math.cos(rect.yaw ?? 0),
        s = Math.sin(rect.yaw ?? 0);
      for (
        let offset = -rect.w / 2 + 1.3;
        offset < rect.w / 2 - 0.9;
        offset += 4
      ) {
        box(
          `${rect.id} upper pilaster`,
          rect.x + c * offset,
          HOTEL.floorY + 2.4,
          rect.z + s * offset,
          0.18,
          3.8,
          rect.d + 0.12,
          stone,
          yaw,
        );
      }
    }
  }

  for (const stairs of HOTEL.stairs) {
    const count = 28;
    for (let i = 0; i < count; i++) {
      const a = i / count,
        b = (i + 1) / count;
      const innerA = stairPoint(stairs, a, stairs.innerRadius);
      const outerA = stairPoint(stairs, a, stairs.outerRadius);
      const innerB = stairPoint(stairs, b, stairs.innerRadius);
      const outerB = stairPoint(stairs, b, stairs.outerRadius);
      const top = stairs.bottomY + (stairs.topY - stairs.bottomY) * b;
      slab(
        `${stairs.id} tread ${i}`,
        [innerA, outerA, outerB, innerB],
        -0.03,
        top,
        tread,
      );
      // Contrast at each real tread edge makes the curved rise easy to read.
      strip(
        `${stairs.id} nosing ${i}`,
        innerA,
        outerA,
        top + 0.007,
        0.034,
        brass,
        0.014,
      );
    }
    const bottom = stairPoint(stairs, 0);
    const top = stairPoint(stairs, 1);
    // Flush floor inlays mark the two routes without adding collision obstacles.
    box(
      `${stairs.id} approach`,
      bottom.x,
      0.008,
      bottom.z - 1.45,
      1.8,
      0.014,
      2.2,
      teal,
    );
    box(
      `${stairs.id} landing inlay`,
      top.x - stairs.side * 0.75,
      HOTEL.floorY + 0.008,
      top.z,
      1.35,
      0.014,
      1.8,
      teal,
    );
    const id = stairs.side < 0 ? "A" : "B";
    // Place wayfinding on the solid riser at the far end of the stair; no
    // freestanding signboards obstruct the bottom landing or its approach.
    sign(
      `stair ${id}`,
      [`STAIR ${id}`, "DINING ROOM"],
      stairs.cx - stairs.side * 0.025,
      1.65,
      stairs.cz + 4,
      1.6,
      0.55,
      (stairs.side * Math.PI) / 2,
    );
  }

  // A single coherent entrance replaces overlapping lintels and wall labels.
  // Keep a simple matching surround only while the original GLB is loading.
  const entryLacquer = material("entry smoky oxblood", "#5B3038");
  const entryFallback: Mesh[] = [];
  for (const [x,y,w,h] of [[HOTEL.entrance.x-2.67,1.535,.54,3.07],
    [HOTEL.entrance.x+2.67,1.535,.54,3.07],[HOTEL.entrance.x,3.865,5.88,1.59]]) {
    const mesh=box("entry marble loading surround",x,y,HOTEL_GATE.z-.13,w,h,.82,stone);
    batches.get(stone)!.splice(batches.get(stone)!.indexOf(mesh),1);
    ownedMeshes.push(mesh);entryFallback.push(mesh);
  }
  entryFallback.push(sign("entry loading title",["GRAND HOTEL"],HOTEL.entrance.x,3.9,
    HOTEL_GATE.z-.56,4.3,.47,0,"#5B3038"));
  box(
    "restaurant sign mounting board",
    HOTEL.center.x,
    HOTEL.floorY + 2.65,
    lobbyMaxZ - 0.2,
    5.25,
    0.74,
    0.22,
    dark,
  );
  sign(
    "upper level",
    ["GRAND DINING ROOM"],
    HOTEL.center.x,
    HOTEL.floorY + 2.65,
    lobbyMaxZ - 0.32,
    5.02,
    0.53,
  );
  box(
    "foyer return sign panel",
    HOTEL.entrance.x,
    3.5,
    15.13,
    3.7,
    0.57,
    0.04,
    teal,
  );
  sign(
    "return to casino",
    ["CASINO"],
    HOTEL.entrance.x,
    3.5,
    15.16,
    3.5,
    0.45,
    Math.PI,
  );

  // A flush central medallion defines the open lobby training space.
  for (const [radius, width, m] of [
    [3.3, 0.055, brass],
    [3.5, 0.12, teal],
  ] as const) {
    const segments = 48;
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments,
        b = ((i + 1) * Math.PI * 2) / segments;
      strip(
        "floor medallion",
        {
          x: HOTEL.center.x + Math.cos(a) * radius,
          z: HOTEL.center.z + Math.sin(a) * radius,
        },
        {
          x: HOTEL.center.x + Math.cos(b) * radius,
          z: HOTEL.center.z + Math.sin(b) * radius,
        },
        0.008,
        width,
        m,
        0.012,
      );
    }
  }

  // Suspended stepped chandeliers and coffered ceilings replace office strips.
  const chandelier = (x: number, z: number, y: number, radius: number) => {
    cylinder(
      "chandelier ceiling rose",
      x,
      HOTEL.ceilingY - 0.05,
      z,
      radius * 0.55,
      0.1,
      brass,
    );
    cylinder(
      "chandelier suspension",
      x,
      (HOTEL.ceilingY + y) / 2,
      z,
      0.035,
      HOTEL.ceilingY - y,
      brass,
    );
    for (const [r, drop] of [
      [radius, 0],
      [radius * 0.68, 0.28],
      [radius * 0.34, 0.52],
    ]) {
      ring("chandelier brass crown", x, y - drop, z, r * 2, 0.06, brass);
      ring(
        "chandelier luminous crown",
        x,
        y - drop - 0.06,
        z,
        r * 2 - 0.1,
        0.06,
        lamp,
      );
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI * 2) / 24;
        cylinder(
          "cut crystal pendant",
          x + Math.cos(a) * r,
          y - drop - 0.22,
          z + Math.sin(a) * r,
          0.07,
          0.34,
          crystal,
          0.035,
          6,
        );
      }
    }
  };
  chandelier(HOTEL.center.x, HOTEL.center.z - 2, 7, 1.8);
  for (const x of [HOTEL.center.x - 7, HOTEL.center.x + 7])
    chandelier(x, upperCenterZ + 0.8, 7.6, 0.82);
  // Fit each coffer to the octagonal ceiling instead of leaving beam ends
  // suspended short of the perimeter. The top embeds slightly in the slab.
  const ceilingSpan = (coordinate: number, fixedAxis: "x" | "z") => {
    const otherAxis = fixedAxis === "x" ? "z" : "x";
    const intersections: number[] = [];
    for (let i = 0; i < HOTEL.lobbyPolygon.length; i++) {
      const a = HOTEL.lobbyPolygon[i];
      const b = HOTEL.lobbyPolygon[(i + 1) % HOTEL.lobbyPolygon.length];
      const delta = b[fixedAxis] - a[fixedAxis];
      if (Math.abs(delta) < 1e-8) continue;
      const t = (coordinate - a[fixedAxis]) / delta;
      if (t >= 0 && t <= 1)
        intersections.push(a[otherAxis] + t * (b[otherAxis] - a[otherAxis]));
    }
    const start = Math.min(...intersections), end = Math.max(...intersections);
    return { center: (start + end) / 2, length: end - start };
  };
  for (const x of [-15, -7, 1, 9]) {
    const span = ceilingSpan(x, "x");
    box(
      "coffer long beam",
      x,
      HOTEL.ceilingY - 0.1,
      span.center,
      0.22,
      0.22,
      span.length,
      walnut,
    );
    box(
      "coffer brass fillet",
      x,
      HOTEL.ceilingY - 0.2175,
      span.center,
      0.05,
      0.015,
      span.length,
      brass,
    );
  }
  for (const z of [22, 30, 38, 46]) {
    const span = ceilingSpan(z, "z");
    box(
      "coffer cross beam",
      span.center,
      HOTEL.ceilingY - 0.1,
      z,
      span.length,
      0.22,
      0.22,
      walnut,
    );
  }
  for (const x of [-12, 4])
    for (const z of [38, 44]) {
      cylinder("lounge ceiling fixture frame", x, 3.53, z, 1.05, 0.16, brass);
      cylinder("lounge opal ceiling fixture", x, 3.43, z, 0.89, 0.08, lamp);
    }

  // Backlit scenic panels give the tall walls scale without adding geometry
  // outside the fixed walkable layout or introducing another shadow map.
  const artTexture = new DynamicTexture(
    "hotel deco skyline",
    { width: 512, height: 768 },
    scene,
    true,
  );
  const art = artTexture.getContext() as CanvasRenderingContext2D;
  art.fillStyle = "#173b37";
  art.fillRect(0, 0, 512, 768);
  art.fillStyle = "#b29355";
  art.beginPath();
  art.arc(256, 255, 125, 0, Math.PI * 2);
  art.fill();
  for (let i = 0; i < 11; i++) {
    const x = 24 + i * 45,
      h = 110 + ((i * 79) % 290);
    art.fillStyle = i % 2 ? "#244b45" : "#102e2b";
    art.fillRect(x, 610 - h, 38, h);
    art.fillStyle = "#b29b67";
    for (let y = 625 - h; y < 600; y += 22) art.fillRect(x + 16, y, 5, 9);
  }
  art.strokeStyle = "#cfb57a";
  art.lineWidth = 6;
  art.strokeRect(18, 18, 476, 732);
  artTexture.update();
  textures.push(artTexture);
  const artMaterial = material("deco wall art", "#ffffff", 0);
  artMaterial.diffuseTexture = artTexture;
  artMaterial.emissiveColor.set(0.05, 0.045, 0.03);
  for (const [x, y, z, yaw] of [
    [-22.84, 2.3, 23.8, -Math.PI / 2],
    [14.84, 2.3, 36.2, Math.PI / 2],
    [-11.5, 6.45, 50.84, 0],
    [0.6, 6.45, 50.84, 0],
  ]) {
    const frame = box("deco art frame", x, y, z, 2.25, 3.05, 0.09, brass, yaw);
    const plane = MeshBuilder.CreatePlane(
      "hotel framed skyline",
      { width: 2.1, height: 2.9 },
      scene,
    );
    plane.position.set(x - Math.sin(yaw) * 0.06, y, z - Math.cos(yaw) * 0.06);
    plane.rotation.y = frame.rotation.y;
    batch(plane, artMaterial);
  }

  for (const [x, city, hour] of [
    [1.6, "LAS VEGAS", 10],
    [3.7, "LONDON", 6],
    [5.8, "MONTE CARLO", 2],
  ] as const) {
    const faceTexture = new DynamicTexture(
      `hotel ${city} clock face`,
      256,
      scene,
      true,
    );
    const ctx = faceTexture.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#dbceac";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#705936";
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(128, 128, 116, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
      ctx.lineTo(128 + Math.sin(a) * 107, 128 - Math.cos(a) * 107);
      ctx.stroke();
    }
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(
      128 + Math.sin((hour * Math.PI) / 6) * 66,
      128 - Math.cos((hour * Math.PI) / 6) * 66,
    );
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(185, 65);
    ctx.stroke();
    faceTexture.update();
    textures.push(faceTexture);
    const m = material(`${city} clock`, "#ffffff", 0);
    m.diffuseTexture = faceTexture;
    const plane = MeshBuilder.CreateDisc(
      `hotel ${city} clock`,
      { radius: 0.46, tessellation: 48 },
      scene,
    );
    plane.position.set(x, 3.05, 15.16);
    plane.rotation.y = Math.PI;
    batch(plane, m);
    sign(`${city} clock label`, [city], x, 2.4, 15.18, 1.55, 0.28, Math.PI);
  }

  for (const spawn of HOTEL_SPAWNS) {
    const door = spawn.door,
      yaw = door.yaw + Math.PI;
    const dx = Math.sin(door.yaw),
      dz = Math.cos(door.yaw);
    // The perimeter wall face is 0.1 m inside its centerline. Give the
    // three-sided frame real depth around the recessed leaf; the old solid
    // backing shared that wall face and disappeared into it at oblique angles.
    const casingWidth = 0.18;
    const casingDepth = 0.12;
    const casingOffset = 0.15;
    for (const side of [-1, 1]) {
      const offset = side * (door.w + casingWidth) / 2;
      box(
        `${spawn.id} service jamb`,
        door.x + Math.cos(yaw) * offset + dx * casingOffset,
        door.y + (door.h + casingWidth) / 2,
        door.z - Math.sin(yaw) * offset + dz * casingOffset,
        casingWidth,
        door.h + casingWidth,
        casingDepth,
        walnut,
        yaw,
      );
    }
    box(
      `${spawn.id} service header`,
      door.x + dx * casingOffset,
      door.y + door.h + casingWidth / 2,
      door.z + dz * casingOffset,
      door.w + casingWidth * 2,
      casingWidth,
      casingDepth,
      walnut,
      yaw,
    );
    box(
      `${spawn.id} door slab`,
      door.x + dx * 0.12,
      door.y + door.h / 2,
      door.z + dz * 0.12,
      door.w,
      door.h,
      0.06,
      dark,
      yaw,
    );
    for (const side of [-1, 1]) {
      const offset = side * door.w * 0.24;
      box(
        `${spawn.id} door inset`,
        door.x + Math.cos(yaw) * offset + dx * 0.16,
        door.y + door.h * 0.55,
        door.z - Math.sin(yaw) * offset + dz * 0.16,
        door.w * 0.4,
        door.h * 0.65,
        0.03,
        teal,
        yaw,
      );
    }
    sign(
      `${spawn.id} portal sign`,
      [door.y > 0 ? "SERVICE • STAFF ONLY" : "HOTEL STAFF"],
      door.x + dx * 0.16,
      door.y + door.h + 0.42,
      door.z + dz * 0.16,
      2.15,
      0.32,
      yaw,
    );
  }

  const gateParts: Mesh[] = [];
  const gateBox = (
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
    d: number,
    m: StandardMaterial,
  ) => {
    const mesh = box(name, x, y, HOTEL_GATE.z, w, h, d, m);
    const list = batches.get(m)!;
    list.splice(list.indexOf(mesh), 1);
    gateParts.push(mesh);
    return mesh;
  };
  gateBox(
    "hotel locked grille base",
    HOTEL_GATE.x,
    0.25,
    HOTEL_GATE.w,
    0.5,
    0.15,
    dark,
  );
  for (
    let x = HOTEL_GATE.x - HOTEL_GATE.w / 2 + 0.08;
    x < HOTEL_GATE.x + HOTEL_GATE.w / 2;
    x += 0.28
  ) {
    gateBox(
      "hotel locked grille bars",
      x,
      HOTEL_GATE.h / 2,
      0.045,
      HOTEL_GATE.h,
      0.075,
      brass,
    );
    gateBox(
      "hotel grille ornament",
      x,
      1.65,
      0.12,
      0.12,
      0.1,
      brass,
    ).rotation.z = Math.PI / 4;
  }
  for (const y of [0.6, 2.25, 2.95])
    gateBox(
      "hotel grille ribbon",
      HOTEL_GATE.x,
      y,
      HOTEL_GATE.w,
      0.075,
      0.1,
      brass,
    );
  gateBox("hotel purchase plaque backing",HOTEL_GATE.x,1.86,3.2,.46,.035,entryLacquer).position.z-=.105;
  const gate = Mesh.MergeMeshes(gateParts, true, true, undefined, false, true)!;
  gate.name = "hotel purchase gate";
  gate.isPickable = false;
  ownedMeshes.push(gate);
  const gatePrice = sign(
    "hotel price",
    [`F · OPEN ${HOTEL_RULES.price.toLocaleString()}`],
    HOTEL_GATE.x,
    1.86,
    HOTEL_GATE.z - 0.126,
    2.95,
    0.32,
    0,
    "#5B3038",
  );

  const bellMaterial = material("service bell status", "#d0a55b", 0.12);
  cylinder("service bell foot", -3.52, 5.1885, 35.18, 0.25, 0.05, brass);
  const bellDome = MeshBuilder.CreateSphere(
    "hotel service bell dome",
    { diameter: 0.22, segments: 16 },
    scene,
  );
  bellDome.position.set(-3.52, 5.2135, 35.18);
  bellDome.scaling.y = 0.82;
  batch(bellDome, bellMaterial);
  cylinder("service bell pushbutton", -3.52, 5.3345, 35.18, 0.042, 0.055, brass);
  const bellSign = sign(
    "last service bell",
    ["RING FOR LAST SERVICE", "SURVIVE 35S • TOMMY GUN"],
    -4,
    4.78,
    34.91,
    1.03,
    0.29,
  );
  const crate = HOTEL_AMMO_CRATE;
  box(
    "Tommy ammunition crate",
    crate.x,
    crate.baseY + 0.245,
    crate.z,
    crate.w,
    0.49,
    crate.d,
    walnut,
  );
  box(
    "Tommy ammunition crate lid",
    crate.x,
    crate.baseY + 0.52,
    crate.z,
    0.78,
    0.06,
    0.58,
    dark,
  );
  for (const x of [crate.x - 0.26, crate.x + 0.26])
    box(
      "Tommy ammunition crate straps",
      x,
      crate.baseY + 0.25,
      crate.z,
      0.047,
      0.49,
      0.575,
      brass,
    );
  sign(
    "Tommy ammunition refill",
    [".45 AUTO", `${HOTEL_RULES.ammoPrice} CHIPS`],
    crate.x,
    crate.baseY + 0.29,
    crate.z - 0.287,
    0.47,
    0.22,
  );
  const jukeStatus = material("jukebox playing indicator", "#e0ac51", 0.12);
  cylinder(
    "jukebox playing indicator",
    12.5,
    1.04,
    25,
    0.07,
    0.03,
    jukeStatus,
  ).rotation.z = Math.PI / 2;

  const contactTexture = new DynamicTexture(
    "hotel soft contact shadows",
    128,
    scene,
    true,
  );
  const contactContext =
    contactTexture.getContext() as CanvasRenderingContext2D;
  const contactGradient = contactContext.createRadialGradient(
    64,
    64,
    9,
    64,
    64,
    64,
  );
  contactGradient.addColorStop(0, "rgba(0,0,0,0.6)");
  contactGradient.addColorStop(0.6, "rgba(0,0,0,0.32)");
  contactGradient.addColorStop(1, "rgba(0,0,0,0)");
  contactContext.fillStyle = contactGradient;
  contactContext.fillRect(0, 0, 128, 128);
  contactTexture.update();
  contactTexture.hasAlpha = true;
  textures.push(contactTexture);
  const contactMaterial = material("furniture contact shade", "#000000", 0);
  contactMaterial.diffuseTexture = contactTexture;
  contactMaterial.useAlphaFromDiffuseTexture = true;
  contactMaterial.disableLighting = true;
  contactMaterial.alpha = 0.62;
  for (const fixture of HOTEL_FIXTURES) {
    const contact = MeshBuilder.CreateGround(
      `hotel ${fixture.kind} soft shadow`,
      { width: fixture.w + 0.4, height: fixture.d + 0.4 },
      scene,
    );
    contact.position.set(fixture.x, (fixture.baseY ?? 0) + 0.027, fixture.z);
    contact.rotation.y = -(fixture.yaw ?? 0);
    batch(contact, contactMaterial);
  }

  for (const [x, y, z, intensity, range] of [
    [HOTEL.center.x, 6.6, HOTEL.center.z - 2, 2.3, 24],
    [HOTEL.center.x, 7.4, upperCenterZ + 0.8, 1.8, 23],
    [HOTEL.center.x, 2.9, upperCenterZ + 1.5, 0.65, 19],
    [HOTEL.entrance.x, 3.5, 14, 0.48, 8],
    [-12, 3.15, 20.4, 0.9, 11],
    [-4, 2.8, 48.5, 0.45, 15],
  ]) {
    const light =
      lights.length < 2
        ? new SpotLight(
            `hotel chandelier pool ${lights.length}`,
            new Vector3(x, y, z),
            new Vector3(0, -1, 0),
            2.7,
            1.3,
            scene,
          )
        : new PointLight(
            `hotel light ${lights.length}`,
            new Vector3(x, y, z),
            scene,
          );
    light.diffuse = new Color3(1, 0.78, 0.49);
    light.intensity = intensity;
    light.range = range;
    light.renderPriority = 2;
    lights.push(light);
  }

  for (const [m, meshes] of batches) {
    // Gate-only materials have no static pieces after their meshes are extracted.
    if (!meshes.length) continue;
    const merged = Mesh.MergeMeshes(
      meshes,
      true,
      true,
      undefined,
      false,
      false,
    );
    if (!merged)
      throw new Error(`Could not merge hotel geometry for ${m.name}`);
    merged.name = `${m.name} architecture`;
    merged.material = m;
    merged.isPickable = false;
    merged.receiveShadows = true;
    merged.freezeWorldMatrix();
    ownedMeshes.push(merged);
  }
  const renovation = buildHotelRenovation(scene);
  let propMeshes = buildHotelProps(scene);
  let furniture: Awaited<ReturnType<typeof loadHotelFurniture>> | undefined;
  let entry: Awaited<ReturnType<typeof loadHotelEntry>> | undefined;
  let disposed = false;
  const lightMembership = createHotelLightMembership(scene, lights);
  const disposeFallback = () => {
    const propMaterials = new Set(
      propMeshes.flatMap((mesh) => (mesh.material ? [mesh.material] : [])),
    );
    propMeshes.forEach((mesh) => mesh.dispose());
    propMaterials.forEach((m) => m.dispose(false, true));
  };
  const refreshLights = () => {
    lightMembership.setStaticMeshes([
      ...ownedMeshes,
      ...renovation.meshes,
      ...propMeshes,
      ...(furniture?.lightMeshes ?? []),
      ...(entry?.meshes ?? []),
    ]);
  };
  refreshLights();
  const furnitureReady = loadHotelFurniture(scene).then((loaded) => {
    if (disposed || scene.isDisposed) {
      loaded.dispose();
      return;
    }
    furniture = loaded;
    if (loaded.handled.size) {
      disposeFallback();
      propMeshes = buildHotelProps(
        scene,
        HOTEL_FIXTURES.filter((fixture) => !loaded.handled.has(fixture.kind)),
      );
    }
    loaded.activate();
    refreshLights();
  });
  const entryReady=loadHotelEntry(scene).then(loaded=>{
    if(disposed || scene.isDisposed){loaded.dispose();return;}
    entry=loaded;entryFallback.forEach(mesh=>mesh.setEnabled(false));gate.setEnabled(false);
    loaded.setOpen(gateWasOpen);onEntryLoaded?.();refreshLights();
  }).catch(error=>{if(!disposed && !scene.isDisposed) console.warn("Hotel entrance model unavailable; keeping its surround.",error);});
  const ready=Promise.all([furnitureReady,entryReady]).then(()=>undefined);
  let bellCaption = "";
  let jukeWasOn = false;
  let gateWasOpen = false;
  const update = (sim: Simulation) => {
    if (disposed) return;
    renovation.update(sim);
    if (gateWasOpen !== sim.hotel) {
      gateWasOpen = sim.hotel;
      gate.setEnabled(!sim.hotel && !entry);
      entry?.setOpen(sim.hotel);
      gatePrice.setEnabled(!sim.hotel);
    }
    const phase = sim.hotelChallenge.phase;
    const lines =
      phase === "active"
        ? [
            "LAST SERVICE",
            `${Math.ceil(sim.hotelChallenge.remaining)}S • ${sim.hotelChallenge.pending + sim.hotelChallengeAlive} REMAIN`,
          ]
        : phase === "complete"
          ? ["TOMMY GUN UNLOCKED", "AMMUNITION → 500 CHIPS"]
          : phase === "failed"
            ? ["SERVICE INTERRUPTED", "RING TO TRY AGAIN"]
            : ["RING FOR LAST SERVICE", "SURVIVE 35S • TOMMY GUN"];
    const caption = lines.join("|");
    if (caption !== bellCaption) {
      bellCaption = caption;
      const texture = (bellSign.material as StandardMaterial)
        .diffuseTexture as DynamicTexture;
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      const size = texture.getSize();
      ctx.fillStyle = "#172b27";
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.strokeStyle = "#b89b5e";
      ctx.lineWidth = 3;
      ctx.strokeRect(7, 7, size.width - 14, size.height - 14);
      ctx.fillStyle = phase === "active" ? "#f3b57b" : "#e9d7aa";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach((line, i) => {
        ctx.font = "500 46px Georgia";
        const scale = Math.min(
          1,
          (size.width - 55) / ctx.measureText(line).width,
        );
        ctx.font = `500 ${46 * scale}px Georgia`;
        ctx.fillText(line, size.width / 2, (size.height * (i + 0.5)) / 2);
      });
      texture.update();
      bellMaterial.emissiveColor.set(
        phase === "active" ? 0.7 : 0.1,
        phase === "complete" ? 0.45 : 0.07,
        0.02,
      );
    }
    if (jukeWasOn !== sim.jukeboxOn) {
      jukeWasOn = sim.jukeboxOn;
      jukeStatus.emissiveColor.set(
        sim.jukeboxOn ? 0.15 : 0.09,
        sim.jukeboxOn ? 0.9 : 0.04,
        sim.jukeboxOn ? 0.46 : 0.01,
      );
    }
    lightMembership.update(sim.time);
  };
  return {
    ready,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      lightMembership.dispose();
      furniture?.dispose();
      entry?.dispose();
      renovation.dispose();
      disposeFallback();
      gate.material?.dispose();
      lights.forEach((light) => light.dispose());
      ownedMeshes.forEach((mesh) => mesh.dispose());
      textures.forEach((texture) => texture.dispose());
      materials.forEach((m) => m.dispose());
      marbleFloor.dispose();
    },
  };
}
