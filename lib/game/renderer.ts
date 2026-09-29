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
import { LOUNGE_RECTS } from "./lounge-layout";
import { SERVICE_RECTS } from "./service-layout";
import { buildLoungeDecor } from "./lounge-decor";
import { createZombie, loadZombieAsset, animateZombie } from "./zombies";
import { slotCabinetsForIsland } from "./slot-machines";
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
  type Rect,
} from "./simulation";
import "@babylonjs/core/Culling/ray";
import { buildHotel } from "./hotel-scene";

type ZombieView = ReturnType<typeof createZombie>;
export class GameRenderer {
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  gun: TransformNode;
  guns: Record<WeaponId, TransformNode>;
  flash: Mesh;
  ready: Promise<void>;
  private weaponAssets: AssetContainer[] = [];
  private hotel: ReturnType<typeof buildHotel>;
  private couchFallback?: TransformNode;
  private slotPlacements: {
    root: TransformNode;
    variant: "emerald" | "burgundy";
  }[] = [];
  private displays: Partial<Record<WeaponId, TransformNode>> = {};
  private movingParts: Partial<
    Record<WeaponId, { node: TransformNode; y: number; z: number }[]>
  > = {};
  private bartender?: ReturnType<typeof createCharacter>;
  private zombieAsset?: Awaited<ReturnType<typeof loadZombieAsset>>;
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
  private loungeAccentLights: (PointLight | SpotLight)[] = [];
  private loungeShadow?: ShadowGenerator;
  private serviceAccentLights: (PointLight | SpotLight)[] = [];
  private serviceShadow?: ShadowGenerator;
  private serviceFallbacks = new Map<"truck" | "props", TransformNode>();
  private gunKick = 0;
  private knifeModel?: TransformNode;
  private grenadeMeshes = new Map<number, Mesh>();
  private blastMeshes = new Map<number, Mesh>();
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
    this.engine.maxFPS = 15;
    this.engine.renderEvenInBackground = false;
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
      new Vector3(10, 3.6, -4.6),
      this.scene,
    );
    lounge.diffuse = new Color3(1, 0.72, 0.45);
    lounge.intensity = 1.25;
    lounge.range = 12;
    const backbar = new PointLight("Last Call shelf glow", new Vector3(12, 2.55, -10.55), this.scene);
    backbar.diffuse = new Color3(1, 0.67, 0.32);
    backbar.intensity = 1.1;
    backbar.range = 7;
    backbar.renderPriority = 2;
    this.loungeAccentLights.push(backbar);
    for (const [x, z] of [
      [-6, 0],
      [22, 1],
      [35, 0],
      [10, -4.6],
    ]) {
      const key = new SpotLight(
        "chandelier pool",
        new Vector3(x, 4.55, z),
        new Vector3(0.08, -1, 0.04),
        2.35,
        1.35,
        this.scene,
      );
      if (x === 10) {
        key.renderPriority = 1;
        this.loungeAccentLights.push(key);
      }
      key.diffuse = new Color3(1, 0.8, 0.5);
      key.intensity = 2.8;
      key.range = 18;
      key.shadowMinZ = 0.3;
      key.shadowMaxZ = 18;
      const shadow = new ShadowGenerator(1024, key);
      if (x === 10) this.loungeShadow = shadow;
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
    this.hotel = buildHotel(this.scene);
    this.serviceLighting();
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
      tommy: this.weapon("tommy"),
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
      this.hotel.ready,
      this.loadWeaponAssets(),
      this.loadTableAssets(),
      this.loadSlotAssets(),
      this.loadPokerAssets(),
      this.loadLoungeAssets(),
      this.loadServiceAsset("truck"),
      this.loadServiceAsset("props"),
      this.loadCouchAsset(),
      loadZombieAsset().then((asset) => {
        this.zombieAsset = asset;
      }),
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
    this.box(
      "staff floor",
      10,
      -0.006,
      7.5,
      11.5,
      0.035,
      8.8,
      this.mat("service concrete", "#626b62"),
    );
    const concreteJoint = this.mat("service expansion joints", "#3d4840");
    for (let x = 7; x < 16; x += 3)
      this.box("concrete joint", x, 0.013, 7.5, 0.018, 0.005, 8.8, concreteJoint);
    for (let z = 6; z < 12; z += 3)
      this.box("concrete joint", 10, 0.014, z, 11.5, 0.005, 0.018, concreteJoint);
    this.serviceFallback();
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
      if (r.id.startsWith("hotel-")) continue;
      if (LOUNGE_RECTS.some((furniture) => furniture.id === r.id)) continue;
      if (SERVICE_RECTS.some((fixture) => fixture.id === r.id)) continue;
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
        this.slotIsland(r);
        continue;
      }
      if (r.id.startsWith("poker")) {
        this.pokerTable(r.x, r.z);
        continue;
      }
      if (r.id === "vip-sofa") {
        // Keep the loading fallback out of the merged room scenery so it can
        // be removed after the detailed couch has loaded successfully.
        const fallback = new TransformNode(
          "VIP couch loading fallback",
          this.scene,
        );
        this.couchFallback = fallback;
        this.box("sofa base", r.x, 0.26, r.z, r.w, 0.4, r.d, wood, fallback);
        this.box(
          "tufted sofa back",
          r.x + 0.4,
          0.8,
          r.z,
          0.3,
          0.8,
          r.d,
          burgundy,
          fallback,
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
            fallback,
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
            fallback,
          );
        }
        for (const mesh of fallback.getChildMeshes()) {
          mesh.isPickable = false;
          for (const shadow of this.shadows) shadow.addShadowCaster(mesh, false);
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
        r.id === "cashier" ? wood : wall,
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
      if (id === "hotel") continue; // Hotel builder owns this north-facing entrance.
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
    this.label("main sign", "LAST JACKPOT", -4, 3.5, -11.9, 7, 1.1, "#d9bd77", Math.PI);
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
      12,
      4.03,
      -11.79,
      5.5,
      0.5,
      "#cead72",
      Math.PI,
    );
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
    SPAWNS.forEach((p, i) => {
      // This entry is concealed behind the new back bar; its spawn lane stays open.
      if (i === 3) return;
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
    this.serviceWallFinish();
    buildLoungeDecor(this.scene);
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
  private serviceWallFinish() {
    const plaster = this.mat("service worn plaster", "#ffffff");
    const texture = new DynamicTexture("service plaster wear", { width: 256, height: 512 }, this.scene, true);
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#858e7e";
    ctx.fillRect(0, 0, 256, 512);
    // Small, repeatable stains give the utility finish scale without external textures.
    for (let i = 0; i < 280; i++) {
      const x = (i * 83) % 256, y = (i * 137) % 512;
      ctx.fillStyle = i % 2 ? "rgba(33,49,38,.045)" : "rgba(204,208,184,.045)";
      ctx.fillRect(x, y, 2 + i % 6, 4 + i % 21);
    }
    texture.update();
    texture.anisotropicFilteringLevel = 8;
    plaster.diffuseTexture = texture;
    plaster.specularColor = Color3.Black();
    const dado = this.mat("service painted steel dado", "#435c51");
    const seam = this.mat("service panel seams", "#293b34");
    const metal = this.mat("service kickplate", "#6b7970");
    // Only the inward-facing solid sections are clad; all door openings remain clear.
    const panels = [
      { x: 4.285, z: 5.15, length: 3.7, alongX: false, inward: 1 },
      { x: 4.285, z: 11.1, length: 1.8, alongX: false, inward: 1 },
      { x: 15.715, z: 5.15, length: 3.7, alongX: false, inward: -1 },
      { x: 15.715, z: 11.1, length: 1.8, alongX: false, inward: -1 },
      { x: 7.14, z: 3.263, length: 5.72, alongX: true, inward: 1 },
      { x: 14.56, z: 3.263, length: 2.32, alongX: true, inward: 1 },
      { x: 10, z: 11.93, length: 11.43, alongX: true, inward: -1 },
    ];
    for (const { x, z, length, alongX, inward } of panels) {
      const w = alongX ? length : 0.025, d = alongX ? 0.025 : length;
      this.box("service wall upper finish", x, 3.22, z, w, 3.15, d, plaster);
      this.box("service wall lower finish", x, 0.83, z, w, 1.66, d, dado);
      for (const [y, h] of [[0.1, 0.18], [1.67, 0.045]])
        this.box("service wall protective trim", x, y, z,
          w + (alongX ? 0 : 0.013), h, d + (alongX ? 0.013 : 0), metal);
      for (let offset = -length / 2 + 1.1; offset < length / 2 - 0.08; offset += 1.1) {
        const px = x + (alongX ? offset : inward * 0.018);
        const pz = z + (alongX ? inward * 0.018 : offset);
        this.box("service dado seam", px, 0.9, pz,
          alongX ? 0.012 : 0.005, 1.45, alongX ? 0.005 : 0.012, seam);
        for (const y of [0.28, 1.48])
          this.box("service panel fastener", px, y, pz,
            alongX ? 0.028 : 0.008, 0.028, alongX ? 0.008 : 0.028, metal);
      }
    }
  }
  private serviceFallback() {
    const paint = this.mat("service fallback truck paint", "#9a8a66");
    const cardboard = this.mat("service fallback cartons", "#97724b");
    const steel = this.mat("service fallback steel", "#52645e");
    const rubber = this.mat("service fallback rubber", "#151b19");
    const glass = this.mat("service fallback glass", "#253e40");
    for (const kind of ["truck", "props"] as const) {
      const root = new TransformNode(`Service ${kind} loading fallback`, this.scene);
      this.serviceFallbacks.set(kind, root);
      for (const rect of SERVICE_RECTS.filter((r) => (r.id === "service-truck") === (kind === "truck"))) {
        const material = rect.id.includes("cartons") || rect.id.includes("pallet") ? cardboard : steel;
        this.box(`${rect.id} fallback`, rect.x, rect.h / 2, rect.z, rect.w, rect.h, rect.d,
          kind === "truck" ? paint : material, root);
        if (kind === "truck") {
          this.box("fallback truck windshield", rect.x - rect.w / 2 - 0.005, 2.05, rect.z,
            0.015, 0.6, 1.85, glass, root);
          for (const x of [rect.x - 1.8, rect.x + 1.7]) {
            for (const side of [-1, 1]) {
              const wheel = this.cylinder("fallback truck wheel", x, 0.42,
                rect.z + side * (rect.d / 2 - 0.15), 0.8, 0.25, rubber);
              wheel.parent = root;
              wheel.rotation.x = Math.PI / 2;
            }
          }
        } else {
          this.box(`${rect.id} fallback band`, rect.x, rect.h * 0.55, rect.z,
            rect.w + 0.005, 0.055, rect.d + 0.005, rubber, root);
        }
      }
      for (const mesh of root.getChildMeshes()) mesh.isPickable = false;
    }
  }
  private serviceLighting() {
    // The loading bay has its own bounded pool; the lounge chandelier cannot
    // reach around the staff partition. One map serves both imported assets.
    const key = new SpotLight("Service loading bay work light", new Vector3(10, 4.48, 8.4),
      new Vector3(0, -1, -0.12), 2.5, 1.2, this.scene);
    key.diffuse = new Color3(0.83, 0.93, 1);
    key.intensity = 2.15;
    key.range = 13;
    key.renderPriority = 3;
    key.shadowMinZ = 0.3;
    key.shadowMaxZ = 13;
    const shadow = new ShadowGenerator(1024, key);
    shadow.usePercentageCloserFiltering = true;
    shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadow.bias = 0.002;
    shadow.normalBias = 0.025;
    shadow.setDarkness(0.18);
    this.serviceShadow = shadow;
    // Keep this map out of the general scenery list: unrelated table, couch,
    // and wall-weapon loaders register their meshes with every general map.
    const fill = new PointLight("Service storage warm bounce", new Vector3(14.7, 3.55, 10.4), this.scene);
    fill.diffuse = new Color3(1, 0.83, 0.59);
    fill.intensity = 0.65;
    fill.range = 8;
    fill.renderPriority = 2;
    this.serviceAccentLights.push(key, fill);
    const receivers = this.scene.meshes.filter((mesh) => mesh.name.startsWith("scenery: service "));
    const fallbacks = [...this.serviceFallbacks.values()].flatMap((root) => root.getChildMeshes());
    for (const light of this.serviceAccentLights) light.includedOnlyMeshes = [...receivers, ...fallbacks];
    for (const mesh of fallbacks) shadow.addShadowCaster(mesh, false);
  }
  private async loadServiceAsset(kind: "truck" | "props") {
    let asset: AssetContainer | undefined;
    try {
      asset = await LoadAssetContainerAsync(`/models/service-${kind}.glb`, this.scene);
      if (this.scene.isDisposed) {
        asset.dispose();
        return;
      }
      // These exports are already placed in world space. Keep the glTF root,
      // including its handedness transform, to preserve normals and winding.
      asset.addAllToScene();
      for (const mesh of asset.meshes) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        const material = mesh.material as unknown as { maxSimultaneousLights?: number };
        if (material && "maxSimultaneousLights" in material) material.maxSimultaneousLights = 8;
        for (const texture of mesh.material?.getActiveTextures() ?? []) texture.anisotropicFilteringLevel = 8;
        if (mesh.getTotalVertices() > 0) {
          this.serviceShadow?.addShadowCaster(mesh, false);
          mesh.freezeWorldMatrix();
        }
      }
      for (const light of this.serviceAccentLights) light.includedOnlyMeshes.push(...asset.meshes);
      const fallback = this.serviceFallbacks.get(kind);
      if (fallback) {
        const meshes = fallback.getChildMeshes();
        for (const mesh of meshes) this.serviceShadow?.removeShadowCaster(mesh, false);
        for (const light of this.serviceAccentLights)
          light.includedOnlyMeshes = light.includedOnlyMeshes.filter((mesh) => !meshes.includes(mesh));
        fallback.dispose();
        this.serviceFallbacks.delete(kind);
      }
      this.weaponAssets.push(asset);
    } catch (error) {
      if (asset) {
        const meshes = asset.meshes;
        for (const light of this.serviceAccentLights)
          light.includedOnlyMeshes = light.includedOnlyMeshes.filter((mesh) => !meshes.includes(mesh));
        for (const mesh of asset.meshes) this.serviceShadow?.removeShadowCaster(mesh, false);
        asset.dispose();
      }
      if (!this.scene.isDisposed) console.warn(`Detailed service ${kind} unavailable; keeping the fallback.`, error);
    }
  }
  private async loadLoungeAssets() {
    const asset = await LoadAssetContainerAsync("/models/last-call-lounge.glb", this.scene);
    if (this.scene.isDisposed) {
      asset.dispose();
      return;
    }
    this.weaponAssets.push(asset);
    asset.addAllToScene();
    // Accent lights affect this room only, and rank ahead of distant casino lights.
    // Otherwise the eight-light material cap silently drops the lounge shadow light.
    const litMeshes = [
      ...asset.meshes,
      ...this.scene.meshes.filter((mesh) => mesh.name.startsWith("scenery: Last Call")),
      ...(this.bartender?.root.getChildMeshes() ?? []),
    ];
    for (const light of this.loungeAccentLights) light.includedOnlyMeshes = [...litMeshes];
    // The export is baked to world placement, including glTF's handedness conversion.
    // Retain the loader root so winding and normals remain correct.
    for (const mesh of asset.meshes) {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      const material = mesh.material as unknown as { maxSimultaneousLights?: number };
      if (material && "maxSimultaneousLights" in material) material.maxSimultaneousLights = 8;
      if (mesh.getTotalVertices() > 0) {
        this.loungeShadow?.addShadowCaster(mesh, false);
        mesh.freezeWorldMatrix();
      }
    }
  }
  private async loadCouchAsset() {
    const footprint = STATIC_RECTS.find((rect) => rect.id === "vip-sofa")!;
    let asset: AssetContainer | undefined;
    let placement: TransformNode | undefined;
    try {
      asset = await LoadAssetContainerAsync("/models/vip-couch.glb", this.scene);
      if (this.scene.isDisposed) {
        asset.dispose();
        return;
      }
      placement = new TransformNode("VIP couch placement", this.scene);
      placement.position.set(footprint.x, 0, footprint.z);
      // The glTF conversion root preserves +Z forward in this left-handed
      // scene. Turn the couch toward the card tables to the west (-X).
      placement.rotation.y = -Math.PI / 2;
      const imported = asset.instantiateModelsToScene(
        (name) => `VIP couch:${name}`,
        false,
        { doNotInstantiate: true },
      );
      for (const node of imported.rootNodes) node.parent = placement;
      for (const mesh of placement.getChildMeshes()) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        const material = mesh.material as unknown as {
          maxSimultaneousLights?: number;
        };
        if (material && "maxSimultaneousLights" in material)
          material.maxSimultaneousLights = 8;
        for (const shadow of this.shadows) shadow.addShadowCaster(mesh, false);
        mesh.freezeWorldMatrix();
      }
      this.weaponAssets.push(asset);
      if (this.couchFallback) {
        for (const mesh of this.couchFallback.getChildMeshes())
          for (const shadow of this.shadows)
            shadow.removeShadowCaster(mesh, false);
        this.couchFallback.dispose();
        this.couchFallback = undefined;
      }
    } catch (error) {
      placement?.dispose();
      asset?.dispose();
      // A missing optional furnishing must not prevent the game from starting.
      if (!this.scene.isDisposed)
        console.warn(
          "Detailed VIP couch unavailable; keeping the fallback.",
          error,
        );
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
  private slotIsland(island: Rect) {
    const { x, z, w, d } = island;
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
    for (const cabinet of slotCabinetsForIsland(island)) {
      const variant = cabinet.modelVariant;
      const root = new TransformNode(
        `slot ${this.slotPlacements.length + 1} ${variant}`,
        this.scene,
      );
      root.position.set(cabinet.rootX, 0.16, cabinet.rootZ);
      // Blender export faces +Z; both banks face outward toward their aisles.
      root.rotation.y = (cabinet.side * Math.PI) / 2;
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
    return createZombie(this.scene, id, this.zombieAsset!);
  }
  shot(id: WeaponId) {
    this.gunKick =
      id === "revolver"
        ? 0.115
        : id === "shotgun"
          ? 0.12
          : id === "rifle"
            ? 0.085
            : id === "tommy"
              ? 0.05
            : id === "smg"
              ? 0.035
              : 0.055;
    this.flashTime = 0.045;
    this.flash.position.set(
      0,
      id === "revolver" ? 0.07 : id === "tommy" ? 0.025 : 0.03,
      id === "shotgun" || id === "rifle"
        ? 0.65
        : id === "revolver"
          ? 0.307
          : id === "tommy"
            ? 0.48
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
  private updateEquipment(sim: Simulation) {
    if (!this.knifeModel) {
      const knife = new TransformNode("combat knife", this.scene);
      knife.parent = this.camera;
      const part = (name: string, size: number[], pos: number[], material: StandardMaterial) => {
        const mesh = MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},this.scene);
        mesh.parent=knife;mesh.position.set(pos[0],pos[1],pos[2]);mesh.material=material;
        mesh.isPickable=false;mesh.renderingGroupId=1;
        return mesh;
      };
      part("ribbed knife grip",[.065,.07,.19],[0,0,0],this.mat("knife grip","#292d26"));
      part("steel guard",[.18,.035,.035],[0,0,.11],this.mat("knife steel","#a6b5b3",.1));
      const blade=MeshBuilder.CreateCylinder("tapered blade",{diameterTop:0,diameterBottom:.11,height:.34,tessellation:4},this.scene);
      blade.parent=knife;blade.rotation.x=Math.PI/2;blade.position.z=.29;blade.scaling.z=.16;
      blade.material=this.mat("knife steel","#a6b5b3",.1);blade.renderingGroupId=1;blade.isPickable=false;
      part("gloved knife hand",[.105,.095,.13],[0,-.045,-.035],this.mat("knife glove","#69503a"));
      part("knife sleeve",[.12,.13,.22],[0,-.075,-.18],this.mat("knife sleeve","#283b31"));
      this.knifeModel=knife;
    }
    const slash=sim.knifeRemaining>0;
    this.knifeModel.setEnabled(slash);
    if (slash) {
      const progress=1-sim.knifeRemaining/.55;
      const swing=Math.sin(progress*Math.PI);
      this.knifeModel.position.set(.4-swing*.62,-.3+swing*.17,.5+swing*.3);
      this.knifeModel.rotation.set(-.2,.65-swing*1.2,-.4+swing*.65);
    }
    for(const [id,mesh] of this.grenadeMeshes) if(!sim.projectiles.some(g=>g.id===id)) {
      mesh.dispose();this.grenadeMeshes.delete(id);
    }
    for(const g of sim.projectiles) {
      let mesh=this.grenadeMeshes.get(g.id);
      if(!mesh) {
        mesh=MeshBuilder.CreateSphere("thrown grenade",{diameter:.17,segments:12},this.scene);
        mesh.scaling.y=1.2;mesh.material=this.mat("grenade casing","#52613a");mesh.isPickable=false;
        const cap=MeshBuilder.CreateBox("grenade fuse",{width:.05,height:.06,depth:.05},this.scene);
        cap.parent=mesh;cap.position.y=.095;cap.material=this.mat("grenade fuse","#eb9d43",.5);cap.isPickable=false;
        this.grenadeMeshes.set(g.id,mesh);
      }
      mesh.position.set(g.x,g.y,g.z);mesh.rotation.set(sim.time*7,0,sim.time*4);
    }
    for(const [id,mesh] of this.blastMeshes) if(!sim.explosions.some(g=>g.id===id)) {
      mesh.material?.dispose();mesh.dispose();this.blastMeshes.delete(id);
    }
    for(const blast of sim.explosions) {
      let mesh=this.blastMeshes.get(blast.id);
      if(!mesh) {
        mesh=MeshBuilder.CreateSphere("grenade blast",{diameter:1,segments:16},this.scene);
        const material=new StandardMaterial("blast flash",this.scene);
        material.emissiveColor.set(1,.35,.035);material.disableLighting=true;
        mesh.material=material;mesh.isPickable=false;this.blastMeshes.set(blast.id,mesh);
      }
      const progress=1-blast.remaining/.5;
      mesh.position.set(blast.x,Math.max(.15,blast.y),blast.z);
      mesh.scaling.setAll(.2+progress*8);
      (mesh.material as StandardMaterial).alpha=(1-progress)*.65;
    }
  }
  update(sim: Simulation, dt: number) {
    this.hotel.update(sim);
    this.updateEquipment(sim);
    this.time += dt;
    this.camera.position.set(
      sim.player.x,
      (sim.player.y ?? 0) + 1.65 +
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
    this.gun.position.y -= sim.grenadeCooldown > 0 ? Math.sin(sim.grenadeCooldown/.65*Math.PI)*.25 : 0;
    for (const id of WEAPON_ORDER) this.guns[id].setEnabled(sim.weapon === id && sim.knifeRemaining <= 0);
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
    const characterShadows = this.serviceShadow ? [...this.shadows, this.serviceShadow] : this.shadows;
    const active = new Set(
      sim.enemies.filter((e) => e.health > 0).map((e) => e.id),
    );
    for (const [id, v] of this.zombies)
      if (!active.has(id)) {
        const meshes = v.root.getChildMeshes();
        for (const light of [...this.loungeAccentLights, ...this.serviceAccentLights])
          light.includedOnlyMeshes = light.includedOnlyMeshes.filter((mesh) => !meshes.includes(mesh));
        for (const generator of characterShadows)
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
      if (!this.zombieAsset) continue;
      let v = this.zombies.get(e.id);
      if (!v) {
        v = this.zombie(e.id);
        this.zombies.set(e.id, v);
      }
      const meshes = v.root.getChildMeshes();
      const atCasinoLevel = Math.abs(e.y ?? 0) < 0.2;
      const inLounge = atCasinoLevel && e.x > 4 && e.x < 16 && e.z > -12 && e.z < 3;
      for (const light of this.loungeAccentLights) {
        if (inLounge === light.includedOnlyMeshes.includes(meshes[0])) continue;
        if (inLounge) light.includedOnlyMeshes.push(...meshes);
        else light.includedOnlyMeshes = light.includedOnlyMeshes.filter((mesh) => !meshes.includes(mesh));
      }
      const inService = atCasinoLevel && e.x > 4 && e.x < 16 && e.z > 3 && e.z < 12;
      for (const light of this.serviceAccentLights) {
        if (inService === light.includedOnlyMeshes.includes(meshes[0])) continue;
        if (inService) light.includedOnlyMeshes.push(...meshes);
        else light.includedOnlyMeshes = light.includedOnlyMeshes.filter((mesh) => !meshes.includes(mesh));
      }
      const membership = this.zombieShadows.get(e.id)!;
      for (const shadow of characterShadows) {
        const light = shadow.getLight().position;
        const nearby = shadow === this.serviceShadow ? inService : Math.hypot(e.x - light.x, e.z - light.z) < 12;
        if (nearby === membership.has(shadow)) continue;
        for (const mesh of v.root.getChildMeshes()) {
          if (nearby) shadow.addShadowCaster(mesh, false);
          else shadow.removeShadowCaster(mesh, false);
        }
        if (nearby) membership.add(shadow);
        else membership.delete(shadow);
      }
      animateZombie(v, e);
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
    this.hotel.dispose();
    for (const asset of this.weaponAssets) asset.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
