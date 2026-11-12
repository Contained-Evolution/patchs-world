import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ISLAND } from './terrain.js';
import { pondSwings } from './pond-swings.js';

export function addPondScenery(scene, ropeMaterial, solids) {
 const group=new THREE.Group();
 group.name='Swimming hole rope swings';
 scene.add(group);
 const loader=new GLTFLoader();
 const load=path=>loader.loadAsync(new URL(path,document.baseURI).href);
 const templates={
  fig:load('assets/pond-fig.glb'),
  palm:load('assets/camp/palm.glb')
 };
 for(const swing of pondSwings){
  solids.ellipse(swing.x,swing.z,swing.radius,swing.radius);
  templates[swing.model].then(({scene:tree})=>{
   const root=new THREE.Group(),lean=new THREE.Group(),model=tree.clone();
   root.position.set(swing.x,swing.y,swing.z);
   root.rotation.y=swing.heading-Math.PI/2;
   lean.rotation.z=-swing.tilt;
   model.scale.setScalar(swing.scale);
   model.position.y=-swing.bottom*swing.scale;
   root.add(lean);
   lean.add(model);
   group.add(root);
  }).catch(error=>console.error('Unable to load swimming hole tree',error));
 }
 const ropeGeometry=new THREE.CylinderGeometry(.043,.052,1,8);
 const knotGeometry=new THREE.SphereGeometry(.084,9,7);
 const anchor=new THREE.Vector3(),tip=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const lines=pondSwings.map(swing=>{
  const line=new THREE.Mesh(ropeGeometry,ropeMaterial);
  const tie=new THREE.Mesh(knotGeometry,ropeMaterial);
  tie.position.set(...swing.anchor);
  tie.scale.set(1.6,1.1,1.6);
  group.add(line,tie);
  return line;
 });
 function moveRope(index,end=pondSwings[index].start){
  const line=lines[index];
  anchor.set(...pondSwings[index].anchor);
  tip.set(...end);
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
   if(!splash.visible)return;
   splashAge+=dt;
   splash.scale.setScalar(.5+splashAge*3.2);
   splash.material.opacity=.62*Math.max(0,1-splashAge/1.4);
   splash.visible=splashAge<1.4;
  }
 };
}
