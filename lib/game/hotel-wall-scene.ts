import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Vector4 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { HOTEL_RECTS } from "./world";
import { HOTEL_SPAWNS } from "./hotel-gameplay";

/** Shallow architectural relief on the existing collision shell, in metres. */
export function buildHotelWalls(scene: Scene) {
  const materials: PBRMaterial[] = [];
  const batches = new Map<PBRMaterial, Mesh[]>();
  const material = (name: string, color: string, roughness: number, metallic = 0) => {
    const m = new PBRMaterial(`hotel walls ${name}`, scene);
    m.albedoColor = Color3.FromHexString(color).toLinearSpace();
    m.roughness = roughness;
    m.metallic = metallic;
    m.maxSimultaneousLights = 8;
    materials.push(m);
    return m;
  };
  const plaster = material("lime plaster", "#d8cdb6", 0.88);
  const relief = material("ivory molded plaster", "#e4d9c3", 0.73);
  const green = material("forest lacquer", "#354d43", 0.39);
  const panel = material("recessed green panels", "#425b4d", 0.49);
  const bronze = material("rubbed champagne brass", "#b09b6b", 0.42, 0.72);
  const plinth = material("dark stone skirting", "#303b35", 0.36);

  // Small, seamless mineral variation: UVs are in metres rather than stretched
  // once across each wall. Seeded noise gives the same finish on every run.
  const surface = new DynamicTexture("hotel walls mineral finish", 256, scene, true);
  const normal = new DynamicTexture("hotel walls plaster normal", 256, scene, true);
  const ctx = surface.getContext() as CanvasRenderingContext2D;
  const nctx = normal.getContext() as CanvasRenderingContext2D;
  const pixels = ctx.createImageData(256, 256), normals = nctx.createImageData(256, 256);
  let seed = 1896;
  const noise = new Float32Array(256 * 256);
  for (let i = 0; i < noise.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    noise[i] = seed / 4294967296;
  }
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = y * 256 + x, p = i * 4;
    const cloud = Math.sin(x * Math.PI / 64) * Math.sin(y * Math.PI / 128);
    const value = 239 + noise[i] * 9 + cloud * 3;
    pixels.data.set([value, value, value, 255], p);
    normals.data.set([
      128 + (noise[y * 256 + (x + 1) % 256] - noise[i]) * 14,
      128 + (noise[((y + 1) % 256) * 256 + x] - noise[i]) * 14,
      255, 255,
    ], p);
  }
  ctx.putImageData(pixels, 0, 0); surface.update();
  nctx.putImageData(normals, 0, 0); normal.update(); normal.gammaSpace = false;
  surface.anisotropicFilteringLevel = normal.anisotropicFilteringLevel = 8;
  for (const m of [plaster, relief]) { m.albedoTexture = surface; m.bumpTexture = normal; }

  const add = (mesh: Mesh, m: PBRMaterial) => {
    mesh.material = m;
    const group = batches.get(m) ?? [];
    group.push(mesh); batches.set(m, group);
    return mesh;
  };

  for (const wall of HOTEL_RECTS.filter(w => w.id.startsWith("hotel-wall-"))) {
    const angle = wall.yaw ?? 0, tx = Math.cos(angle), tz = Math.sin(angle);
    const nx = -tz, nz = tx; // The perimeter is counter-clockwise, facing inward.
    const box = (name: string, along: number, y: number, depth: number, w: number, h: number, d: number, m: PBRMaterial) => {
      const mesh = MeshBuilder.CreateBox(`hotel walls ${name}`, {
        width: w, height: h, depth: d,
        faceUV: Array.from({ length: 6 }, () => new Vector4(0, 0, w, h)),
      }, scene);
      mesh.position.set(wall.x + tx * along + nx * depth, y, wall.z + tz * along + nz * depth);
      mesh.rotation.y = -angle;
      return add(mesh, m);
    };
    // An actual profiled frame: mitred corners and a sloping raised lip catch
    // light from oblique views. Eight-sided outlines gently clip the corners.
    const frame = (name: string, along: number, y: number, w: number, h: number, depth: number, m: PBRMaterial, bead = 0.055) => {
      const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
      const rings = [[0, 0], [bead * .3, .017], [bead * .65, .026], [bead, .01]];
      for (const [inset, projection] of rings) {
        const a = w / 2 - inset, b = h / 2 - inset, clip = Math.min(.07, a * .15, b * .15);
        for (const [x, yy] of [[-a+clip,-b],[a-clip,-b],[a,-b+clip],[a,b-clip],[a-clip,b],[-a+clip,b],[-a,b-clip],[-a,-b+clip]]) {
          positions.push(wall.x + tx * (along+x) + nx * (depth+projection), y+yy, wall.z + tz * (along+x) + nz * (depth+projection));
          uvs.push(along+x,y+yy);
        }
      }
      for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < 8; i++) {
        const a = r*8+i, b = r*8+(i+1)%8, c = b+8, d = a+8;
        // Babylon uses clockwise front faces in this left-handed scene.
        indices.push(a,c,b,a,d,c);
      }
      const data = new VertexData(), normals: number[] = [];
      data.positions = positions; data.indices = indices; data.uvs = uvs;
      VertexData.ComputeNormals(positions, indices, normals); data.normals = normals;
      const mesh = new Mesh(`hotel walls ${name}`, scene); data.applyToMesh(mesh); add(mesh,m);
    };
    // Treat existing attachments as reserved wall intervals, including their
    // casings. No lower panel rails run across a service-door leaf.
    const reservations = (upper: boolean) => {
      const spans: [number, number][] = [];
      const reserve = (x: number, z: number, width: number) => {
        if (Math.abs((x-wall.x)*nx + (z-wall.z)*nz) > .5) return;
        const center = (x-wall.x)*tx + (z-wall.z)*tz;
        spans.push([center-width/2, center+width/2]);
      };
      if (!upper) for (const spawn of HOTEL_SPAWNS.filter(s => s.y === 0)) reserve(spawn.door.x,spawn.door.z,spawn.door.w+.48);
      if (upper) {
        for (const [x,z] of [[-23,26],[15,26],[-23,40],[15,39]]) reserve(x,z,4.7);
        for (const x of [-11.5,.6]) reserve(x,50.84,2.6);
      } else {
        reserve(-22.84,23.8,2.6); reserve(14.84,36.2,2.6);
        // Reception backdrop and world clocks already own the south facade.
        if (wall.id.startsWith("hotel-wall-0")) spans.push([-wall.w/2,wall.w/2]);
      }
      return spans;
    };
    const runs = (spans: [number,number][]) => {
      let result: [number,number][] = [[-wall.w/2+.015,wall.w/2-.015]];
      for (const [lo,hi] of spans) result = result.flatMap(([a,b]) => {
        if (hi<=a || lo>=b) return [[a,b]];
        const pieces: [number,number][] = [];
        if (lo>a) pieces.push([a,lo]); if (hi<b) pieces.push([hi,b]);
        return pieces;
      });
      return result;
    };

    box("structural plaster",0,wall.h/2,0,wall.w,wall.h,wall.d,plaster);
    const doorSpans: [number,number][] = [];
    for (const spawn of HOTEL_SPAWNS.filter(s => s.y === 0)) {
      const door=spawn.door;
      if (Math.abs((door.x-wall.x)*nx+(door.z-wall.z)*nz)<.5) {
        const at=(door.x-wall.x)*tx+(door.z-wall.z)*tz;
        doorSpans.push([at-door.w/2-.21,at+door.w/2+.21]);
      }
    }
    for (const [a,b] of runs(doorSpans)) {
      const middle=(a+b)/2, width=b-a;
      box("wainscot backing",middle,.76,.112,width,1.52,.025,green);
      for (const [y,h,d,m] of [
        [.11,.22,.075,plinth], [.245,.055,.086,green], [.29,.025,.091,bronze],
        [1.4,.055,.059,green], [1.465,.055,.08,relief], [1.51,.027,.095,bronze],
      ] as const) box("dado profile",middle,y,.1+d/2,width,h,d,m);
    }
    for (const [a,b] of runs(reservations(false))) {
      const count=Math.max(1,Math.round((b-a)/1.35)), width=(b-a)/count;
      if (width<.48) continue;
      for (let i=0;i<count;i++) {
        const at=a+width*(i+.5);
        box("recessed panel field",at,.84,.132,width-.16,.88,.016,panel);
        frame("raised wainscot bolection",at,.84,width-.12,.94,.14,green,.075);
        frame("fine brass panel bead",at,.84,width-.28,.78,.157,bronze,.014);
      }
    }
    for (const [a,b] of runs(reservations(false))) {
      if (b-a<1) continue;
      const count=Math.max(1,Math.round((b-a)/2.7)), width=(b-a)/count;
      for (let i=0;i<count;i++) {
        const at=a+width*(i+.5);
        frame("salon plaster panel",at,2.72,width-.25,1.98,.114,relief,.07);
        frame("salon inner fillet",at,2.72,width-.47,1.76,.114,relief,.022);
      }
    }
    // Layered cornice and picture rail give the full-height room a readable
    // hierarchy. Projection stays below 20 cm, inside the player wall clearance.
    for (const [y,h,d,m] of [
      [3.95,.10,.055,relief],[4.04,.06,.085,relief],[4.095,.025,.09,bronze],
      [8.34,.06,.04,relief],[8.40,.055,.065,bronze],[8.48,.10,.09,relief],
      [8.58,.10,.125,relief],[8.70,.14,.18,relief],
    ] as const) box("continuous cornice",0,y,.1+d/2,wall.w,h,d,m);
    // Front wall retains its existing cartouches; windows and framed art retain
    // their full clearances. Bay spacing is fitted independently to each run.
    if (!wall.id.startsWith("hotel-wall-0")) {
      for (const [a,b] of runs(reservations(true))) {
        if (b-a<1.0) continue;
        const count=Math.max(1,Math.round((b-a)/2.8)), width=(b-a)/count;
        for(let i=0;i<count;i++) {
          const at=a+width*(i+.5);
          frame("tall plaster panel",at,6.24,width-.25,3.72,.114,relief,.065);
          frame("inner plaster fillet",at,6.24,width-.47,3.5,.115,relief,.022);
          // A small, restrained diamond at the crest avoids a flat empty frame.
          const boss=box("panel crest lozenge",at,7.90,.14,.075,.075,.035,bronze);
          boss.rotation.z=Math.PI/4;
        }
      }
    }
  }

  const meshes: Mesh[] = [];
  for (const [m, group] of batches) {
    const mesh = Mesh.MergeMeshes(group,true,true,undefined,false,false);
    if (!mesh) throw new Error(`Could not merge ${m.name}`);
    mesh.name = `${m.name} architecture`; mesh.material = m;
    mesh.isPickable = false; mesh.receiveShadows = true; mesh.freezeWorldMatrix(); meshes.push(mesh);
  }
  return {
    meshes,
    dispose() { meshes.forEach(m=>m.dispose()); materials.forEach(m=>m.dispose()); surface.dispose(); normal.dispose(); },
  };
}
