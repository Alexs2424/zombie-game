import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
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
import { RouletteMotion, ROULETTE_GEOMETRY } from "./roulette-motion";
import { POKER_TABLES, type PokerTableId } from "./poker";
import { paintPlayingCard } from "./card-art";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import {
  Simulation,
  STATIC_RECTS,
  DOORS,
  PURCHASES,
  SPAWNS,
  BOUNDS,
  PRICES,
  ROULETTE_RULES,
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
  private slotPlacements: {
    root: TransformNode;
    variant: "emerald" | "burgundy";
  }[] = [];
  private displays: Partial<Record<WeaponId, TransformNode>> = {};
  private movingParts: Partial<
    Record<WeaponId, { node: TransformNode; y: number; z: number }[]>
  > = {};
  private bartender?: ZombieView;
  private handLight: PointLight;
  private muzzleLight: PointLight;
  private rouletteWheel?: TransformNode;
  private rouletteBall?: TransformNode;
  private rouletteMotion = new RouletteMotion();
  private pokerCards: {
    table: PokerTableId;
    index: number;
    key: string;
    texture: DynamicTexture;
    material: StandardMaterial;
  }[] = [];
  private diceMeshes: TransformNode[] = [];
  private handParts: Partial<
    Record<WeaponId, { node: TransformNode; rest: Vector3 }[]>
  > = {};
  private materials = new Map<string, StandardMaterial>();
  private zombies = new Map<number, ZombieView>();
  private zombieShadows = new Map<number, Set<ShadowGenerator>>();
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
    this.scene.fogDensity = 0.012;
    this.scene.fogColor = new Color3(0.027, 0.048, 0.043);
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
    hemi.intensity = 0.85;
    hemi.groundColor = new Color3(0.2, 0.23, 0.23);
    hemi.diffuse = new Color3(0.69, 0.79, 0.77);
    const amber = new PointLight(
      "casino lamp",
      new Vector3(-8, 3.7, 3),
      this.scene,
    );
    amber.diffuse = new Color3(1, 0.73, 0.34);
    amber.intensity = 0.8;
    amber.range = 13;
    const lounge = new PointLight(
      "lounge lamp",
      new Vector3(10, 3, -5),
      this.scene,
    );
    lounge.diffuse = new Color3(0.46, 0.9, 0.72);
    lounge.intensity = 0.95;
    lounge.range = 12;
    for (const [x, z] of [
      [-6, 0],
      [22, 1],
      [35, 0],
    ]) {
      const key = new SpotLight(
        "chandelier pool",
        new Vector3(x, 4.55, z),
        new Vector3(0.08, -1, 0.04),
        2.35,
        1.35,
        this.scene,
      );
      key.diffuse = new Color3(1, 0.8, 0.5);
      key.intensity = 2.8;
      key.range = 18;
      key.shadowMinZ = 0.3;
      key.shadowMaxZ = 18;
      const shadow = new ShadowGenerator(1024, key);
      shadow.usePercentageCloserFiltering = true;
      shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      shadow.bias = 0.002;
      shadow.normalBias = 0.04;
      shadow.setDarkness(0.16);
      this.shadows.push(shadow);
    }
    if (SSAO2RenderingPipeline.IsSupported) {
      const ao = new SSAO2RenderingPipeline(
        "contact shadows",
        this.scene,
        { ssaoRatio: 0.5, blurRatio: 1 },
        [this.camera],
        false,
      );
      ao.radius = 0.35;
      ao.totalStrength = 0.45;
      ao.base = 0.05;
      ao.samples = 12;
      ao.maxZ = 45;
    }
    const pipeline = new DefaultRenderingPipeline(
      "casino finish",
      true,
      this.scene,
      [this.camera],
    );
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.9;
    pipeline.bloomWeight = 0.16;
    pipeline.bloomKernel = 40;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 1.1;
    pipeline.imageProcessing.vignetteColor = new Color4(0.012, 0.019, 0.016, 1);
    pipeline.imageProcessing.contrast = 1.02;
    pipeline.imageProcessing.exposure = 1.55;
    const tableBounce = new PointLight(
      "table room warm bounce",
      new Vector3(35, 2.8, -3),
      this.scene,
    );
    tableBounce.diffuse = new Color3(1, 0.74, 0.45);
    tableBounce.intensity = 0.65;
    tableBounce.range = 12;
    const rouletteGlow = new PointLight(
      "roulette jade bounce",
      new Vector3(39, 2.8, 7),
      this.scene,
    );
    rouletteGlow.diffuse = new Color3(0.35, 0.7, 0.61);
    rouletteGlow.intensity = 0.5;
    rouletteGlow.range = 9;
    this.environment();
    this.handLight = new PointLight(
      "weapon bounce",
      new Vector3(-0.3, 0.5, -0.1),
      this.scene,
    );
    this.handLight.parent = this.camera;
    this.handLight.diffuse = new Color3(0.83, 0.88, 0.82);
    this.handLight.intensity = 1.4;
    this.handLight.range = 3;
    this.handLight.renderPriority = 20;
    this.muzzleLight = new PointLight(
      "muzzle spill",
      Vector3.Zero(),
      this.scene,
    );
    this.muzzleLight.diffuse = new Color3(1, 0.65, 0.25);
    this.muzzleLight.range = 6;
    this.muzzleLight.intensity = 0;
    this.muzzleLight.renderPriority = 30;
    this.gun = new TransformNode("hands", this.scene);
    this.gun.parent = this.camera;
    this.guns = {
      pistol: this.weapon("pistol"),
      shotgun: this.weapon("shotgun"),
      smg: this.weapon("smg"),
      rifle: this.weapon("rifle"),
      revolver: this.weapon("revolver"),
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
    this.ready = Promise.all([
      this.loadWeaponAssets(),
      this.loadTableAssets(),
      this.loadSlotAssets(),
      this.loadPokerAssets(),
    ]).then(async () => {
      await this.scene.whenReadyAsync();
    });
  }
  mat(name: string, hex: string, glow = 0) {
    if (this.materials.has(name)) return this.materials.get(name)!;
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.12, 0.12, 0.1);
    m.maxSimultaneousLights = 8;
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
    carpet.uScale = 14.5;
    carpet.vScale = 6;
    carpet.anisotropicFilteringLevel = 8;
    const floorMat = this.mat("woven carpet", "#ffffff");
    floorMat.diffuseTexture = carpet;
    floorMat.specularColor = Color3.Black();
    const width = BOUNDS.maxX - BOUNDS.minX;
    const centerX = (BOUNDS.minX + BOUNDS.maxX) / 2;
    this.box("floor", centerX, -0.12, 0, width, 0.2, 24, floorMat);
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
      centerX,
      4.94,
      0,
      width,
      0.14,
      24,
      this.mat("ceiling", "#262b24"),
    );
    // Decorative meshes stay inside these same solid footprints used by the simulation.
    for (const r of STATIC_RECTS) {
      if (
        [
          "upgrade-machine",
          "craps-table",
          "roulette-table",
          "tables-sideboard",
        ].includes(r.id)
      )
        continue;
      if (r.id.startsWith("slots")) {
        this.slotIsland(r.x, r.z, r.w, r.d);
        continue;
      }
      if (r.id.startsWith("poker")) {
        this.pokerTable(r.x, r.z);
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
            : id.startsWith("tables")
              ? "THE DEVIL’S TABLES"
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
          : id.startsWith("tables")
            ? "HIGH ROLLER CLUB"
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
        id === "tablesExit"
          ? "UNLOCK AT FRONT ENTRANCE"
          : id === "vipExit"
            ? "UNLOCK FROM LOUNGE"
            : id === "shortcut"
              ? "OPEN FROM STAFF SIDE"
              : `E  •  OPEN  ${PRICES[id as "lounge" | "shortcut" | "vip" | "tables"]}`,
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
        const x = p.id === "shotgun" ? -15.95 : p.id === "smg" ? 4.27 : 27.725;
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
          `${WEAPONS[p.id].price} CHIPS • AMMO ${WEAPONS[p.id].refill}`,
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
        [
          "ENTRANCE",
          "SECURITY",
          "STAFF",
          "BACK OF HOUSE",
          "PRIVATE ENTRANCE",
          "DEALER ACCESS",
        ][i],
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
    for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 4)
      this.box("ceiling cross beam", x, 4.66, 0, 0.13, 0.22, 24, wood);
    for (let z = -12; z <= 12; z += 4)
      this.box("ceiling cross beam", centerX, 4.66, z, width, 0.22, 0.13, wood);
    for (const [x, z] of [
      [-7, 0],
      [-0.7, 5],
      [22, -3],
      [22, 5],
      [35, -3],
      [35, 5],
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
    for (const x of [-15.88, 27.7, 41.88])
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
    for (const x of [-15.83, 15.7, 27.7, 41.83])
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
    this.label(
      "tables room title",
      "THE DEVIL’S TABLES",
      35,
      3.55,
      11.9,
      8,
      0.65,
      "#dfbd78",
    );
    this.label(
      "tables invitation",
      "CRAPS & ROULETTE →",
      27.69,
      2.7,
      4.3,
      3.4,
      0.42,
      "#dfbd78",
      Math.PI / 2,
    );
    this.box(
      "roulette rules brass frame",
      35,
      2.12,
      11.93,
      6.8,
      2.06,
      0.06,
      trim,
    );
    this.box(
      "roulette rules walnut board",
      35,
      2.12,
      11.89,
      6.68,
      1.94,
      0.035,
      wood,
    );
    this.label(
      "roulette rules title",
      "ROULETTE • LUCKY NUMBERS",
      35,
      2.83,
      11.864,
      6.32,
      0.39,
      "#e3bd78",
    );
    this.label(
      "roulette spin cost",
      `${PRICES.roulette} CHIPS • EVERY SPIN`,
      35,
      2.43,
      11.864,
      6.32,
      0.29,
      "#d6c4a0",
    );
    this.label(
      "roulette equipped ammo reward",
      "4 / 24  •  EQUIPPED WEAPON AMMO",
      35,
      2.08,
      11.864,
      6.32,
      0.29,
      "#d6c4a0",
    );
    this.label(
      "roulette maximum ammo reward",
      "7  •  MAX AMMO FOR ALL OWNED WEAPONS",
      35,
      1.73,
      11.864,
      6.32,
      0.29,
      "#d6c4a0",
    );
    this.label(
      "roulette jackpot reward",
      `0  •  MAX AMMO + ${ROULETTE_RULES.damageMultiplier}× DAMAGE FOR ${ROULETTE_RULES.damageDuration} SECONDS`,
      35,
      1.38,
      11.864,
      6.32,
      0.29,
      "#e3bd78",
    );
    this.label(
      "craps rules",
      "SEVEN’S CURSE",
      35,
      2.5,
      -11.9,
      4.6,
      0.65,
      "#e3b875",
      Math.PI,
    );
    this.label(
      "craps cost",
      "250 CHIPS • ONE ROLL PER ROUND",
      35,
      1.93,
      -11.9,
      5.6,
      0.37,
      "#c6b998",
      Math.PI,
    );
    this.label(
      "craps risk",
      "7: −20% SPEED • OTHER ROLLS: 500 CHIPS",
      35,
      1.48,
      -11.9,
      6.5,
      0.36,
      "#c6b998",
      Math.PI,
    );
    this.box("table room sideboard", 41.35, 0.53, 1, 1.1, 1.06, 3, wood);
    this.box("sideboard brass top", 41.35, 1.1, 1, 1.15, 0.07, 3.05, trim);
    for (let i = 0; i < 7; i++) {
      this.cylinder(
        "sideboard chip tray",
        41.25,
        1.18,
        -0.1 + i * 0.34,
        0.18,
        0.06,
        dark,
      );
      for (let j = 0; j < 4; j++)
        this.cylinder(
          "sideboard chips",
          41.25,
          1.225 + j * 0.025,
          -0.1 + i * 0.34,
          0.12,
          0.02,
          i % 2 ? burgundy : cream,
        );
    }
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
  private pokerTable(x: number, z: number) {
    const table = POKER_TABLES.find((table) => table.x === x && table.z === z)!;
    for (let i = 0; i < 5; i++) {
      this.box(
        `${table.id} card ${i + 1} paper edge`,
        x + (i - 2) * 0.28,
        0.868,
        z - 0.36,
        0.22,
        0.004,
        0.31,
        this.mat("card paper edge", "#ddcfac"),
      );
      const texture = new DynamicTexture(
        `${table.id} card ${i + 1} print`,
        { width: 384, height: 544 },
        this.scene,
        true,
      );
      texture.anisotropicFilteringLevel = 8;
      paintPlayingCard(texture.getContext() as CanvasRenderingContext2D);
      texture.update();
      const material = new StandardMaterial(
        `${table.id} card ${i + 1}`,
        this.scene,
      );
      material.diffuseTexture = texture;
      material.diffuseColor = Color3.White();
      material.emissiveColor = new Color3(0.08, 0.08, 0.065);
      material.specularColor = new Color3(0.13, 0.12, 0.09);
      material.specularPower = 40;
      material.maxSimultaneousLights = 8;
      const face = MeshBuilder.CreateGround(
        `${table.id} card ${i + 1} face`,
        { width: 0.22, height: 0.31 },
        this.scene,
      );
      face.position.set(x + (i - 2) * 0.28, 0.8705, z - 0.36);
      face.material = material;
      face.isPickable = false;
      face.receiveShadows = true;
      this.pokerCards.push({
        table: table.id,
        index: i,
        key: "back",
        texture,
        material,
      });
    }
  }
  private async loadPokerAssets() {
    const asset = await LoadAssetContainerAsync(
      "/models/poker-table.glb",
      this.scene,
    );
    if (this.scene.isDisposed) {
      asset.dispose();
      return;
    }
    this.weaponAssets.push(asset);
    for (const mesh of asset.meshes) {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      const material = mesh.material as unknown as {
        maxSimultaneousLights?: number;
      };
      if (material && "maxSimultaneousLights" in material)
        material.maxSimultaneousLights = 8;
    }
    for (const table of POKER_TABLES) {
      const root = new TransformNode(`${table.id} detailed table`, this.scene);
      root.position.set(table.x, 0, table.z);
      const imported = asset.instantiateModelsToScene(
        (name) => `${table.id}:${name}`,
        false,
        { doNotInstantiate: false },
      );
      for (const node of imported.rootNodes) node.parent = root;
      for (const mesh of root.getChildMeshes()) {
        mesh.isPickable = false;
        this.shadows[0].addShadowCaster(mesh, false);
      }
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
        const variant = (i + (side > 0 ? 1 : 0)) % 2 ? "burgundy" : "emerald";
        const root = new TransformNode(
          `slot ${this.slotPlacements.length + 1} ${variant}`,
          this.scene,
        );
        root.position.set(x + side * (w / 2 - 0.7), 0.16, zz);
        // Blender export faces +Z; both banks face outward toward their aisles.
        root.rotation.y = (side * Math.PI) / 2;
        this.slotPlacements.push({ root, variant });
      }
  }
  private async loadSlotAssets() {
    await Promise.all(
      (["emerald", "burgundy"] as const).map(async (variant) => {
        const asset = await LoadAssetContainerAsync(
          `/models/slot-machine-${variant}.glb`,
          this.scene,
        );
        if (this.scene.isDisposed) {
          asset.dispose();
          return;
        }
        this.weaponAssets.push(asset);
        // InstancedMesh inherits shadow reception from its source mesh.
        for (const mesh of asset.meshes) {
          mesh.isPickable = false;
          mesh.receiveShadows = true;
          const material = mesh.material as unknown as {
            maxSimultaneousLights?: number;
          };
          if (material && "maxSimultaneousLights" in material)
            material.maxSimultaneousLights = 8;
        }
        for (const { root, variant: placedVariant } of this.slotPlacements) {
          if (placedVariant !== variant) continue;
          // Share geometry and materials across the six cabinets of each style.
          const imported = asset.instantiateModelsToScene(
            (name) => `${root.name}:${name}`,
            false,
            { doNotInstantiate: false },
          );
          for (const node of imported.rootNodes) node.parent = root;
          for (const mesh of root.getChildMeshes()) {
            mesh.isPickable = false;
            this.shadows[0].addShadowCaster(mesh, false);
          }
        }
      }),
    );
  }
  private async loadTableAssets() {
    await Promise.all(
      ["craps-table", "roulette-table", "ivory-die-a", "ivory-die-b"].map(
        async (name, i) => {
          const asset = await LoadAssetContainerAsync(
            `/models/${name}.glb`,
            this.scene,
          );
          if (this.scene.isDisposed) {
            asset.dispose();
            return;
          }
          this.weaponAssets.push(asset);
          const imported = asset.instantiateModelsToScene(
            (n) => `${name}:${n}`,
            false,
            { doNotInstantiate: true },
          );
          const placement = new TransformNode(name + " placement", this.scene);
          placement.position.set(35, 0, i === 1 ? 5 : -3);
          for (const root of imported.rootNodes) root.parent = placement;
          if (i >= 2) {
            // Rotate inside glTF's conversion root so the documented pip faces stay correct.
            const conversion = imported.rootNodes[0] as TransformNode;
            const die = new TransformNode(name + " animated", this.scene);
            die.parent = conversion;
            const children = conversion.getChildren();
            for (const child of children) if (child !== die) child.parent = die;
            die.position.set(i === 2 ? -0.27 : 0.28, 0.8601, -0.1);
            this.diceMeshes[i - 2] = die;
          }
          for (const node of placement.getDescendants()) {
            if (node.name === `${name}:roulette_wheel`)
              this.rouletteWheel = node as TransformNode;
            if (node.name === `${name}:roulette_ball`)
              this.rouletteBall = node as TransformNode;
            if (node.name.includes("Presentation red die"))
              node.setEnabled(false);
          }
          for (const mesh of placement.getChildMeshes()) {
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            const material = mesh.material as unknown as {
              maxSimultaneousLights?: number;
            };
            if (material && "maxSimultaneousLights" in material)
              material.maxSimultaneousLights = 8;
            for (const shadow of this.shadows)
              shadow.addShadowCaster(mesh, false);
          }
        },
      ),
    );
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
        const firstPerson = asset.instantiateModelsToScene(
          (n) => `${id}-${n}`,
          false,
          { doNotInstantiate: true },
        );
        for (const root of firstPerson.rootNodes) root.parent = this.guns[id];
        const hands = await LoadAssetContainerAsync(
          `/models/hands-${id}.glb`,
          this.scene,
        );
        if (this.scene.isDisposed) {
          hands.dispose();
          return;
        }
        this.weaponAssets.push(hands);
        const grip = hands.instantiateModelsToScene(
          (n) => `${id}-grip-${n}`,
          false,
          { doNotInstantiate: true },
        );
        for (const root of grip.rootNodes) root.parent = this.guns[id];
        this.handParts[id] = this.guns[id]
          .getDescendants()
          .filter((n) => n.name === `${id}-grip-LeftHand`)
          .map((n) => ({
            node: n as TransformNode,
            rest: (n as TransformNode).position.clone(),
          }));
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
    this.handLight.includedOnlyMeshes = WEAPON_ORDER.flatMap((id) =>
      this.guns[id].getChildMeshes(),
    );
    for (const mesh of this.handLight.includedOnlyMeshes) {
      const material = mesh.material as unknown as {
        maxSimultaneousLights?: number;
      };
      if (material && "maxSimultaneousLights" in material)
        material.maxSimultaneousLights = 8;
    }
  }
  private weapon(id: WeaponId) {
    const root = new TransformNode(id, this.scene);
    root.parent = this.gun;
    return root;
  }
  private zombie(id: number): ZombieView {
    this.zombieShadows.set(id, new Set());
    return createCharacter(this.scene, id);
  }
  shot(id: WeaponId) {
    this.gunKick =
      id === "revolver"
        ? 0.115
        : id === "shotgun"
          ? 0.12
          : id === "rifle"
            ? 0.085
            : id === "smg"
              ? 0.035
              : 0.055;
    this.flashTime = 0.045;
    this.flash.position.set(
      0,
      id === "revolver" ? 0.07 : 0.03,
      id === "shotgun" || id === "rifle"
        ? 0.65
        : id === "revolver"
          ? 0.307
          : id === "smg"
            ? 0.4
            : 0.24,
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
    this.muzzleLight.position.copyFrom(
      this.camera.position.add(
        this.camera.getForwardRay(1).direction.scale(0.8),
      ),
    );
    this.muzzleLight.intensity = this.flash.isVisible ? 3.5 : 0;
    this.impactTime -= dt;
    this.impact.isVisible = this.impactTime > 0;
    const bob =
      sim.moving && sim.phase === "playing"
        ? Math.sin(sim.time * (sim.sprinting ? 15 : 10)) * 0.012
        : 0;
    this.gun.position.set(0.29, -0.21 + bob, 0.61 - this.gunKick);
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
    for (const hand of this.handParts[sim.weapon] ?? []) {
      hand.node.position.copyFrom(hand.rest);
      if (sim.reloadRemaining > 0) {
        const reach = Math.sin(reloadProgress * Math.PI);
        hand.node.position.y -= reach * 0.12;
        hand.node.position.z -= reach * 0.1;
      } else if (sim.weapon === "shotgun")
        hand.node.position.z -= this.gunKick * 0.5;
    }
    for (const card of this.pokerCards) {
      const state = sim.pokerTables[card.table];
      const value = state.hand[card.index];
      const key = value ? `${value.suit}-${value.rank}` : "back";
      if (key !== card.key) {
        paintPlayingCard(
          card.texture.getContext() as CanvasRenderingContext2D,
          value,
        );
        card.texture.update();
        card.key = key;
      }
      card.material.emissiveColor.set(
        state.completed ? 0.2 : 0.08,
        state.completed ? 0.16 : 0.08,
        0.065,
      );
    }
    const roulettePose = this.rouletteMotion.update(
      sim,
      sim.roulette,
      ROULETTE_RULES.spinDuration,
    );
    if (this.rouletteWheel) {
      this.rouletteWheel.rotationQuaternion = null;
      this.rouletteWheel.rotation.y = roulettePose.wheelAngle;
    }
    if (this.rouletteBall) {
      // Both nodes remain beneath glTF's conversion root. In these coordinates,
      // a wheel pocket at angle alpha rotates to alpha - wheel.rotation.y.
      this.rouletteBall.position.set(
        ROULETTE_GEOMETRY.centerX +
          Math.cos(roulettePose.ballAngle) * roulettePose.ballRadius,
        roulettePose.ballHeight,
        ROULETTE_GEOMETRY.centerZ +
          Math.sin(roulettePose.ballAngle) * roulettePose.ballRadius,
      );
    }
    const faces = [
      Quaternion.Identity(),
      Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2),
      Quaternion.RotationAxis(Vector3.Forward(), Math.PI / 2),
      Quaternion.RotationAxis(Vector3.Forward(), -Math.PI / 2),
      Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2),
      Quaternion.RotationAxis(Vector3.Right(), Math.PI),
    ];
    this.diceMeshes.forEach((die, i) => {
      const rolling = !!sim.dice && !sim.dice.resolved;
      const progress = sim.dice ? 1 - sim.dice.remaining / 1.6 : 1;
      die.position.y =
        0.8601 +
        (rolling
          ? Math.abs(Math.sin(progress * Math.PI * 4)) * (1 - progress) * 0.38
          : 0);
      die.position.z = -0.1 + (rolling ? (1 - progress) * 0.6 : 0);
      die.rotationQuaternion = rolling
        ? Quaternion.RotationYawPitchRoll(
            progress * 17 + i,
            progress * 23,
            progress * 14,
          )
        : faces[(sim.dice?.values[i] ?? (i ? 4 : 3)) - 1];
    });
    if (this.bartender) {
      this.bartender.arms[0].rotation.x =
        -1.3 + Math.sin(this.time * 1.5) * 0.045;
      this.bartender.arms[1].rotation.x =
        -1.35 + Math.sin(this.time * 1.5 + 1) * 0.08;
      this.bartender.root.rotation.y = Math.sin(this.time * 0.3) * 0.035;
    }
    this.gun.setEnabled(sim.phase !== "ready");
    for (const id of [
      "lounge",
      "shortcut",
      "vip",
      "vipExit",
      "tables",
      "tablesExit",
    ] as const) {
      const open =
        id === "vipExit" ? sim.vip : id === "tablesExit" ? sim.tables : sim[id];
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
        this.zombieShadows.delete(id);
      }
    for (const e of sim.enemies) {
      if (e.health <= 0) continue;
      let v = this.zombies.get(e.id);
      if (!v) {
        v = this.zombie(e.id);
        this.zombies.set(e.id, v);
      }
      const membership = this.zombieShadows.get(e.id)!;
      for (const shadow of this.shadows) {
        const light = shadow.getLight().position;
        const nearby = Math.hypot(e.x - light.x, e.z - light.z) < 12;
        if (nearby === membership.has(shadow)) continue;
        for (const mesh of v.root.getChildMeshes()) {
          if (nearby) shadow.addShadowCaster(mesh, false);
          else shadow.removeShadowCaster(mesh, false);
        }
        if (nearby) membership.add(shadow);
        else membership.delete(shadow);
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
