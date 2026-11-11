import * as THREE from 'three';
import { groundHeight, trees } from './world-state.js';

// Match the current island's tree and palm trunks. Keep the routes between them open.
export const obstacles = [...trees.map(([x,z])=>[x,z,.57])];
for(let row=0;row<4;row++) for(let col=0;col<5;col++) obstacles.push([-16+col*2+(row%2)*.5,5+row*2.6,.45]);
for(let z=-10;z<=20;z+=5) obstacles.push([32-Math.abs(z)*.13,z,.45]);
for(let i=0;i<15;i++){const a=i*2.4,r=2+(i%4)*1.1;obstacles.push([22+Math.cos(a)*r,-20+Math.sin(a)*r,.55]);}
export function walkable(x,z,fromX=x,fromZ=z) {
  if ((x/43)**2+(z/34)**2 > 1) return false;
  const d=Math.hypot(x-fromX,z-fromZ);
  if (d && Math.abs(groundHeight(x,z)-groundHeight(fromX,fromZ))/d > 1.1) return false;
  return !obstacles.some(([ox,oz,r]) => Math.hypot(x-ox,z-oz)<r && Math.hypot(x-ox,z-oz)<Math.hypot(fromX-ox,fromZ-oz));
}
export function createVisitorControls(camera, canvas, dialog) {
  let mode='walk', yaw=0, pitch=0, touchLook=null, lastTouch=0;
  const keys=new Set(), touch=new Set(), euler=new THREE.Euler(0,0,0,'YXZ');
  const walk=document.querySelector('#walk'), fly=document.querySelector('#fly'), hint=document.querySelector('#explore-hint');
  const orientation=()=>{euler.set(pitch,yaw,0);camera.quaternion.setFromEuler(euler);};
  const look=(dx,dy)=>{yaw-=dx*.0025;pitch=THREE.MathUtils.clamp(pitch-dy*.0025,-1.45,1.45);orientation();};
  const pointAt=(x,y,z)=>{camera.lookAt(x,y,z);euler.setFromQuaternion(camera.quaternion,'YXZ');yaw=euler.y;pitch=euler.x;};
  const setMode=value=>{mode=value;walk.setAttribute('aria-pressed',String(mode==='walk'));fly.setAttribute('aria-pressed',String(mode==='fly'));document.body.classList.toggle('flying',mode==='fly');hint.textContent=mode==='fly'?'Click the island to look · WASD or arrows to move · Space up · Ctrl or C down · Shift faster · Esc releases mouse':'Click the island to look · WASD or arrows to move · Shift to go faster · Esc releases mouse';if(mode==='walk'){let x=camera.position.x,z=camera.position.z;const scale=Math.sqrt((x/43)**2+(z/34)**2);if(scale>1){camera.position.x/=scale;camera.position.z/=scale;}camera.position.y=groundHeight(camera.position.x,camera.position.z)+1.6;}else camera.position.y=Math.max(camera.position.y,groundHeight(camera.position.x,camera.position.z)+1.6);};
  const pause=()=>{keys.clear();touch.clear();touchLook=null;if(document.pointerLockElement===canvas) document.exitPointerLock();};
  walk.onclick=()=>setMode('walk');fly.onclick=()=>setMode('fly');
  document.querySelector('#overview').onclick=()=>{setMode('fly');camera.position.set(48,48,58);pointAt(0,1,0);};
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
  document.querySelectorAll('[data-move]').forEach(button=>{const name=button.dataset.move;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touch.add(name);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>touch.delete(name));});
  camera.position.set(6,groundHeight(6,10)+1.6,10);pointAt(0,1.6,0);
  return {pause, findPatch(position){const x=position.x+3,z=position.z+4;camera.position.set(x,groundHeight(x,z)+1.6,z);setMode('walk');pointAt(position.x,position.y+1,position.z);}, update(dt){if(dialog.open)return;const has=(...codes)=>codes.some(c=>keys.has(c));let forward=Number(has('KeyW','ArrowUp')||touch.has('forward'))-Number(has('KeyS','ArrowDown')||touch.has('back'));let side=Number(has('KeyD','ArrowRight')||touch.has('right'))-Number(has('KeyA','ArrowLeft')||touch.has('left'));const length=Math.hypot(forward,side);if(length){forward/=length;side/=length;}const speed=(mode==='fly'?9:3.5)*(has('ShiftLeft','ShiftRight')?2:1)*dt;let dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed;let {x,z}=camera.position;if(mode==='walk'){if(walkable(x+dx,z,x,z))x+=dx;if(walkable(x,z+dz,x,z))z+=dz;camera.position.set(x,groundHeight(x,z)+1.6,z);}else{camera.position.x=THREE.MathUtils.clamp(x+dx,-90,90);camera.position.z=THREE.MathUtils.clamp(z+dz,-90,90);const vertical=Number(has('Space')||touch.has('up'))-Number(has('ControlLeft','ControlRight','KeyC')||touch.has('down'));camera.position.y=THREE.MathUtils.clamp(camera.position.y+vertical*speed,groundHeight(camera.position.x,camera.position.z)+1.6,90);}}};
}
