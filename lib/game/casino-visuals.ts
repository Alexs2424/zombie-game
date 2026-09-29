import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { BET_TARGETS, SECRET_DOOR, CRAPS_FELT_Y, placeAmount } from "./casino";
import type { Simulation } from "./simulation";

export class CasinoVisuals {
  ready: Promise<void>;
  private assets: AssetContainer[]=[];
  private portrait?: TransformNode;
  private keypad?: TransformNode;
  private held?: TransformNode;
  private piles = new Map<number,TransformNode[]>();
  private betHighlight?: ReturnType<typeof MeshBuilder.CreateBox>;
  private ghostChip?: TransformNode;
  private highlightMaterial?: StandardMaterial;
  private reels: TransformNode[]=[];
  private door: ReturnType<typeof MeshBuilder.CreateBox>;
  private lockLight: PointLight;
  private cabinetLight: PointLight;
  constructor(private scene:Scene, private camera:FreeCamera) {
    const wall=new StandardMaterial('concealed walnut door',scene);
    wall.diffuseColor=Color3.FromHexString('#35473d');wall.specularColor.set(.05,.05,.05);
    this.door=MeshBuilder.CreateBox('concealed speakeasy door',{width:SECRET_DOOR.w,height:SECRET_DOOR.h,depth:SECRET_DOOR.d},scene);
    this.door.position.set(42,2.4,-4.1);this.door.material=wall;
    this.lockLight=new PointLight('lock indicator',new Vector3(41,2,-4.1),scene);this.lockLight.range=3;this.lockLight.intensity=.25;this.lockLight.diffuse=new Color3(1,.68,.25);
    this.cabinetLight=new PointLight('mystery marquee bounce',new Vector3(48,2.9,-7.7),scene);this.cabinetLight.diffuse=new Color3(.7,1,.6);this.cabinetLight.range=9;this.cabinetLight.intensity=1.4;
    for (const z of [-6,4,10]) {
      const light=new PointLight('speakeasy amber lamp',new Vector3(47,3.2,z),scene);
      light.diffuse=new Color3(1,.67,.31);light.intensity=1.3;light.range=10;
    }
    this.ready=this.load();
  }
  private async load() {
    const names=['casino-chip','crooked-cards','secret-portrait','secret-keypad','mystery-slot','speakeasy-decor'];
    const assets=await Promise.all(names.map(name=>LoadAssetContainerAsync(`/models/${name}.glb`,this.scene)));
    if(this.scene.isDisposed) {assets.forEach(a=>a.dispose());return;}
    this.assets=assets;
    const spawn=(index:number,name:string,position:Vector3,yaw=0)=>{
      const root=new TransformNode(name,this.scene);
      root.position.copyFrom(position);root.rotation.y=yaw;
      const model=assets[index].instantiateModelsToScene(n=>name+':'+n,false,{doNotInstantiate:true});
      for(const node of model.rootNodes) node.parent=root;
      for(const mesh of root.getChildMeshes()) {
        mesh.isPickable=false;mesh.receiveShadows=true;
        const material=mesh.material as unknown as {maxSimultaneousLights?:number};
        if(material && 'maxSimultaneousLights' in material) material.maxSimultaneousLights=8;
      }
      return root;
    };
    spawn(1,'pinned evidence cards',new Vector3(22,.978,5),Math.PI);
    this.portrait=spawn(2,'sliding portrait',new Vector3(41.45,2,-4.1),-Math.PI/2);
    this.keypad=spawn(3,'shootable keypad',new Vector3(41.64,0,-4.1),-Math.PI/2);
    // The real table already has its place boxes printed on the recessed felt.
    // No raised second board: only a translucent hover cue lies on that surface.
    const target = BET_TARGETS[0];
    this.betHighlight=MeshBuilder.CreateBox('place bet hover',{width:target.halfWidth*1.92,height:.001,depth:target.halfDepth*1.92},this.scene);
    this.highlightMaterial=new StandardMaterial('bet hover ink',this.scene);
    this.highlightMaterial.disableLighting=true;this.highlightMaterial.alpha=.32;
    this.betHighlight.material=this.highlightMaterial;this.betHighlight.isPickable=false;
    this.betHighlight.setEnabled(false);
    this.ghostChip=spawn(0,'chip placement preview',new Vector3(0,0,0));
    for(const mesh of this.ghostChip.getChildMeshes()) mesh.visibility=.48;
    this.ghostChip.setEnabled(false);
    const cabinet=spawn(4,'velvet fortune',new Vector3(48,0,-8.6));
    this.reels=cabinet.getChildTransformNodes().filter(n=>/Reel face/.test(n.name));
    spawn(5,'speakeasy furniture',new Vector3(47,0,0));
    this.held=new TransformNode('held casino chips',this.scene);this.held.parent=this.camera;
    this.held.position.set(.27,-.23,.53);this.held.rotation.set(.65,0,-.18);
    for(let i=0;i<4;i++) {
      const chip=spawn(0,`held chip ${i}`,new Vector3(0,i*.019,0));chip.parent=this.held;
      for(const mesh of chip.getChildMeshes()) mesh.renderingGroupId=1;
    }
    const glove=new StandardMaterial('chip glove',this.scene);glove.diffuseColor=Color3.FromHexString('#71513a');
    const palm=MeshBuilder.CreateSphere('chip holding palm',{diameter:1,segments:12},this.scene);palm.scaling.set(.14,.09,.17);palm.position.set(0,-.04,-.035);palm.parent=this.held;palm.material=glove;palm.renderingGroupId=1;
    for(let i=0;i<4;i++) {
      const finger=MeshBuilder.CreateCapsule('chip fingers',{radius:.012,height:.11,tessellation:8},this.scene);
      finger.parent=this.held;finger.position.set((i-1.5)*.032,-.01,.025);finger.rotation.x=1.3;finger.material=glove;finger.renderingGroupId=1;
    }
    for(const target of BET_TARGETS.filter(t=>t.bank===0)) {
      const stack:TransformNode[]=[];
      for(let i=0;i<8;i++) stack.push(spawn(0,`bet ${target.number} chip ${i}`,new Vector3(target.x,CRAPS_FELT_Y+.007+i*.012,target.z+.065)));
      this.piles.set(target.number,stack);
    }
  }
  update(sim:Simulation) {
    const target=sim.aimedBetTarget();
    this.betHighlight?.setEnabled(!!target);
    this.ghostChip?.setEnabled(!!target);
    if(target && this.betHighlight && this.highlightMaterial && this.ghostChip) {
      this.betHighlight.position.set(target.x,CRAPS_FELT_Y+.002,target.z);
      const affordable=sim.points>=placeAmount(target.number,sim.chipValue);
      this.highlightMaterial.emissiveColor=Color3.FromHexString(affordable?'#e8ca72':'#d65f46');
      this.ghostChip.position.set(target.x,CRAPS_FELT_Y+.008,target.z+.065);
    }
    this.door.setEnabled(!sim.speakeasy);
    if(this.portrait) this.portrait.position.z=-4.1+(sim.paintingOpen?2.3:0);
    if(this.keypad) this.keypad.setEnabled(sim.paintingOpen && !sim.speakeasy);
    this.held?.setEnabled(sim.holdingChips);
    if(this.held) for(const child of this.held.getChildren()) if(child.name.startsWith('held chip')) child.setEnabled(Number(child.name.slice(-1))<sim.chipValue/25);
    for(const [number,stack] of this.piles) {
      const bank=sim.betBanks[number as keyof typeof sim.betBanks]??0;
      const box=BET_TARGETS.find(t=>t.number===number && t.bank===bank)!;
      stack.forEach((chip,i)=>{
        chip.position.x=box.x;chip.position.z=box.z+.065;
        chip.setEnabled(i<Math.ceil((sim.bets[number as keyof typeof sim.bets]??0)/25));
      });
    }
    const spinning=!!sim.mystery&&!sim.mystery.resolved;
    this.cabinetLight.intensity=spinning?1.7+Math.sin(sim.time*19)*.5:1.4;
    for(let i=0;i<this.reels.length;i++) this.reels[i].rotation.x=spinning?Math.sin(sim.time*20+i)*.12:0;
    this.lockLight.diffuse=sim.speakeasy?new Color3(.2,1,.5):sim.codeFlash<0?new Color3(1,.08,.025):sim.codeFlash>0?new Color3(.3,1,.4):new Color3(1,.68,.25);
  }
  dispose(){this.assets.forEach(a=>a.dispose());}
}
