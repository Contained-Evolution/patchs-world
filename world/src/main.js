import * as THREE from 'three';
import { createVisitorControls } from './visitor-controls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sampleState } from '../../shared/state.js';
import { createIsland } from './island.js';
import { setupCommunity } from './community.js';
import { ISLAND } from './terrain.js';
import { travelFraction } from './travel-progress.js';
import { adaptiveQuality } from './render-quality.js';
import { places, groundHeight, walkRoute, swingLoop, traversalLoop, holdFor, statusText, isLocalPreview, safePatch } from './world-state.js';
import { patchRoute, roamPlan, ROAM, seedFrom } from './patch-motion.js';
import { makeTransfer } from './traversal.js';

const $ = s => document.querySelector(s);
const dialog = $('#map');
for(const [label,id] of Object.entries({grove:'banana-grove',trees:'tall-trees',pond:'pond',camp:'hammock',beach:'beach',lookout:'lookout',meadow:'meadow',cave:'cave',tide:'tide-pools'})){const [x,z]=places[id],node=document.querySelector('.map-label.'+label);node.style.left=`${50+x/6.4}%`;node.style.top=`${50+z/7.2}%`;node.style.right='auto';node.style.bottom='auto';}

$('#open-map').onclick = () => { controls.pause(); dialog.showModal(); };
$('#close-map').onclick = () => dialog.close();
setupCommunity(dialog);
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); } catch { $('#error').hidden = false; throw new Error('WebGL unavailable'); }
const basePixelRatio=Math.min(devicePixelRatio,1.5);renderer.setPixelRatio(basePixelRatio);
const updateQuality=adaptiveQuality(renderer,basePixelRatio),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#world').append(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xadd9d4, 750, 1650);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 12000);
const controls = createVisitorControls(camera, renderer.domElement, dialog, scene);
const hemi = new THREE.HemisphereLight(0xd9f5ee, 0x496d4c, 2.1); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffedbe, 2.4); scene.add(sunLight);
const sunColor=new THREE.Color(0xffedbe),moonColor=new THREE.Color(0x91b7e0);
const mat = color => new THREE.MeshStandardMaterial({color, roughness: 1});
function mesh(geo,material,x=0,y=0,z=0,parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;}
function ellipsoid(material,x,y,z,sx,sy,sz,parent=scene){const m=mesh(new THREE.SphereGeometry(1,12,8),material,x,y,z,parent);m.scale.set(sx,sy,sz);return m;}
const scenery=createIsland(scene);
const patch = new THREE.Group(); scene.add(patch);const patchVelocity=new THREE.Vector3(),previousPatchPosition=new THREE.Vector3();
const fishingRod=new THREE.Group(),rodDirection=new THREE.Vector3(.1,.65,2.2),rod=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,rodDirection.length(),6),new THREE.MeshStandardMaterial({color:0x6b4d31}));rod.position.copy(rodDirection).multiplyScalar(.5);rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),rodDirection.clone().normalize());fishingRod.add(rod);const lineGeo=new THREE.BufferGeometry().setFromPoints([rodDirection,new THREE.Vector3(.1,-.7,3.3)]);fishingRod.add(new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:0xd8d1b7})));patch.add(fishingRod);const handWorld=new THREE.Vector3();


let mixer, patchModel, headBone, rightHandBone, clips = {}, strideSpeed = {}, currentAction, currentName, headRest = null, roam = null;
// Turn smoothly toward a heading instead of snapping at each bend.
function face(angle,dt){const turn=Math.atan2(Math.sin(angle-patch.rotation.y),Math.cos(angle-patch.rotation.y));patch.rotation.y+=turn*Math.min(1,dt*7);}
const lookUp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.6);
new GLTFLoader().load(new URL('./assets/patch.glb', document.baseURI).href, gltf => {
  patchModel=gltf.scene; patch.add(patchModel);
  gltf.scene.traverse(node => { if (node.isBone && /mixamorig[:_]?head$/i.test(node.name)) headBone=node; if(node.isBone && /mixamorig[:_]?righthand$/i.test(node.name)) rightHandBone=node; });
  mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    // Locomotion is controlled by the island, not the source animation's travel.
    // Remove only the hips' steady drift, so the stride and bob stay and the loop never snaps back.
    const tracks = clip.tracks.map(track => {
      const copy = track.clone();
      if (/(?:mixamorig[:_]?Hips).*\.position$/i.test(copy.name) && ['walk','run','swing','swim'].includes(clip.name)) {
        const n=copy.times.length, drift=[0,1,2].map(c=>copy.values[(n-1)*3+c]-copy.values[c]), span=copy.times[n-1]-copy.times[0];
        if (span>0) { for (let i=0;i<n;i++) { const f=(copy.times[i]-copy.times[0])/span; for (let c=0;c<3;c++) copy.values[i*3+c]-=drift[c]*f; } strideSpeed[clip.name]=Math.hypot(...drift)/span; }
      }
      return copy;
    });
    clips[clip.name] = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }
}, undefined, error => { console.error('Unable to load Patch', error); $('#error').hidden = false; });
function playClip(name, once = false) {
  if (!mixer || !clips[name] || currentName === name) return;
  const next = mixer.clipAction(clips[name]);
  next.reset(); next.enabled = true; next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  next.clampWhenFinished = once;
  if (currentAction) currentAction.fadeOut(.2);
  next.fadeIn(.2).play(); currentAction = next; currentName = name;
}
let state = null, hasLiveState = false, demo = false, journey = null, serverOffset = 0, descent = null, wasAirborne = false, climbTime = 0;
function renderCare(p) {
  const panel=$('#care'), list=$('#care-needs');
  if (!p.needs) { panel.hidden=true; return; }
  panel.hidden=false; $('#care-mood').textContent=`Mood: ${p.mood || 'unknown'}`;
  list.replaceChildren();
  for (const [key,label] of [['hunger','Fullness'],['energy','Energy'],['fun','Fun'],['comfort','Comfort'],['social','Social']]) {
    const value=p.needs[key]; if (!Number.isFinite(value)) continue;
    const percent=Math.round(Math.max(0,Math.min(1,value))*100), row=document.createElement('div'), name=document.createElement('span'), meter=document.createElement('progress'), text=document.createElement('span');
    row.className='care-row'; name.textContent=label; meter.max=100; meter.value=percent; meter.setAttribute('aria-label',label); text.textContent=`${percent}%`; row.append(name,meter,text); list.append(row);
  }
}
const localPreview = isLocalPreview(location.hostname), start = performance.now();
const mockActions=['idle','walk','run','climb','swing','swim','fish','eat','sit','sleep','think','write','phone','wave','look','explore','watch-sky'], ids=Object.keys(places);
async function poll() {
  try {
    const response = await fetch('/patch/api/state', {cache:'no-store'});
    if (!response.ok) throw new Error('State unavailable');
    const next = await response.json();
    if (!next.patch || !next.clock) throw new Error('Invalid state');
    next.patch = safePatch(next.patch);
    const serverNow=Date.parse(next.clock.now);if(Number.isFinite(serverNow))serverOffset=serverNow-Date.now();
    const previous=state?.patch;
    // A poll can arrive after an activity ended while this tab was paused. Place
    // Patch at the server's destination instead of replaying an obsolete journey.
    const [px,pz]=places[next.patch.place];
    if (!state || (previous && previous.since!==next.patch.since && !next.patch.target && Math.hypot(patch.position.x-px,patch.position.z-pz)>60)) patch.position.set(px,groundHeight(px,pz),pz);
    state = next; hasLiveState = true; demo = false;
    renderCare(next.patch);
    $('#connection').hidden = true;
  } catch {
    demo = localPreview && !hasLiveState;
    $('#connection').hidden = demo;
    if (!state && !demo) $('#status').textContent = '';
  }
}
poll(); setInterval(poll,5000);
const skyDay=new THREE.Color(0xaddfdf),skyNight=new THREE.Color(0x101c40),sky=new THREE.Color();
const skyCanvas=document.createElement('canvas');skyCanvas.width=16;skyCanvas.height=256;const skyContext=skyCanvas.getContext('2d'),skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;let lastSky=-1;
function updateSky(daylight){const key=Math.round(daylight*40);if(key===lastSky)return;lastSky=key;const top=new THREE.Color(0x0b1837).lerp(new THREE.Color(0x559abe),daylight),horizon=new THREE.Color(0x28394e).lerp(new THREE.Color(0xc6e4db),daylight),gradient=skyContext.createLinearGradient(0,0,0,256);gradient.addColorStop(0,`#${top.getHexString()}`);gradient.addColorStop(1,`#${horizon.getHexString()}`);skyContext.fillStyle=gradient;skyContext.fillRect(0,0,16,256);skyTexture.needsUpdate=true;}
const starsGeo=new THREE.BufferGeometry(),starPositions=[];for(let i=0;i<300;i++){let a=Math.random()*Math.PI*2,b=Math.random()*Math.PI*.47,r=1200;starPositions.push(Math.cos(a)*Math.cos(b)*r,Math.sin(b)*r+5,Math.sin(a)*Math.cos(b)*r);}starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xfff8d7,size:2,transparent:true,depthWrite:false}));scene.add(stars);
const sun=mesh(new THREE.SphereGeometry(18,16,12),new THREE.MeshBasicMaterial({color:0xffe6a0}));const moon=mesh(new THREE.SphereGeometry(12,16,12),new THREE.MeshBasicMaterial({color:0xe9eddd}));
// Soft procedural cloud cards replace the old solid spheres.
function cloudTexture(){const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');for(let i=0;i<16;i++){const x=70+(i*71)%380,y=95+Math.sin(i*2.3)*32,r=35+(i%5)*12,grad=g.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(255,255,255,.15)');grad.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=grad;g.fillRect(x-r,y-r,r*2,r*2);}return new THREE.CanvasTexture(c);}
const cloudMap=cloudTexture(),clouds=[];for(let i=0;i<10;i++){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudMap,transparent:true,opacity:.75,depthWrite:false}));m.scale.set(190+i%3*35,90,1);m.position.set(Math.cos(i*2.4)*510,650+i%3*45,Math.sin(i*2.4)*510);scene.add(m);clouds.push(m);}
const rainGeo=new THREE.BufferGeometry(),drops=[];for(let i=0;i<500;i++)drops.push((Math.random()-.5)*50,Math.random()*35,(Math.random()-.5)*50);rainGeo.setAttribute('position',new THREE.Float32BufferAttribute(drops,3));const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xd6edf2,size:.12,transparent:true,opacity:.7}));scene.add(rain);
let last=performance.now();patch.position.set(0,groundHeight(0,0),0);
$('#find-patch').onclick=()=>{ if (state) controls.findPatch(patch.position,patchVelocity); };
function frame(now){requestAnimationFrame(frame);updateQuality(now);const dt=Math.min((now-last)/1000,.05);last=now;let t=(now-start)/1000;
if (demo) { let n=Math.floor(t/9); state={patch:{...sampleState.patch,action:mockActions[n%mockActions.length],place:ids[Math.floor(n/2)%ids.length],target:['walk','run','swing'].includes(mockActions[n%mockActions.length]) ? ids[(Math.floor(n/2)+1)%ids.length] : null,since:String(n),says:null},clock:{dayFraction:(.38+t/240)%1,weather:['clear','cloudy','rain','storm'][Math.floor(t/60)%4]}}; }
if (demo) renderCare(state.patch);
controls.update(dt);
$('#find-patch').disabled=!state;
if (!state) { patch.visible=false; scene.background=skyDay; scenery.update(reducedMotion.matches?0:dt,1); renderer.render(scene,camera); return; }
patch.visible=true;previousPatchPosition.copy(patch.position);
const {action,place,target,says,since,until,speechUntil}=state.patch;
$('#status').textContent = statusText(state.patch);
scenery.resetRopes();let heldRope=null, heldGrip=null;fishingRod.visible=action==='fish'&&!target;
const dest=action==='climb'&&place==='tall-trees'&&!target?[holdFor(0).grip[0],holdFor(0).grip[2]]:action==='sleep'&&place==='hammock'&&!target?[0,1]:action==='swim'&&place==='pond'&&!target?[ISLAND.pondX,ISLAND.pondZ]:places[target]||places[place];
const travel = !!(target && places[target] && ['walk','run','swing'].includes(action));
const swinging = action === 'swing';
const key = `${action}|${place}|${target||''}|${since||''}`;
if (travel || swinging) {
  if (!journey || journey.key !== key) {
    // Leave from where he is standing when that is near the place he is leaving.
    const here=[patch.position.x,patch.position.z],origin=Math.hypot(here[0]-places[place][0],here[1]-places[place][1])<60?here:places[place],seed=seedFrom(key);
    const ground=groundHeight(...origin),fromAir=wasAirborne&&patch.position.y>ground+.5;
    const points=[{p:new THREE.Vector3(origin[0],fromAir?patch.position.y:ground,origin[1]),mode:'ground'}];
    if(fromAir)points.push({p:new THREE.Vector3(origin[0],ground,origin[1]),mode:'descent'});
    const groundPoints=route=>route.forEach(([x,z])=>points.push({p:new THREE.Vector3(x,groundHeight(x,z),z),mode:'ground'}));
    const wayTo=(from,to,remembered)=>patchRoute(from,to,seed+points.length,remembered).slice(1);
    const branchPoints=holds=>holds.forEach((hold,i)=>{const [x,y,z]=hold.grip;points.push({p:new THREE.Vector3(x,y-1.8,z),hold,mode:travel&&i===0?'climb':'branch'});});
    if(swinging){
      if(travel){const [ax,,az]=swingLoop()[0];groundPoints(wayTo(origin,[ax,az],[origin,...walkRoute(place,'tall-trees'),[ax,az]]));branchPoints(traversalLoop());if(target!=='tall-trees'){const last=points.at(-1).p;points.push({p:new THREE.Vector3(last.x,groundHeight(last.x,last.z),last.z),mode:'descent'});groundPoints(wayTo([last.x,last.z],places[target],[[last.x,last.z],...walkRoute('tall-trees',target)]));}}
      else {points.length=0;branchPoints(traversalLoop());}
    } else groundPoints(wayTo(origin,places[target],[origin,...walkRoute(place,target)]));
    const lengths=[];let total=0;for(let i=1;i<points.length;i++){const length=points[i-1].p.distanceTo(points[i].p);lengths.push(length);total+=length;}
    const transfers=points.slice(1).map((point,i)=>point.mode==='branch'&&points[i].hold?makeTransfer(points[i].hold,point.hold):null);
    journey={key,points,lengths,total,transfers};
  }
  const j=journey;
  const elapsed=Math.max(0,(Date.now()+serverOffset-Date.parse(since))/1000||0);
  const mounting=!travel&&elapsed<4;
  const fraction=travel?travelFraction(since,until,Date.now()+serverOffset,j.total):((Math.max(0,elapsed-4)*3/Math.max(j.total,1))%1);
  let remaining=j.total*fraction,index=0;while(index<j.lengths.length-1&&remaining>j.lengths[index])remaining-=j.lengths[index++];
  const from=j.points[index],to=j.points[index+1];if(to){
    const progress=j.lengths[index]?remaining/j.lengths[index]:0,branch=to.mode==='branch';
    patch.position.lerpVectors(from.p,to.p,progress);
    if(branch&&!mounting){
      const sample=j.transfers[index].at(progress),dx=to.p.x-from.p.x,dz=to.p.z-from.p.z;
      patch.position.set(sample.grip[0],sample.grip[1]-1.8,sample.grip[2]);
      heldGrip=sample.grip;if(sample.hold?.type==='rope')heldRope=sample.hold.index;
      face(Math.atan2(dx,dz),dt);patch.rotation.z=heldRope!==null?Math.sin(Math.PI*progress)*.12:0;
      playClip(sample.hold?(sample.hold.type==='rope'?'rope-swing':'hang'):'swing');
    }else if(!mounting){
      if(to.mode!=='climb'&&to.mode!=='descent')patch.position.y=groundHeight(patch.position.x,patch.position.z);
      face(Math.atan2(to.p.x-from.p.x,to.p.z-from.p.z),dt);patch.rotation.z=0;
      const pace=travel?j.total/Math.max(1,(Date.parse(until)-Date.parse(since))/1000):1;
      const clip=to.mode==='climb'?'swing-start':to.mode==='descent'?'rope-to-ground':pace>1.9?'run':'walk';playClip(clip,clip==='swing-start'||clip==='rope-to-ground');
    }
  }
  if(mounting){const hold=holdFor(0),f=THREE.MathUtils.smoothstep(elapsed/4,0,1),[x,y,z]=hold.grip;patch.position.set(x,THREE.MathUtils.lerp(groundHeight(x,z),y-1.8,f),z);patch.rotation.z=0;playClip('swing-start',true);if(f>.98)heldGrip=hold.grip;}
  wasAirborne=swinging;descent=null;
} else {
  if(wasAirborne&&action!=='climb'){const ground=groundHeight(patch.position.x,patch.position.z);if(patch.position.y>ground+.5)descent={start:patch.position.y,ground,elapsed:0};wasAirborne=false;}
  if(action!=='climb')climbTime=0;
  journey=null;
  const names={idle:'idle',think:'idle',phone:'idle',write:'idle',look:'look-around',wave:'look-around',walk:'walk',run:'run',climb:'hang',swim:'swim',fish:'sit',sit:'sit',sleep:'sleep',eat:'idle',explore:'look-around','watch-sky':'sit'};
  // Exploring and similar activities are a shared roam: he picks spots, walks there, stops and looks around.
  const roams=!!ROAM[action]?.radius[place],roamKey=`${action}|${place}|${since||''}`;
  if(roams&&roam?.key!==roamKey)roam={key:roamKey,plan:roamPlan(action,place,seedFrom(roamKey))};
  if(!roams)roam=null;
  const elapsed=(Date.now()+serverOffset-Date.parse(since))/1000,pose=roam?.plan.at(Number.isFinite(elapsed)?Math.max(0,elapsed):t%9);
  const goal=pose?[pose.x,pose.z]:dest,dx=goal[0]-patch.position.x,dz=goal[1]-patch.position.z,dist=Math.hypot(dx,dz);
  // Catch up gently when he is out of place, and follow the roam exactly once he is on it.
  if(pose&&dist<1.5){patch.position.x=pose.x;patch.position.z=pose.z;if(pose.heading!==null)face(pose.heading,dt);}
  else if(dist>.15&&!descent){let step=Math.min(dist,dt*1.7);patch.position.x+=dx/dist*step;patch.position.z+=dz/dist*step;face(Math.atan2(dx,dz),dt);}
  const arriving=pose?dist>=1.5:dist>.5;
  if(action==='climb'&&!arriving&&place==='tall-trees')climbTime=Math.min(4,climbTime+dt);
  patch.position.y=action==='swim'?ISLAND.pondY-.35:action==='climb'&&!arriving&&place==='tall-trees'?THREE.MathUtils.lerp(groundHeight(patch.position.x,patch.position.z),holdFor(0).grip[1]-1.8,THREE.MathUtils.smoothstep(climbTime/4,0,1)):action==='sleep'&&place==='hammock'&&!arriving?groundHeight(0,0)+1.5:groundHeight(patch.position.x,patch.position.z);
  patch.rotation.z=0;
  if(action==='fish'&&!arriving)face(Math.atan2(ISLAND.pondX-patch.position.x,ISLAND.pondZ-patch.position.z),dt);
  let clip=arriving&&action!=='swim'?'walk':pose?pose.clip:names[action]||'idle';
  if(action==='climb'&&!arriving&&place==='tall-trees'){wasAirborne=true;if(climbTime>=4)heldGrip=holdFor(0).grip;else clip='swing-start';}
  if(descent){descent.elapsed+=dt;const f=Math.min(1,descent.elapsed/2);patch.position.y=THREE.MathUtils.lerp(descent.start,descent.ground,f);clip='rope-to-ground';heldGrip=null;if(f===1)descent=null;}
  playClip(clip,['sit','swing-start','rope-to-ground'].includes(clip));
}
if(dt>0)patchVelocity.subVectors(patch.position,previousPatchPosition).multiplyScalar(1/dt).clampLength(0,5);
// Match the stride to his ground speed so his feet neither slide nor race.
if(currentAction&&strideSpeed[currentName]&&dt>0){const speed=Math.hypot(patchVelocity.x,patchVelocity.z);currentAction.timeScale=speed>.05?THREE.MathUtils.clamp(speed/strideSpeed[currentName],.45,2.2):1;}
if(patchModel)patchModel.position.set(0,0,0);
if(mixer) mixer.update(dt);
if(rightHandBone&&heldGrip){
  patch.updateMatrixWorld(true);rightHandBone.getWorldPosition(handWorld);
  const correction=new THREE.Vector3(...heldGrip).sub(handWorld);patch.worldToLocal(correction.add(patch.position));patchModel.position.copy(correction);
  patch.updateMatrixWorld(true);rightHandBone.getWorldPosition(handWorld);
  if(heldRope!==null)scenery.setRope(heldRope,[handWorld.x,handWorld.y,handWorld.z]);
}
if(rightHandBone&&fishingRod.visible){patch.updateMatrixWorld(true);rightHandBone.getWorldPosition(handWorld);fishingRod.position.copy(patch.worldToLocal(handWorld.clone()));}
// Tip his head back from the held sitting pose. Set it absolutely each frame so the tilt never accumulates.
if(action==='watch-sky' && headBone && currentName==='sit' && currentAction.time >= clips.sit.duration*.8){
  if(!headRest) headRest=headBone.quaternion.clone();
  headBone.quaternion.copy(headRest).multiply(lookUp);
} else headRest=null;
const speechLive=!!says && Number.isFinite(Date.parse(speechUntil)) && Date.now()+serverOffset<Date.parse(speechUntil);$('#bubble').hidden=!speechLive;$('#bubble').textContent=speechLive?says:'';
let day=Number.isFinite(state.clock.dayFraction)?state.clock.dayFraction:.5;let daylight=THREE.MathUtils.smoothstep(Math.sin((day-.25)*Math.PI*2),-.12,.2);let weather=state.clock.weather;let overcast=weather==='cloudy'||weather==='rain'||weather==='storm';sky.copy(skyNight).lerp(skyDay,daylight*(overcast?.65:1));updateSky(daylight);scene.background=skyTexture;scene.fog.color.copy(sky);hemi.intensity=1.25+daylight*(overcast?.4:1.15);sunLight.intensity=daylight*(overcast?.6:2.4)+(1-daylight)*.65;sunLight.color.copy(moonColor).lerp(sunColor,daylight);let angle=(day-.25)*Math.PI*2;sun.position.set(Math.cos(angle)*900,Math.sin(angle)*900,0);moon.position.copy(sun.position).multiplyScalar(-1);sunLight.position.copy(daylight>.05?sun.position:moon.position);stars.material.opacity=1-daylight;stars.visible=daylight<.98;clouds.forEach((c,i)=>{c.visible=overcast||i<5;c.position.x+=reducedMotion.matches?0:dt*.14;if(c.position.x>520)c.position.x=-520;});rain.visible=weather==='rain'||weather==='storm';if(rain.visible){rain.position.x=camera.position.x;rain.position.z=camera.position.z;rain.position.y=camera.position.y-(reducedMotion.matches?0:t*12%30);}
scenery.update(reducedMotion.matches?0:dt,daylight);renderer.render(scene,camera);}
requestAnimationFrame(frame);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

document.getElementById('open-memory')?.addEventListener('click', () => { location.href = './memory.html'; });
