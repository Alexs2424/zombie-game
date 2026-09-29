import { buildTestRange } from './test-range-scene';
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
import { Frustum } from "@babylonjs/core/Maths/math.frustum";
import type { Plane } from "@babylonjs/core/Maths/math.plane";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
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
import { SERVICE_FINISH, SERVICE_RECTS, SERVICE_WALL_PANELS } from "./service-layout";
import { buildLoungeDecor } from "./lounge-decor";
import {
  CASINO_ROOMS,
  CRAPS_TABLES,
  ROULETTE_TABLES,
  LOUNGE_OFFSET,
  SERVICE_OFFSET,
} from "./casino-layout";
import { createZombie, loadZombieAsset, animateZombie, animateZombieDeath } from "./zombies";
import { slotCabinetsForIsland } from "./slot-machines";
import { CasinoVisuals } from "./casino-visuals";
import { CASINO_SECRET_ANCHORS } from "./casino";
import { aimPose } from "./weapon-aim";
import { createExplosion } from "./explosion-visuals";
import { VIEWMODELS } from "./weapon-viewmodels";
import { ViewmodelState, WeaponRig } from "./weapon-rig";
import { AXE_CABINET, meleeDuration } from "./weapon-expansion";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import {
  Simulation,
  STATIC_RECTS,
  DOORS,
  PURCHASES,
  PRICES,
  ROULETTE_RULES,
  WEAPONS,
  WEAPON_ORDER,
  MYSTERY_WEAPONS,
  type WeaponId,
  type Rect,
  type GameEvent,
} from "./simulation";
import "@babylonjs/core/Culling/ray";
import { buildHotel } from "./hotel-scene";
import { intersectsShadowFrustum } from "./shadow-culling";

type ZombieView = ReturnType<typeof createZombie>;
export class GameRenderer {
  aimBlend = 0;
  private aimedWeapon = "";
  private reloadRecover = 0;
  private wasReloading = false;
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  gun: TransformNode;
  guns: Record<WeaponId, TransformNode>;
  flash: Mesh;
  ready: Promise<void>;
  private weaponAssets: AssetContainer[] = [];
  private ammoDisplayFallback?: TransformNode;
  private planterFallbacks = new Map<string, { root: TransformNode; footprint: Rect }>();
  private hotel: ReturnType<typeof buildHotel>;
  private couchFallbacks = new Map<string, {
    root: TransformNode;
    footprint: Rect;
    yaw: number;
  }>();
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
  private casino: CasinoVisuals;
  private handLight: PointLight;
  private muzzleLight: PointLight;
  private rouletteViews = new Map<string, {
    wheel?: TransformNode;
    ball?: TransformNode;
    motion: RouletteMotion;
  }>();
  private pokerCards: {
    table: PokerTableId;
    index: number;
    key: string;
    texture: DynamicTexture;
    material: StandardMaterial;
  }[] = [];
  private diceMeshes = new Map<string, TransformNode[]>();
  private handParts: Partial<
    Record<WeaponId, { node: TransformNode; rest: Vector3 }[]>
  > = {};
  private materials = new Map<string, StandardMaterial>();
  private zombies = new Map<number, ZombieView>();
  private zombieShadows = new Map<number, Set<ShadowGenerator>>();
  private gates: Record<string, Mesh> = {};
  private gateSigns: Record<string, Mesh> = {};
  private shadows: ShadowGenerator[] = [];
  private staticShadowFrusta = new Map<ShadowGenerator, Plane[]>();
  private loungeAccentLights: (PointLight | SpotLight)[] = [];
  private loungeShadow?: ShadowGenerator;
  private serviceAccentLights: (PointLight | SpotLight)[] = [];
  private serviceShadow?: ShadowGenerator;
  private serviceFallbacks = new Map<"truck" | "props", TransformNode>();
  private gunKick = 0;
  private relicFinishes = new Map<Mesh,{original: PBRMaterial; gilded: PBRMaterial; weapon: WeaponId}>();
  private knifeModel?: TransformNode;
  private rigs: Partial<Record<WeaponId, WeaponRig>> = {};
  private weaponContainers: Partial<Record<WeaponId, AssetContainer>> = {};
  private stickProp?: TransformNode;
  private axeProp?: TransformNode;
  private cabinetPane?: TransformNode;
  private mysteryDisplay: Partial<Record<WeaponId, TransformNode>> = {};
  private viewmodel = new ViewmodelState();
  private revealUntil = 0;
  private grenadeMeshes = new Map<number, Mesh>();
  private blastMeshes = new Map<number, ReturnType<typeof createExplosion>>();
  private explosionRun: Simulation | null = null;
  private flashTime = 0;
  private impact: Mesh;
  private impactTime = 0;
  private time = 0;
  private fpsFrames: number[] = [];
  private fpsSampleCount = 0;
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
    this.engine.maxFPS = process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("range") ? 60 : 15;
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
    this.camera.maxZ = 105;
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
      new Vector3(-3, 4.8, -3),
      this.scene,
    );
    amber.diffuse = new Color3(1, 0.73, 0.34);
    amber.intensity = 0.8;
    amber.range = 27;
    const lounge = new PointLight(
      "lounge lamp",
      new Vector3(10 + LOUNGE_OFFSET.x, 3.6, -4.6 + LOUNGE_OFFSET.z),
      this.scene,
    );
    lounge.diffuse = new Color3(1, 0.72, 0.45);
    lounge.intensity = 1.25;
    lounge.range = 12;
    this.loungeAccentLights.push(lounge);
    const backbar = new PointLight("Last Call shelf glow", new Vector3(12 + LOUNGE_OFFSET.x, 2.55, -10.55 + LOUNGE_OFFSET.z), this.scene);
    backbar.diffuse = new Color3(1, 0.67, 0.32);
    backbar.intensity = 1.1;
    backbar.range = 7;
    backbar.renderPriority = 2;
    this.loungeAccentLights.push(backbar);
    for (const [x, z, height] of [
      [-17, -4, 5.9],
      [11, -4, 5.9],
      [-17, -29, 4.55],
      [10 + LOUNGE_OFFSET.x, -4.6 + LOUNGE_OFFSET.z, 4.55],
    ]) {
      const key = new SpotLight(
        "chandelier pool",
        new Vector3(x, height, z),
        new Vector3(0.08, -1, 0.04),
        2.35,
        1.35,
        this.scene,
      );
      if (x === 10 + LOUNGE_OFFSET.x) {
        key.renderPriority = 1;
        this.loungeAccentLights.push(key);
      }
      key.diffuse = new Color3(1, 0.8, 0.5);
      key.intensity = 2.8;
      key.range = x === 10 + LOUNGE_OFFSET.x ? 18 : 28;
      key.shadowMinZ = 0.3;
      key.shadowMaxZ = key.range;
      const shadow = new ShadowGenerator(1024, key);
      if (x === 10 + LOUNGE_OFFSET.x) this.loungeShadow = shadow;
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
      new Vector3(14, 3.8, -14),
      this.scene,
    );
    tableBounce.diffuse = new Color3(1, 0.74, 0.45);
    tableBounce.intensity = 0.65;
    tableBounce.range = 12;
    const rouletteGlow = new PointLight(
      "roulette jade bounce",
      new Vector3(-26.3, 3.8, -1),
      this.scene,
    );
    rouletteGlow.diffuse = new Color3(0.35, 0.7, 0.61);
    rouletteGlow.intensity = 0.5;
    rouletteGlow.range = 9;
    this.environment();
    if (process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("range")) buildTestRange(this.scene);
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
    this.guns = Object.fromEntries(
      WEAPON_ORDER.map((id) => [id, this.weapon(id)]),
    ) as Record<WeaponId, TransformNode>;
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
    this.casino = new CasinoVisuals(this.scene,this.camera);
    this.ready = Promise.all([
      this.casino.ready,
      this.hotel.ready,
      this.loadWeaponAssets(),
      this.loadTableAssets(),
      this.loadSlotAssets(),
      this.loadPokerAssets(),
      this.loadLoungeAssets(),
      this.loadServiceAsset("truck"),
      this.loadServiceAsset("props"),
      this.loadCouchAsset(),
      this.loadAmmoDisplay(),
      this.loadPlanters(),
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
  /** Fixed geometry only: animated casters retain their existing membership.
   * These lights have fixed transforms and explicit near/far shadow planes.
   */
  private staticShadowMask(mesh: AbstractMesh) {
    mesh.computeWorldMatrix(true);
    const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox;
    let mask = 0;
    this.shadows.forEach((shadow, index) => {
      let planes = this.staticShadowFrusta.get(shadow);
      if (!planes) {
        planes = Frustum.GetPlanes(shadow.getTransformMatrix());
        this.staticShadowFrusta.set(shadow, planes);
      }
      if (intersectsShadowFrustum(minimumWorld, maximumWorld, planes, shadow.normalBias + 0.01))
        mask |= 1 << index;
    });
    return mask;
  }
  private addStaticShadowCaster(mesh: AbstractMesh, mask = this.staticShadowMask(mesh)) {
    this.shadows.forEach((shadow, index) => {
      if (mask & (1 << index)) shadow.addShadowCaster(mesh, false);
    });
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
    const wall = this.mat("walls", "#56635a"),
      trim = this.mat("old brass", "#b2985c"),
      dark = this.mat("charcoal", "#15221e"),
      wood = this.mat("walnut paneling", "#392c24"),
      burgundy = this.mat("velvet", "#612b35"),
      cream = this.mat("aged ivory", "#b4a58b"),
      luminous = this.mat("warm diffuser", "#f0cf8b", 0.95);
    trim.specularColor = new Color3(0.7, 0.57, 0.3);
    trim.specularPower = 48;
    const wallpaper = this.mat("aged fan damask", "#bcbca3");
    const wallpaperTexture = new Texture("/textures/casino-wallpaper.png", this.scene);
    wallpaperTexture.uScale = 1.25;
    wallpaperTexture.vScale = 1.8;
    wallpaper.diffuseTexture = wallpaperTexture;
    wallpaper.specularColor = Color3.Black();
    const ceilingMat = this.mat("ceiling", "#202923");
    // Each room has its own floor and ceiling: the space between the casino,
    // hotel and supply room is outside, not an accidental walkable carpet slab.
    for (const room of Object.values(CASINO_ROOMS)) {
      const w = room.maxX - room.minX, d = room.maxZ - room.minZ;
      const x = (room.minX + room.maxX) / 2, z = (room.minZ + room.maxZ) / 2;
      const floor = this.mat(`${room.id} woven carpet`, "#ffffff");
      const carpet = new Texture("/textures/casino-carpet.png", this.scene);
      carpet.uScale = w / 4;
      carpet.vScale = d / 4;
      carpet.anisotropicFilteringLevel = 8;
      floor.diffuseTexture = carpet;
      floor.specularColor = Color3.Black();
      this.box(`${room.id} floor`, x, -0.11, z, w, 0.2, d,
        room.id === "supply" ? this.mat("service concrete", "#626b62") : floor);
      this.box(`${room.id} ceiling`, x, room.ceilingY + 0.07, z, w, 0.14, d, ceilingMat);
    }
    const supply = CASINO_ROOMS.supply;
    const concreteJoint = this.mat("service expansion joints", "#3d4840");
    for (let x = supply.minX + 2; x < supply.maxX; x += 3)
      this.box("service concrete joint", x, 0.002, (supply.minZ + supply.maxZ) / 2,
        0.018, 0.005, supply.maxZ - supply.minZ, concreteJoint);
    for (let z = supply.minZ + 2; z < supply.maxZ; z += 3)
      this.box("service concrete joint", (supply.minX + supply.maxX) / 2, 0.002, z,
        supply.maxX - supply.minX, 0.005, 0.018, concreteJoint);
    this.serviceFallback();
    for (const r of STATIC_RECTS) {
      if (r.id.startsWith("hotel-")) continue;
      if (LOUNGE_RECTS.some((furniture) => furniture.id === r.id)) continue;
      if (SERVICE_RECTS.some((fixture) => fixture.id === r.id)) continue;
      if (r.id === "upgrade-machine" || r.id === "mystery-cabinet" || r.id === "secret-bar" || r.id.startsWith("craps-table") ||
        r.id.startsWith("roulette-table") || (r.id.startsWith("cashier-") && !r.id.includes("wall"))) continue;
      if (r.id.startsWith("slots")) {
        this.slotIsland(r);
        continue;
      }
      if (r.id.startsWith("poker")) {
        this.pokerTable(r.x, r.z);
        continue;
      }
      if (r.id === "vip-sofa") {
        const fallback = new TransformNode("VIP couch loading fallback", this.scene);
        this.couchFallbacks.set(r.id, { root: fallback, footprint: r, yaw: -Math.PI / 2 });
        this.box("sofa base", r.x, 0.26, r.z, r.w, 0.4, r.d, wood, fallback);
        this.box("tufted sofa back", r.x + 0.4, 0.8, r.z, 0.3, 0.8, r.d, burgundy, fallback);
        for (let z = r.z - r.d / 2 + 0.5; z < r.z + r.d / 2; z += 1) {
          this.box("velvet seat cushion", r.x - 0.08, 0.58, z, 0.85, 0.2, 0.94, burgundy, fallback);
          this.box("upholstery button", r.x + 0.235, 0.9, z, 0.02, 0.04, 0.04, trim, fallback);
        }
        for (const mesh of fallback.getChildMeshes()) {
          mesh.isPickable = false;
          this.addStaticShadowCaster(mesh);
        }
        continue;
      }
      if (r.id.includes("planter")) {
        const root = new TransformNode(`${r.id} planter loading fallback`, this.scene);
        this.planterFallbacks.set(r.id, { root, footprint: r });
        this.cylinder("brass planter base", r.x, 0.16, r.z, Math.min(r.w, r.d), 0.25, trim).parent = root;
        this.cylinder("fluted planter", r.x, 0.5, r.z, Math.min(r.w, r.d) * 0.84, 0.7, dark,
          Math.min(r.w, r.d)).parent = root;
        for (let i = 0; i < 7; i++) {
          const angle = i * Math.PI * 2 / 7;
          const leaf = MeshBuilder.CreateSphere("broad palm frond", { diameter: 1, segments: 8 }, this.scene);
          leaf.position.set(r.x + Math.sin(angle) * 0.23, 1.35 + i % 2 * 0.18, r.z + Math.cos(angle) * 0.23);
          leaf.scaling.set(0.13, 1.35, 0.33);
          leaf.rotation.set(Math.cos(angle) * 0.65, angle, Math.sin(angle) * 0.65);
          leaf.material = this.mat("palm greenery", "#345044");
          leaf.parent = root;
        }
        for (const mesh of root.getChildMeshes()) {
          mesh.isPickable = false;
          mesh.receiveShadows = true;
          this.addStaticShadowCaster(mesh);
        }
        continue;
      }
      if (r.id.includes("bench") || r.id.includes("banquette")) {
        const back = r.id.includes("south") ? -1 : 1;
        // Keep loading placeholders out of the permanent scenery batches so
        // each can be removed once the original Blender couch is ready.
        const fallback = new TransformNode(`${r.id} couch loading fallback`, this.scene);
        this.couchFallbacks.set(r.id, { root: fallback, footprint: r, yaw: back > 0 ? Math.PI : 0 });
        this.box("casino seating plinth", r.x, 0.15, r.z, r.w, 0.28, r.d, trim, fallback);
        this.box("casino upholstered seat", r.x, 0.47, r.z, r.w, 0.36, r.d, burgundy, fallback);
        this.box("casino upholstered back", r.x, 0.92, r.z + back * r.d * 0.36,
          r.w, 0.7, Math.min(0.26, r.d / 3), burgundy, fallback);
        for (let x = r.x - r.w / 2 + 0.45; x < r.x + r.w / 2; x += 0.7)
          this.box("casino tufted button", x, 0.92, r.z + back * (r.d * 0.36 - 0.15), 0.04, 0.04, 0.025, trim, fallback);
        for (const mesh of fallback.getChildMeshes()) {
          mesh.isPickable = false;
          this.shadowAt(r.x, r.z).addShadowCaster(mesh, false);
        }
        continue;
      }
      this.box(r.id, r.x, (r.baseY ?? 0) + r.h / 2, r.z, r.w, r.h, r.d, wall);
      // The supply room has its own continuous utility cladding. Casino trim
      // would otherwise protrude through it and leave overlapping wall details.
      if (r.id.startsWith("supply-wall-")) continue;
      if (r.h < 4) continue;
      this.box("lower walnut wainscot", r.x, 0.68, r.z, r.w + 0.03, 1.36, r.d + 0.03, wood);
      for (const [y, h] of [[0.14, 0.15], [1.38, 0.055], [r.h - 0.25, 0.18], [r.h - 0.07, 0.05]])
        this.box("continuous brass molding", r.x, y, r.z, r.w + 0.065, h, r.d + 0.065, trim);
      const alongX = r.w > r.d, length = alongX ? r.w : r.d;
      for (let a = -length / 2 + 0.65; a < length / 2; a += 2.2) {
        const x = r.x + (alongX ? a : 0), z = r.z + (alongX ? 0 : a);
        const bay = Math.min(1.94, length / 2 - a - 0.08);
        if (bay > 0.5) this.box("damask wall panel", x, (r.h + 1.4) / 2, z,
          alongX ? bay : r.w + 0.025, r.h - 1.9, alongX ? r.d + 0.025 : bay, wallpaper);
        this.box("panel stile", x, 0.75, z, alongX ? 0.035 : r.w + 0.06,
          1.12, alongX ? r.d + 0.06 : 0.035, trim);
        this.box("plaster pilaster", x, (r.h + 1.4) / 2, z, alongX ? 0.15 : r.w + 0.09,
          r.h - 1.6, alongX ? r.d + 0.09 : 0.15, cream);
      }
    }
    // Both ends of a loop are independently purchased. Frame and lettering
    // follow the actual door axis, including the new south-facing VIP doors.
    const doorNames: Record<string, string> = {
      lounge: "THE LAST CALL", shortcut: "THE LAST CALL",
      vip: "HIGH ROLLER CLUB", vipExit: "HIGH ROLLER CLUB",
      supply: "SUPPLY & RECEIVING", cashier: "CASHIER",
    };
    for (const [id, r] of Object.entries(DOORS)) {
      if (id === "hotel") continue;
      const acrossX = r.w > r.d, span = acrossX ? r.w : r.d;
      const gate = this.box(`${id} shutter`, r.x, r.h / 2, r.z, r.w, r.h, r.d,
        this.mat("shutter", "#50493a"));
      this.gates[id] = gate;
      for (let y = 0.15; y < r.h; y += 0.22)
        this.box("shutter rib", 0, y - r.h / 2, 0, r.w + 0.035, 0.04, r.d + 0.035, trim, gate);
      for (const side of [-1, 1])
        this.box("door jamb", r.x + (acrossX ? side * (span / 2 + 0.07) : 0),
          r.h / 2, r.z + (acrossX ? 0 : side * (span / 2 + 0.07)),
          acrossX ? 0.14 : 0.58, r.h, acrossX ? 0.58 : 0.14, trim);
      this.box("door lintel", r.x, r.h - 0.26, r.z,
        acrossX ? span + 0.2 : 0.62, 0.52, acrossX ? 0.62 : span + 0.2, dark);
      for (const side of [-1, 1]) {
        const rotation = acrossX ? (side < 0 ? 0 : Math.PI) : (side < 0 ? Math.PI / 2 : -Math.PI / 2);
        const labelX = r.x + (acrossX ? 0 : side * 0.33);
        const labelZ = r.z + (acrossX ? side * 0.33 : 0);
        this.label(`${id} ${side} lintel`, doorNames[id] ?? "ROOM ACCESS", labelX,
          r.h - 0.26, labelZ, Math.max(1.6, span - 0.2), 0.38, "#e5c881", rotation);
        this.gateSigns[id + (side > 0 ? "Back" : "")] = this.label(`${id} ${side} price`,
          `F • OPEN ${PRICES[id as keyof typeof PRICES]} CHIPS`, labelX, 1.65, labelZ,
          Math.min(2.8, span - 0.15), 0.42, "#e5c881", rotation);
      }
    }
    const casino = CASINO_ROOMS.casino;
    const centerX = (casino.minX + casino.maxX) / 2;
    const centerZ = (casino.minZ + casino.maxZ) / 2;
    this.label("main sign", "LAST JACKPOT", centerX, 4.65, casino.minZ + 0.2, 10, 1.2, "#e1c789", Math.PI);
    this.label("main subtitle", "THE GRAND CASINO", centerX, 3.78, casino.minZ + 0.21, 7, 0.36, "#adbdac", Math.PI);
    // The hotel supplies the single entrance plaque on its marble lintel.
    // Repeated carpet borders and coffers tie the much larger floor together.
    // These flat inlays leave all combat routes and table approaches unobstructed.
    const rug = this.mat("gaming bay green velvet", "#1b3430");
    const rugEdge = this.mat("gaming bay woven gold", "#9a7b45");
    const inset = (name: string, x: number, z: number, w: number, d: number) => {
      this.box(`${name} outer rug`, x, 0.004, z, w, 0.008, d, rugEdge);
      this.box(`${name} velvet rug`, x, 0.01, z, w - 0.11, 0.006, d - 0.11, rug);
      this.box(`${name} inner rug border`, x, 0.014, z, w - 0.3, 0.004, d - 0.3, rugEdge);
      this.box(`${name} field`, x, 0.018, z, w - 0.34, 0.004, d - 0.34, rug);
    };
    for (const table of [...CRAPS_TABLES, ...ROULETTE_TABLES]) {
      const r = STATIC_RECTS.find((rect) => rect.id === table.rectId)!;
      inset(table.id, r.x, r.z, r.w + 3.1, r.d + 2.8);
    }
    for (const table of POKER_TABLES) inset(table.id, table.x, table.z, 6.8, 6.7);
    for (const x of [centerX - 3.45, centerX + 3.45])
      this.box("central promenade gold border", x, 0.012, centerZ, 0.05, 0.007,
        casino.maxZ - casino.minZ - 0.4, rugEdge);
    for (const z of [casino.minZ + 0.6, casino.maxZ - 0.6])
      this.box("grand casino perimeter border", centerX, 0.012, z,
        casino.maxX - casino.minX - 1.2, 0.007, 0.065, rugEdge);
    for (let x = casino.minX + 6; x < casino.maxX; x += 9)
      this.box("grand coffer beam", x, casino.ceilingY - 0.18, centerZ, 0.19, 0.32,
        casino.maxZ - casino.minZ, wood);
    for (let z = casino.minZ + 5; z < casino.maxZ; z += 8)
      this.box("grand coffer cross beam", centerX, casino.ceilingY - 0.18, z,
        casino.maxX - casino.minX, 0.32, 0.19, wood);
    const chandelier = (x: number, z: number, top: number, size = 1) => {
      this.cylinder("chandelier stem", x, top - 0.52, z, 0.055, 1.05, trim);
      for (const [drop, diameter] of [[1.1, 2.65], [1.42, 1.65]]) {
        const ring = MeshBuilder.CreateTorus("chandelier brass ring",
          { diameter: diameter * size, thickness: 0.075, tessellation: 36 }, this.scene);
        ring.position.set(x, top - drop, z);
        ring.material = trim;
        for (let i = 0; i < 10; i++) {
          const angle = i * Math.PI / 5;
          const xx = x + Math.cos(angle) * diameter * size / 2;
          const zz = z + Math.sin(angle) * diameter * size / 2;
          this.cylinder("pendant frosted glass", xx, top - drop + 0.08, zz, 0.14, 0.35, luminous, 0.2);
          this.cylinder("pendant brass base", xx, top - drop - 0.13, zz, 0.19, 0.08, trim);
        }
      }
    };
    for (const x of [-25, -12.8, -3, 11.2, 22]) {
      for (const z of [5, -6, -14]) chandelier(x, z, casino.ceilingY - 0.04, x === -3 ? 1.22 : 0.83);
    }
    chandelier(-17, -29, CASINO_ROOMS.vip.ceilingY, 0.9);
    chandelier(-39, 0, CASINO_ROOMS.lounge.ceilingY, 0.7);
    // Perimeter sconces have no collision and sit fully against the new walls.
    for (const x of [casino.minX + 0.18, casino.maxX - 0.18]) {
      // The west wall has doors centered on -14 and -2. Keep sconces on
      // the solid wall bays, clear of both shutter openings.
      for (const z of x < centerX ? [-18, -6, 10.5] : [-11, -3, 8]) {
        this.box("sconce backing", x, 3.4, z, 0.08, 1.15, 0.5, trim);
        this.box("sconce opal glass", x + (x < centerX ? 0.07 : -0.07), 3.45, z,
          0.14, 0.8, 0.27, luminous);
      }
      this.box("grand casino cove", x, casino.ceilingY - 0.42, centerZ, 0.045, 0.045,
        casino.maxZ - casino.minZ - 0.5, luminous);
    }
    this.cashierDecor();
    this.purchaseDisplays();
    this.bartender = createCharacter(this.scene, 0, true);
    const bartenderX = 12 + LOUNGE_OFFSET.x, bartenderZ = -9.35 + LOUNGE_OFFSET.z;
    this.box("bar staff step", bartenderX, 0.075, bartenderZ, 1.1, 0.15, 0.7, wood);
    this.bartender.root.position.set(bartenderX, 0.15, bartenderZ);
    this.bartender.shadow.position.set(bartenderX, 0.16, bartenderZ);
    for (const shadow of this.shadows)
      for (const mesh of this.bartender.root.getChildMeshes()) shadow.addShadowCaster(mesh, false);
    this.label("bartender counter badge", "MARLOWE", bartenderX, 1.02,
      -8.1 + LOUNGE_OFFSET.z, 2.5, 0.27, "#ddc68b", Math.PI);
    this.label("lounge sign", "THE LAST CALL", 12 + LOUNGE_OFFSET.x, 4.03,
      -11.79 + LOUNGE_OFFSET.z, 5.5, 0.5, "#cead72", Math.PI);
    // Rules and wager details live in the contextual interaction UI. Keep
    // the architecture clear of the old stacked instructional placards.
    this.serviceWallFinish();
    buildLoungeDecor(this.scene);
    // Batch fixed pieces by material and contributing shadow maps. A single
    // world-spanning material batch defeats culling in every light's render list.
    // Assets, cards, glass and shutters remain separate for their animations.
    const groups = new Map<StandardMaterial, Map<number, Mesh[]>>();
    const gates = new Set(Object.values(this.gates));
    for (const mesh of [...this.scene.meshes]) {
      if (!(mesh instanceof Mesh) || mesh.parent || gates.has(mesh) || mesh === this.bartender?.shadow ||
        Object.values(this.gateSigns).includes(mesh) || !mesh.material || mesh.material.alpha < 1) continue;
      const material = mesh.material as StandardMaterial;
      // The chandelier pool originates inside its decorative fixture. Casting
      // those rings/bases projects giant silhouettes across the room's floor.
      const lightFixture = mesh.name.startsWith("chandelier ") || mesh.name.startsWith("pendant ");
      const castsShadow = !lightFixture && material.emissiveColor.equals(Color3.Black()) &&
        !material.name.includes("carpet") && !material.name.includes("rug") && !material.name.includes("concrete");
      const mask = castsShadow ? this.staticShadowMask(mesh) : 0;
      const byShadow = groups.get(material) ?? new Map<number, Mesh[]>();
      const group = byShadow.get(mask) ?? [];
      group.push(mesh);
      byShadow.set(mask, group);
      groups.set(material, byShadow);
    }
    for (const [material, byShadow] of groups) for (const [mask, meshes] of byShadow) {
      const merged = meshes.length > 1 ? Mesh.MergeMeshes(meshes, true, true) : meshes[0];
      if (!merged) continue;
      merged.name = "scenery: " + material.name;
      merged.isPickable = false;
      merged.receiveShadows = true;
      merged.freezeWorldMatrix();
      this.addStaticShadowCaster(merged, mask);
    }
  }
  private purchaseDisplays() {
    const wood = this.mat("walnut paneling", "#392c24"), trim = this.mat("old brass", "#b2985c"),
      dark = this.mat("charcoal", "#15221e");
    for (const purchase of PURCHASES) {
      if (purchase.id === "pistolAmmo") {
        const z = CASINO_ROOMS.casino.minZ + 0.29;
        const fallback = new TransformNode("ammo display loading fallback", this.scene);
        this.ammoDisplayFallback = fallback;
        this.box("ammo plaque", purchase.x, 1.5, z + 0.06, 2.5, 1.6, 0.12, wood, fallback);
        this.label("ammo header", "PISTOL AMMUNITION", purchase.x, 2.05, z + 0.28,
          2.08, 0.3, "#cbd4bb", Math.PI);
        this.label("ammo price", "F • REFILL 150", purchase.x, 0.905, z + 0.28,
          1.9, 0.24, "#d9c58d", Math.PI);
        for (let i = 0; i < 5; i++)
          this.box("ammunition carton", purchase.x - 0.6 + i * 0.3, 1.5, z + 0.2, 0.22, 0.3, 0.19, trim, fallback);
      }
      if (purchase.id === "shotgun" || purchase.id === "smg" || purchase.id === "rifle") {
        const id = purchase.id;
        // Anchors sit at the standing approach; the display is fixed on the
        // nearest room wall, always facing the accessible side of that room.
        const x = id === "shotgun" ? CASINO_ROOMS.casino.maxX - 0.25 :
          id === "smg" ? CASINO_ROOMS.lounge.minX + 0.25 : CASINO_ROOMS.supply.minX + 0.42;
        // The rifle hangs on the west wall so the preserved north storage
        // shelving cannot obscure it from its purchase approach.
        const z = purchase.z;
        const side = id === "shotgun" ? -1 : 1;
        const facing = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.box(`${id} walnut display`, x, 1.52, z, 0.1, 1.75, 2.75, trim);
        this.box(`${id} dark backing`, x + side * 0.06, 1.52, z, 0.1, 1.56, 2.54, dark);
        this.label(`${id} rack name`, WEAPONS[id].name, x + side * 0.14, 2.16, z,
          2.4, 0.35, "#d9c58d", facing);
        this.label(`${id} rack price`, `${WEAPONS[id].price} CHIPS • AMMO ${WEAPONS[id].refill}`,
          x + side * 0.14, 0.9, z, 2.4, 0.3, "#93c5ae", facing);
        const display = new TransformNode(`${id} display weapon`, this.scene);
        display.position.set(x + side * 0.24, 1.55, z);
        display.scaling.setAll(1.8);
        this.displays[id] = display;
      }
      if (purchase.id === "upgrade") {
        const fixture = STATIC_RECTS.find((r) => r.id === "upgrade-machine")!;
        const x = fixture.x, z = fixture.z;
        const previousMeshes = new Set(this.scene.meshes);
        this.box("workshop cabinet", x, 0.65, z, 1.6, 1.3, 1.1, dark);
        this.box("workshop brass lip", x, 1.33, z, 1.7, 0.12, 1.2, trim);
        for (const side of [-1, 1]) {
          this.box("workshop upright", x + side * 0.75, 1.9, z + 0.35, 0.12, 1.1, 0.16, trim);
          this.cylinder("workshop energy canister", x + side * 0.55, 1.7, z - 0.15, 0.17, 0.6,
            this.mat("workshop glow", "#76bc9e", 0.6));
        }
        this.label("workshop sign", "DOUBLE DOWN", x, 2.27, z + 0.22, 1.6, 0.35, "#e3c47d");
        this.label("workshop price", "UPGRADE • 2000", x, 0.88, z - 0.57, 1.4, 0.28, "#e3c47d");
        const root = new TransformNode("east wall upgrade workshop", this.scene);
        root.position.set(x, 0, z);
        root.rotation.y = Math.PI / 2;
        for (const mesh of this.scene.meshes.filter((mesh) => !previousMeshes.has(mesh))) {
          mesh.position.x -= x;
          mesh.position.z -= z;
          mesh.parent = root;
        }
      }
    }
  }
  private cashierDecor() {
    const room = CASINO_ROOMS.cashier;
    const secure = CASINO_ROOMS.cashierSecure;
    const centerX = (room.minX + room.maxX) / 2;
    const width = room.maxX - room.minX - 0.4;
    const z = secure.minZ;
    const brass = this.mat("cashier champagne brass", "#b89a5f");
    const wood = this.mat("cashier espresso walnut", "#342925");
    const black = this.mat("cashier counter marble", "#172723");
    const note = this.mat("cashier stacked banknotes", "#839375");
    const paper = this.mat("cashier paper currency bands", "#d2c6a2");
    this.box("cashier counter front", centerX, 0.58, z - 0.16, width, 1.16, 0.8, wood);
    this.box("cashier marble counter", centerX, 1.18, z - 0.16, width + 0.03, 0.12, 1.05, black);
    for (const y of [0.12, 1.06]) this.box("cashier counter brass inlay", centerX, y, z - 0.58, width, 0.035, 0.025, brass);
    const glass = this.mat("cashier security glass", "#a0c2b6");
    glass.alpha = 0.2;
    glass.specularColor = new Color3(0.85, 0.92, 0.87);
    glass.specularPower = 90;
    glass.backFaceCulling = false;
    const bayWidth = width / 4;
    for (let bay = 0; bay < 4; bay++) {
      const x = centerX - width / 2 + bay * bayWidth;
      this.box("cashier glass partition", x + bayWidth / 2, 2.97, z, bayWidth - 0.07, 3.42, 0.035, glass);
      this.box("cashier brass mullion", x, 2.95, z, 0.065, 3.5, 0.07, brass);
      this.box("cashier document slot", x + bayWidth / 2, 1.245, z - 0.24, 0.72, 0.02, 0.34, brass);
      const registerX = x + bayWidth / 2;
      this.box("cashier terminal body", registerX, 1.39, z + 0.45, 0.65, 0.3, 0.6, black);
      this.box("cashier terminal display", registerX, 1.64, z + 0.25, 0.48, 0.25, 0.065,
        this.mat("cashier display glow", "#87b397", 0.3));
    }
    this.box("cashier glass top rail", centerX, 4.72, z, width, 0.1, 0.11, brass);
    this.label("cashier glass title", "CASHIER", centerX, 3.9, z - 0.07, 6, 0.6, "#e7cea0");
    this.label("cashier closed notice", "HOUSE CREDIT SUSPENDED", centerX, 2.3, z - 0.08, 3.7, 0.4, "#c6bc9b");
    // The inaccessible area is visibly stocked but intentionally contains no
    // working stair or trapdoor until the later story/progression pass.
    const rear = STATIC_RECTS.find((r) => r.id === "cashier-rear-counter")!;
    this.box("cashier secure cash desk", rear.x, rear.h / 2, rear.z, rear.w, rear.h, rear.d, wood);
    this.box("cashier secure desk top", rear.x, rear.h + 0.045, rear.z,
      rear.w + 0.08, 0.09, rear.d + 0.08, black);
    for (let col = 0; col < 16; col++) for (let row = 0; row < 3; row++) {
      const xx = rear.x - rear.w / 2 + 0.5 + col * (rear.w - 1) / 15;
      const zz = rear.z - 0.35 + row * 0.34;
      const stack = 0.12 + (col + row) % 3 * 0.045;
      this.box("cash bundle", xx, rear.h + 0.09 + stack / 2, zz, 0.45, stack, 0.24, note);
      this.box("cash bundle paper band", xx, rear.h + 0.095 + stack, zz, 0.12, 0.012, 0.245, paper);
    }
    const safe = STATIC_RECTS.find((r) => r.id === "cashier-safe")!;
    this.box("cashier secure safe", safe.x, safe.h / 2, safe.z, safe.w, safe.h, safe.d, black);
    this.box("cashier safe brass rim", safe.x, safe.h / 2, safe.z - safe.d / 2 - 0.015,
      safe.w - 0.15, safe.h - 0.15, 0.065, brass);
    this.box("cashier safe door", safe.x, safe.h / 2, safe.z - safe.d / 2 - 0.055,
      safe.w - 0.24, safe.h - 0.24, 0.055, black);
    const wheel = MeshBuilder.CreateTorus("cashier safe handle wheel",
      { diameter: 0.6, thickness: 0.04, tessellation: 24 }, this.scene);
    wheel.position.set(safe.x, 1.2, safe.z - safe.d / 2 - 0.14);
    wheel.rotation.x = Math.PI / 2;
    wheel.material = brass;
    for (const yaw of [0, Math.PI / 3, -Math.PI / 3]) {
      const spoke = this.box("cashier safe wheel spoke", safe.x, 1.2, safe.z - safe.d / 2 - 0.14,
        0.55, 0.035, 0.035, brass);
      spoke.rotation.z = yaw;
    }
    const shelves = STATIC_RECTS.find((r) => r.id === "cashier-shelves")!;
    for (const side of [-1, 1])
      this.box("cashier cabinet side", shelves.x + side * (shelves.w / 2 - 0.045), shelves.h / 2,
        shelves.z, 0.09, shelves.h, shelves.d, wood);
    for (let row = 0; row < 5; row++) {
      const y = 0.12 + row * 0.53;
      this.box("cashier currency shelf", shelves.x, y, shelves.z, shelves.w, 0.075, shelves.d, wood);
      for (let col = 0; col < 4; col++) {
        const x = shelves.x - 0.98 + col * 0.64;
        this.box("cashier shelf cash case", x, y + 0.22, shelves.z, 0.48, 0.34, 0.5, note);
        this.box("cashier shelf case label", x, y + 0.22, shelves.z - 0.256, 0.23, 0.12, 0.01, paper);
      }
    }
    const light = new PointLight("cashier secure warm light", new Vector3(centerX, 3.8, z + 3.2), this.scene);
    light.diffuse = new Color3(1, 0.83, 0.53);
    light.intensity = 0.85;
    light.range = 17;
    this.box("cashier ceiling glow", centerX, 4.55, z + 2.5, width - 2, 0.06, 0.3,
      this.mat("cashier opal light", "#e4d4a1", 0.85));
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
    for (const { x, z, length, alongX, inward } of SERVICE_WALL_PANELS) {
      const w = alongX ? length : SERVICE_FINISH.thickness;
      const d = alongX ? SERVICE_FINISH.thickness : length;
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
    const door = DOORS.supply;
    this.box("service doorway upper finish", SERVICE_FINISH.east,
      (door.h + SERVICE_FINISH.ceiling) / 2, door.z,
      SERVICE_FINISH.thickness, SERVICE_FINISH.ceiling - door.h, door.d, plaster);
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
    // A broad fluorescent pool fades to almost zero at its cone edge. The old
    // narrow, low-exponent spot cut a bright hard arc through both side walls.
    // Keep one shadow map for the truck/props and a gentle storage-side fill.
    const key = new SpotLight("Service loading bay work light", new Vector3(10 + SERVICE_OFFSET.x, 4.48, 8.4 + SERVICE_OFFSET.z),
      new Vector3(0, -1, -0.12), 2.95, 4, this.scene);
    key.diffuse = new Color3(0.83, 0.93, 1);
    key.intensity = 2.0;
    key.range = 18;
    key.renderPriority = 3;
    key.shadowMinZ = 0.3;
    key.shadowMaxZ = 18;
    const shadow = new ShadowGenerator(1024, key);
    shadow.usePercentageCloserFiltering = true;
    shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadow.bias = 0.002;
    shadow.normalBias = 0.025;
    shadow.setDarkness(0.18);
    this.serviceShadow = shadow;
    // Keep this map out of the general scenery list: unrelated table, couch,
    // and wall-weapon loaders register their meshes with every general map.
    const fill = new PointLight("Service storage warm bounce", new Vector3(14.7 + SERVICE_OFFSET.x, 3.55, 10.4 + SERVICE_OFFSET.z), this.scene);
    fill.diffuse = new Color3(1, 0.83, 0.59);
    fill.intensity = 0.55;
    fill.range = 14;
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
      const placement = new TransformNode(`Supply ${kind} placement`, this.scene);
      placement.position.set(SERVICE_OFFSET.x, 0, SERVICE_OFFSET.z);
      for (const node of [...asset.meshes, ...asset.transformNodes].filter((node) => !node.parent))
        node.parent = placement;
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
    const placement = new TransformNode("Relocated Last Call lounge", this.scene);
    placement.position.set(LOUNGE_OFFSET.x, 0, LOUNGE_OFFSET.z);
    for (const node of [...asset.meshes, ...asset.transformNodes].filter((node) => !node.parent))
      node.parent = placement;
    // Accent lights affect this room only, and rank ahead of distant casino lights.
    // Otherwise the eight-light material cap silently drops the lounge shadow light.
    const litMeshes = [
      ...asset.meshes,
      ...this.scene.meshes.filter((mesh) => mesh.name.startsWith("scenery: Last Call")),
      ...(this.bartender?.root.getChildMeshes() ?? []),
      // The couch and lounge imports run concurrently; include whichever
      // seating is ready so either completion order keeps the room lighting.
      ...(this.scene.getTransformNodeByName("lounge-bench-north couch placement")?.getChildMeshes()
        ?? this.couchFallbacks.get("lounge-bench-north")?.root.getChildMeshes() ?? []),
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
  private async loadAmmoDisplay() {
    let asset: AssetContainer | undefined;
    let placement: TransformNode | undefined;
    try {
      asset = await LoadAssetContainerAsync("/models/pistol-ammo-display.glb", this.scene);
      if (this.scene.isDisposed) {
        asset.dispose();
        return;
      }
      const purchase = PURCHASES.find((item) => item.id === "pistolAmmo")!;
      placement = new TransformNode("pistol ammo cabinet placement", this.scene);
      placement.position.set(purchase.x, 1.5, CASINO_ROOMS.casino.minZ + 0.29);
      // The authored front faces Babylon +Z with the loader root retained.
      asset.addAllToScene();
      for (const node of [...asset.meshes, ...asset.transformNodes].filter((node) => !node.parent))
        node.parent = placement;
      for (const mesh of asset.meshes) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        const material = mesh.material as PBRMaterial | null;
        if (material) material.maxSimultaneousLights = 8;
        for (const texture of material?.getActiveTextures() ?? []) texture.anisotropicFilteringLevel = 8;
        if (mesh.getTotalVertices() > 0) this.addStaticShadowCaster(mesh);
        mesh.freezeWorldMatrix();
      }
      this.ammoDisplayFallback?.dispose();
      this.ammoDisplayFallback = undefined;
      this.weaponAssets.push(asset);
    } catch (error) {
      if (placement) {
        for (const mesh of placement.getChildMeshes())
          for (const shadow of this.shadows) shadow.removeShadowCaster(mesh, false);
        placement.dispose();
      }
      asset?.dispose();
      if (!this.scene.isDisposed)
        console.warn("Detailed ammo display unavailable; keeping the fallback.", error);
    }
  }
  private async loadPlanters() {
    let asset: AssetContainer | undefined;
    const placements: TransformNode[] = [];
    try {
      asset = await LoadAssetContainerAsync("/models/casino-planter.glb", this.scene);
      if (this.scene.isDisposed) { asset.dispose(); return; }
      for (const [id, { footprint }] of this.planterFallbacks) {
        const placement = new TransformNode(`${id} palm placement`, this.scene);
        placements.push(placement);
        placement.setEnabled(false);
        placement.position.set(footprint.x, footprint.baseY ?? 0, footprint.z);
        placement.scaling.set(footprint.w / 1.2, footprint.h / 2.35, footprint.d / 1.2);
        const model = asset.instantiateModelsToScene((name) => `${id}:${name}`, false, { doNotInstantiate: true });
        for (const node of model.rootNodes) node.parent = placement;
        for (const mesh of placement.getChildMeshes()) {
          mesh.isPickable = false;
          mesh.receiveShadows = true;
          const material = mesh.material as unknown as { maxSimultaneousLights?: number };
          if (material && "maxSimultaneousLights" in material) material.maxSimultaneousLights = 8;
          if (mesh.getTotalVertices() > 0) this.addStaticShadowCaster(mesh);
          mesh.freezeWorldMatrix();
        }
      }
      for (const { root } of this.planterFallbacks.values()) {
        for (const mesh of root.getChildMeshes())
          for (const shadow of this.shadows) shadow.removeShadowCaster(mesh, false);
        root.dispose();
      }
      this.planterFallbacks.clear();
      placements.forEach((placement) => placement.setEnabled(true));
      this.weaponAssets.push(asset);
    } catch (error) {
      for (const placement of placements) {
        for (const mesh of placement.getChildMeshes())
          for (const shadow of this.shadows) shadow.removeShadowCaster(mesh, false);
        placement.dispose();
      }
      asset?.dispose();
      if (!this.scene.isDisposed) console.warn("Detailed palms unavailable; keeping the fallbacks.", error);
    }
  }
  private async loadCouchAsset() {
    let asset: AssetContainer | undefined;
    const placements: TransformNode[] = [];
    try {
      // Reuse the original six-batch leather couch for all casino seating.
      // Clones share geometry/textures but keep per-mesh room lighting.
      asset = await LoadAssetContainerAsync("/models/vip-couch.glb", this.scene);
      if (this.scene.isDisposed) {
        asset.dispose();
        return;
      }
      for (const [id, { footprint, yaw }] of this.couchFallbacks) {
        const placement = new TransformNode(`${id} couch placement`, this.scene);
        placements.push(placement);
        placement.setEnabled(false);
        placement.position.set(footprint.x, footprint.baseY ?? 0, footprint.z);
        placement.rotation.y = yaw;
        // The original is authored for a 5 m seat. Shorten only its width for
        // the south bench, preserving seat height, depth and floor contact.
        placement.scaling.x = (id === "vip-sofa" ? footprint.d : footprint.w) / 5;
        const imported = asset.instantiateModelsToScene(
          (name) => `${id}:${name}`,
          false,
          { doNotInstantiate: true },
        );
        // Retain the glTF conversion root, including its handedness transform.
        for (const node of imported.rootNodes) node.parent = placement;
        for (const mesh of placement.getChildMeshes()) {
          mesh.isPickable = false;
          mesh.receiveShadows = true;
          const material = mesh.material as unknown as { maxSimultaneousLights?: number };
          if (material && "maxSimultaneousLights" in material)
            material.maxSimultaneousLights = 8;
          for (const texture of mesh.material?.getActiveTextures() ?? [])
            texture.anisotropicFilteringLevel = 8;
          if (mesh.getTotalVertices() > 0)
            this.shadowAt(footprint.x, footprint.z).addShadowCaster(mesh, false);
          mesh.freezeWorldMatrix();
        }
      }
      const loungeMeshes = this.scene.getTransformNodeByName("lounge-bench-north couch placement")?.getChildMeshes() ?? [];
      for (const light of this.loungeAccentLights) light.includedOnlyMeshes.push(...loungeMeshes);
      for (const { root } of this.couchFallbacks.values()) {
        const fallbackMeshes = root.getChildMeshes();
        for (const mesh of fallbackMeshes)
          for (const shadow of this.shadows) shadow.removeShadowCaster(mesh, false);
        for (const light of this.loungeAccentLights)
          light.includedOnlyMeshes = light.includedOnlyMeshes.filter((mesh) => !fallbackMeshes.includes(mesh));
        root.dispose();
      }
      this.couchFallbacks.clear();
      placements.forEach((placement) => placement.setEnabled(true));
      this.weaponAssets.push(asset);
    } catch (error) {
      for (const placement of placements) {
        const meshes = placement.getChildMeshes();
        for (const mesh of meshes)
          for (const shadow of this.shadows) shadow.removeShadowCaster(mesh, false);
        for (const light of this.loungeAccentLights)
          light.includedOnlyMeshes = light.includedOnlyMeshes.filter((mesh) => !meshes.includes(mesh));
        placement.dispose();
      }
      asset?.dispose();
      // A missing optional furnishing must not prevent the game from starting.
      if (!this.scene.isDisposed)
        console.warn("Detailed couches unavailable; keeping the fallbacks.", error);
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
        this.shadowAt(table.x, table.z).addShadowCaster(mesh, false);
      }
    }
  }
  private shadowAt(x: number, z: number) {
    return this.shadows.reduce((closest, candidate) => {
      const a = closest.getLight().position, b = candidate.getLight().position;
      return Math.hypot(x - a.x, z - a.z) <= Math.hypot(x - b.x, z - b.z) ? closest : candidate;
    });
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
            this.shadowAt(root.position.x, root.position.z).addShadowCaster(mesh, false);
          }
        }
      }),
    );
  }
  private async loadTableAssets() {
    await Promise.all(
      ["craps-table", "roulette-table", "ivory-die-a", "ivory-die-b"].map(async (name) => {
        const asset = await LoadAssetContainerAsync(`/models/${name}.glb`, this.scene);
        if (this.scene.isDisposed) {
          asset.dispose();
          return;
        }
        this.weaponAssets.push(asset);
        const tables = name === "roulette-table" ? ROULETTE_TABLES : CRAPS_TABLES;
        for (const table of tables) {
          const imported = asset.instantiateModelsToScene(
            (n) => `${table.id}:${name}:${n}`, false, { doNotInstantiate: true });
          const placement = new TransformNode(`${table.id} ${name} placement`, this.scene);
          placement.position.set(table.x, 0, table.z);
          for (const root of imported.rootNodes) root.parent = placement;
          if (name.startsWith("ivory-die")) {
            const index = name === "ivory-die-a" ? 0 : 1;
            // Keep die rotation beneath glTF's conversion root so the visible
            // top pips still match the actual outcome for this specific table.
            const conversion = imported.rootNodes[0] as TransformNode;
            const die = new TransformNode(`${table.id} ${name} animated`, this.scene);
            die.parent = conversion;
            for (const child of conversion.getChildren()) if (child !== die) child.parent = die;
            die.position.set(index === 0 ? -0.27 : 0.28, 0.8601, -0.1);
            const dice = this.diceMeshes.get(table.id) ?? [];
            dice[index] = die;
            this.diceMeshes.set(table.id, dice);
          }
          const roulette = name === "roulette-table" ? { motion: new RouletteMotion() } as {
            wheel?: TransformNode; ball?: TransformNode; motion: RouletteMotion;
          } : undefined;
          for (const node of placement.getDescendants()) {
            if (roulette && node.name.endsWith(":roulette_wheel")) roulette.wheel = node as TransformNode;
            if (roulette && node.name.endsWith(":roulette_ball")) roulette.ball = node as TransformNode;
            if (node.name.includes("Presentation red die")) node.setEnabled(false);
          }
          if (roulette) this.rouletteViews.set(table.id, roulette);
          for (const mesh of placement.getChildMeshes()) {
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            const material = mesh.material as unknown as { maxSimultaneousLights?: number };
            if (material && "maxSimultaneousLights" in material) material.maxSimultaneousLights = 8;
            // Wheel, ball and dice move after loading; keep their conservative
            // render lists. All fixed table geometry can be culled once.
            const movingRoulettePart = roulette && [roulette.wheel, roulette.ball].some((node) =>
              node && (mesh === node || mesh.isDescendantOf(node)));
            if (name === "craps-table" || (name === "roulette-table" && !movingRoulettePart))
              this.addStaticShadowCaster(mesh);
            else for (const shadow of this.shadows) shadow.addShadowCaster(mesh, false);
          }
        }
      }),
    );
  }
  private async loadWeaponAssets() {
    // Several weapons use the same hand model. Share its parsed source while
    // cloning each rig's transform hierarchy for independent weapon animation.
    const handAssets = new Map<string, Promise<AssetContainer | null>>();
    const loadHands = (name: string) => {
      let pending = handAssets.get(name);
      if (!pending) {
        pending = LoadAssetContainerAsync(`/models/hands-${name}.glb`, this.scene).then((asset) => {
          if (this.scene.isDisposed) {
            asset.dispose();
            return null;
          }
          this.weaponAssets.push(asset);
          return asset;
        });
        handAssets.set(name, pending);
      }
      return pending;
    };
    await Promise.all(
      ([
        "pistol",
        "shotgun",
        "smg",
        "rifle",
        "revolver",
        ...Object.keys(VIEWMODELS),
      ] as WeaponId[]).map(async (id) => {
        const spec = VIEWMODELS[id];
        const asset = await LoadAssetContainerAsync(
          `/models/${id}.glb`,
          this.scene,
        );
        if (this.scene.isDisposed) {
          asset.dispose();
          return;
        }
        this.weaponAssets.push(asset);
        this.weaponContainers[id] = asset;
        const firstPerson = asset.instantiateModelsToScene(
          (n) => `${id}-${n}`,
          false,
          { doNotInstantiate: true },
        );
        for (const root of firstPerson.rootNodes) root.parent = this.guns[id];
        const hands = spec?.hands === null
          ? null
          : await loadHands(spec ? spec.hands : id);
        if (this.scene.isDisposed) return;
        if (hands) {
          const grip = hands.instantiateModelsToScene(
            (n) => `${id}-grip-${n}`,
            false,
            { doNotInstantiate: true },
          );
          for (const root of grip.rootNodes) root.parent = this.guns[id];
        }
        if (spec && hands && spec.extraHands) {
          // Snake Eyes: a second fitted right hand under the left pistol. Parenting a glTF
          // root inside another glTF root cancels the loader's X mirror, so it reads as a left hand.
          const mount = this.guns[id]
            .getDescendants(false)
            .find((n) => n.name === `${id}-${spec.extraHands!.parent}`);
          const extra = hands.instantiateModelsToScene((n) => `${id}-grip2-${n}`, false, { doNotInstantiate: true });
          for (const root of extra.rootNodes) root.parent = mount ?? this.guns[id];
          for (const n of this.guns[id].getDescendants(false))
            if (n.name === `${id}-grip2-LeftHand`) (n as TransformNode).setEnabled(false);
        }
        if (spec) {
          this.guns[id].scaling.setAll(spec.scale ?? 1);
          this.rigs[id] = new WeaponRig(id, spec, this.guns[id]);
        }
        this.handParts[id] = spec ? [] : this.guns[id]
          .getDescendants()
          .filter((n) => n.name === `${id}-grip-LeftHand`)
          .map((n) => ({
            node: n as TransformNode,
            rest: (n as TransformNode).position.clone(),
          }));
        for (const mesh of this.guns[id].getChildMeshes()) {
          mesh.renderingGroupId = 1;
          mesh.isPickable = false;
          if(mesh instanceof Mesh && !mesh.name.includes('-grip-') && mesh.material instanceof PBRMaterial) {
            const gilded=mesh.material.clone(`relic-${id}-${mesh.name}`);
            gilded.albedoColor=new Color3(.7,.45,.12);gilded.metallic=.85;gilded.roughness=.26;
            gilded.emissiveColor=new Color3(.035,.019,.002);
            this.relicFinishes.set(mesh,{original:mesh.material,gilded,weapon:id});
          }
        }
        this.movingParts[id] = spec ? [] : this.guns[id]
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
            this.addStaticShadowCaster(m);
          }
        }
      }),
    );
    await this.loadWeaponProps();
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
  /** World copies: Stickman on the craps table, Fire Exit in its cabinet, Mystery Box reveal models. */
  private async loadWeaponProps() {
    const world = (id: WeaponId, name: string, parent: TransformNode, hide: string[] = []) => {
      const asset = this.weaponContainers[id];
      if (!asset) return;
      const copy = asset.instantiateModelsToScene((n) => `${name}-${n}`, false, { doNotInstantiate: true });
      for (const root of copy.rootNodes) root.parent = parent;
      for (const n of parent.getDescendants(false))
        if (hide.some((h) => n.name === `${name}-${h}`)) (n as TransformNode).setEnabled(false);
      for (const m of parent.getChildMeshes()) {
        m.isPickable = false;
        m.receiveShadows = true;
        const material = m.material as unknown as { maxSimultaneousLights?: number };
        if (material && "maxSimultaneousLights" in material) material.maxSimultaneousLights = 8;
      }
    };
    // The cane rests on the rug and leans into the west padded rail.
    const stick = new TransformNode("stickman rack", this.scene);
    stick.position.set(CRAPS_TABLES[0].x - 2.57, 0.33, CRAPS_TABLES[0].z - 0.1);
    stick.rotationQuaternion = Quaternion.RotationAxis(Vector3.Forward(), -0.13)
      .multiply(Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2))
      .multiply(Quaternion.RotationAxis(Vector3.Forward(), Math.PI / 2));
    world("stick", "world-stick", stick);
    stick.position.y += 0.021 - stick.getHierarchyBoundingVectors().min.y;
    this.stickProp = stick;
    // Fire Exit: red break-glass cabinet on the staff passage's north wall.
    const cabinet = new TransformNode("fire exit cabinet", this.scene);
    // Mounted just inside the supply room's north wall finish.
    cabinet.position.set(AXE_CABINET.x, 1.45,
      SERVICE_FINISH.north - SERVICE_FINISH.thickness / 2 - 0.003);
    cabinet.rotation.y = Math.PI;
    const cabAsset = await LoadAssetContainerAsync("/models/fire-cabinet.glb", this.scene).catch(() => null);
    if (cabAsset && !this.scene.isDisposed) {
      this.weaponAssets.push(cabAsset);
      const copy = cabAsset.instantiateModelsToScene((n) => `cabinet-${n}`, false, { doNotInstantiate: true });
      for (const root of copy.rootNodes) root.parent = cabinet;
      this.cabinetPane = cabinet
        .getChildMeshes()
        .find((m) => m.material?.name.includes("glass")) as TransformNode | undefined;
    }
    const emergency = new PointLight("fire cabinet emergency lamp", new Vector3(AXE_CABINET.x, 2.25, AXE_CABINET.z - 0.38), this.scene);
    emergency.diffuse = new Color3(1, 0.62, 0.5);
    emergency.intensity = 0.9;
    emergency.range = 3.2;
    const axe = new TransformNode("fire exit axe", this.scene);
    axe.parent = cabinet;
    axe.position.set(0.18, 0.0276, 0.06);
    axe.scaling.setAll(0.93);
    axe.rotation.set(0, -Math.PI / 2, 0);
    world("axe", "world-axe", axe);
    this.axeProp = axe;
    // Velvet Fortune reveal: the reels shuffle through the ten firearms above the cabinet.
    for (const id of MYSTERY_WEAPONS) {
      const node = new TransformNode(`mystery reveal ${id}`, this.scene);
      node.position.set(CASINO_SECRET_ANCHORS.mysteryCabinet.x, 1.72, CASINO_SECRET_ANCHORS.mysteryCabinet.z + 0.68);
      node.scaling.setAll(1.35);
      world(id, `mystery-${id}`, node, ["Loading shell", "Loading round", "Stripper clip"]);
      node.setEnabled(false);
      this.mysteryDisplay[id] = node;
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
  /** Feed every simulation event to the viewmodel animators. */
  weaponEvent(event: GameEvent) {
    this.viewmodel.event(event, this.time);
  }
  shot(id: WeaponId, side = 0) {
    const spec = VIEWMODELS[id];
    if (spec) {
      this.flashTime = 0.05;
      const [x, y, z] = spec.muzzle;
      this.flash.position.set(side ? -x : x, y, z);
      this.flash.scaling.setAll(spec.flash);
      return;
    }
    this.flash.scaling.setAll(1);
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
      if(!mesh && g.kind === "grenade") {
        // Debt Collector 40 mm round: olive ogive on a brass band, flying nose-first.
        mesh=MeshBuilder.CreateCylinder("40mm round body",{diameterTop:.034,diameterBottom:.04,height:.07,tessellation:14},this.scene);
        mesh.material=this.mat("40mm olive","#4f5a33");mesh.isPickable=false;
        const nose=MeshBuilder.CreateCylinder("40mm nose",{diameterTop:.006,diameterBottom:.034,height:.035,tessellation:14},this.scene);
        nose.parent=mesh;nose.position.y=.052;nose.material=this.mat("40mm olive","#4f5a33");nose.isPickable=false;
        const band=MeshBuilder.CreateCylinder("40mm band",{diameter:.042,height:.008,tessellation:14},this.scene);
        band.parent=mesh;band.position.y=-.02;band.material=this.mat("40mm brass","#b08d49",.05);band.isPickable=false;
        this.grenadeMeshes.set(g.id,mesh);
      }
      if(!mesh) {
        mesh=MeshBuilder.CreateSphere("thrown grenade",{diameter:.17,segments:12},this.scene);
        mesh.scaling.y=1.2;mesh.material=this.mat("grenade casing","#52613a");mesh.isPickable=false;
        const cap=MeshBuilder.CreateBox("grenade fuse",{width:.05,height:.06,depth:.05},this.scene);
        cap.parent=mesh;cap.position.y=.095;cap.material=this.mat("grenade fuse","#eb9d43",.5);cap.isPickable=false;
        this.grenadeMeshes.set(g.id,mesh);
      }
      mesh.position.set(g.x,g.y,g.z);
      if (g.kind === "grenade") {
        // Point the round's +Y (nose) along its velocity.
        const v=new Vector3(g.vx,g.vy,g.vz).normalize();
        const axis=Vector3.Cross(Vector3.Up(),v);
        const angle=Math.acos(Math.max(-1,Math.min(1,Vector3.Dot(Vector3.Up(),v))));
        mesh.rotationQuaternion=axis.lengthSquared()>1e-8?Quaternion.RotationAxis(axis.normalize(),angle):Quaternion.Identity();
      } else mesh.rotation.set(sim.time*7,0,sim.time*4);
    }
    if (this.explosionRun !== sim) {
      for (const effect of this.blastMeshes.values()) effect.dispose();
      this.blastMeshes.clear(); this.explosionRun = sim;
    }
    for(const [id,effect] of this.blastMeshes) if(sim.time-effect.started>2.2 || sim.time<effect.started) {
      effect.dispose();this.blastMeshes.delete(id);
    }
    for(const blast of sim.explosions) {
      if(!this.blastMeshes.has(blast.id)) this.blastMeshes.set(blast.id,createExplosion(this.scene,blast,sim.time-(.5-blast.remaining),blast.id));
    }
    for(const effect of this.blastMeshes.values()) effect.update(sim.time);
  }
  update(sim: Simulation, dt: number) {
    const priorGunPosition=this.gun.position.clone(),priorGunRotation=this.gun.rotation.clone();
    if(this.wasReloading && !sim.reloadRemaining) this.reloadRecover=.18;
    this.wasReloading=sim.reloadRemaining>0;
    this.reloadRecover=Math.max(0,this.reloadRecover-dt);
    const aim = aimPose(sim.weapon);
    if (this.aimedWeapon !== sim.weapon) { this.aimBlend = 0; this.aimedWeapon = sim.weapon; }
    this.aimBlend += ((sim.aiming && aim ? 1 : 0) - this.aimBlend) * (1-Math.exp(-dt*18));
    this.camera.fov = 1.32 + ((aim?.fov ?? 1.32)-1.32)*this.aimBlend;
    this.casino.update(sim);
    this.stickProp?.setEnabled(!sim.stickTaken);
    this.axeProp?.setEnabled(!sim.axeTaken);
    this.cabinetPane?.setEnabled(!sim.axeTaken);
    const reveal = sim.mystery;
    const shown = !reveal
      ? null
      : !reveal.resolved
        ? MYSTERY_WEAPONS[Math.floor(this.time * 11) % MYSTERY_WEAPONS.length]
        : reveal.reward && reveal.remaining <= 0 && this.revealUntil > this.time
          ? reveal.reward
          : null;
    if (reveal && !reveal.resolved) this.revealUntil = this.time + 2.2;
    for (const id of MYSTERY_WEAPONS) {
      const node = this.mysteryDisplay[id];
      if (!node) continue;
      node.setEnabled(id === shown);
      if (id === shown) {
        node.rotation.y = this.time * (reveal?.resolved ? 1.2 : 0.4) + Math.PI / 2;
        node.position.y = 1.72 + Math.sin(this.time * 2.2) * 0.02 + (reveal?.resolved ? Math.min(0.25, (2.2 - (this.revealUntil - this.time)) * 0.4) : 0);
      }
    }
    this.hotel.update(sim);
    this.updateEquipment(sim);
    this.time += dt;
    this.camera.position.set(
      sim.player.x,
      (sim.player.y ?? 0) + 1.65 +
        (sim.moving && sim.phase === "playing"
          ? Math.sin(sim.time * 12) * 0.018 * (1-this.aimBlend)
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
    this.gun.rotation.y = 0;
    const rig = this.rigs[sim.weapon];
    if (rig) {
      const inv = sim.inventory[sim.weapon];
      const pose = rig.spec.animate(
        this.viewmodel.input(sim.weapon, this.time, dt, {
          reloadRemaining: sim.reloadRemaining,
          reloadDuration: sim.reloadDuration(),
          mag: inv.mag,
          capacity: sim.capacity(),
          interval: WEAPONS[sim.weapon].interval,
          melee: sim.meleeRemaining > 0 ? 1 - sim.meleeRemaining / meleeDuration(sim.weapon) : -1,
          moving: sim.moving && sim.phase === "playing",
          sprinting: sim.sprinting,
        }),
      );
      const [rx, ry, rz] = rig.spec.root;
      this.gun.position.set(rx + pose.pos[0], ry + pose.pos[1], rz + pose.pos[2]);
      this.gun.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2]);
      rig.apply(pose,dt,sim.reloadRemaining>0);
    }
    if(this.reloadRecover>0) {
      const recover=1-Math.exp(-dt*32);
      this.gun.position.copyFrom(Vector3.Lerp(priorGunPosition,this.gun.position,recover));
      this.gun.rotation.copyFrom(Vector3.Lerp(priorGunRotation,this.gun.rotation,recover));
    }
    if (aim && this.aimBlend > .001) {
      const a = this.aimBlend;
      this.gun.position.x += (aim.x-this.gun.position.x)*a;
      this.gun.position.y += (aim.y-this.gun.position.y)*a;
      this.gun.position.z += (aim.z-this.gun.position.z)*a;
      this.gun.rotation.x += (aim.pitch-this.gun.rotation.x)*a;
      this.gun.rotation.y *= 1-a;
      this.gun.rotation.z *= 1-a;
    }
    this.gun.position.y -= sim.grenadeCooldown > 0 ? Math.sin(sim.grenadeCooldown/.65*Math.PI)*.25 : 0;
    for (const id of WEAPON_ORDER) this.guns[id].setEnabled(sim.weapon === id && sim.knifeRemaining <= 0 && !sim.holdingChips && !(aim?.scope && this.aimBlend>.95));
    for (const [mesh,finish] of this.relicFinishes) mesh.material=sim.relics[finish.weapon]?finish.gilded:finish.original;
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
    for (const [id, view] of this.rouletteViews) {
      const state = sim.rouletteTables[id as keyof typeof sim.rouletteTables];
      const pose = view.motion.update(sim, state, ROULETTE_RULES.spinDuration);
      if (view.wheel) {
        view.wheel.rotationQuaternion = null;
        view.wheel.rotation.y = pose.wheelAngle;
      }
      if (view.ball) {
        view.ball.position.set(
          ROULETTE_GEOMETRY.centerX + Math.cos(pose.ballAngle) * pose.ballRadius,
          pose.ballHeight,
          ROULETTE_GEOMETRY.centerZ + Math.sin(pose.ballAngle) * pose.ballRadius,
        );
      }
    }
    const faces = [
      Quaternion.Identity(),
      Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2),
      Quaternion.RotationAxis(Vector3.Forward(), Math.PI / 2),
      Quaternion.RotationAxis(Vector3.Forward(), -Math.PI / 2),
      Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2),
      Quaternion.RotationAxis(Vector3.Right(), Math.PI),
    ];
    for (const [id, dice] of this.diceMeshes) {
      const state = sim.diceTables[id as keyof typeof sim.diceTables];
      dice.forEach((die, i) => {
        const rolling = !!state && !state.resolved;
        const progress = state ? 1 - state.remaining / 1.6 : 1;
        die.position.y = 0.8601 + (rolling ? Math.abs(Math.sin(progress * Math.PI * 4)) * (1 - progress) * 0.38 : 0);
        die.position.z = -0.1 + (rolling ? (1 - progress) * 0.6 : 0);
        die.rotationQuaternion = rolling
          ? Quaternion.RotationYawPitchRoll(progress * 17 + i, progress * 23, progress * 14)
          : faces[(state?.values[i] ?? (i ? 4 : 3)) - 1];
      });
    }
    if (this.bartender) {
      this.bartender.arms[0].rotation.x =
        -1.3 + Math.sin(this.time * 1.5) * 0.045;
      this.bartender.arms[1].rotation.x =
        -1.35 + Math.sin(this.time * 1.5 + 1) * 0.08;
      this.bartender.root.rotation.y = Math.sin(this.time * 0.3) * 0.035;
    }
    this.gun.setEnabled(sim.phase !== "ready");
    for (const [id, gate] of Object.entries(this.gates)) {
      const open = sim.doorsOpen[id as keyof typeof sim.doorsOpen];
      gate.setEnabled(!open);
      this.gateSigns[id]?.setEnabled(!open);
      this.gateSigns[id + "Back"]?.setEnabled(!open);
    }
    const characterShadows = this.serviceShadow ? [...this.shadows, this.serviceShadow] : this.shadows;
    const active = new Set(
      [...sim.enemies.filter((e) => e.health > 0).map((e) => e.id), ...sim.corpses.map(c => c.enemy.id)],
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
    const corpseAges = new Map(sim.corpses.map(c => [c.enemy.id, c.age]));
    for (const e of [...sim.enemies.filter(e => e.health > 0), ...sim.corpses.map(c => c.enemy)]) {
      if (!this.zombieAsset) continue;
      let v = this.zombies.get(e.id);
      if (!v) {
        v = this.zombie(e.id);
        this.zombies.set(e.id, v);
      }
      const meshes = v.root.getChildMeshes();
      const atCasinoLevel = Math.abs(e.y ?? 0) < 0.2;
      const loungeRoom = CASINO_ROOMS.lounge;
      const inLounge = atCasinoLevel && e.x > loungeRoom.minX && e.x < loungeRoom.maxX &&
        e.z > loungeRoom.minZ && e.z < loungeRoom.maxZ;
      for (const light of this.loungeAccentLights) {
        if (inLounge === light.includedOnlyMeshes.includes(meshes[0])) continue;
        if (inLounge) light.includedOnlyMeshes.push(...meshes);
        else light.includedOnlyMeshes = light.includedOnlyMeshes.filter((mesh) => !meshes.includes(mesh));
      }
      const supplyRoom = CASINO_ROOMS.supply;
      const inService = atCasinoLevel && e.x > supplyRoom.minX && e.x < supplyRoom.maxX &&
        e.z > supplyRoom.minZ && e.z < supplyRoom.maxZ;
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
      const deathAge = corpseAges.get(e.id);
      if (deathAge === undefined) animateZombie(v, e);
      else animateZombieDeath(v, e, deathAge);
    }
    this.scene.render();
    this.fps = this.engine.getFps();
    this.fpsFrames.push(this.engine.getDeltaTime());
    if (this.fpsFrames.length > 180) this.fpsFrames.shift();
    if (++this.fpsSampleCount % 30 === 0) {
      const frames = [...this.fpsFrames].sort((a, b) => a - b);
      this.frameP95 = frames[Math.floor(frames.length * 0.95)] ?? 0;
    }
  }
  resize() {
    this.engine.resize();
  }
  dispose() {
    this.casino.dispose();
    this.hotel.dispose();
    for (const asset of this.weaponAssets) asset.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
