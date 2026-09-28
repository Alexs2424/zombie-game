import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { RawCubeTexture } from "@babylonjs/core/Materials/Textures/rawCubeTexture";
import { Constants } from "@babylonjs/core/Engines/constants";
import "@babylonjs/loaders/glTF";
import { createCharacter } from "./characters";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import {
  Simulation,
  STATIC_RECTS,
  DOORS,
  PURCHASES,
  SPAWNS,
  BOUNDS,
  PRICES,
  WEAPONS,
  WEAPON_ORDER,
  type WeaponId,
} from "./simulation";
import "@babylonjs/core/Culling/ray";

type ZombieView = ReturnType<typeof createCharacter>;
export class GameRenderer {
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  gun: TransformNode;
  guns: Record<WeaponId, TransformNode>;
  flash: Mesh;
  ready: Promise<void>;
  private weaponAssets: AssetContainer[] = [];
  private displays: Partial<Record<WeaponId, TransformNode>> = {};
  private movingParts: Partial<
    Record<WeaponId, { node: TransformNode; y: number; z: number }[]>
  > = {};
  private bartender?: ZombieView;
  private materials = new Map<string, StandardMaterial>();
  private zombies = new Map<number, ZombieView>();
  private gates: Record<string, Mesh> = {};
  private gateSigns: Record<string, Mesh> = {};
  private shadows: ShadowGenerator[] = [];
  private gunKick = 0;
  private flashTime = 0;
  private impact: Mesh;
  private impactTime = 0;
  private time = 0;
  private fpsFrames: number[] = [];
  fps = 60;
  frameP95 = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(
      canvas,
      true,
      {
        preserveDrawingBuffer: false,
        stencil: true,
        powerPreference: "high-performance",
      },
      true,
    );
    this.engine.setHardwareScalingLevel(
      1 / Math.min(window.devicePixelRatio || 1, 1.5),
    );
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.035, 0.049, 0.045, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.014;
    this.scene.fogColor = new Color3(0.045, 0.066, 0.057);
    const reflectionFaces = Array.from({ length: 6 }, (_, face) => {
      const pixels = new Uint8Array(16 * 16 * 4);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const light =
            (face === 2
              ? 0.62
              : face === 3
                ? 0.14
                : 0.22 + 0.25 * (1 - y / 15)) +
            (x > 5 && x < 10 && y > 3 && y < 7 ? 0.25 : 0);
          const at = (y * 16 + x) * 4;
          pixels[at] = 220 * light;
          pixels[at + 1] = 210 * light;
          pixels[at + 2] = 180 * light;
          pixels[at + 3] = 255;
        }
      return pixels;
    });
    this.scene.environmentTexture = new RawCubeTexture(
      this.scene,
      reflectionFaces,
      16,
      Constants.TEXTUREFORMAT_RGBA,
      Constants.TEXTURETYPE_UNSIGNED_BYTE,
      true,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    this.scene.environmentIntensity = 0.7;
    this.camera = new FreeCamera(
      "player",
      new Vector3(-9, 1.65, -8),
      this.scene,
    );
    this.camera.minZ = 0.04;
    this.camera.maxZ = 75;
    this.camera.fov = 1.32;
    this.camera.inputs.clear();
    const hemi = new HemisphericLight(
      "ceiling bounce",
      new Vector3(0.3, 1, -0.2),
      this.scene,
    );
    hemi.intensity = 0.65;
    hemi.groundColor = new Color3(0.18, 0.17, 0.15);
    hemi.diffuse = new Color3(0.79, 0.87, 0.8);
    const amber = new PointLight(
      "casino lamp",
      new Vector3(-8, 3.7, 3),
      this.scene,
    );
    amber.diffuse = new Color3(1, 0.73, 0.34);
    amber.intensity = 0.85;
    amber.range = 17;
    const lounge = new PointLight(
      "lounge lamp",
      new Vector3(10, 3, -5),
      this.scene,
    );
    lounge.diffuse = new Color3(0.46, 0.9, 0.72);
    lounge.intensity = 1.1;
    lounge.range = 14;
    for (const [x, z] of [
      [-6, 0],
      [22, 1],
    ]) {
      const key = new SpotLight(
        "chandelier pool",
        new Vector3(x, 4.55, z),
        new Vector3(0.08, -1, 0.04),
        2.75,
        1.2,
        this.scene,
      );
      key.diffuse = new Color3(1, 0.8, 0.5);
      key.intensity = 1.4;
      key.range = 30;
      key.shadowMinZ = 0.3;
      key.shadowMaxZ = 30;
      const shadow = new ShadowGenerator(1024, key);
      shadow.usePercentageCloserFiltering = true;
      shadow.bias = 0.002;
      shadow.normalBias = 0.04;
      shadow.setDarkness(0.35);
      this.shadows.push(shadow);
    }
    const pipeline = new DefaultRenderingPipeline(
      "casino finish",
      true,
      this.scene,
      [this.camera],
    );
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.85;
    pipeline.bloomWeight = 0.17;
    pipeline.bloomKernel = 40;
    pipeline.imageProcessing.contrast = 1.14;
    pipeline.imageProcessing.exposure = 1.12;
    this.environment();
    this.gun = new TransformNode("hands", this.scene);
    this.gun.parent = this.camera;
    this.guns = {
      pistol: this.weapon("pistol"),
      shotgun: this.weapon("shotgun"),
      smg: this.weapon("smg"),
      rifle: this.weapon("rifle"),
    };
    this.flash = MeshBuilder.CreateSphere(
      "muzzle",
      { diameter: 0.17, segments: 4 },
      this.scene,
    );
    this.flash.parent = this.gun;
    this.flash.material = this.mat("flash", "#ffe2a2", 1);
    this.flash.isVisible = false;
    this.flash.renderingGroupId = 1;
    this.impact = MeshBuilder.CreateSphere(
      "impact",
      { diameter: 0.09, segments: 4 },
      this.scene,
    );
    this.impact.material = this.mat("impact", "#e3c580", 1);
    this.impact.isVisible = false;
    this.ready = this.loadWeaponAssets();
  }
  mat(name: string, hex: string, glow = 0) {
    if (this.materials.has(name)) return this.materials.get(name)!;
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.12, 0.12, 0.1);
    m.maxSimultaneousLights = 6;
    if (glow) m.emissiveColor = m.diffuseColor.scale(glow);
    this.materials.set(name, m);
    return m;
  }
  box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: StandardMaterial,
    parent?: TransformNode,
  ) {
    const b = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      this.scene,
    );
    b.position.set(x, y, z);
    b.material = material;
    b.receiveShadows = true;
    if (parent) b.parent = parent;
    return b;
  }
  label(
    name: string,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    color = "#d9bd77",
    rotation = 0,
  ) {
    const textureHeight = Math.max(96, Math.round((1024 * h) / w));
    const t = new DynamicTexture(
      name,
      { width: 1024, height: textureHeight },
      this.scene,
      false,
    );
    const ctx = t.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#111d19";
    ctx.fillRect(0, 0, 1024, textureHeight);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, 1000, textureHeight - 24);
    ctx.fillStyle = color;
    let fontSize = Math.min(90, Math.round(textureHeight * 0.46));
    ctx.font = `bold ${fontSize}px Georgia`;
    if (ctx.measureText(text).width > 940) {
      fontSize *= 940 / ctx.measureText(text).width;
      ctx.font = `bold ${fontSize}px Georgia`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, textureHeight * 0.52);
    t.update();
    const m = new StandardMaterial(name, this.scene);
    m.diffuseTexture = t;
    m.emissiveTexture = t;
    m.specularColor = Color3.Black();
    m.backFaceCulling = true;
    const p = MeshBuilder.CreatePlane(
      name,
      { width: w, height: h, sideOrientation: Mesh.FRONTSIDE },
      this.scene,
    );
    p.position.set(x, y, z);
    p.rotation.y = rotation;
    p.material = m;
    return p;
  }
  private cylinder(
    name: string,
    x: number,
    y: number,
    z: number,
    diameter: number,
    height: number,
    material: StandardMaterial,
    top = diameter,
  ) {
    const mesh = MeshBuilder.CreateCylinder(
      name,
      { diameterBottom: diameter, diameterTop: top, height, tessellation: 24 },
      this.scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.receiveShadows = true;
    return mesh;
  }
  private environment() {
    const wall = this.mat("walls", "#586358"),
      trim = this.mat("old brass", "#b2985c"),
      dark = this.mat("charcoal", "#15221e"),
      wood = this.mat("walnut paneling", "#392c24"),
      burgundy = this.mat("velvet", "#612b35"),
      cream = this.mat("aged ivory", "#b4a58b"),
      luminous = this.mat("warm diffuser", "#f0cf8b", 0.95);
    const wallpaper = this.mat("aged fan damask", "#bcbca3");
    const wallpaperTexture = new Texture(
      "/textures/casino-wallpaper.png",
      this.scene,
    );
    wallpaperTexture.uScale = 1.25;
    wallpaperTexture.vScale = 1.8;
    wallpaper.diffuseTexture = wallpaperTexture;
    wallpaper.specularColor = Color3.Black();
    trim.specularColor = new Color3(0.7, 0.57, 0.3);
    trim.specularPower = 48;
    const carpet = new Texture("/textures/casino-carpet.png", this.scene);
    carpet.uScale = 11;
    carpet.vScale = 6;
    carpet.anisotropicFilteringLevel = 8;
    const floorMat = this.mat("woven carpet", "#ffffff");
    floorMat.diffuseTexture = carpet;
    floorMat.specularColor = Color3.Black();
    const width = BOUNDS.maxX - BOUNDS.minX;
    this.box("floor", 6, -0.12, 0, width, 0.2, 24, floorMat);
    const loungeMat = this.mat("lounge carpet", "#739f8b");
    const loungeTexture = carpet.clone();
    loungeTexture.uScale = 3;
    loungeTexture.vScale = 3.75;
    loungeMat.diffuseTexture = loungeTexture;
    loungeMat.specularColor = Color3.Black();
    this.box("lounge carpet", 10, -0.005, -4.5, 11.5, 0.035, 14.7, loungeMat);
    this.box(
      "staff floor",
      10,
      -0.006,
      7.5,
      11.5,
      0.035,
      8.8,
      this.mat("service tile", "#53605a"),
    );
    for (let x = 5; x < 16; x += 1.5)
      this.box("grout", x, 0.013, 7.5, 0.016, 0.005, 8.8, dark);
    for (let z = 3.5; z < 12; z += 1.5)
      this.box("grout", 10, 0.014, z, 11.5, 0.005, 0.016, dark);
    this.box(
      "ceiling",
      6,
      4.94,
      0,
      width,
      0.14,
      24,
      this.mat("ceiling", "#262b24"),
    );
    // Decorative meshes stay inside these same solid footprints used by the simulation.
    for (const r of STATIC_RECTS) {
      if (r.id === "upgrade-machine") continue;
      if (r.id.startsWith("slots")) {
        this.slotIsland(r.x, r.z, r.w, r.d);
        continue;
      }
      if (r.id.startsWith("poker")) {
        this.pokerTable(r.x, r.z, r.w, r.d);
        continue;
      }
      if (r.id === "vip-sofa") {
        this.box("sofa base", r.x, 0.26, r.z, r.w, 0.4, r.d, wood);
        this.box(
          "tufted sofa back",
          r.x + 0.4,
          0.8,
          r.z,
          0.3,
          0.8,
          r.d,
          burgundy,
        );
        for (let z = -1; z <= 3; z++) {
          this.box(
            "velvet seat cushion",
            r.x - 0.08,
            0.58,
            z,
            0.85,
            0.2,
            0.94,
            burgundy,
          );
          this.box(
            "upholstery button",
            r.x + 0.235,
            0.9,
            z,
            0.02,
            0.04,
            0.04,
            trim,
          );
        }
        continue;
      }
      if (r.id === "cashier") {
        this.box("cashier canopy", r.x, 3.25, r.z, r.w, 0.25, r.d, wood);
        this.box("cashier rear wall", r.x, 1.7, 11.75, r.w, 3.4, 0.2, dark);
        for (const x of [-12.5, -9.5]) {
          this.box("cash register", x, 1.27, 9.6, 0.7, 0.35, 0.55, trim);
          this.box("register display", x, 1.54, 9.48, 0.45, 0.15, 0.08, dark);
          for (let k = 0; k < 5; k++)
            this.box(
              "register key",
              x - 0.2 + k * 0.1,
              1.46,
              9.36,
              0.055,
              0.025,
              0.07,
              cream,
            );
        }
      }
      this.box(
        r.id,
        r.x,
        r.id === "cashier" ? 0.5 : r.h / 2,
        r.z,
        r.w,
        r.id === "cashier" ? 1 : r.h,
        r.d,
        r.id === "bar" || r.id === "cashier" ? wood : wall,
      );
      if (r.h > 4) {
        this.box(
          "lower walnut wainscot",
          r.x,
          0.68,
          r.z,
          r.w + 0.03,
          1.36,
          r.d + 0.03,
          wood,
        );
        for (const [y, h] of [
          [0.14, 0.15],
          [1.38, 0.055],
          [4.55, 0.18],
          [4.73, 0.05],
        ])
          this.box(
            "continuous brass molding",
            r.x,
            y,
            r.z,
            r.w + 0.065,
            h,
            r.d + 0.065,
            trim,
          );
        const alongX = r.w > r.d,
          length = alongX ? r.w : r.d;
        for (let a = -length / 2 + 0.65; a < length / 2; a += 2.2) {
          const x = r.x + (alongX ? a : 0),
            z = r.z + (alongX ? 0 : a);
          const bay = Math.min(1.94, length / 2 - a - 0.08);
          if (bay > 0.5)
            this.box(
              "damask wall panel",
              x,
              2.95,
              z,
              alongX ? bay : r.w + 0.025,
              2.85,
              alongX ? r.d + 0.025 : bay,
              wallpaper,
            );
          this.box(
            "panel stile",
            x,
            0.75,
            z,
            alongX ? 0.035 : r.w + 0.06,
            1.12,
            alongX ? r.d + 0.06 : 0.035,
            trim,
          );
          this.box(
            "plaster pilaster",
            x,
            2.94,
            z,
            alongX ? 0.15 : r.w + 0.09,
            2.98,
            alongX ? r.d + 0.09 : 0.15,
            cream,
          );
        }
      }
    }
    for (const [id, r] of Object.entries(DOORS)) {
      this.gates[id] = this.box(
        id + " shutter",
        r.x,
        r.h / 2,
        r.z,
        r.w,
        r.h,
        r.d,
        this.mat("shutter", "#50493a"),
      );
      for (let y = 0.15; y < 4.5; y += 0.22)
        this.box(
          "shutter rib",
          0,
          y - r.h / 2,
          0,
          r.w + 0.035,
          0.04,
          r.d,
          trim,
          this.gates[id],
        );
      for (const side of [-1, 1])
        this.box(
          "door jamb",
          r.x,
          2.25,
          r.z + side * (r.d / 2 + 0.03),
          0.58,
          4.5,
          0.1,
          trim,
        );
      this.box("door lintel", r.x, 3.28, r.z, 0.62, 0.62, r.d + 0.2, dark);
      const name =
        id === "lounge"
          ? "THE LAST CALL"
          : id === "shortcut"
            ? "STAFF PASSAGE"
            : "HIGH ROLLER CLUB";
      this.label(
        id + " lintel",
        name,
        r.x - 0.33,
        3.28,
        r.z,
        r.d - 0.12,
        0.48,
        "#e5c881",
        Math.PI / 2,
      );
      this.label(
        id + " reverse lintel",
        id === "lounge" || id === "shortcut"
          ? "CASINO FLOOR"
          : "STAFF & LOUNGE",
        r.x + 0.33,
        3.28,
        r.z,
        r.d - 0.12,
        0.48,
        "#e5c881",
        -Math.PI / 2,
      );
      this.gateSigns[id + "Back"] = this.label(
        id + " inside price",
        id === "shortcut" ? "E • OPEN 1200" : "ROOM ACCESS",
        r.x + 0.26,
        1.65,
        r.z,
        2.6,
        0.44,
        "#e5c881",
        -Math.PI / 2,
      );
      this.gateSigns[id] = this.label(
        id + " price",
        id === "vipExit"
          ? "UNLOCK FROM LOUNGE"
          : id === "shortcut"
            ? "OPEN FROM STAFF SIDE"
            : `E  •  OPEN  ${PRICES[id as "lounge" | "shortcut" | "vip"]}`,
        r.x - 0.26,
        1.65,
        r.z,
        2.8,
        0.5,
        "#e5c881",
        Math.PI / 2,
      );
    }
    this.label("main sign", "LAST JACKPOT", -2.5, 3.5, 11.9, 7, 1.1);
    this.label("cashier sign", "CASHIER", -11, 2.8, 9.12, 4, 0.7);
    for (let x = -13.7; x < -8.2; x += 0.3)
      this.box("cage bar", x, 2.05, 9.04, 0.035, 1.05, 0.055, trim);
    this.box("cage counter", -11, 1.05, 9.12, 5.9, 0.16, 0.35, trim);
    this.label(
      "cashier notice",
      "HOUSE CREDIT SUSPENDED",
      -11,
      1.85,
      8.99,
      2.6,
      0.35,
      "#ad9d7a",
    );
    this.label(
      "lounge sign",
      "THE LAST CALL",
      11,
      3.8,
      -11.9,
      4.8,
      0.58,
      "#cead72",
      Math.PI,
    );
    this.box("bar top", 12, 1.31, -8.7, 5.7, 0.14, 1.1, trim);
    for (const y of [1.8, 2.7]) {
      this.box("back bar shelf", 10.5, y, -11.68, 4.2, 0.08, 0.45, wood);
      for (let i = 0; i < 9; i++) {
        const x = 8.6 + i * 0.43,
          height = 0.28 + (i % 3) * 0.08;
        const bottle = this.mat(
          i % 2 ? "amber bottle" : "green glass",
          i % 2 ? "#8c5d2c" : "#2c7059",
        );
        this.cylinder(
          "bottle body",
          x,
          y + height / 2 + 0.04,
          -11.67,
          0.14,
          height,
          bottle,
          0.12,
        );
        this.cylinder(
          "bottle neck",
          x,
          y + height + 0.1,
          -11.67,
          0.055,
          0.12,
          bottle,
        );
        this.box(
          "bottle label",
          x,
          y + height / 2,
          -11.57,
          0.08,
          0.13,
          0.01,
          cream,
        );
      }
    }
    for (let i = 0; i < 5; i++) {
      this.box(
        "bar front brass stile",
        9.8 + i,
        0.62,
        -8.135,
        0.035,
        1.1,
        0.025,
        trim,
      );
      this.cylinder("bar glass", 10.1 + i * 0.7, 1.48, -8.7, 0.11, 0.19, cream);
    }
    for (const p of PURCHASES) {
      if (p.id === "pistolAmmo") {
        this.box("ammo plaque", p.x, 1.5, -11.9, 2.5, 1.6, 0.12, wood);
        this.label(
          "ammo header",
          "PISTOL AMMUNITION",
          p.x,
          2.04,
          -11.81,
          2.3,
          0.34,
          "#a4d3bb",
          Math.PI,
        );
        this.label(
          "ammo price",
          "E • REFILL 150",
          p.x,
          0.92,
          -11.81,
          2,
          0.32,
          "#c9c7a3",
          Math.PI,
        );
        for (let i = 0; i < 5; i++)
          this.box(
            "ammunition carton",
            p.x - 0.6 + i * 0.3,
            1.5,
            -11.7,
            0.22,
            0.3,
            0.19,
            trim,
          );
        continue;
      }
      if (p.id === "shotgun" || p.id === "smg" || p.id === "rifle") {
        const x = p.id === "shotgun" ? -15.95 : p.id === "smg" ? 4.27 : 27.95;
        const facing = p.id === "rifle" ? Math.PI / 2 : -Math.PI / 2;
        const offset = p.id === "rifle" ? -0.12 : 0.12;
        this.box(p.id + " walnut display", x, 1.52, p.z, 0.1, 1.65, 2.65, wood);
        this.box(
          p.id + " display trim",
          x + offset * 0.3,
          1.52,
          p.z,
          0.1,
          1.75,
          2.75,
          trim,
        );
        this.box(
          p.id + " dark backing",
          x + offset * 0.6,
          1.52,
          p.z,
          0.1,
          1.56,
          2.54,
          dark,
        );
        this.label(
          p.id + " rack name",
          WEAPONS[p.id].name,
          x + offset * 1.15,
          2.16,
          p.z,
          2.4,
          0.35,
          "#d9c58d",
          facing,
        );
        this.label(
          p.id + " rack price",
          `${WEAPONS[p.id].price} PTS • AMMO ${WEAPONS[p.id].refill}`,
          x + offset * 1.15,
          0.9,
          p.z,
          2.4,
          0.3,
          "#93c5ae",
          facing,
        );
        const display = new TransformNode(p.id + " display weapon", this.scene);
        display.position.set(x + offset * 2, 1.55, p.z);
        display.scaling.setAll(1.8);
        this.displays[p.id] = display;
        continue;
      }
      if (p.id !== "upgrade") continue;
      this.box("workshop cabinet", p.x, 0.65, 10.9, 1.6, 1.3, 1.1, dark);
      this.box("workshop brass lip", p.x, 1.33, 10.9, 1.7, 0.12, 1.2, trim);
      for (const side of [-1, 1]) {
        this.box(
          "workshop upright",
          p.x + side * 0.75,
          1.9,
          11.25,
          0.12,
          1.1,
          0.16,
          trim,
        );
        this.cylinder(
          "workshop energy canister",
          p.x + side * 0.55,
          1.7,
          10.75,
          0.17,
          0.6,
          this.mat("workshop glow", "#76bc9e", 0.6),
        );
      }
      this.label(
        "workshop sign",
        "DOUBLE DOWN",
        p.x,
        2.27,
        11.12,
        1.6,
        0.35,
        "#e3c47d",
      );
      this.label(
        "workshop price",
        "UPGRADE • 2000",
        p.x,
        0.88,
        10.33,
        1.4,
        0.28,
        "#e3c47d",
      );
      this.label(
        "club wall title",
        "FORTUNE FAVORS THE BOLD",
        22,
        3.5,
        11.9,
        8,
        0.75,
        "#e6c275",
      );
    }
    this.bartender = createCharacter(this.scene, 0, true);
    this.box("bar staff step", 12, 0.075, -9.35, 1.1, 0.15, 0.7, wood);
    this.bartender.root.position.set(12, 0.15, -9.35);
    this.bartender.shadow.position.set(12, 0.16, -9.35);
    for (const shadow of this.shadows)
      for (const m of this.bartender.root.getChildMeshes())
        shadow.addShadowCaster(m, false);
    this.label(
      "bartender counter badge",
      "MARLOWE · PERKS & UPGRADES",
      12,
      1.02,
      -8.1,
      2.5,
      0.27,
      "#ddc68b",
      Math.PI,
    );
    for (let i = 0; i < 3; i++) {
      this.cylinder(
        "cocktail stem",
        13.1 + i * 0.45,
        1.51,
        -8.7,
        0.025,
        0.22,
        trim,
      );
      this.cylinder(
        "cocktail coupe",
        13.1 + i * 0.45,
        1.64,
        -8.7,
        0.06,
        0.11,
        this.mat("cocktail " + i, ["#b34a4a", "#d1b567", "#629d80"][i], 0.2),
        0.2,
      );
    }
    SPAWNS.forEach((p, i) => {
      const rotation = i === 1 ? -Math.PI / 2 : i === 2 ? 0 : Math.PI;
      const x = i === 1 ? -15.95 : p.x,
        z = i === 1 ? p.z : i === 2 ? 11.94 : -11.94;
      this.label(
        "entrance " + i,
        ["ENTRANCE", "SECURITY", "STAFF", "BACK OF HOUSE", "PRIVATE ENTRANCE"][
          i
        ],
        x,
        2.9,
        z,
        2.5,
        0.5,
        "#c6b479",
        rotation,
      );
      this.box(
        "entry dark",
        x,
        1.25,
        z,
        i === 1 ? 0.08 : 2.2,
        2.5,
        i === 1 ? 2.2 : 0.08,
        this.mat("entry black", "#080d0b"),
      );
      for (const side of [-1, 1]) {
        this.box(
          "entrance brass jamb",
          x + (i === 1 ? 0 : side * 1.15),
          1.25,
          z + (i === 1 ? side * 1.15 : 0),
          i === 1 ? 0.13 : 0.06,
          2.5,
          i === 1 ? 0.06 : 0.13,
          trim,
        );
      }
    });
    // Staff corridor reads as back-of-house: exposed pipes, valves, service signage.
    for (const z of [5.4, 6.0]) {
      const pipe = this.cylinder(
        "service pipe",
        10,
        4.12,
        z,
        0.13,
        11.4,
        this.mat("utility steel", "#727b72"),
      );
      pipe.rotation.z = Math.PI / 2;
      for (const x of [5.8, 9.5, 13.2]) {
        const joint = this.cylinder(
          "pipe coupling",
          x,
          4.12,
          z,
          0.19,
          0.11,
          trim,
        );
        joint.rotation.z = Math.PI / 2;
      }
    }
    this.label(
      "staff fire instructions",
      "SERVICE CORRIDOR",
      7,
      2.55,
      3.27,
      4.5,
      0.45,
      "#cfb986",
      Math.PI,
    );
    for (let i = 0; i < 4; i++) {
      this.box(
        "staff conduit",
        7 + i * 0.23,
        2.12,
        11.86,
        0.035,
        4.16,
        0.08,
        dark,
      );
      this.box(
        "staff switch box",
        7 + i * 0.45,
        1.8,
        11.81,
        0.32,
        0.48,
        0.15,
        this.mat("utility steel", "#727b72"),
      );
    }
    // Coffered ceiling and suspended fixtures establish architectural scale.
    for (let x = -16; x <= 28; x += 4)
      this.box("ceiling cross beam", x, 4.66, 0, 0.13, 0.22, 24, wood);
    for (let z = -12; z <= 12; z += 4)
      this.box("ceiling cross beam", 6, 4.66, z, width, 0.22, 0.13, wood);
    for (const [x, z] of [
      [-7, 0],
      [-0.7, 5],
      [22, -3],
      [22, 5],
    ]) {
      this.cylinder("chandelier stem", x, 4.14, z, 0.045, 1.2, trim);
      const ring = MeshBuilder.CreateTorus(
        "chandelier brass ring",
        { diameter: 2.1, thickness: 0.075, tessellation: 36 },
        this.scene,
      );
      ring.position.set(x, 3.62, z);
      ring.material = trim;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          xx = x + Math.cos(a),
          zz = z + Math.sin(a);
        this.cylinder(
          "pendant frosted glass",
          xx,
          3.8,
          zz,
          0.18,
          0.4,
          luminous,
          0.24,
        );
        this.cylinder("pendant brass base", xx, 3.55, zz, 0.2, 0.08, trim);
      }
    }
    for (const x of [-15.88, 27.88])
      for (const z of [-8, 0, 8]) {
        this.box("sconce backing", x, 2.85, z, 0.07, 0.8, 0.46, trim);
        this.box(
          "sconce light",
          x + (x < 0 ? 0.06 : -0.06),
          2.9,
          z,
          0.13,
          0.55,
          0.25,
          luminous,
        );
      }
    for (const x of [-15.83, 15.7, 27.83])
      this.box(
        "cove light",
        x,
        4.48,
        0,
        0.045,
        0.045,
        23.5,
        this.mat("cove glow", "#c6a25e", 0.7),
      );
    this.label(
      "lounge wayfinding",
      "THE LAST CALL • LOUNGE",
      3.69,
      2.7,
      -8.8,
      3.7,
      0.42,
      "#dbbd78",
      Math.PI / 2,
    );
    this.label(
      "vip invitation",
      "HIGH ROLLER →",
      7,
      2.65,
      2.71,
      4.8,
      0.5,
      "#dbbd78",
    );
    // Batch fixed scenery by material, keeping shutters and their children movable.
    const groups = new Map<StandardMaterial, Mesh[]>();
    const gates = new Set(Object.values(this.gates));
    for (const m of [...this.scene.meshes]) {
      if (
        !(m instanceof Mesh) ||
        m.parent ||
        gates.has(m) ||
        m === this.bartender?.shadow ||
        Object.values(this.gateSigns).includes(m) ||
        !m.material
      )
        continue;
      const mat = m.material as StandardMaterial;
      const group = groups.get(mat) ?? [];
      group.push(m);
      groups.set(mat, group);
    }
    for (const [material, meshes] of groups) {
      const merged =
        meshes.length > 1 ? Mesh.MergeMeshes(meshes, true, true) : meshes[0];
      if (!merged) continue;
      merged.name = "scenery: " + material.name;
      merged.isPickable = false;
      merged.receiveShadows = true;
      merged.freezeWorldMatrix();
      if (
        !material.emissiveColor.equals(Color3.Black()) ||
        material.diffuseTexture === carpet
      )
        continue;
      for (const shadow of this.shadows) shadow.addShadowCaster(merged, false);
    }
  }
  private pokerTable(x: number, z: number, w: number, d: number) {
    const wood = this.mat("walnut paneling", "#392c24"),
      brass = this.mat("old brass", "#b2985c"),
      felt = this.mat("poker felt", "#286c59"),
      leather = this.mat("padded rail", "#251e1b");
    this.box("poker pedestal", x, 0.4, z, 1.8, 0.8, 1, wood);
    this.box("padded poker rail", x, 0.88, z, w, 0.14, d, leather);
    this.box(
      "brass table edge",
      x,
      0.82,
      z,
      w + 0.015,
      0.035,
      d + 0.015,
      brass,
    );
    this.box("green baize", x, 0.954, z, w - 0.32, 0.012, d - 0.32, felt);
    for (let i = 0; i < 5; i++) {
      const card = this.box(
        "playing card",
        x - 0.65 + i * 0.33,
        0.966,
        z,
        0.22,
        0.009,
        0.3,
        this.mat("cards", "#dacfad"),
      );
      card.rotation.y = (i - 2) * 0.08;
      this.box(
        "card suit",
        x - 0.65 + i * 0.33,
        0.972,
        z,
        0.06,
        0.006,
        0.07,
        this.mat("red chips", "#a34842"),
      );
    }
    for (let i = 0; i < 8; i++) {
      const xx = x - 1.25 + (i % 4) * 0.8,
        zz = z + (i < 4 ? -0.8 : 0.8);
      for (let n = 0; n <= i % 3; n++)
        this.cylinder(
          "chip stack",
          xx,
          0.975 + n * 0.028,
          zz,
          0.13,
          0.022,
          this.mat(
            i % 2 ? "red chips" : "ivory chips",
            i % 2 ? "#a34842" : "#e0cfa9",
          ),
        );
    }
  }
  private slotIsland(x: number, z: number, w: number, d: number) {
    const base = this.mat("slot base", "#202b27"),
      brass = this.mat("slot brass", "#998153");
    this.box("slot island plinth", x, 0.1, z, w, 0.2, d, base);
    this.box("slot central spine", x, 0.8, z, 0.58, 1.5, d - 0.15, base);
    this.box("island crown", x, 1.9, z, 0.45, 0.1, d - 0.15, brass);
    for (const end of [-1, 1]) {
      this.box(
        "end panel",
        x,
        0.8,
        z + end * (d / 2 - 0.06),
        w - 0.08,
        1.35,
        0.1,
        base,
      );
      for (const offset of [-0.75, 0, 0.75])
        this.box(
          "end brass fluting",
          x + offset,
          0.85,
          z + (end * d) / 2,
          0.035,
          1.2,
          0.018,
          brass,
        );
      this.label(
        "island end insignia",
        "♠  JACKPOT  ♠",
        x,
        1.28,
        z + end * (d / 2 + 0.01),
        w - 0.25,
        0.38,
        "#c6a970",
        end > 0 ? Math.PI : 0,
      );
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const zz = z - d / 2 + 0.7 + (i * (d - 1.4)) / 2;
        this.box(
          "slot cabinet",
          x + side * (w / 2 - 0.7),
          1.06,
          zz,
          1.4,
          1.8,
          0.88,
          base,
        );
        const screen = this.box(
          "slot screen",
          x + side * (w / 2 + 0.012),
          1.28,
          zz,
          0.035,
          0.7,
          0.64,
          this.mat(
            i % 2 ? "slot mint" : "slot amber",
            i % 2 ? "#4b9277" : "#b49d61",
            0.35,
          ),
        );
        screen.rotation.z = side * 0.06;
        this.label(
          "slot reels",
          "7  7  7",
          x + side * (w / 2 + 0.04),
          1.29,
          zz,
          0.52,
          0.22,
          "#e3d7a2",
          side === -1 ? Math.PI / 2 : -Math.PI / 2,
        );
        this.box(
          "slot lip",
          x + side * (w / 2 + 0.03),
          0.72,
          zz,
          0.2,
          0.075,
          0.8,
          brass,
        );
        this.box(
          "coin return",
          x + side * (w / 2 + 0.018),
          0.43,
          zz,
          0.035,
          0.14,
          0.44,
          this.mat("coin black", "#080e0b"),
        );
        for (let button = 0; button < 3; button++)
          this.box(
            "slot button",
            x + side * (w / 2 + 0.045),
            0.79,
            zz - 0.2 + button * 0.2,
            0.07,
            0.035,
            0.08,
            this.mat("slot button light", "#dcc487", 0.4),
          );
        this.box(
          "slot crown",
          x + side * (w / 2 - 0.33),
          2.03,
          zz,
          0.7,
          0.13,
          0.82,
          brass,
        );
      }
  }
  private async loadWeaponAssets() {
    await Promise.all(
      WEAPON_ORDER.map(async (id) => {
        const asset = await LoadAssetContainerAsync(
          `/models/${id}.glb`,
          this.scene,
        );
        if (this.scene.isDisposed) {
          asset.dispose();
          return;
        }
        this.weaponAssets.push(asset);
        for (const m of this.guns[id].getChildMeshes())
          if (!m.name.startsWith("glove")) m.dispose();
        const firstPerson = asset.instantiateModelsToScene(
          (n) => `${id}-${n}`,
          false,
          { doNotInstantiate: true },
        );
        for (const root of firstPerson.rootNodes) root.parent = this.guns[id];
        for (const mesh of this.guns[id].getChildMeshes()) {
          mesh.renderingGroupId = 1;
          mesh.isPickable = false;
        }
        this.movingParts[id] = this.guns[id]
          .getDescendants()
          .filter((n) => {
            if (!(n instanceof TransformNode)) return false;
            const name = n.name.slice(id.length + 1);
            return (
              (id !== "shotgun" &&
                [
                  "Magazine",
                  "Magazine floor plate",
                  "Magazine pressed ribs",
                ].includes(name)) ||
              name === "Bolt" ||
              name.startsWith("Bolt handle") ||
              (id === "pistol" &&
                name.startsWith("Slide") &&
                !name.startsWith("Slide stop")) ||
              (id === "shotgun" &&
                (name.startsWith("Pump") || name === "Action bars"))
            );
          })
          .map((n) => ({
            node: n as TransformNode,
            y: (n as TransformNode).position.y,
            z: (n as TransformNode).position.z,
          }));
        const display = this.displays[id];
        if (display) {
          const world = asset.instantiateModelsToScene(
            (n) => `display-${id}-${n}`,
            false,
            { doNotInstantiate: true },
          );
          for (const root of world.rootNodes) root.parent = display;
          for (const m of display.getChildMeshes()) {
            m.receiveShadows = true;
            for (const shadow of this.shadows) shadow.addShadowCaster(m, false);
          }
        }
      }),
    );
    await this.scene.whenReadyAsync();
  }
  private weapon(id: WeaponId) {
    const root = new TransformNode(id, this.scene);
    root.parent = this.gun;
    const glove = this.mat("tactical leather", "#403e32");
    for (const [x, y, z] of [
      [0.04, -0.17, -0.04],
      [-0.035, -0.12, id === "pistol" ? -0.07 : 0.21],
    ]) {
      const palm = MeshBuilder.CreateSphere(
        "glove palm",
        { diameter: 1, segments: 12 },
        this.scene,
      );
      palm.scaling.set(0.12, 0.14, 0.12);
      palm.position.set(x, y, z);
      palm.parent = root;
      palm.material = glove;
      for (let n = 0; n < 3; n++)
        this.box(
          "glove finger",
          x - 0.032 + n * 0.029,
          y + 0.024,
          z + 0.048,
          0.025,
          0.08,
          0.034,
          glove,
          root,
        );
      const cuff = MeshBuilder.CreateCapsule(
        "glove cuff",
        { radius: 0.064, height: 0.2, tessellation: 12 },
        this.scene,
      );
      cuff.position.set(x, y - 0.1, z - 0.07);
      cuff.rotation.x = -0.6;
      cuff.parent = root;
      cuff.material = glove;
    }
    for (const m of root.getChildMeshes()) m.renderingGroupId = 1;
    return root;
  }
  private zombie(id: number): ZombieView {
    const view = createCharacter(this.scene, id);
    for (const shadow of this.shadows)
      for (const mesh of view.root.getChildMeshes())
        shadow.addShadowCaster(mesh, false);
    return view;
  }
  shot(id: WeaponId) {
    this.gunKick =
      id === "shotgun"
        ? 0.12
        : id === "rifle"
          ? 0.085
          : id === "smg"
            ? 0.035
            : 0.055;
    this.flashTime = 0.045;
    this.flash.position.set(
      0,
      0.03,
      id === "shotgun" || id === "rifle" ? 0.65 : id === "smg" ? 0.4 : 0.24,
    );
  }
  hit() {
    this.impactTime = 0.07;
    const ray = this.camera.getForwardRay(6);
    this.impact.position.copyFrom(ray.origin.add(ray.direction.scale(5)));
  }
  update(sim: Simulation, dt: number) {
    this.time += dt;
    this.camera.position.set(
      sim.player.x,
      1.65 +
        (sim.moving && sim.phase === "playing"
          ? Math.sin(sim.time * 12) * 0.018
          : 0),
      sim.player.z,
    );
    this.camera.rotation.set(sim.pitch, sim.yaw, 0);
    this.gunKick = Math.max(0, this.gunKick - dt * 0.7);
    this.flashTime -= dt;
    this.flash.isVisible = this.flashTime > 0 && sim.phase === "playing";
    this.impactTime -= dt;
    this.impact.isVisible = this.impactTime > 0;
    const bob =
      sim.moving && sim.phase === "playing"
        ? Math.sin(sim.time * (sim.sprinting ? 15 : 10)) * 0.012
        : 0;
    this.gun.position.set(0.29, -0.25 + bob, 0.61 - this.gunKick);
    this.gun.rotation.x =
      sim.reloadRemaining > 0
        ? 0.5 + Math.sin(sim.reloadRemaining * 6) * 0.12
        : this.gunKick * 1.4;
    this.gun.rotation.z = sim.sprinting ? -0.2 : 0;
    for (const id of WEAPON_ORDER) this.guns[id].setEnabled(sim.weapon === id);
    const reloadProgress =
      sim.reloadRemaining > 0
        ? 1 - sim.reloadRemaining / sim.reloadDuration()
        : 0;
    for (const part of this.movingParts[sim.weapon] ?? []) {
      part.node.position.y =
        part.y -
        (part.node.name.includes("Magazine") && sim.reloadRemaining > 0
          ? Math.sin(reloadProgress * Math.PI) * 0.23
          : 0);
      part.node.position.z =
        part.z -
        (part.node.name.includes("Bolt") ||
        part.node.name.includes("Slide") ||
        part.node.name.includes("Pump") ||
        part.node.name.includes("Action bars")
          ? this.gunKick * 0.5
          : 0);
    }
    if (this.bartender) {
      this.bartender.arms[0].rotation.x =
        -1.3 + Math.sin(this.time * 1.5) * 0.045;
      this.bartender.arms[1].rotation.x =
        -1.35 + Math.sin(this.time * 1.5 + 1) * 0.08;
      this.bartender.root.rotation.y = Math.sin(this.time * 0.3) * 0.035;
    }
    this.gun.setEnabled(sim.phase !== "ready");
    for (const id of ["lounge", "shortcut", "vip", "vipExit"] as const) {
      const open = id === "vipExit" ? sim.vip : sim[id];
      this.gates[id].setEnabled(!open);
      this.gateSigns[id].setEnabled(!open);
      this.gateSigns[id + "Back"]?.setEnabled(!open);
    }
    const active = new Set(
      sim.enemies.filter((e) => e.health > 0).map((e) => e.id),
    );
    for (const [id, v] of this.zombies)
      if (!active.has(id)) {
        for (const generator of this.shadows)
          for (const mesh of v.root.getChildMeshes())
            generator.removeShadowCaster(mesh, false);
        v.root.dispose();
        v.shadow.dispose();
        for (const material of v.materials) material.dispose();
        this.zombies.delete(id);
      }
    for (const e of sim.enemies) {
      if (e.health <= 0) continue;
      let v = this.zombies.get(e.id);
      if (!v) {
        v = this.zombie(e.id);
        this.zombies.set(e.id, v);
      }
      v.root.position.set(e.x, 0, e.z);
      v.root.rotation.y = e.yaw;
      v.root.rotation.z = Math.sin(e.age * 3 + e.id) * 0.025;
      const walk = Math.sin(e.age * e.speed * 4) * 0.3;
      v.legs[0].rotation.x = walk;
      v.legs[1].rotation.x = -walk;
      v.arms.forEach(
        (a, i) =>
          (a.rotation.x =
            e.attack > 0 ? -1.55 : -0.7 + (i ? walk : -walk) * 0.4),
      );
      v.material.emissiveColor =
        e.flash > 0 ? new Color3(0.6, 0.45, 0.2) : Color3.Black();
      v.shadow.position.set(e.x, 0.025, e.z);
    }
    this.scene.render();
    this.fps = this.engine.getFps();
    this.fpsFrames.push(this.engine.getDeltaTime());
    if (this.fpsFrames.length > 180) this.fpsFrames.shift();
    if (this.fpsFrames.length % 30 === 0) {
      const frames = [...this.fpsFrames].sort((a, b) => a - b);
      this.frameP95 = frames[Math.floor(frames.length * 0.95)] ?? 0;
    }
  }
  resize() {
    this.engine.resize();
  }
  dispose() {
    for (const asset of this.weaponAssets) asset.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
