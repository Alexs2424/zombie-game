import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import {
  Simulation,
  STATIC_RECTS,
  DOORS,
  PURCHASES,
  SPAWNS,
  type WeaponId,
} from "./simulation";
import "@babylonjs/core/Culling/ray";

type ZombieView = {
  root: TransformNode;
  head: Mesh;
  arms: Mesh[];
  legs: Mesh[];
  body: Mesh;
  shadow: Mesh;
  material: StandardMaterial;
};
export class GameRenderer {
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  gun: TransformNode;
  guns: Record<WeaponId, TransformNode>;
  flash: Mesh;
  private materials = new Map<string, StandardMaterial>();
  private zombies = new Map<number, ZombieView>();
  private gates: Record<string, Mesh> = {};
  private gateSigns: Record<string, Mesh> = {};
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
      Math.max(1, window.devicePixelRatio / 1.25),
    );
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.035, 0.049, 0.045, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.022;
    this.scene.fogColor = new Color3(0.045, 0.066, 0.057);
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
    hemi.intensity = 1.1;
    hemi.groundColor = new Color3(0.18, 0.17, 0.15);
    hemi.diffuse = new Color3(0.79, 0.87, 0.8);
    const amber = new PointLight(
      "casino lamp",
      new Vector3(-8, 3.7, 3),
      this.scene,
    );
    amber.diffuse = new Color3(1, 0.73, 0.34);
    amber.intensity = 0.7;
    amber.range = 17;
    const lounge = new PointLight(
      "lounge lamp",
      new Vector3(10, 3, -5),
      this.scene,
    );
    lounge.diffuse = new Color3(0.46, 0.9, 0.72);
    lounge.intensity = 0.8;
    lounge.range = 14;
    this.environment();
    this.gun = new TransformNode("hands", this.scene);
    this.gun.parent = this.camera;
    this.guns = {
      pistol: this.weapon("pistol"),
      shotgun: this.weapon("shotgun"),
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
  }
  mat(name: string, hex: string, glow = 0) {
    if (this.materials.has(name)) return this.materials.get(name)!;
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.12, 0.12, 0.1);
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
    const t = new DynamicTexture(
      name,
      { width: 1024, height: 256 },
      this.scene,
      false,
    );
    const ctx = t.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#111d19";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, 1000, 232);
    ctx.fillStyle = color;
    ctx.font = "bold 70px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 133, 940);
    t.update();
    const m = new StandardMaterial(name, this.scene);
    m.diffuseTexture = t;
    m.emissiveTexture = t;
    m.specularColor = Color3.Black();
    m.backFaceCulling = false;
    const p = MeshBuilder.CreatePlane(
      name,
      { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE },
      this.scene,
    );
    p.position.set(x, y, z);
    p.rotation.y = rotation;
    p.material = m;
    return p;
  }
  private environment() {
    const wall = this.mat("walls", "#34413a"),
      trim = this.mat("old brass", "#9a8352"),
      dark = this.mat("charcoal", "#171f1d"),
      burgundy = this.mat("velvet", "#4e252a");
    const carpet = new DynamicTexture(
      "carpet",
      { width: 256, height: 256 },
      this.scene,
      false,
    );
    const ctx = carpet.getContext();
    ctx.fillStyle = "#293d32";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#746845";
    ctx.lineWidth = 3;
    for (let x = -128; x < 384; x += 64)
      for (let y = -128; y < 384; y += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y + 24);
        ctx.lineTo(x + 20, y + 44);
        ctx.lineTo(x, y + 64);
        ctx.lineTo(x - 20, y + 44);
        ctx.closePath();
        ctx.stroke();
      }
    carpet.update();
    carpet.uScale = 12;
    carpet.vScale = 9;
    carpet.wrapU = Texture.WRAP_ADDRESSMODE;
    carpet.wrapV = Texture.WRAP_ADDRESSMODE;
    const floorMat = this.mat("carpet", "#b5a782");
    floorMat.diffuseTexture = carpet;
    floorMat.specularColor = Color3.Black();
    this.box("floor", 0, -0.12, 0, 32, 0.2, 24, floorMat);
    this.box("lounge carpet", 10, -0.005, -4.5, 11.5, 0.04, 14.7, burgundy);
    this.box(
      "ceiling",
      0,
      4.9,
      0,
      32,
      0.15,
      24,
      this.mat("ceiling", "#1b2521"),
    );
    for (const r of STATIC_RECTS) {
      if (r.id.startsWith("slots")) {
        this.slotIsland(r.x, r.z, r.w, r.d);
        continue;
      }
      this.box(
        r.id,
        r.x,
        r.h / 2,
        r.z,
        r.w,
        r.h,
        r.d,
        r.id === "bar" ? dark : r.id === "cashier" ? dark : wall,
      );
      if (r.id !== "bar" && r.id !== "cashier")
        this.box(
          r.id + " trim",
          r.x,
          0.55,
          r.z,
          r.w + 0.018,
          0.1,
          r.d + 0.018,
          trim,
        );
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
        this.mat("shutter", "#756746"),
      );
      for (let y = 0.4; y < 4.5; y += 0.35)
        this.box(
          "shutter rib",
          0,
          y - r.h / 2,
          0,
          r.w + 0.015,
          0.035,
          r.d,
          trim,
          this.gates[id],
        );
      this.gateSigns[id] = this.label(
        id + " sign",
        id === "lounge" ? "COCKTAIL LOUNGE" : "STAFF ONLY",
        r.x - 0.25,
        2.8,
        r.z,
        2.7,
        0.62,
        "#d9bd77",
        Math.PI / 2,
      );
    }
    this.label("main sign", "LAST JACKPOT", -2.5, 3.6, 11.94, 7, 1.1);
    this.label("cashier sign", "CASHIER", -11, 2.8, 9.12, 4, 0.8);
    for (let x = -13.5; x < -8; x += 0.5)
      this.box("cage bar", x, 2.1, 9.05, 0.045, 1.1, 0.055, trim);
    this.box("cage counter", -11, 1.03, 8.92, 6.2, 0.15, 0.65, trim);
    this.label(
      "lounge sign",
      "THE LAST CALL",
      11,
      3.1,
      -11.91,
      5.5,
      0.8,
      "#cead72",
      Math.PI,
    );
    this.box("bar top", 12, 1.3, -8.7, 6, 0.15, 1.4, trim);
    for (let i = 0; i < 5; i++) {
      this.box(
        "bottle",
        9.8 + i * 0.85,
        1.63,
        -8.8,
        0.14,
        0.53,
        0.14,
        this.mat("bottle", "#357661", 0.1),
      );
      const stool = MeshBuilder.CreateCylinder(
        "stool",
        { diameter: 0.58, height: 0.12, tessellation: 12 },
        this.scene,
      );
      stool.position.set(9.9 + i, -0.12 + 0.85, -7.5);
      stool.material = burgundy;
      this.box("stool leg", 9.9 + i, 0.35, -7.5, 0.08, 0.7, 0.08, trim);
    }
    // All prop colliders are represented by the simple island, bar, and cage footprints.
    for (const p of PURCHASES) {
      if (p.id === "lounge" || p.id === "shortcut") continue;
      this.box(p.id + " stand", p.x, 0.5, p.z, 0.58, 1, 0.48, dark);
      const color = p.id === "upgrade" ? "#e3c579" : "#86c6ae";
      this.box(
        p.id + " lamp",
        p.x,
        1.02,
        p.z,
        0.64,
        0.08,
        0.54,
        this.mat(p.id + " glow", color, 0.7),
      );
      this.label(
        p.id + " title",
        p.id === "pistolAmmo"
          ? "AMMO 150"
          : p.id === "shotgun"
            ? "ROOM SERVICE 800"
            : "HIGH ROLLER 2000",
        p.x,
        1.57,
        p.z,
        2.15,
        0.47,
        color,
        p.id === "shotgun" ? -Math.PI / 2 : 0,
      );
    }
    SPAWNS.forEach((p, i) => {
      const rotation = i === 1 ? -Math.PI / 2 : i === 2 ? 0 : Math.PI;
      const x = i === 1 ? -15.95 : p.x,
        z = i === 1 ? p.z : i === 2 ? 11.94 : -11.94;
      this.label(
        "entrance " + i,
        ["ENTRANCE", "SECURITY", "STAFF", "BACK OF HOUSE"][i],
        x,
        2.7,
        z,
        2.5,
        0.55,
        "#92865b",
        rotation,
      );
      const door = this.box(
        "entry dark",
        x,
        1.2,
        z,
        i === 1 ? 0.08 : 2.2,
        2.4,
        i === 1 ? 2.2 : 0.08,
        this.mat("entry black", "#0b110e"),
      );
      door.isPickable = false;
    });
    for (const x of [-12, -3, 10])
      for (const z of [-6, 5]) {
        this.box(
          "ceiling fixture",
          x,
          4.72,
          z,
          2.4,
          0.06,
          0.6,
          this.mat("light diffuser", "#c5bd8f", 0.6),
        );
      }
    for (const x of [-15.85, 15.85])
      this.box(
        "wall light",
        x,
        3.6,
        0,
        0.07,
        0.035,
        23,
        this.mat("neon", "#74a484", 0.6),
      );
  }
  private slotIsland(x: number, z: number, w: number, d: number) {
    const base = this.mat("slot base", "#202b27"),
      brass = this.mat("slot brass", "#998153");
    this.box("slot island", x, 0.85, z, w, 1.7, d, base);
    this.box("island cap", x, 1.76, z, w + 0.08, 0.08, d + 0.08, brass);
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const zz = z - d / 2 + 0.7 + (i * (d - 1.4)) / 2;
        this.box(
          "slot cabinet",
          x + side * (w / 2 - 0.28),
          1.06,
          zz,
          0.5,
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
          side === -1 ? -Math.PI / 2 : Math.PI / 2,
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
      }
  }
  private weapon(id: WeaponId) {
    const root = new TransformNode(id, this.scene);
    root.parent = this.gun;
    const metal = this.mat("gun metal", "#414b48"),
      black = this.mat("gun black", "#202727"),
      wood = this.mat("wood", "#73513d");
    if (id === "pistol") {
      this.box("pistol slide", 0, 0.02, 0, 0.13, 0.13, 0.38, metal, root);
      this.box("pistol grip", 0, -0.12, -0.08, 0.11, 0.22, 0.16, black, root);
      this.box("pistol sight", 0, 0.1, -0.04, 0.035, 0.03, 0.05, black, root);
    } else {
      this.box("shotgun receiver", 0, 0, -0.06, 0.14, 0.14, 0.36, metal, root);
      this.box(
        "shotgun barrel",
        0,
        0.03,
        0.34,
        0.075,
        0.075,
        0.58,
        black,
        root,
      );
      this.box("shotgun pump", 0, -0.06, 0.23, 0.14, 0.12, 0.25, wood, root);
      this.box("shotgun stock", 0, -0.08, -0.31, 0.13, 0.19, 0.3, wood, root);
    }
    this.box(
      "hand",
      0.035,
      -0.18,
      -0.09,
      0.14,
      0.16,
      0.2,
      this.mat("gloves", "#4c5047"),
      root,
    );
    for (const m of root.getChildMeshes()) m.renderingGroupId = 1;
    return root;
  }
  private zombie(id: number): ZombieView {
    const root = new TransformNode("zombie " + id, this.scene),
      suit = new StandardMaterial("suit " + id, this.scene);
    suit.diffuseColor = Color3.FromHexString(
      id % 3 === 0 ? "#736157" : id % 3 === 1 ? "#596c60" : "#4b5c68",
    );
    suit.specularColor = Color3.Black();
    const body = this.box("torso", 0, 1.07, 0, 0.52, 0.68, 0.34, suit, root),
      skin = this.mat("skin", "#93a482");
    const head = MeshBuilder.CreateSphere(
      "head",
      { diameter: 0.46, segments: 8 },
      this.scene,
    );
    head.parent = root;
    head.position.y = 1.64;
    head.material = skin;
    const legs = [-0.15, 0.15].map((x) =>
      this.box(
        "leg",
        x,
        0.35,
        0,
        0.18,
        0.7,
        0.21,
        this.mat("pants", "#303b36"),
        root,
      ),
    );
    const arms = [-0.35, 0.35].map((x) =>
      this.box("arm", x, 1.06, 0.18, 0.15, 0.6, 0.16, suit, root),
    );
    arms.forEach((a) => (a.rotation.x = -0.65));
    for (const x of [-0.09, 0.09])
      this.box(
        "eye",
        x,
        1.69,
        0.202,
        0.058,
        0.042,
        0.055,
        this.mat("zombie eyes", "#d3bc6d", 0.6),
        root,
      );
    this.box(
      "shirt",
      0,
      1.2,
      0.18,
      0.14,
      0.4,
      0.015,
      this.mat("shirt", "#aaae92"),
      root,
    );
    const shadow = MeshBuilder.CreateDisc(
      "shadow",
      { radius: 0.48, tessellation: 14 },
      this.scene,
    );
    shadow.rotation.x = Math.PI / 2;
    shadow.material = this.mat("shadow", "#101814");
    shadow.position.y = 0.027;
    return { root, head, arms, legs, body, shadow, material: suit };
  }
  shot(id: WeaponId) {
    this.gunKick = id === "shotgun" ? 0.12 : 0.055;
    this.flashTime = 0.045;
    this.flash.position.set(0, 0.03, id === "shotgun" ? 0.65 : 0.23);
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
    this.guns.pistol.setEnabled(sim.weapon === "pistol");
    this.guns.shotgun.setEnabled(sim.weapon === "shotgun");
    this.gun.setEnabled(sim.phase !== "ready");
    for (const id of ["lounge", "shortcut"] as const) {
      const open = sim[id];
      this.gates[id].setEnabled(!open);
      this.gateSigns[id].setEnabled(!open);
    }
    const active = new Set(
      sim.enemies.filter((e) => e.health > 0).map((e) => e.id),
    );
    for (const [id, v] of this.zombies)
      if (!active.has(id)) {
        v.root.dispose();
        v.shadow.dispose();
        v.material.dispose();
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
    this.scene.dispose();
    this.engine.dispose();
  }
}
