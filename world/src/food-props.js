import * as THREE from 'three';
import { FOOD_STORE } from './foraging.js';
import { groundHeight } from './terrain.js';

export function createFoodProps(scene){
 const wicker=new THREE.MeshStandardMaterial({color:0xa36d37,roughness:1}),rim=new THREE.MeshStandardMaterial({color:0xe0b975,roughness:1}),yellow=new THREE.MeshStandardMaterial({color:0xf2d139,roughness:.8});
 const box=(parent,w,h,d,x,y,z,material=wicker)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;};
 function basket(){const g=new THREE.Group();box(g,.62,.05,.42,0,.025,0);for(const side of [-1,1]){box(g,.04,.3,.42,side*.31,.17,0);box(g,.62,.3,.04,0,.17,side*.21);for(let i=0;i<3;i++)box(g,.66,.018,.018,0,.08+i*.09,side*.235,rim);}return g;}
 const carried=basket(),fruit=new THREE.Group();carried.add(fruit);
 for(let i=0;i<5;i++){const b=new THREE.Mesh(new THREE.TorusGeometry(.12,.035,6,12,Math.PI*.85),yellow);b.rotation.set(Math.PI/2,0,i*.3);b.position.set((i%3-1)*.13,.27,Math.floor(i/3)*.12-.06);fruit.add(b);}
 scene.add(carried);carried.visible=false;
 const storage=basket();storage.scale.set(1.8,1.8,1.8);storage.position.set(FOOD_STORE[0],groundHeight(FOOD_STORE[0],FOOD_STORE[1]+1.15),FOOD_STORE[1]+1.15);scene.add(storage);
 const lid=new THREE.Group();lid.position.set(0,.34,.21);box(lid,.66,.045,.46,0,0,-.21,rim);storage.add(lid);
 const stored=fruit.clone();stored.position.y=.02;storage.add(stored);
 const left=new THREE.Vector3(),right=new THREE.Vector3(),floor=new THREE.Vector3();
 return {update(pose,patch,leftHand,rightHand){
  carried.visible=!!pose?.basket;lid.rotation.x=(pose?.lid||0)*Math.PI*.65;
  if(!carried.visible)return;
  fruit.visible=!!pose.filled;stored.visible=true;
  const heading=pose.heading??patch.rotation.y;
  floor.set(patch.position.x+Math.sin(heading)*.5,0,patch.position.z+Math.cos(heading)*.5);floor.y=groundHeight(floor.x,floor.z);
  carried.position.copy(floor);carried.rotation.set(0,heading,0);
  if(leftHand&&rightHand){patch.updateMatrixWorld(true);leftHand.getWorldPosition(left);rightHand.getWorldPosition(right);left.lerp(right,.5);left.y-=.26;
   const f=pose.basket==='held'?1:pose.basket==='lifting'?THREE.MathUtils.smoothstep(pose.progress,.35,.8):pose.basket==='lowering'?1-THREE.MathUtils.smoothstep(pose.progress,.2,.65):0;
   carried.position.lerp(left,f);
  }
 }};
}
