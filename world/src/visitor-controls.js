import * as THREE from 'three';
import { groundHeight, trees } from './world-state.js';
import { forestCollision } from './forest.js';
import { shoreFraction, walkShoreLimit, places, ISLAND, pondFraction, TIDE_POOLS } from './terrain.js';

// The swing trees and cave walls remain solid without blocking their routes.
export const obstacles = [...trees.map(([x,z])=>[x,z,.8])];
const [caveX,caveZ]=places.cave;
obstacles.push([caveX-7,caveZ-5,3],[caveX+7,caveZ-5,3],[caveX-8,caveZ-12,3],[caveX+8,caveZ-12,3],[caveX,caveZ-19,4]);
function caveSolid(x,z){const dx=Math.abs(x-caveX),depth=caveZ-z;return depth>3&&depth<20&&((dx>5&&dx<8)||(depth>15&&dx<8));}
export function walkable(x,z,fromX=x,fromZ=z) {
  if (caveSolid(x,z)&&!caveSolid(fromX,fromZ)) return false;
  if (shoreFraction(x,z) > walkShoreLimit || pondFraction(x,z)<.94 || TIDE_POOLS.some(([px,pz,rx,rz])=>Math.hypot((x-px)/rx,(z-pz)/rz)<.72) || forestCollision(x,z,fromX,fromZ)) return false;
  const d=Math.hypot(x-fromX,z-fromZ);
  if (d && Math.abs(groundHeight(x,z)-groundHeight(fromX,fromZ))/d > 1.1) return false;
  return !obstacles.some(([ox,oz,r]) => Math.hypot(x-ox,z-oz)<r && Math.hypot(x-ox,z-oz)<Math.hypot(fromX-ox,fromZ-oz));
}
export function createVisitorControls(camera, canvas, dialog, scene=null) {
  let mode='walk', yaw=0, pitch=0, touchLook=null, lastTouch=0;
  const keys=new Set(), touch=new Set(), euler=new THREE.Euler(0,0,0,'YXZ'),sightRay=new THREE.Raycaster();
  const sceneVisible=(from,to)=>{if(!scene)return true;const d=to.clone().sub(from),length=d.length();sightRay.set(from,d.normalize());sightRay.far=Math.max(0,length-.3);return sightRay.intersectObjects(scene.children.filter(o=>o.isMesh&&!o.material.transparent),false).length===0;};
  const walk=document.querySelector('#walk'), fly=document.querySelector('#fly'), hint=document.querySelector('#explore-hint');
  const orientation=()=>{euler.set(pitch,yaw,0);camera.quaternion.setFromEuler(euler);};
  const look=(dx,dy)=>{yaw-=dx*.0025;pitch=THREE.MathUtils.clamp(pitch-dy*.0025,-1.45,1.45);orientation();};
  const pointAt=(x,y,z)=>{camera.lookAt(x,y,z);euler.setFromQuaternion(camera.quaternion,'YXZ');yaw=euler.y;pitch=euler.x;};
  // Repositioning from the air or to Patch must not land inside water or a trunk.
  const safeLanding=(x,z)=>{let scale=shoreFraction(x,z)/walkShoreLimit;if(scale>1){x/=scale;z/=scale;}for(let radius=0;radius<=60;radius+=1.5)for(let i=0;i<(radius?24:1);i++){const a=i*Math.PI/12,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;if(walkable(px,pz,px+10000,pz+10000))return [px,pz];}return [0,12];};
  const setMode=value=>{mode=value;walk.setAttribute('aria-pressed',String(mode==='walk'));fly.setAttribute('aria-pressed',String(mode==='fly'));document.body.classList.toggle('flying',mode==='fly');hint.textContent=mode==='fly'?'Click the island to look · WASD or arrows to move · Space up · Ctrl or C down · Shift faster · Esc releases mouse':'Click the island to look · WASD or arrows to move · Shift to go faster · Esc releases mouse';if(mode==='walk'){const [x,z]=safeLanding(camera.position.x,camera.position.z);camera.position.set(x,groundHeight(x,z)+1.6,z);}else camera.position.y=Math.max(camera.position.y,groundHeight(camera.position.x,camera.position.z)+1.6);};
  const pause=()=>{keys.clear();touch.clear();touchLook=null;if(document.pointerLockElement===canvas) document.exitPointerLock();};
  walk.onclick=()=>setMode('walk');fly.onclick=()=>setMode('fly');
  document.querySelector('#overview').onclick=()=>{setMode('fly');camera.position.set(440,410,510);pointAt(0,5,0);};
  canvas.addEventListener('click',e=>{if(Date.now()-lastTouch<800||dialog.open||matchMedia('(pointer: coarse)').matches)return;canvas.requestPointerLock?.();});
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&!dialog.open)look(e.movementX,e.movementY);});
  const allowed=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','ControlLeft','ControlRight','KeyC']);
  addEventListener('keydown',e=>{if(dialog.open||!allowed.has(e.code)||e.altKey||e.metaKey||(['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(document.activeElement?.tagName)))return;e.preventDefault();keys.add(e.code);});
  addEventListener('keyup',e=>keys.delete(e.code));
  document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas)keys.clear();});
  addEventListener('blur',pause);
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!dialog.open){lastTouch=Date.now();touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(touchLook?.id===e.pointerId){look(e.clientX-touchLook.x,e.clientY-touchLook.y);touchLook.x=e.clientX;touchLook.y=e.clientY;}});
  const endLook=e=>{if(touchLook?.id===e.pointerId)touchLook=null;};canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);
  document.querySelectorAll('[data-move]').forEach(button=>{const name=button.dataset.move;button.addEventListener('contextmenu',e=>e.preventDefault());button.addEventListener('pointerdown',e=>{e.preventDefault();window.getSelection()?.removeAllRanges();button.setPointerCapture(e.pointerId);touch.add(name);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>touch.delete(name));});
  camera.position.set(9,groundHeight(9,14)+1.6,14);pointAt(0,5,0);
  return {pause, findPatch(position,velocity=new THREE.Vector3()){const airborne=position.y>groundHeight(position.x,position.z)+3;if(airborne){let candidate=null;const predicted=position.clone().addScaledVector(velocity,.7),baseAngle=velocity.lengthSq()>.01?Math.atan2(-velocity.z,-velocity.x):0;for(const radius of [7,9,5]){for(let i=0;i<16;i++){const a=baseAngle+i*Math.PI/8,x=position.x+Math.cos(a)*radius,z=position.z+Math.sin(a)*radius;let clear=true;for(const [tx,tz] of [[position.x,position.z],[predicted.x,predicted.z]]){let px=tx,pz=tz;for(let j=1;j<=12;j++){const nx=tx+(x-tx)*j/12,nz=tz+(z-tz)*j/12;if(forestCollision(nx,nz,px,pz)){clear=false;break;}px=nx;pz=nz;}if(!clear)break;}if(clear){const view=new THREE.Vector3(x,Math.max(position.y+.8,groundHeight(x,z)+1.6),z),target=position.clone().add(new THREE.Vector3(0,1,0));if(sceneVisible(view,target)&&sceneVisible(view,predicted.clone().add(new THREE.Vector3(0,1,0)))){candidate=[x,z];break;}}}if(candidate)break;}const [x,z]=candidate||[position.x+5,position.z+5];setMode('fly');camera.position.set(x,Math.max(position.y+.8,groundHeight(x,z)+1.6),z);}else{const x=position.x+3,z=position.z+4;camera.position.set(x,groundHeight(x,z)+1.6,z);setMode('walk');}const look=airborne?position.clone().addScaledVector(velocity,.5):position;pointAt(look.x,look.y+1,look.z);}, update(dt){if(dialog.open)return;const has=(...codes)=>codes.some(c=>keys.has(c));let forward=Number(has('KeyW','ArrowUp')||touch.has('forward'))-Number(has('KeyS','ArrowDown')||touch.has('back'));let side=Number(has('KeyD','ArrowRight')||touch.has('right'))-Number(has('KeyA','ArrowLeft')||touch.has('left'));const length=Math.hypot(forward,side);if(length){forward/=length;side/=length;}const speed=(mode==='fly'?38:3.5)*(has('ShiftLeft','ShiftRight')?2:1)*dt;let dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed;let {x,z}=camera.position;if(mode==='walk'){if(walkable(x+dx,z,x,z))x+=dx;if(walkable(x,z+dz,x,z))z+=dz;camera.position.set(x,groundHeight(x,z)+1.6,z);}else{camera.position.x=THREE.MathUtils.clamp(x+dx,-650,650);camera.position.z=THREE.MathUtils.clamp(z+dz,-650,650);const vertical=Number(has('Space')||touch.has('up'))-Number(has('ControlLeft','ControlRight','KeyC')||touch.has('down'));camera.position.y=THREE.MathUtils.clamp(camera.position.y+vertical*speed,groundHeight(camera.position.x,camera.position.z)+1.6,700);}}};
}
