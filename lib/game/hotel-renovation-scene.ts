import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HOTEL, stairPoint } from "./world";
import { HOTEL_GALLERY_WALLS, HOTEL_RENOVATION_SOLIDS } from "./hotel-renovation-layout";
import { HOTEL_MYSTERY_GATES } from "./hotel-mystery";
import type { Simulation } from "./simulation";

/** Belle Époque detail, batched by material; all substantial solids are shared with navigation. */
export function buildHotelRenovation(scene: Scene) {
  const materials: PBRMaterial[] = [];
  const textures: DynamicTexture[] = [];
  const batches = new Map<PBRMaterial, Mesh[]>();
  const loose: Mesh[] = [];
  const stairFallback: Mesh[] = [];
  const ceilingFallback: Mesh[] = [];
  const floorFallback: Mesh[] = [];
  let floorDetail = false;
  let ceilingDetail = false;
  let stairDetail = false;
  const doors: Mesh[] = [];
  const makeMaterial = (name: string, color: string, metallic = 0, roughness = 0.5) => {
    const m = new PBRMaterial(`hotel renovation ${name}`, scene);
    m.albedoColor = Color3.FromHexString(color).toLinearSpace();
    m.metallic = metallic;
    m.roughness = roughness;
    m.maxSimultaneousLights = 10;
    materials.push(m);
    return m;
  };
  const plaster = makeMaterial("carved ivory plaster", "#dbd2bd", 0, 0.76);
  const gold = makeMaterial("champagne gilding", "#b69a59", 0.75, 0.31);
  const walnut = makeMaterial("walnut gallery paneling", "#503427", 0, 0.35);
  const inset = makeMaterial("inset walnut burl", "#76513a", 0, 0.43);
  const walnutTexture = new Texture("/textures/hotel-walnut.png", scene);
  walnutTexture.anisotropicFilteringLevel = 8;
  walnut.albedoTexture = walnutTexture;
  walnut.albedoColor = Color3.White();
  inset.albedoTexture = walnutTexture;
  inset.albedoColor.set(1, .9, .78);
  const stone = makeMaterial("cream carved stone", "#cfc7b5", 0, 0.3);
  const green = makeMaterial("forest silk curtains", "#304b41", 0, 0.8);
  const lining = makeMaterial("curtain silk lining", "#b9aa87", 0, 0.62);
  const window = makeMaterial("cool evening window glass", "#56666b", 0.18, 0.18);
  window.emissiveColor.set(0.1, 0.15, 0.17);
  const leather = makeMaterial("oxblood folio leather", "#522b2b", 0, 0.48);
  const opal = makeMaterial("lit opal sconces", "#efdeb2", 0, 0.3);
  opal.emissiveColor.set(0.9, 0.62, 0.27);
  const mirror = makeMaterial("antiqued mirror silver", "#a0a9a3", 0.94, 0.16);

  const add = (mesh: Mesh, m: PBRMaterial, dynamic = false) => {
    mesh.material = m;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    if (floorDetail) { floorFallback.push(mesh); loose.push(mesh); }
    else if (ceilingDetail) { ceilingFallback.push(mesh); loose.push(mesh); }
    else if (stairDetail) { stairFallback.push(mesh); loose.push(mesh); }
    else if (dynamic) loose.push(mesh);
    else { const list = batches.get(m) ?? []; list.push(mesh); batches.set(m, list); }
    return mesh;
  };
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, m: PBRMaterial, yaw = 0, dynamic = false) => {
    const mesh = add(MeshBuilder.CreateBox(`hotel ${name}`, { width: w, height: h, depth: d }, scene), m, dynamic);
    mesh.position.set(x, y, z); mesh.rotation.y = yaw; return mesh;
  };
  const cylinder = (name: string, x: number, y: number, z: number, diameter: number, h: number, m: PBRMaterial, top = diameter, tessellation = 24) => {
    const mesh = add(MeshBuilder.CreateCylinder(`hotel ${name}`, { diameterBottom: diameter, diameterTop: top, height: h, tessellation }, scene), m);
    mesh.position.set(x, y, z); return mesh;
  };
  const line = (name: string, path: Vector3[], radius: number, m: PBRMaterial) =>
    add(MeshBuilder.CreateTube(`hotel ${name}`, { path, radius, tessellation: 6, cap: Mesh.CAP_ALL }, scene), m);
  const frame = (x: number, y: number, z: number, w: number, h: number, yaw = 0) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const side of [-1, 1]) {
      box("carved frame upright", x + side * w / 2 * c, y, z - side * w / 2 * s, 0.1, h + 0.1, 0.12, gold, yaw);
      box("carved frame lintel", x, y + side * h / 2, z, w + 0.1, 0.1, 0.12, gold, yaw);
    }
  };
  // A shallow relief scroll, rather than a printed motif, catches the sconce light.
  const scroll = (x: number, y: number, z: number, side = 1, scale = 1) => {
    const path: Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * Math.PI * 3, r = (.025 + i / 40 * .22) * scale;
      path.push(new Vector3(x + Math.cos(a) * r * side, y + Math.sin(a) * r, z));
    }
    line("gilded plaster volute", path, .018 * scale, gold);
  };
  const plaque = (name: string, words: string[], x: number, y: number, z: number, width: number, height: number, yaw = 0, dark = false) => {
    const tex = new DynamicTexture(`hotel ${name} print`, { width: 1024, height: Math.max(128, Math.round(1024 * height / width)) }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const size = tex.getSize();
    ctx.fillStyle = dark ? "#26382f" : "#e2d6b5"; ctx.fillRect(0, 0, size.width, size.height);
    ctx.strokeStyle = "#b59659"; ctx.lineWidth = 5; ctx.strokeRect(15, 15, size.width - 30, size.height - 30);
    ctx.fillStyle = dark ? "#e6d7ae" : "#302820"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    words.forEach((word, index) => {
      let font = Math.min(80, size.height / (words.length + 0.7));
      ctx.font = `${font}px Georgia`; font *= Math.min(1, (size.width - 70) / ctx.measureText(word).width);
      ctx.font = `${font}px Georgia`; ctx.fillText(word, size.width / 2, size.height * (index + 0.5) / words.length);
    });
    tex.update(); textures.push(tex);
    const m = makeMaterial(`${name} paper`, "#ffffff", 0, 0.85); m.albedoTexture = tex;
    const mesh = add(MeshBuilder.CreatePlane(`hotel ${name}`, { width, height }, scene), m);
    mesh.position.set(x,y,z); mesh.rotation.y = yaw; return mesh;
  };

  // Rear gallery partitions meet the original perimeter: no invisible exterior rooms.
  for (const wall of HOTEL_GALLERY_WALLS) {
    box("gallery panel wall", wall.x, wall.h / 2, wall.z, wall.w, wall.h, wall.d, walnut);
    for (const side of [-1, 1]) {
      for (const y of [0.17, 1.1, 3.3, 3.57])
        box("gallery continuous molding", wall.x, y, wall.z + side * 0.145, wall.w, y > 3.5 ? 0.16 : 0.055, 0.07, y > 3.5 ? plaster : gold);
      const count = Math.ceil(wall.w / 1.75), width = wall.w / count;
      for (let i = 0; i < count; i++) {
        const x = wall.x - wall.w / 2 + width * (i + 0.5);
        box("gallery raised panel", x, 2.1, wall.z + side * 0.14, width - 0.19, 1.95, 0.05, inset);
        frame(x, 2.1, wall.z + side * 0.19, width - 0.3, 1.75);
      }
    }
  }
  for (const gate of HOTEL_MYSTERY_GATES) {
    const part: Mesh[] = [];
    part.push(box("concealed walnut door", gate.x, 1.86, gate.z, gate.w, 3.72, 0.24, walnut, 0, true));
    for (const face of [-1, 1]) {
      for (const y of [0.17, 1.1, 3.3, 3.57]) part.push(box("concealed panel rail", gate.x, y, gate.z + face * 0.15, gate.w, y > 3.5 ? 0.16 : 0.055, 0.07, y > 3.5 ? plaster : gold, 0, true));
      part.push(box("concealed panel inset", gate.x, 2.1, gate.z + face * 0.15, gate.w - 0.3, 1.95, 0.05, inset, 0, true));
      for (const dx of [-1, 1]) part.push(box("concealed vertical bead", gate.x + dx * (gate.w / 2 - 0.21), 2.1, gate.z + face * .19, .04, 1.94, .035, gold, 0, true));
      for (const y of [1.15,3.05]) part.push(box("concealed horizontal bead", gate.x, y, gate.z + face * .19, gate.w - .38, .04, .035, gold, 0, true));
      // Small key escutcheon is the discoverable visual cue, not a glowing quest marker.
      part.push(box("brass key escutcheon", gate.x + 0.8, 1.28, gate.z + face * .21, .07, .13, .02, gold, 0, true));
    }
    doors.push(...part);
  }

  stairDetail = true;
  // Stately supports make the balcony feel grounded; decoration stays inside shared bounds.
  for (const q of HOTEL_RENOVATION_SOLIDS.filter(q => q.id.includes("column"))) {
    box("column square plinth", q.x, .12, q.z, .72, .24, .72, stone);
    cylinder("column lower torus", q.x, .29, q.z, .65, .12, stone);
    cylinder("fluted salon column", q.x, 1.84, q.z, .46, 3, plaster, .41, 32);
    for (let i=0;i<16;i++) {
      const a = i * Math.PI / 8;
      cylinder("column carved flute", q.x + Math.cos(a)*.221, 1.85, q.z + Math.sin(a)*.221, .037, 2.8, stone, .03, 8);
    }
    for (const [y,d,h] of [[3.32,.53,.11],[3.46,.63,.17],[3.61,.7,.15]]) cylinder("acanthus capital collar",q.x,y,q.z,d,h,plaster);
    // The cap bears directly against the 28 cm mezzanine slab above it.
    box("column bearing capital",q.x,HOTEL.floorY-.32,q.z,q.w,.08,q.d,stone);
    for (let i=0;i<8;i++) {
      const a = i * Math.PI/4;
      const leaf = add(MeshBuilder.CreateSphere("hotel capital leaf", {segments:8,diameter:1},scene),gold);
      leaf.scaling.set(.09,.23,.045); leaf.position.set(q.x+Math.cos(a)*.255,3.44,q.z+Math.sin(a)*.255); leaf.rotation.y=-a;
    }
  }

  stairDetail = false;
  // Upper wall bays clear the artwork, staff signs, and supply doorway below.
  // Derive the wall tangent and inward normal from the actual lobby polygon.
  for (const [wallIndex,z] of [[6,26],[2,26],[6,40],[2,39]]) {
    const a=HOTEL.lobbyPolygon[wallIndex],b=HOTEL.lobbyPolygon[(wallIndex+1)%HOTEL.lobbyPolygon.length];
    const t=(z-a.z)/(b.z-a.z),length=Math.hypot(b.x-a.x,b.z-a.z);
    const tx=(b.x-a.x)/length,tz=(b.z-a.z)/length,nx=-tz,nz=tx;
    const x=a.x+(b.x-a.x)*t,yaw=-Math.atan2(tz,tx);
    const at=(offset:number,along=0)=>({x:x+nx*offset+tx*along,z:z+nz*offset+tz*along});
    let p=at(.135);box("window stone reveal",p.x,6.45,p.z,3.9,3.8,.12,stone,yaw);
    p=at(.201);box("window recessed glass",p.x,6.45,p.z,3.7,3.6,.015,window,yaw);
    p=at(.21);frame(p.x,6.45,p.z,3.7,3.6,yaw);
    for (const offset of [-.92,0,.92]) {p=at(.23,offset);box("window vertical mullion",p.x,6.45,p.z,.06,3.57,.07,plaster,yaw);}
    for (const y of [5.9,7.1]) {p=at(.23);box("window cross mullion",p.x,y,p.z,3.7,.08,.08,plaster,yaw);}
    p=at(.18);box("window cornice",p.x,8.33,p.z,4.35,.18,.36,plaster,yaw);
    box("window supported sill",p.x,4.56,p.z,3.96,.15,.36,stone,yaw);
    for (const edge of [-1,1]) {
      for (let fold=0;fold<7;fold++) {
        p=at(.30+Math.sin(fold*.9)*.045,edge*(1.5+fold*.105));
        const mesh = cylinder("gathered silk drapery",p.x,6.45,p.z,.145,3.74,fold%3?green:lining,.19,12);
        mesh.scaling.x=.74;
      }
      p=at(.36,edge*1.8);box("curtain gilded tieback",p.x,5.8,p.z,.55,.1,.16,gold,yaw);
    }
  }

  // A clear central vista; border marquetry and a reception rug anchor the furniture.
  floorDetail = true;
  for (let i=0;i<16;i++) {
    const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
    const r1=i%2?1.18:2.7,r2=i%2?2.7:1.18;
    const mesh=new Mesh("hotel marble compass inlay",scene), data=new VertexData();
    data.positions=[-4,.034,30,-4+Math.sin(a)*r1,.034,30+Math.cos(a)*r1,-4+Math.sin(b)*r2,.034,30+Math.cos(b)*r2];
    data.indices=[0,2,1];data.normals=[0,1,0,0,1,0,0,1,0];data.uvs=[.5,.5,0,0,1,1];data.applyToMesh(mesh);
    add(mesh,i%2?gold:green);
  }
  floorDetail = false;
  box("reception woven rug",-12,.035,22.65,8.9,.015,2.7,green);
  for (const dx of [-4.22,4.22]) box("rug border",-12+dx,.047,22.65,.045,.006,2.32,gold);
  for (const dz of [-1.16,1.16]) box("rug border",-12,.047,22.65+dz,8.47,.006,.045,gold);
  for (let i=0;i<17;i++) {
    const mesh=box("rug woven diamond",-15.9+i*.48,.05,22.65,.1,.004,.1,lining);
    mesh.rotation.y=Math.PI/4;
  }
  for (const x of [-6.15,-1.85]) box("foyer marble border",x,.027,20.3,.055,.012,9.5,gold);
  for (const x of [-6.33,-1.67]) box("foyer dark stone border",x,.025,20.3,.14,.012,9.5,green);

  // Transparent gilded lettering belongs to the circular cartouche itself.
  const crestTexture=new DynamicTexture("hotel crest lettering",{width:512,height:512},scene,true);
  const crestContext=crestTexture.getContext() as CanvasRenderingContext2D;
  crestContext.clearRect(0,0,512,512);crestContext.fillStyle="#65502d";
  crestContext.textAlign="center";crestContext.textBaseline="middle";
  crestContext.font="bold 185px Georgia";crestContext.fillText("GH",256,215);
  crestContext.font="45px Georgia";crestContext.fillText("EST. 1896",256,354);
  crestTexture.hasAlpha=true;crestTexture.update();textures.push(crestTexture);
  const crestMaterial=makeMaterial("cartouche gilt lettering","#ffffff",0,.65);
  crestMaterial.albedoTexture=crestTexture;crestMaterial.useAlphaFromAlbedoTexture=true;
  crestMaterial.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHATEST;
  // Ornamented plaster bays above reception, with depth and quiet ivory surfaces.
  for (const x of [-12,3.5]) {
    box("upper reception plaster panel",x,6.45,15.18,7.7,3.5,.13,plaster);
    for (const insetSize of [0,.16]) frame(x,6.45,15.29,7.12-insetSize,2.9-insetSize);
    for (const side of [-1,1]) {
      scroll(x+side*2.75,7.56,15.38,side,1.2);
      scroll(x+side*2.75,5.34,15.38,-side,1.2);
      box("upper plaster bay pilaster",x+side*3.82,6.45,15.3,.31,3.82,.22,plaster);
      for (const y of [4.63,8.27]) box("pilaster carved capital",x+side*3.82,y,15.36,.54,.2,.31,stone);
    }
    const medallion=add(MeshBuilder.CreateDisc("hotel plaster cartouche",{radius:.57,tessellation:48},scene),plaster);
    medallion.position.set(x,6.45,15.37);medallion.rotation.y=Math.PI;
    const ring=add(MeshBuilder.CreateTorus("hotel cartouche gilt rim",{diameter:1.2,thickness:.045,tessellation:48},scene),gold);
    ring.position.set(x,6.45,15.39);ring.rotation.x=Math.PI/2;
    const crest=add(MeshBuilder.CreatePlane("hotel crest",{width:.83,height:.83},scene),crestMaterial);
    crest.position.set(x,6.45,15.405);crest.rotation.y=Math.PI;
  }

  // Real stair treads receive a fitted runner. Curved relief follows the existing guards.
  for (const stairs of HOTEL.stairs) {
    stairDetail = false;
    for (let i=0;i<28;i++) {
      const t=(i+.5)/28, a=stairPoint(stairs,t,3.04), b=stairPoint(stairs,t,4.96);
      const y=stairs.topY*(i+1)/28+.014;
      const dx=b.x-a.x,dz=b.z-a.z;
      box("fitted stair carpet runner",(a.x+b.x)/2,y,(a.z+b.z)/2,Math.hypot(dx,dz),.018,.39,green,-Math.atan2(dz,dx));
      for (const radius of [3.1,4.9]) { const p=stairPoint(stairs,t,radius); box("runner narrow gold weave",p.x,y+.012,p.z,.05,.008,.35,gold,-Math.atan2(dz,dx)); }
    }
    stairDetail = true;
    for (const radius of [stairs.innerRadius-.075,stairs.outerRadius+.075]) {
      for (let n=0;n<14;n++) {
        const t=(n+.5)/14,p=stairPoint(stairs,t,radius),angle=Math.PI*t;
        const tangent=new Vector3(stairs.side*Math.cos(angle),0,Math.sin(angle));
        const points:Vector3[]=[];
        for(let j=0;j<=24;j++) {const a=j*Math.PI*2/24;points.push(new Vector3(p.x+tangent.x*Math.sin(a)*.21,p.y+.63+Math.cos(a)*.28,p.z+tangent.z*Math.sin(a)*.21));}
        line("oval gilded balustrade relief",points,.014,gold);
      }
    }
  }

  stairDetail = false;
  ceilingDetail = true;
  // Gilded ceiling rose with sculpted petals around the existing chandelier.
  const roseX=HOTEL.center.x,roseZ=HOTEL.center.z-2;
  for (const diameter of [2.1,2.35,3.2,3.42]) {
    const torus=add(MeshBuilder.CreateTorus("hotel ceiling rose molding",{diameter,thickness:.07,tessellation:64},scene),diameter>3?plaster:gold);
    torus.position.set(roseX,8.66,roseZ);
  }
  for (let i=0;i<16;i++) {
    const a=i*Math.PI/8;
    const petal=add(MeshBuilder.CreateSphere("hotel ceiling acanthus petal",{diameter:1,segments:12},scene),plaster);
    petal.position.set(roseX+Math.cos(a)*1.36,8.66,roseZ+Math.sin(a)*1.36);
    petal.scaling.set(.6,.12,.2);petal.rotation.y=-a;
  }

  ceilingDetail = false;
  // Framed mirrors and paired sconces furnish the rear salons without blocking paths.
  for (const x of [-6.9,-1.1]) {
    box("salon antique mirror",x,2.23,45.79,2.7,1.83,.04,mirror);
    frame(x,2.23,45.74,2.8,1.93);
    for (const side of [-1,1]) {
      const sx=x+side*1.75;
      box("sconce ornamental backplate",sx,2.2,45.72,.18,.52,.08,gold);
      line("sconce curved arm",[new Vector3(sx,2.1,45.69),new Vector3(sx,2,45.42),new Vector3(sx,2.25,45.34)],.027,gold);
      cylinder("sconce opal shade",sx,2.48,45.34,.27,.42,opal,.18,24);
    }
  }

  // Collection register and supplies are inspectable objects in the discovered gallery.
  box("collection writing desk",-5,.49,49.3,2.35,.98,.76,walnut);
  box("collection desk top",-5,1.03,49.3,2.4,.08,.8,stone);
  box("collection register cover",-5,1.088,49.15,.69,.035,.47,leather);
  const register=plaque("collection register pages",["PRIVATE REGISTER","214 · E. VARGA","COLLECTED 23:47"],-5,1.109,49.15,.62,.4);
  register.rotation.x=Math.PI/2;
  plaque("gallery discreet nameplate",["LEFT LUGGAGE","PRIVATE COLLECTION"],-5,2.35,50.82,2.15,.55,0,true);
  box("emergency supply case",0,.34,49.3,1.2,.68,.7,walnut);
  const cacheLid=box("supply case lid",0,.72,49.3,1.23,.08,.74,green,0,true);
  for (const x of [-.38,.38]) box("supply case straps",x,.35,49.3,.065,.69,.73,gold);
  plaque("supply case label",["HOTEL SECURITY","EMERGENCY RESERVE"],0,.39,48.94,.83,.27);
  plaque("suitcase ownership tag",["E. VARGA","214"],-7.8,.65,24.245,.3,.2);

  const meshes:Mesh[]=[];
  for (const [material, group] of batches) {
    const merged=Mesh.MergeMeshes(group,true,true,undefined,false,false);
    if (!merged) continue;
    merged.name=`${material.name} details`;merged.material=material;merged.isPickable=false;merged.receiveShadows=true;merged.freezeWorldMatrix();meshes.push(merged);
  }
  meshes.push(...loose);
  let passageOpen=false,cacheClaimed=false;
  return {
    meshes,
    replaceFloor() { floorFallback.forEach(mesh => mesh.setEnabled(false)); },
    replaceCeiling() { ceilingFallback.forEach(mesh => mesh.setEnabled(false)); },
    replaceStairs() { stairFallback.forEach(mesh => mesh.setEnabled(false)); },
    update(sim:Simulation) {
      if (passageOpen!==sim.hotelMystery.passageOpen) {passageOpen=sim.hotelMystery.passageOpen;doors.forEach(m=>m.setEnabled(!passageOpen));}
      if (cacheClaimed!==sim.hotelMystery.cacheClaimed) {cacheClaimed=sim.hotelMystery.cacheClaimed;cacheLid.rotation.x=cacheClaimed?-.65:0;cacheLid.position.y=cacheClaimed?1.04:.72;}
    },
    dispose() {meshes.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());walnutTexture.dispose();materials.forEach(m=>m.dispose());}
  };
}
