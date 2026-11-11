import * as THREE from 'three';
import { createVisitorControls } from './visitor-controls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sampleState } from '../../shared/state.js';
import { createIsland } from './island.js';
import { setupCommunity } from './community.js';
import { ISLAND } from './terrain.js';
import { travelFraction, loopFraction } from './travel-progress.js';
import { adaptiveQuality } from './render-quality.js';
import { places, groundHeight, walkRoute, swingRoute, swingLoop, trees, statusText, isLocalPreview, safePatch } from './world-state.js';

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

const vineGeometry=new THREE.BufferGeometry();vineGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));const swingVine=new THREE.Line(vineGeometry,new THREE.LineBasicMaterial({color:0x718452}));swingVine.visible=false;scene.add(swingVine);
let mixer, headBone, rightHandBone, clips = {}, currentAction, currentName, headRest = null;
const lookUp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.6);
new GLTFLoader().load(new URL('./assets/patch.glb', document.baseURI).href, gltf => {
  patch.add(gltf.scene);
  gltf.scene.traverse(node => { if (node.isBone && /mixamorig[:_]?head$/i.test(node.name)) headBone=node; if(node.isBone && /mixamorig[:_]?righthand$/i.test(node.name)) rightHandBone=node; });
  mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    // Locomotion is controlled by the island, not the source animation's travel.
    const tracks = clip.tracks.map(track => {
      const copy = track.clone();
      if (/(?:mixamorig[:_]?Hips).*\.position$/i.test(copy.name) && ['walk','run','swing','swim'].includes(clip.name)) {
        for (let i = 0; i < copy.values.length; i += 3) { copy.values[i] = copy.values[0]; copy.values[i + 2] = copy.values[2]; }
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
let state = null, hasLiveState = false, demo = false, journey = null, serverOffset = 0;
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
    if (!state || (previous && previous.since!==next.patch.since && !next.patch.target)) {
      const [x,z]=places[next.patch.place]; patch.position.set(x,groundHeight(x,z),z);
    }
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
swingVine.visible=false;fishingRod.visible=action==='fish'&&!target;
const dest=action==='climb'&&place==='tall-trees'&&!target?[trees[0][0]+.45,trees[0][1]]:action==='sleep'&&place==='hammock'&&!target?[0,1]:action==='swim'&&place==='pond'&&!target?[ISLAND.pondX,ISLAND.pondZ]:places[target]||places[place];
const travel = !!(target && places[target] && ['walk','run','swing'].includes(action));
const swinging = action === 'swing';
const key = `${action}|${place}|${target||''}|${since||''}`;
if (travel || swinging) {
  if (!journey || journey.key !== key) {
    const points=[{p:new THREE.Vector3(places[place][0],groundHeight(...places[place]),places[place][1]),mode:'ground'}];
    const groundPoints=route=>route.forEach(([x,z])=>points.push({p:new THREE.Vector3(x,groundHeight(x,z),z),mode:'ground'}));
    const branchPoints=anchors=>anchors.forEach(([x,y,z],i)=>points.push({p:new THREE.Vector3(x,y-1.8,z),mode:travel&&i===0?'climb':'branch'}));
    if(swinging){
      if(travel){if(place!=='tall-trees')groundPoints(walkRoute(place,'tall-trees'));const [ax,,az]=swingLoop()[0];groundPoints([[ax,az]]);branchPoints(swingLoop());if(target!=='tall-trees'){const last=points.at(-1).p;points.push({p:new THREE.Vector3(last.x,groundHeight(last.x,last.z),last.z),mode:'descent'});groundPoints([places['tall-trees']]);groundPoints(walkRoute('tall-trees',target));}}
      else {points.length=0;branchPoints(swingLoop());}
    } else groundPoints(walkRoute(place,target));
    const lengths=[];let total=0;for(let i=1;i<points.length;i++){const length=points[i-1].p.distanceTo(points[i].p);lengths.push(length);total+=length;}
    journey={key,points,lengths,total};
  }
  const j=journey;
  const fraction=travel?travelFraction(since,until,Date.now()+serverOffset,j.total):loopFraction(since,Date.now()+serverOffset,j.total);
  let remaining=j.total*fraction,index=0;while(index<j.lengths.length-1&&remaining>j.lengths[index])remaining-=j.lengths[index++];
  const from=j.points[index],to=j.points[index+1];if(to){const progress=j.lengths[index]?remaining/j.lengths[index]:0,branch=to.mode==='branch';patch.position.lerpVectors(from.p,to.p,progress);if(branch){const dx=to.p.x-from.p.x,dz=to.p.z-from.p.z,horizontal=Math.hypot(dx,dz);if(horizontal>.1){let nx=-dz/horizontal,nz=dx/horizontal;if(Math.abs(nx)>.1&&nx<0){nx=-nx;nz=-nz;}const arc=Math.sin(Math.PI*progress)*2;patch.position.x+=nx*arc;patch.position.z+=nz*arc;}patch.position.y-=Math.sin(Math.PI*progress)*Math.min(.8,j.lengths[index]*.15);const rope=vineGeometry.attributes.position;rope.setXYZ(0,patch.position.x,patch.position.y+1.8,patch.position.z);rope.setXYZ(1,to.p.x,to.p.y+1.8,to.p.z);rope.needsUpdate=true;swingVine.visible=true;}else if(to.mode!=='climb'&&to.mode!=='descent')patch.position.y=groundHeight(patch.position.x,patch.position.z);patch.rotation.y=Math.atan2(to.p.x-from.p.x,to.p.z-from.p.z);patch.rotation.z=branch?Math.sin(Math.PI*progress)*.2:0;playClip(branch?'swing':to.mode==='climb'||to.mode==='descent'?'hang':action==='run'?'run':'walk');}
} else {
  journey=null;
  const exploring=action==='explore';
  const wander=exploring?[dest[0]+Math.sin(t*.25)*1.2,dest[1]+(place==='cave'?1.2+Math.cos(t*.25)*.6:Math.cos(t*.25)*1.2)]:dest;
  const dx=wander[0]-patch.position.x,dz=wander[1]-patch.position.z,dist=Math.hypot(dx,dz);
  if(dist>.15){let step=Math.min(dist,dt*(exploring?.65:1.7));patch.position.x+=dx/dist*step;patch.position.z+=dz/dist*step;patch.rotation.y=Math.atan2(dx,dz);}
  patch.position.y=action==='swim'?ISLAND.pondY-.35:action==='climb'&&dist<=.5?groundHeight(patch.position.x,patch.position.z)+1.5:action==='sleep'&&place==='hammock'?groundHeight(0,0)+1.5:groundHeight(patch.position.x,patch.position.z);
  patch.rotation.z=0;
  const names={idle:'idle',think:'idle',phone:'idle',write:'idle',look:'look-around',wave:'look-around',walk:'walk',run:'run',climb:'hang',swim:'swim',fish:'sit',sit:'sit',sleep:'sleep',eat:'idle',explore:Math.sin(t*.45)>.55?'look-around':'walk','watch-sky':'sit'};
  if(action==='fish')patch.rotation.y=Math.atan2(ISLAND.pondX-patch.position.x,ISLAND.pondZ-patch.position.z);
  playClip(action==='climb'&&dist>.5?'walk':names[action]||'idle',action==='sit'||action==='fish'||action==='watch-sky');
}
if(dt>0)patchVelocity.subVectors(patch.position,previousPatchPosition).multiplyScalar(1/dt).clampLength(0,5);
if(mixer) mixer.update(dt);
if(rightHandBone&&(fishingRod.visible||swingVine.visible)){rightHandBone.getWorldPosition(handWorld);if(swingVine.visible){const rope=vineGeometry.attributes.position;rope.setXYZ(0,handWorld.x,handWorld.y,handWorld.z);rope.needsUpdate=true;}if(fishingRod.visible)fishingRod.position.copy(patch.worldToLocal(handWorld.clone()));}
// Tip his head back from the held sitting pose. Set it absolutely each frame so the tilt never accumulates.
if(action==='watch-sky' && headBone && currentName==='sit' && currentAction.time >= clips.sit.duration*.8){
  if(!headRest) headRest=headBone.quaternion.clone();
  headBone.quaternion.copy(headRest).multiply(lookUp);
} else headRest=null;
const speechLive=!!says && Number.isFinite(Date.parse(speechUntil)) && Date.now()+serverOffset<Date.parse(speechUntil);$('#bubble').hidden=!speechLive;$('#bubble').textContent=speechLive?says:'';
let day=Number.isFinite(state.clock.dayFraction)?state.clock.dayFraction:.5;let daylight=THREE.MathUtils.smoothstep(Math.sin((day-.25)*Math.PI*2),-.12,.2);let weather=state.clock.weather;let overcast=weather==='cloudy'||weather==='rain'||weather==='storm';sky.copy(skyNight).lerp(skyDay,daylight*(overcast?.65:1));updateSky(daylight);scene.background=skyTexture;scene.fog.color.copy(sky);hemi.intensity=1.25+daylight*(overcast?.4:1.15);sunLight.intensity=daylight*(overcast?.6:2.4)+(1-daylight)*.65;sunLight.color.copy(moonColor).lerp(sunColor,daylight);let angle=(day-.25)*Math.PI*2;sun.position.set(Math.cos(angle)*900,Math.sin(angle)*900,0);moon.position.copy(sun.position).multiplyScalar(-1);sunLight.position.copy(daylight>.05?sun.position:moon.position);stars.material.opacity=1-daylight;stars.visible=daylight<.98;clouds.forEach((c,i)=>{c.visible=overcast||i<5;c.position.x+=reducedMotion.matches?0:dt*.14;if(c.position.x>520)c.position.x=-520;});rain.visible=weather==='rain'||weather==='storm';if(rain.visible){rain.position.x=camera.position.x;rain.position.z=camera.position.z;rain.position.y=camera.position.y-(reducedMotion.matches?0:t*12%30);}
scenery.update(reducedMotion.matches?0:dt,daylight);renderer.render(scene,camera);}
requestAnimationFrame(frame);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
