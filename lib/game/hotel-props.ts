import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HOTEL_FIXTURES, type HotelFixture } from "./hotel-fixtures";

/** Furniture shares its placements with world collision. No extra light or animation loops. */
export function buildHotelProps(
  scene: Scene,
  fixtures: readonly HotelFixture[] = HOTEL_FIXTURES,
): Mesh[] {
  if (!fixtures.length) return [];
  const ownedMaterials: StandardMaterial[] = [];
  const batches = new Map<StandardMaterial, Mesh[]>();
  const signs: Mesh[] = [];
  const roots: TransformNode[] = [];
  const labels = new Map<string, StandardMaterial>();
  const mat = (name: string, color: string, glow = 0) => {
    const m = new StandardMaterial(`hotel furniture ${name}`, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.emissiveColor = m.diffuseColor.scale(glow);
    m.specularColor.set(0.12, 0.1, 0.08);
    m.maxSimultaneousLights = 8;
    ownedMaterials.push(m);
    return m;
  };
  const walnut = mat("walnut", "#392920");
  const dark = mat("black lacquer", "#162525");
  const brass = mat("brushed brass", "#b79657");
  brass.specularColor.set(0.5, 0.4, 0.23);
  brass.specularPower = 48;
  const velvet = mat("emerald velvet", "#285d50");
  const burgundy = mat("wine upholstery", "#62303d");
  const cream = mat("linen", "#c3b492");
  const ceramic = mat("porcelain", "#c9d2c4");
  const leather = mat("suitcase leather", "#865e35");
  const foliage = mat("palm leaves", "#355c3b");
  const warm = mat("jukebox amber glass", "#edba61", 0.55);
  const mint = mat("jukebox mint glass", "#7bc3a0", 0.24);
  let root: TransformNode;
  const add = (mesh: Mesh, m: StandardMaterial) => {
    mesh.material = m;
    mesh.parent = root;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    const group = batches.get(m) ?? [];
    group.push(mesh);
    batches.set(m, group);
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
  ) => {
    const b = add(
      MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene),
      m,
    );
    b.position.set(x, y, z);
    return b;
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
  ) => {
    const b = add(
      MeshBuilder.CreateCylinder(
        name,
        {
          diameterBottom: diameter,
          diameterTop: top,
          height: h,
          tessellation: 16,
        },
        scene,
      ),
      m,
    );
    b.position.set(x, y, z);
    return b;
  };
  const oval = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: StandardMaterial,
  ) => {
    const b = add(
      MeshBuilder.CreateSphere(name, { diameter: 1, segments: 8 }, scene),
      m,
    );
    b.position.set(x, y, z);
    b.scaling.set(w, h, d);
    return b;
  };
  const tube = (
    name: string,
    path: Vector3[],
    radius: number,
    m: StandardMaterial,
  ) =>
    add(
      MeshBuilder.CreateTube(
        name,
        { path, radius, tessellation: 8, cap: Mesh.CAP_ALL },
        scene,
      ),
      m,
    );
  const text = (
    title: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    yaw = 0,
  ) => {
    const key = `${title}/${w}/${h}`;
    let material = labels.get(key);
    if (!material) {
      const texture = new DynamicTexture(
        title,
        { width: 768, height: Math.max(128, Math.round((768 * h) / w)) },
        scene,
        false,
      );
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      const th = texture.getSize().height;
      ctx.fillStyle = "#172b28";
      ctx.fillRect(0, 0, 768, th);
      ctx.strokeStyle = "#bfa56b";
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, 748, th - 20);
      ctx.fillStyle = "#e9d5a1";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let size = Math.min(74, th * 0.5);
      ctx.font = `500 ${size}px Georgia`;
      size *= Math.min(1, 710 / ctx.measureText(title).width);
      ctx.font = `500 ${size}px Georgia`;
      ctx.fillText(title, 384, th / 2);
      texture.update();
      material = mat(title, "#ffffff");
      material.diffuseTexture = texture;
      material.emissiveTexture = texture;
      material.specularColor = Color3.Black();
      labels.set(key, material);
    }
    const plane = MeshBuilder.CreatePlane(
      title,
      { width: w, height: h },
      scene,
    );
    plane.parent = root;
    plane.position.set(x, y, z);
    plane.rotation.y = yaw;
    plane.material = material;
    plane.isPickable = false;
    signs.push(plane);
  };
  const lamp = (x: number, y: number, z: number, scale = 1) => {
    cylinder(
      "lamp foot",
      x,
      y + 0.025 * scale,
      z,
      0.28 * scale,
      0.05 * scale,
      brass,
    );
    cylinder(
      "lamp stem",
      x,
      y + 0.22 * scale,
      z,
      0.035 * scale,
      0.39 * scale,
      brass,
    );
    cylinder(
      "pleated lampshade",
      x,
      y + 0.42 * scale,
      z,
      0.42 * scale,
      0.25 * scale,
      cream,
      0.28 * scale,
    );
    cylinder(
      "shade piping",
      x,
      y + 0.3 * scale,
      z,
      0.43 * scale,
      0.02 * scale,
      brass,
    );
    cylinder(
      "lamp finial",
      x,
      y + 0.56 * scale,
      z,
      0.055 * scale,
      0.04 * scale,
      brass,
    );
  };
  const sofa = (width: number, m: StandardMaterial) => {
    box("sofa plinth", 0, 0.22, 0, width - 0.1, 0.24, 1.18, walnut);
    box("sofa brass foot rail", 0, 0.12, 0, width - 0.08, 0.04, 1.2, brass);
    box("padded sofa back", 0, 0.82, 0.46, width - 0.18, 0.56, 0.26, m);
    const count = width > 2 ? 3 : 1;
    const cushionWidth = (width - 0.46) / count;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * cushionWidth;
      oval(
        "soft seat cushion",
        x,
        0.48,
        -0.03,
        cushionWidth - 0.025,
        0.25,
        1.02,
        m,
      );
      oval("back cushion", x, 0.84, 0.29, cushionWidth - 0.05, 0.46, 0.2, m);
      for (const dx of [-0.18, 0.18])
        oval("tuft button", x + dx, 0.85, 0.178, 0.034, 0.034, 0.015, brass);
    }
    for (const side of [-1, 1]) {
      box("sofa arm", side * (width / 2 - 0.13), 0.61, 0, 0.25, 0.43, 1.17, m);
      box(
        "arm cap",
        side * (width / 2 - 0.13),
        0.83,
        0,
        0.26,
        0.04,
        1.18,
        walnut,
      );
    }
  };
  const chair = (x: number, z: number, yaw: number) => {
    const rotate = (lx: number, lz: number) => ({
      x: x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
      z: z - lx * Math.sin(yaw) + lz * Math.cos(yaw),
    });
    const part = (
      name: string,
      lx: number,
      y: number,
      lz: number,
      w: number,
      h: number,
      d: number,
      m: StandardMaterial,
    ) => {
      const p = rotate(lx, lz);
      const b = box(name, p.x, y, p.z, w, h, d, m);
      b.rotation.y = yaw;
    };
    part("dining chair seat", 0, 0.51, 0, 0.62, 0.13, 0.6, burgundy);
    part("dining chair back", 0, 0.94, 0.27, 0.64, 0.65, 0.1, walnut);
    part("upholstered chair back", 0, 0.95, 0.208, 0.49, 0.43, 0.065, burgundy);
    for (const dx of [-0.24, 0.24])
      for (const dz of [-0.23, 0.23])
        part("chair leg", dx, 0.25, dz, 0.045, 0.48, 0.045, walnut);
  };
  const setting = (x: number, z: number) => {
    cylinder("dinner plate brass rim", x, 1.038, z, 0.3, 0.016, brass);
    cylinder("porcelain dinner plate", x, 1.049, z, 0.265, 0.018, ceramic);
    box("folded napkin", x, 1.065, z, 0.13, 0.017, 0.18, cream).rotation.y =
      0.18;
    box("fork handle", x - 0.2, 1.042, z, 0.022, 0.013, 0.19, brass);
    for (let j = 0; j < 3; j++)
      box(
        "fork tine",
        x - 0.208 + j * 0.008,
        1.042,
        z - 0.12,
        0.003,
        0.013,
        0.07,
        brass,
      );
    box("dinner knife", x + 0.2, 1.042, z, 0.025, 0.013, 0.26, brass);
    cylinder("goblet foot", x + 0.27, 1.046, z + 0.19, 0.1, 0.016, brass);
    cylinder("goblet stem", x + 0.27, 1.13, z + 0.19, 0.018, 0.16, brass);
    cylinder("goblet cup", x + 0.27, 1.245, z + 0.19, 0.035, 0.1, ceramic, 0.1);
  };
  for (const f of fixtures) {
    root = new TransformNode(f.id, scene);
    root.position.set(f.x, f.baseY ?? 0, f.z);
    root.rotation.y = -(f.yaw ?? 0);
    roots.push(root);
    if (f.kind === "reception") {
      const inner = f.w - f.d;
      box("reception body", 0, 0.55, 0, inner, 1.0, f.d - 0.1, walnut);
      box("reception marble top", 0, 1.09, 0, inner, 0.12, f.d, dark);
      for (const side of [-1, 1]) {
        cylinder(
          "round desk end",
          (side * inner) / 2,
          0.55,
          0,
          f.d - 0.1,
          1.0,
          walnut,
        );
        cylinder(
          "round stone desk cap",
          (side * inner) / 2,
          1.09,
          0,
          f.d,
          0.12,
          dark,
        );
      }
      for (let x = -2.2; x <= 2.2; x += 0.2)
        box("desk front fluting", x, 0.58, -1.01, 0.025, 0.79, 0.025, brass);
      text("RECEPTION", 0, 0.68, -1.055, 2.25, 0.31);
      lamp(-1.9, 1.15, 0, 0.82);
      cylinder("service bell base", 1.6, 1.175, -0.5, 0.2, 0.05, dark);
      oval("service bell dome", 1.6, 1.23, -0.5, 0.15, 0.12, 0.15, brass);
      cylinder("bell button", 1.6, 1.3, -0.5, 0.025, 0.04, brass);
      box("guest register", 0.2, 1.178, 0, 0.65, 0.04, 0.45, leather);
      box("register pages", 0.2, 1.205, 0, 0.6, 0.014, 0.4, cream);
      box("desk telephone base", 2.2, 1.22, 0.3, 0.4, 0.13, 0.28, dark);
      box("telephone receiver", 2.2, 1.34, 0.3, 0.49, 0.07, 0.12, dark);
    } else if (f.kind === "reception-backdrop") {
      box("key cabinet backdrop", 0, f.h / 2, 0, f.w, f.h, f.d, walnut);
      for (const x of [-2.5, 2.5]) {
        box("key wall inset", x, 1.95, -f.d / 2 - 0.015, 2.7, 1.9, 0.025, dark);
        for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++)
          box("ivory key tag", x - 1.12 + i * 0.32, 1.24 + j * 0.4, -f.d / 2 - 0.04, 0.09, 0.15, 0.018, cream);
      }
      text("GRAND HOTEL", 0, 2.85, -f.d / 2 - 0.04, 2.2, 0.34);
      text("CONCIERGE", 0, 2.42, -f.d / 2 - 0.04, 1.8, 0.25);
    } else if (f.kind === "guest-suitcase") {
      box("guest suitcase stand", 0, 0.23, 0, f.w, 0.46, f.d, walnut);
      box("Varga leather case", 0, 0.68, 0, f.w - 0.08, 0.4, f.d - 0.1, leather);
      for (const x of [-0.4, 0.4]) box("suitcase straps", x, 0.68, 0, 0.06, 0.42, f.d - 0.07, dark);
      text("E. VARGA · 214", 0, 0.69, -f.d / 2, 0.68, 0.14);
    } else if (f.kind === "luggage-shelf") {
      for (const x of [-f.w / 2 + 0.035, f.w / 2 - 0.035]) box("luggage shelf upright", x, f.h / 2, 0, 0.07, f.h, f.d, walnut);
      for (const y of [0.06, 0.85, 1.64, 2.43]) box("luggage shelf", 0, y, 0, f.w, 0.08, f.d, walnut);
      for (const y of [0.43, 1.22, 2.01]) for (const x of [-1.2, 0, 1.2]) box("stored guest case", x, y, 0, 1.03, 0.62, 0.55, leather);
    } else if (f.kind === "porter-cabinet") {
      box("porter walnut cabinet", 0, 0.54, 0, f.w, 1.08, f.d, walnut);
      box("porter marble top", 0, 1.12, 0, f.w, 0.06, f.d, dark);
    } else if (f.kind === "jukebox") {
      const outline: [number, number][] = [
        [-0.73, 0.05],
        [0.73, 0.05],
      ];
      for (let i = 0; i <= 24; i++) {
        const angle = (i / 24) * Math.PI;
        outline.push([Math.cos(angle) * 0.73, 1.57 + Math.sin(angle) * 0.73]);
      }
      const positions: number[] = [],
        indices: number[] = [];
      for (const z of [-0.37, 0.37])
        for (const [x, y] of outline) positions.push(x, y, z);
      const n = outline.length;
      for (let i = 1; i < n - 1; i++)
        indices.push(0, i + 1, i, n, n + i, n + i + 1);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        indices.push(i, j, n + j, i, n + j, n + i);
      }
      // Babylon uses clockwise front faces. Keep the cabinet opaque from outside.
      for (let i = 0; i < indices.length; i += 3)
        [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      const v = new VertexData();
      v.positions = positions;
      v.indices = indices;
      v.normals = [];
      // Match the primitives' vertex attributes so the material batch can merge.
      v.uvs = positions.flatMap((value, i) =>
        i % 3 === 0 ? [(value + 0.73) / 1.46, positions[i + 1] / 2.3] : [],
      );
      VertexData.ComputeNormals(positions, indices, v.normals);
      const cabinet = new Mesh("arched jukebox walnut cabinet", scene);
      v.applyToMesh(cabinet);
      add(cabinet, walnut);
      const arch = (radius: number, z: number) => {
        const path = [
          new Vector3(radius, 0.2, z),
          new Vector3(radius, 1.57, z),
        ];
        for (let i = 1; i <= 24; i++) {
          const a = (i / 24) * Math.PI;
          path.push(
            new Vector3(radius * Math.cos(a), 1.57 + radius * Math.sin(a), z),
          );
        }
        path.push(new Vector3(-radius, 0.2, z));
        return path;
      };
      tube("jukebox brass arch", arch(0.68, -0.39), 0.046, brass);
      tube("jukebox amber arch", arch(0.59, -0.4), 0.055, warm);
      tube("jukebox mint arch", arch(0.5, -0.415), 0.023, mint);
      box("jukebox speaker inset", 0, 0.63, -0.39, 0.94, 0.82, 0.045, dark);
      for (let i = 0; i < 14; i++)
        box(
          "brass speaker grille",
          0,
          0.27 + i * 0.052,
          -0.421,
          0.84,
          0.018,
          0.018,
          brass,
        );
      box("song selector frame", 0, 1.38, -0.39, 0.93, 0.59, 0.035, brass);
      box("song selector face", 0, 1.39, -0.414, 0.86, 0.5, 0.018, cream);
      for (const side of [-1, 1])
        for (let i = 0; i < 5; i++) {
          box(
            "song title card",
            side * 0.215,
            1.2 + i * 0.092,
            -0.428,
            0.37,
            0.069,
            0.009,
            dark,
          );
          for (let j = 0; j < 2; j++)
            box(
              "printed selection line",
              side * 0.215,
              1.19 + i * 0.092 + j * 0.02,
              -0.436,
              0.28 - j * 0.07,
              0.008,
              0.004,
              cream,
            );
        }
      text("THE LUCKY NOTE", 0, 1.83, -0.398, 0.83, 0.18);
      text("HI-FI STEREO", 0, 1.05, -0.447, 0.68, 0.095);
      for (const x of [-0.24, 0, 0.24]) {
        const knob = cylinder(
          "jukebox selection button",
          x,
          0.98,
          -0.45,
          0.068,
          0.06,
          brass,
        );
        knob.rotation.x = Math.PI / 2;
      }
      box("jukebox base", 0, 0.08, 0, 1.46, 0.13, 0.81, dark);
    } else if (f.kind === "sofa" || f.kind === "armchair") {
      sofa(f.w, velvet);
    } else if (f.kind === "coffee-table") {
      box("coffee table stone top", 0, 0.52, 0, f.w, 0.08, f.d, dark);
      box(
        "coffee table brass apron",
        0,
        0.46,
        0,
        f.w - 0.1,
        0.035,
        f.d - 0.1,
        brass,
      );
      for (const x of [-0.95, 0.95])
        for (const z of [-0.4, 0.4])
          cylinder("coffee table leg", x, 0.24, z, 0.05, 0.45, brass);
      box(
        "travel magazine",
        -0.4,
        0.565,
        0.1,
        0.38,
        0.022,
        0.26,
        cream,
      ).rotation.y = 0.2;
      cylinder("ashtray", 0.5, 0.574, -0.1, 0.16, 0.012, brass);
    } else if (f.kind === "luggage-cart") {
      box("luggage trolley platform", 0, 0.22, 0, 1.45, 0.09, 0.9, walnut);
      for (const x of [-0.62, 0.62])
        for (const z of [-0.35, 0.35]) {
          const wheel = cylinder(
            "trolley caster",
            x,
            0.11,
            z,
            0.17,
            0.07,
            dark,
          );
          wheel.rotation.z = Math.PI / 2;
        }
      for (const z of [-0.37, 0.37])
        tube(
          "brass luggage arch",
          [
            new Vector3(-0.67, 0.27, z),
            new Vector3(-0.67, 1.65, z),
            new Vector3(-0.45, 1.91, z),
            new Vector3(0.45, 1.91, z),
            new Vector3(0.67, 1.65, z),
            new Vector3(0.67, 0.27, z),
          ],
          0.035,
          brass,
        );
      for (let i = 0; i < 3; i++) {
        const y = 0.42 + i * 0.33,
          x = i % 2 ? 0.15 : -0.1;
        box(
          "stacked suitcase",
          x,
          y,
          0,
          1.1 - i * 0.1,
          0.29,
          0.64,
          i === 1 ? burgundy : leather,
        );
        for (const side of [-1, 1])
          box(
            "suitcase leather strap",
            x + side * 0.33,
            y,
            -0.327,
            0.055,
            0.29,
            0.016,
            walnut,
          );
        box("case handle", x, y + 0.08, -0.35, 0.23, 0.04, 0.045, brass);
      }
    } else if (f.kind === "planter") {
      cylinder("brass planter", 0, 0.3, 0, 0.83, 0.58, brass, 1.05);
      cylinder("planter soil", 0, 0.588, 0, 0.95, 0.035, walnut);
      cylinder("palm trunk", 0, 1.06, 0, 0.11, 0.98, walnut, 0.07);
      for (let i = 0; i < 9; i++) {
        const a = (i * Math.PI * 2) / 9;
        const leaf = oval(
          "palm frond",
          Math.cos(a) * 0.23,
          1.6 + (i % 3) * 0.16,
          Math.sin(a) * 0.23,
          0.19,
          0.9,
          0.1,
          foliage,
        );
        leaf.rotation.set(Math.sin(a) * 0.52, a, -Math.cos(a) * 0.52);
      }
    } else if (f.kind === "dining-table") {
      box("dining table top", 0, 0.97, 0, 2.5, 0.12, 1.45, walnut);
      box("ivory tablecloth", 0, 1.034, 0, 2.43, 0.016, 1.39, cream);
      for (const x of [-1.02, 1.02])
        for (const z of [-0.52, 0.52])
          box("dining table leg", x, 0.48, z, 0.09, 0.88, 0.09, walnut);
      for (const x of [-0.68, 0.68]) {
        chair(x, 1.3, 0);
        chair(x, -1.3, Math.PI);
        setting(x, 0.44);
        setting(x, -0.44);
      }
      chair(1.76, 0, Math.PI / 2);
      chair(-1.76, 0, -Math.PI / 2);
      cylinder("table vase", 0, 1.17, 0, 0.13, 0.25, brass, 0.09);
      oval("table flower", 0, 1.31, 0, 0.13, 0.08, 0.13, burgundy);
    } else if (f.kind === "booth") {
      box("booth timber base", -0.35, 0.24, 0, 1.2, 0.34, 5.85, walnut);
      box("tall booth back", -0.83, 0.88, 0, 0.22, 1.03, 5.85, burgundy);
      for (let i = 0; i < 5; i++) {
        const z = (i - 2) * 1.12;
        oval("booth seat pad", -0.26, 0.49, z, 0.91, 0.24, 1.08, burgundy);
        oval("booth padded back", -0.68, 0.94, z, 0.14, 0.77, 1.06, burgundy);
      }
      for (const z of [-1.5, 1.5]) {
        cylinder("booth table foot", 0.48, 0.08, z, 0.7, 0.08, brass);
        cylinder("booth table pedestal", 0.48, 0.5, z, 0.075, 0.88, brass);
        box("booth table", 0.48, 0.96, z, 0.95, 0.09, 1.15, dark);
        cylinder("booth candle holder", 0.48, 1.06, z, 0.09, 0.11, brass);
      }
    } else if (f.kind === "service-counter") {
      box(
        "restaurant service cabinet",
        0,
        0.54,
        0,
        f.w - 0.12,
        1.02,
        f.d - 0.08,
        walnut,
      );
      box("buffet stone counter", 0, 1.095, 0, f.w, 0.12, f.d, dark);
      for (let x = -2.5; x <= 2.5; x += 1.25) {
        box(
          "buffet recessed panel",
          x,
          0.61,
          -0.623,
          1.13,
          0.74,
          0.022,
          velvet,
        );
        box("buffet handle", x, 0.85, -0.65, 0.2, 0.03, 0.045, brass);
      }
      for (const x of [-1.9, 0, 1.9]) {
        box("serving tray", x, 1.18, 0, 1.0, 0.04, 0.7, brass);
        oval("covered serving dish", x, 1.28, 0, 0.88, 0.21, 0.57, ceramic);
        cylinder("serving lid handle", x, 1.42, 0, 0.09, 0.05, brass);
      }
    } else if (f.kind === "host-stand") {
      box("host lectern foot", 0, 0.06, 0, f.w, 0.11, f.d, dark);
      box("host lectern", 0, 0.58, 0, 1.17, 1.01, 0.74, walnut);
      box("host lectern top", 0, 1.13, 0, f.w, 0.08, f.d, brass);
      box("reservation book", 0, 1.183, 0, 0.55, 0.025, 0.38, cream);
      text("THE GRAND DINING ROOM", 0, 0.79, -0.382, 1.03, 0.22);
    }
  }
  for (const r of roots) r.computeWorldMatrix(true);
  const merged: Mesh[] = [];
  for (const [material, meshes] of batches) {
    for (const m of meshes) m.computeWorldMatrix(true);
    const result = Mesh.MergeMeshes(
      meshes,
      true,
      true,
      undefined,
      false,
      false,
    );
    if (result) {
      result.name = material.name;
      result.material = material;
      result.receiveShadows = true;
      result.isPickable = false;
      result.freezeWorldMatrix();
      merged.push(result);
    }
  }
  for (const sign of signs) {
    sign.setParent(null);
    sign.freezeWorldMatrix();
  }
  roots.forEach((node) => node.dispose());
  const used = new Set([...merged, ...signs].map((mesh) => mesh.material));
  ownedMaterials
    .filter((m) => !used.has(m))
    .forEach((m) => m.dispose(false, true));
  return [...merged, ...signs];
}
