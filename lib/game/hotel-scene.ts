import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { HOTEL, HOTEL_RECTS, stairPoint } from "./world";

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
 * Milestone-one architecture only. All walkable outlines and guards come from
 * world.ts; visible stair treads sit over the simulation's smooth curved ramps.
 * Static geometry is merged by material to keep the larger map inexpensive.
 */
export function buildHotel(scene: Scene) {
  const batches = new Map<StandardMaterial, Mesh[]>();
  const ownedMeshes: Mesh[] = [];
  const materials: StandardMaterial[] = [];
  const textures: DynamicTexture[] = [];
  const lights: PointLight[] = [];
  const material = (name: string, hex: string, glow = 0.045) => {
    const m = new StandardMaterial(`hotel ${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = m.diffuseColor.scale(glow);
    m.specularColor = new Color3(0.09, 0.085, 0.075);
    m.maxSimultaneousLights = 8;
    materials.push(m);
    return m;
  };
  const stone = material("warm limestone", "#b9b0a0");
  const ivory = material("ivory plaster", "#cdc5b4");
  const teal = material("deep teal", "#315a54");
  const tread = material("stair limestone", "#bdb59f");
  const brass = material("aged brass", "#aa8c53");
  const dark = material("dark trim", "#233834");
  const ceiling = material("ceiling", "#858b80");
  const lamp = material("warm diffuser", "#efd8a0", 0.9);
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
  ) => {
    const texHeight = Math.round((768 * height) / width);
    const texture = new DynamicTexture(
      `hotel ${name}`,
      { width: 768, height: texHeight },
      scene,
      false,
    );
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#233834";
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
  };

  const foyer = HOTEL.foyer;
  const foyerPolygon = [
    { x: foyer.minX, z: foyer.minZ },
    { x: foyer.maxX, z: foyer.minZ },
    { x: foyer.maxX, z: foyer.maxZ },
    { x: foyer.minX, z: foyer.maxZ },
  ];
  slab("lobby floor", HOTEL.lobbyPolygon, -0.28, 0, stone);
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
  slab("foyer ceiling", foyerPolygon, 4.77, 4.96, ceiling);

  for (const rect of HOTEL_RECTS) {
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
    if (base > 1) continue;
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
      [`STAIR ${id}`, "UPPER WALKWAY"],
      stairs.cx - stairs.side * 0.025,
      1.65,
      stairs.cz + 4,
      1.6,
      0.55,
      (stairs.side * Math.PI) / 2,
    );
  }

  // Entrance lintel and low wayfinding face south into the existing casino.
  box(
    "entry lintel teal panel",
    HOTEL.entrance.x,
    3.5,
    11.95,
    4.6,
    0.64,
    0.06,
    teal,
  );
  sign(
    "entry overhead",
    ["THE GRAND HOTEL"],
    HOTEL.entrance.x,
    3.5,
    11.91,
    4.3,
    0.47,
  );
  sign(
    "entry eye level",
    ["HOTEL LOBBY", "STAIRS / UPPER WALKWAY"],
    -6.85,
    1.95,
    11.93,
    1.85,
    0.72,
  );
  sign(
    "upper level",
    ["UPPER WALKWAY", "CASINO VIA EITHER STAIR"],
    -4,
    5.65,
    40.64,
    4.8,
    0.85,
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

  // A flush central medallion gives the atrium an anchor without changing its
  // walkable space. Furniture and a restaurant remain milestone two work.
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

  // Broad light ribbons communicate the two-floor height without requiring
  // detailed fixtures or another set of real-time shadow maps.
  for (const x of [-10, 2]) {
    box(
      "ceiling light housing",
      x,
      HOTEL.ceilingY - 0.16,
      27.5,
      0.55,
      0.2,
      10.5,
      dark,
    );
    box(
      "ceiling light",
      x,
      HOTEL.ceilingY - 0.275,
      27.5,
      0.38,
      0.035,
      10.2,
      lamp,
    );
  }
  box(
    "upper ceiling light housing",
    -4,
    HOTEL.ceilingY - 0.16,
    36,
    10.5,
    0.2,
    0.55,
    dark,
  );
  box(
    "upper ceiling light",
    -4,
    HOTEL.ceilingY - 0.275,
    36,
    10.2,
    0.035,
    0.38,
    lamp,
  );
  for (const [x, y, z, intensity, range] of [
    [-4, 6.8, 24, 1.25, 21],
    [-4, 7.3, 36, 0.9, 18],
    [-3, 3.5, 14, 0.65, 8],
  ]) {
    const light = new PointLight(
      `hotel light ${lights.length}`,
      new Vector3(x, y, z),
      scene,
    );
    light.diffuse = new Color3(1, 0.87, 0.65);
    light.intensity = intensity;
    light.range = range;
    light.renderPriority = 2;
    lights.push(light);
  }

  for (const [m, meshes] of batches) {
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
  // Hotel lights illuminate only this static wing, leaving existing casino
  // lighting and its moving muzzle light selection unchanged.
  for (const light of lights) light.includedOnlyMeshes = ownedMeshes;

  return () => {
    lights.forEach((light) => light.dispose());
    ownedMeshes.forEach((mesh) => mesh.dispose());
    textures.forEach((texture) => texture.dispose());
    materials.forEach((m) => m.dispose());
  };
}
