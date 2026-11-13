import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ISLAND, pondStairs, stairPoint, stairTread, vinePoint } from './terrain.js';
import { pondSwings, POND_SWING_BASE, POND_SWING_DEFINITIONS } from './pond-swings.js';

export function addPondScenery(scene, ropeMaterial, registry) {
 const group=new THREE.Group();
 group.name='Swimming hole rope swings';
 scene.add(group);
 const loader=new GLTFLoader();
 const load=path=>loader.loadAsync(new URL(path,document.baseURI).href);
 const templates={
  fig:load('assets/pond-fig.glb'),
  palm:load('assets/camp/palm.glb')
 };
 const roots=POND_SWING_BASE.map((swing,index)=>{
  const root=new THREE.Group();
  if(registry)registry.object(POND_SWING_DEFINITIONS[index],root);
  else{root.position.set(swing.x,swing.y,swing.z);root.rotation.y=swing.heading-Math.PI/2;scene.add(root);}
  templates[swing.model].then(({scene:tree})=>{
   const lean=new THREE.Group(),model=tree.clone();lean.rotation.z=-swing.tilt;model.scale.setScalar(swing.scale);model.position.y=-swing.bottom*swing.scale;root.add(lean);lean.add(model);
  }).catch(error=>console.error('Unable to load swimming hole tree',error));
  return root;
 });
 const ropeGeometry=new THREE.CylinderGeometry(.043,.052,1,8);
 const knotGeometry=new THREE.SphereGeometry(.084,9,7);
 const anchor=new THREE.Vector3(),tip=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const lines=pondSwings.map((swing,index)=>{
  const line=new THREE.Mesh(ropeGeometry,ropeMaterial);
  const tie=new THREE.Mesh(knotGeometry,ropeMaterial);
  tie.position.copy(roots[index].worldToLocal(new THREE.Vector3(...swing.anchor)));
  tie.scale.set(1.6,1.1,1.6);
  roots[index].add(line,tie);
  return line;
 });
 function moveRope(index,end=pondSwings[index].start){
  const line=lines[index];
  anchor.copy(roots[index].worldToLocal(new THREE.Vector3(...pondSwings[index].anchor)));
  tip.copy(roots[index].worldToLocal(new THREE.Vector3(...end)));
  direction.subVectors(tip,anchor);
  line.position.copy(anchor).lerp(tip,.5);
  line.scale.y=direction.length();
  line.quaternion.setFromUnitVectors(up,direction.normalize());
 }
 lines.forEach((_,i)=>moveRope(i));
 let active=-1;
 const splash=new THREE.Mesh(
  new THREE.RingGeometry(.87,1,48),
  new THREE.MeshBasicMaterial({color:0xc6f5e6,transparent:true,depthWrite:false,side:THREE.DoubleSide})
 );
 splash.rotation.x=-Math.PI/2;
 splash.visible=false;
 group.add(splash);
 let splashAge=0;
 return {
  hold(index,grip) {
   if(active>=0&&active!==index)moveRope(active);
   if(index>=0)moveRope(index,grip);
   active=index;
  },
  splash(x,z){
   splashAge=0;
   splash.position.set(x,ISLAND.pondY+.045,z);
   splash.scale.setScalar(.5);
   splash.material.opacity=.62;
   splash.visible=true;
  },
  update(dt){
   lines.forEach((_,index)=>{if(index!==active)moveRope(index);});
   if(!splash.visible)return;
   splashAge+=dt;
   splash.scale.setScalar(.5+splashAge*3.2);
   splash.material.opacity=.62*Math.max(0,1-splashAge/1.4);
   splash.visible=splashAge<1.4;
  }
 };
}

export function createPondSteps(stoneMaterial) {
 return pondStairs.map(stair=>{
  const depth=1.3;
  const angle=Math.atan2(stair.dx,stair.dz);
  const treads=Array.from({length:stair.count},(_,index)=>{
   const [x,z]=stairPoint(stair,(index+.5)*stair.run);
   return new THREE.BoxGeometry(stair.width,depth,stair.run)
    .rotateY(angle).translate(x,stairTread(stair,index)-depth/2,z);
  });
  const geometry=mergeGeometries(treads);
  for(const tread of treads)tread.dispose();
  return new THREE.Mesh(geometry,stoneMaterial);
 });
}

export function addWaterfallVines(scene, leafGeometry, leafMaterial) {
 const stems=new THREE.MeshStandardMaterial({color:0x506132,roughness:1});
 const leaves=new THREE.InstancedMesh(leafGeometry,leafMaterial,87);
 const pose=new THREE.Object3D();
 for(let vine=0;vine<3;vine++){
  const points=Array.from({length:29},(_,i)=>{
   const t=i/28;
   const [x,y,z]=vinePoint(t,(vine-1)*.51+Math.sin(i*.51+vine)*.14);
   pose.position.set(x,y+.25,z);
   pose.rotation.set(-.25,i*2.39+vine,(i%2-.5)*.9);
   pose.scale.setScalar(.29+.11*Math.sin(i*7.2)**2);
   pose.updateMatrix();
   leaves.setMatrixAt(vine*29+i,pose.matrix);
   return new THREE.Vector3(x,y+.13,z);
  });
  const curve=new THREE.CatmullRomCurve3(points);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve,56,.065,6,false),stems));
 }
 scene.add(leaves);
}
