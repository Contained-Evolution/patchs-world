import { createPatchMouth } from './patch-mouth.js';
import { foragePlan } from './foraging.js';
import { createFoodProps } from './food-props.js';
import { createPatchInteractions, fishingPose, mealPose } from './patch-interactions.js';
import { createPatchEyes, blinkRate, drowsiness } from './patch-eyes.js';
import { captionAt } from '../../shared/speech.js';
import * as THREE from 'three';
import { createVisitorControls } from './visitor-controls.js';
import { setupIslandCameras } from './island-cameras.js';
import { setupIslandMap } from './island-map.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sampleState } from '../../shared/state.js';
import { hammock } from './hammock.js';
import { createIslandAudio } from './island-audio.js';
import { createIsland } from './island.js';
import { setupCommunity } from './community.js';
import { setupNotifications } from './notifications.js';
import { registerApp } from './app.js';
import { setupInstall } from './install.js';
import { ISLAND, RIVER, riverPoint, riverSpeed } from './terrain.js';
import { pondSwings, pondSwingPose, nextPondSwing } from './pond-swings.js';
import { travelFraction } from './travel-progress.js';
import { adaptiveQuality } from './render-quality.js';
import { places, groundHeight, walkRoute, swingLoop, traversalLoop, holdFor, trees, statusText, isLocalPreview, safePatch } from './world-state.js';
import { hasAnimationRoom, patchRoute, roamPlan, ROAM, seedFrom, rng, swimPlan } from './patch-motion.js';
import { clearGroundLine, inPond, nearestWalkable, pondAccess } from './island-collision.js';
import { CLIPS } from './patch-clips.js';
import { CLIMB_WALLS, wallHold, holdLine, climbPlan, ropeExitPlan, placement } from './climbing.js';
import { setupAnimationViewer } from './animation-viewer.js';
import { NEEDS, overallHealth, makeGauge } from './health-gauge.js';
import { makeTransfer, swingRhythm } from './traversal.js';
import { seatFor, usesTablet, deskBeats, deskClip } from './furniture.js';
import { beatPlan, beatsFor, walkClip } from './patch-beats.js';

const $ = s => document.querySelector(s);
// The beach marker is also the driftwood seat. A standing meal needs clear ground beside it.
const beachMeal = [places.beach[0] + 1.8, places.beach[1] + 1.7];
const dialog = $('#map');
const mapHome = $('#map-home');
$('#close-map').onclick = () => dialog.close();
const community=setupCommunity(dialog);
setupNotifications(dialog,community,registerApp());
setupInstall();
// Chris's account sees an Animations button in the menu that opens Patch's clip locker.
const animations=setupAnimationViewer();

fetch('/api/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(me=>{if(me?.user?.admin)$('#open-social-inbox').hidden=false;if(me?.user?.admin||isLocalPreview(location.hostname))$('#open-animations').hidden=false;}).catch(()=>{if(isLocalPreview(location.hostname))$('#open-animations').hidden=false;});
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); } catch { $('#error').hidden = false; throw new Error('WebGL unavailable'); }
const basePixelRatio=Math.min(devicePixelRatio,1.5);renderer.setPixelRatio(basePixelRatio);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const quality = $('#render-quality');
try { quality.value = localStorage.getItem('patch-render-quality') || 'auto'; } catch {}
if (!quality.value) quality.value = 'auto';
let adaptiveTick;
function applyQuality() {
  renderer.setPixelRatio(quality.value === 'reduced' ? Math.min(.75, basePixelRatio) : basePixelRatio);
  adaptiveTick = quality.value === 'auto' ? adaptiveQuality(renderer, basePixelRatio) : null;
}
quality.onchange = () => {
  try { localStorage.setItem('patch-render-quality', quality.value); } catch {}
  applyQuality();
};
applyQuality();
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#world').append(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xadd9d4, 750, 1650);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 12000);
const scenery=createIsland(scene),solids=scenery.walkSolids;
const soundSetting = $('#island-sound'), soundShortcut = $('#sound-shortcut');
const sound = createIslandAudio(soundSetting, $('#footsteps'));
function syncSoundShortcut() {
  soundShortcut.setAttribute('aria-pressed', String(soundSetting.checked));
  soundShortcut.title = soundSetting.checked ? 'Audio (sound on)' : 'Audio (sound off)';
}
soundSetting.addEventListener('change', syncSoundShortcut);
syncSoundShortcut();
const cameraFeeds = setupIslandCameras(renderer, scene);
const controls = createVisitorControls(camera, renderer.domElement, () => dialog.open, scene, solids);
const updateMap = setupIslandMap(renderer, $('#mini-chart canvas'), $('#full-chart canvas'), $('#map-landmarks'), renderAerial);

const healthButton = $('#open-health'), healthDrop = $('#health-drop');
const overallGauge = makeGauge('❤️', 'Patch’s health'), needGauges = new Map();
healthButton.append(overallGauge.el);
overallGauge.set(null);
for (const [key, label, icon] of NEEDS) {
  const gauge = makeGauge(icon, label);
  gauge.set(null);
  needGauges.set(key, gauge);
  $('#health-gauges').append(gauge.el);
}
function setHealthDrop(open) {
  healthDrop.hidden = !open;
  healthButton.setAttribute('aria-expanded', String(open));
}
healthButton.onclick = () => setHealthDrop(healthDrop.hidden);
const hudToggle = $('#toggle-hud'), hudPanel = $('#hud-panel');
hudToggle.onclick = () => {
  const expanded = hudPanel.inert;
  hudPanel.inert = !expanded;
  hudToggle.setAttribute('aria-expanded', String(expanded));
  const label = expanded ? 'Collapse menu' : 'Expand menu';
  hudToggle.setAttribute('aria-label', label);
  hudToggle.title = label;
  if (!expanded) setHealthDrop(false);
};
document.addEventListener('pointerdown', event => {
  if (!healthDrop.hidden && !healthDrop.contains(event.target) && !healthButton.contains(event.target)) setHealthDrop(false);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || healthDrop.hidden) return;
  setHealthDrop(false);
  healthButton.focus();
});

function openDialog() {
  setHealthDrop(false);
  controls.pause();
  if (!dialog.open) dialog.showModal();
}
function openIslandMenu(panel) {
  openDialog();
  community.showPanel(panel);
}
$('#open-map').onclick = () => openIslandMenu('map');
$('#open-menu').onclick = () => openIslandMenu('more');
soundShortcut.onclick = () => openIslandMenu('audio');
$('#open-cameras').onclick = () => {
  openIslandMenu('cameras');
  cameraFeeds.reset();
};
$('#back-to-map').onclick = () => {
  if (animations.isOpen()) animations.close();
  community.showPanel('more');
};
const embeddedPage = $('#island-page');
// The menu hub and the quick buttons beside the stream open the same pages; only pages opened from the hub have a Back button to it.
for (const container of [$('#island-menu'), $('.quick-row')]) container.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const { panel, page } = button.dataset, hub = !!button.closest('#more-panel');
  if (animations.isOpen() && panel !== 'animations') animations.close();
  openDialog();
  if (page) {
    embeddedPage.dataset.page = page;
    embeddedPage.title = $('#page-title').textContent = button.title || button.textContent;
    community.showPanel('page', hub);
    embeddedPage.src = `./${page}.html`;
  } else if (['audio', 'video', 'patch', 'rules', 'animations'].includes(panel)) {
    community.showPanel(panel, hub);
    if (panel === 'animations') animations.open();
  }
});
embeddedPage.addEventListener('load', () => {
  const page = embeddedPage.contentDocument;
  if (!page || !embeddedPage.dataset.page) return;
  // The island menu provides the navigation in the embedded view.
  const navigation = page.querySelector('header nav, header > a');
  if (navigation) navigation.style.display = 'none';
});
$('#close-animations').onclick = () => {
  animations.close();
  community.showPanel('more');
};
dialog.addEventListener('close', () => { if (!dialog.open && animations.isOpen()) animations.close(); });
// A notification opens the island at its panel: ?view=letters.
const view=new URLSearchParams(location.search).get('view');
if(view==='letters'||view==='board'){history.replaceState(null,'',location.pathname);controls.pause();dialog.showModal();community.openPanel(view);}
const hemi = new THREE.HemisphereLight(0xd9f5ee, 0x496d4c, 2.1); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffedbe, 2.4); scene.add(sunLight);
const sunColor=new THREE.Color(0xffedbe),moonColor=new THREE.Color(0x91b7e0);
const mat = color => new THREE.MeshStandardMaterial({color, roughness: 1});
function mesh(geo,material,x=0,y=0,z=0,parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;}
function ellipsoid(material,x,y,z,sx,sy,sz,parent=scene){const m=mesh(new THREE.SphereGeometry(1,12,8),material,x,y,z,parent);m.scale.set(sx,sy,sz);return m;}
const foodProps=createFoodProps(scene, scenery.block);let foodPose=null;
const patch = new THREE.Group(); scene.add(patch);const patchVelocity=new THREE.Vector3(),previousPatchPosition=new THREE.Vector3();
const interactions=createPatchInteractions(scene,patch),handWorld=new THREE.Vector3();
// His tablet: a thin bamboo-cased slate with a glowing screen, held in his hands when he reads or writes away from the computer.
const tablet=new THREE.Group(),tabletCase=new THREE.Mesh(new THREE.BoxGeometry(.24,.17,.016),new THREE.MeshStandardMaterial({color:0xe9d39a,roughness:.7})),tabletScreen=new THREE.Mesh(new THREE.PlaneGeometry(.215,.145),new THREE.MeshBasicMaterial({color:0x9fe3d2,toneMapped:false}));tabletScreen.position.z=.009;tablet.add(tabletCase,tabletScreen);tablet.visible=false;scene.add(tablet);
const otherHand=new THREE.Vector3(),headWorld=new THREE.Vector3();
// His bow rides in his left hand while he practises archery. Its string runs straight between the tips, and back to his right hand at full draw.
const bow=new THREE.Group(),bowTips=[new THREE.Vector3(0,.42,-.1),new THREE.Vector3(0,-.42,-.1)],bowGrip=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0)));
bow.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(bowTips[0],new THREE.Vector3(0,0,.1),bowTips[1]),16,.012,6),new THREE.MeshStandardMaterial({color:0x7a5230,roughness:.8})));
const bowString=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xefe6c8}));
bowString.frustumCulled=false;bow.visible=bowString.visible=false;scene.add(bow,bowString);
// When letters are waiting, his tablet pings him: a little envelope bobs over his head until he goes to the coconut computer.
function pingTexture(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle='#ffd27a';g.beginPath();g.arc(64,64,54,0,Math.PI*2);g.fill();g.strokeStyle='#5b3b22';g.lineWidth=6;g.stroke();g.fillStyle='#3b2a1a';g.font='64px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('✉',64,70);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const ping=new THREE.Sprite(new THREE.SpriteMaterial({map:pingTexture(),depthTest:false,transparent:true}));ping.scale.setScalar(.42);ping.visible=false;ping.renderOrder=5;scene.add(ping);


let patchMouth, patchEyes, mixer, patchModel, headBone, rightHandBone, leftHandBone, clips = {}, strideSpeed = {}, currentAction, currentName, roam = null;
// Turn smoothly toward a heading instead of snapping at each bend.
function face(angle,dt){const turn=Math.atan2(Math.sin(angle-patch.rotation.y),Math.cos(angle-patch.rotation.y));patch.rotation.y+=turn*Math.min(1,dt*7);}
let hoodie, hoodieLoading;
function updateOutfit() {
  const wearingHoodie = state?.patch.outfit === 'hoodie';
  if (hoodie) hoodie.visible = wearingHoodie;
  if (!patchModel || !wearingHoodie || hoodie || hoodieLoading) return;
  const model = patchModel;
  hoodieLoading = new GLTFLoader().loadAsync(new URL('./assets/patch-hoodie.glb', document.baseURI).href)
    .then(({ scene }) => {
      const body = model.getObjectByProperty('isSkinnedMesh', true);
      const garment = scene.getObjectByProperty('isSkinnedMesh', true);
      const bones = new Map(body.skeleton.bones.map(bone => [bone.name, bone]));
      const joints = garment.skeleton.bones.map(bone => bones.get(bone.name));
      if (joints.some(joint => !joint)) throw new Error('The hoodie does not match Patch’s rig.');
      scene.updateMatrixWorld(true);
      garment.matrixWorld.decompose(garment.position, garment.quaternion, garment.scale);
      garment.bind(new THREE.Skeleton(joints, garment.skeleton.boneInverses), garment.bindMatrix);
      garment.frustumCulled = false;
      garment.visible = state?.patch.outfit === 'hoodie';
      model.add(garment);
      hoodie = garment;
    })
    .catch(error => console.error('Unable to load Patch’s hoodie', error))
    .finally(() => { hoodieLoading = null; });
}
const lookUp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.6);
new GLTFLoader().load(new URL('./assets/patch.glb', document.baseURI).href, gltf => {
  patchModel=gltf.scene; patch.add(patchModel);
  patchEyes=createPatchEyes(patchModel);
  patchMouth=createPatchMouth(patchModel);
  updateOutfit();
  gltf.scene.traverse(node => { if (node.isBone && /mixamorig[:_]?head$/i.test(node.name)) headBone=node; if(node.isBone && /mixamorig[:_]?righthand$/i.test(node.name)) rightHandBone=node; if(node.isBone && /mixamorig[:_]?lefthand$/i.test(node.name)) leftHandBone=node; });
  interactions.rig(rightHandBone,leftHandBone,headBone);
  mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    // Locomotion is controlled by the island, not the source animation's travel.
    // Remove only the hips' steady drift, so the stride and bob stay and the loop never snaps back.
    const tracks = clip.tracks.map(track => {
      const copy = track.clone();
      if (/(?:mixamorig[:_]?Hips).*\.position$/i.test(copy.name) && ['walk','run','swing','swim','walk-texting','rope-climb','swing-land','carry-walk','carry-jog','carry-run','carry-stop','climb-top','jump-down','fall','pick-up','open-lid','happy-walk','tree-climb','flip','backflip','dance-hip-hop'].includes(clip.name)) {
        const n=copy.times.length, drift=[0,1,2].map(c=>copy.values[(n-1)*3+c]-copy.values[c]), span=copy.times[n-1]-copy.times[0];
        if(clip.name==='swing-land')drift[1]=0;
        if (span>0) { for (let i=0;i<n;i++) { const f=(copy.times[i]-copy.times[0])/span; for (let c=0;c<3;c++) copy.values[i*3+c]-=drift[c]*f; } strideSpeed[clip.name]=Math.hypot(...drift)/span; }
      }
      return copy;
    });
    clips[clip.name] = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }
}, undefined, error => { console.error('Unable to load Patch', error); $('#error').hidden = false; });
function playClip(name, once = false) {
  if (!mixer || !clips[name]) return;
  if (currentName === name) { currentAction.timeScale=1; return; }
  const next = mixer.clipAction(clips[name]);
  next.reset(); next.enabled = true; next.timeScale = 1; next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  next.clampWhenFinished = once;
  if (currentAction) currentAction.fadeOut(.2);
  next.fadeIn(.2).play(); currentAction = next; currentName = name;
}
// Clips that follow a shared plan are posed at the plan's time, so every visitor sees the same frame.
function poseClip(name,time){playClip(name);if(currentName!==name||!currentAction)return;currentAction.timeScale=0;currentAction.time=Math.max(0,Math.min(time,clips[name].duration-1e-3));}
let state = null, hasLiveState = false, demo = false, journey = null, serverOffset = 0, descent = null, wasAirborne = false, climbTime = 0, climb = null, ropeExit = null;
let groundApproach = null, groundActivity = null, inFurniture = false, swimAccess = null, enteringPond = false, beats = null, satAt = 0, seatShift = 0;
const GROUND_ARRIVAL_DISTANCE = .15;
const SWIM_ARRIVAL_DISTANCE = .6;
const riverEntry = riverPoint(RIVER.entry);
const entryBank = riverPoint(RIVER.entry,-1.42);
const riverBank = [entryBank.x,entryBank.z];
// Leave enough time to reach the river, ride it down and reach the lap from the outflow.
const riverEntrySeconds = Math.hypot(riverBank[0]-places.pond[0],riverBank[1]-places.pond[1])/1.7
  +(RIVER.length-RIVER.entry)/2.3+20;
let riverRide = null, swim = null;
let pondSwing = null;

function followRiver(dt) {
 const here=[patch.position.x,patch.position.z];
 if(!riverRide.boarding){
  if(Math.hypot(here[0]-riverBank[0],here[1]-riverBank[1])>GROUND_ARRIVAL_DISTANCE){
   const walking=approachGround(riverBank,dt);
   patch.position.y=groundHeight(patch.position.x,patch.position.z);
   playClip(walking?'walk':'idle');
   return;
  }
  riverRide.boarding=true;
 }
 if(riverRide.station===null){
  const dx=riverEntry.x-here[0],dz=riverEntry.z-here[1],distance=Math.hypot(dx,dz);
  const step=distance>0?Math.min(1,dt*1.9/distance):1;
  const x=here[0]+dx*step,z=here[1]+dz*step;
  const bed=groundHeight(x,z);
  patch.position.set(x,Math.max(bed,riverEntry.y-.35),z);
  face(Math.atan2(dx,dz),dt);
  playClip(bed>riverEntry.y-.35?'walk':'swim');
  if(step===1)riverRide.station=RIVER.entry;
  return;
 }
 const s=Math.min(RIVER.length,riverRide.station+dt*riverSpeed(riverRide.station));
 riverRide.station=s;
 const current=riverPoint(s,.08*Math.sin((s-RIVER.entry)*.32));
 const falling=s>=RIVER.lip&&s<RIVER.foot;
 patch.position.set(current.x,current.y+(falling?.18:-.35),current.z);
 face(current.heading,dt);
 playClip(falling?'fall':'swim');
 if(s===RIVER.length)riverRide=null;
}
function approachGround(goal, dt) {
  const here = [patch.position.x, patch.position.z];
  const change = groundApproach ? Math.hypot(goal[0]-groundApproach.goal[0],goal[1]-groundApproach.goal[1]) : Infinity;
  const repath = change > 1.5 || (!groundApproach?.points.length && change > GROUND_ARRIVAL_DISTANCE);
  if(repath){
    const route=patchRoute(here,goal,0,[],solids);
    groundApproach={goal,points:route};
  }
  const points=groundApproach.points;
  while(points.length&&Math.hypot(points[0][0]-here[0],points[0][1]-here[1])<.04)points.shift();
  const next=points.length<=1&&clearGroundLine(here,goal,solids)?goal:points[0];
  if(!next)return false;
  const dx=next[0]-here[0],dz=next[1]-here[1],distance=Math.hypot(dx,dz);
  if(distance<.001)return false;
  const step=Math.min(distance,dt*1.7)/distance,point=[here[0]+dx*step,here[1]+dz*step];
  if(!clearGroundLine(here,point,solids))return false;
  patch.position.x=point[0];patch.position.z=point[1];face(Math.atan2(dx,dz),dt);
  return true;
}
// Climbs follow a seeded plan. At the lookout he braces on the rock's flat face;
// in the tall trees he climbs a rope, lands on its canopy bough and rests.
function startClimb(place,key,since,until,spirit,weather){
  const seed=seedFrom(key),random=rng(seed),duration=Math.max(60,(Date.parse(until)-Date.parse(since))/1000||600);
  if(place==='lookout'){const line=wallHold(CLIMB_WALLS[0]),plan=climbPlan(line,random,{duration,fromGround:true,spirit,weather});return {key,line,plan,start:line.stand(plan.segments[0].s),joined:false};}
  // A rope is held facing its tree.
  const hold=holdFor([1,9,8][seed%3]),[gx,,gz]=hold.grip,[tx,tz]=trees[hold.index];
  const line=holdLine(hold,Math.atan2(tx-gx,tz-gz)),plan=climbPlan(line,random,{duration,fromGround:false,spirit,weather});
  return {key,line,plan,start:[gx,gz],joined:true};
}
// Returns false while the generic code still has him walking to the tree and pulling himself up.
function followClimb(elapsed,dt){
  const wall=climb.line.kind==='wall',seg=climb.plan.at(Math.max(0,elapsed-(wall?0:4))),p=placement(climb.line,seg);
  if(!wall&&climbTime<4)return false;
  if(!climb.joined){
    // He joins the shared climb from the ground, walking round the rock if it is in his way.
    const ground=seg.mode==='ground'||seg.mode==='walk',spot=ground?[p.x,p.z]:climb.line.stand(seg.s),here=[patch.position.x,patch.position.z];
    if(ground&&Math.hypot(spot[0]-here[0],spot[1]-here[1])<.3)climb.joined=true;
    else{const moving=approachGround(spot,dt);if(!moving)face(climb.line.heading,dt);patch.position.y=groundHeight(patch.position.x,patch.position.z);patch.rotation.z=0;playClip(moving?'walk':'idle');return true;}
  }
  // Blend his feet across a clip change, matching the animation crossfade.
  if(p.clip!==climb.clip){climb.from=patch.position.clone();climb.blend=0;climb.clip=p.clip;}
  climb.blend=Math.min(1,climb.blend+dt/.2);
  const climbPosition=new THREE.Vector3(p.x,p.y,p.z).lerpVectors(climb.from,p,climb.blend);
  if (wall && ['walk','ground'].includes(seg.mode) && patch.position.y<=groundHeight(patch.position.x,patch.position.z)+.3) {
    const here=[patch.position.x,patch.position.z];
    if(!clearGroundLine(here,[climbPosition.x,climbPosition.z],solids)){
      const moving=approachGround([p.x,p.z],dt);
      patch.position.y=groundHeight(patch.position.x,patch.position.z);
      playClip(moving?'walk':'idle');
      return true;
    }
  }
  patch.position.copy(climbPosition);
  face(p.heading,dt);patch.rotation.z=0;
  if(p.moving)playClip(p.clip);else poseClip(p.clip,p.time);
  wasAirborne=!wall&&seg.mode!=='rope-ground';return true;
}
function renderCare(p) {
  const known = !!p.needs;
  overallGauge.set(known ? overallHealth(p.needs) : null);
  for (const [key, gauge] of needGauges) gauge.set(p.needs?.[key]);
  $('#care-mood').textContent = p.mood ? `Mood: ${p.mood}` : '';
  const carrying = $('#care-carrying'), items = Array.isArray(p.carrying) ? p.carrying : [];
  carrying.hidden = !items.length;
  carrying.textContent = items.length ? `Carrying: ${items.join(', ')}` : '';
}
// Everything Patch thinks and says, oldest at the top; the stream follows the newest line unless the visitor scrolled up.
const stream = $('#stream'), streamSeen = new Set();
function renderStream(feed) {
  if (!Array.isArray(feed)) return;
  const fresh = feed.filter(line => line && typeof line.text === 'string' && !streamSeen.has(`${line.at}|${line.kind}|${line.text}`));
  if (!fresh.length) return;
  const follow = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 24;
  stream.querySelector('.stream-empty')?.remove();
  for (const line of fresh) {
    streamSeen.add(`${line.at}|${line.kind}|${line.text}`);
    const item = document.createElement('p');
    item.className = `stream-line stream-${line.kind === 'says' ? 'says' : 'thought'}`;
    item.textContent = line.kind === 'says' ? `“${line.text}”` : line.text;
    stream.append(item);
  }
  if (follow) stream.scrollTop = stream.scrollHeight;
}
const localPreview = isLocalPreview(location.hostname), start = performance.now();
// Each recording's timing, loaded once, so his mouth follows the words he's saying.
const timings = new Map();
let faceClip;
function speechTiming(speech) {
  const id = speech?.voice;
  if (!id || !/^[0-9a-z]+$/.test(id)) return null;
  if (!timings.has(id)) {
    timings.set(id, null);
    fetch(`/api/voice/${id}`).then(response => response.ok ? response.json() : null).then(clip => { if (clip?.timing) timings.set(id, clip.timing); }, () => {});
    for (const old of [...timings.keys()].slice(0, -8)) timings.delete(old);
  }
  return timings.get(id);
}
const mockActions=['idle','walk','run','climb','swing','swim','fish','eat','sit','sleep','think','write','research','computer','wave','look','explore','watch-sky','archery','dance'], ids=Object.keys(places);
async function poll() {
  try {
    const response = await fetch('/api/state', {cache:'no-store'});
    if (!response.ok) throw new Error('State unavailable');
    const next = await response.json();
    if (!next.patch || !next.clock) throw new Error('Invalid state');
    next.patch = safePatch(next.patch);
    const serverNow=Date.parse(next.clock.now);if(Number.isFinite(serverNow))serverOffset=serverNow-Date.now();
    const previous=state?.patch;
    // A poll can arrive after an activity ended while this tab was paused. Place
    // Patch at the server's destination instead of replaying an obsolete journey.
    const [px,pz]=places[next.patch.place];
    const midSwing=pondSwing?.elapsed!=null;
    if (!hasLiveState || (!midSwing && !riverRide?.boarding && previous && previous.since!==next.patch.since && !next.patch.target && Math.hypot(patch.position.x-px,patch.position.z-pz)>60)) {
      const { action, place, target, since, spirit, activityWeather }=next.patch;
      const age=(serverNow-Date.parse(since))/1000;
      if(action==='swim'&&place==='pond'&&!target&&age>riverEntrySeconds){
        const key=`${action}|${place}|${since}`,plan=swimPlan(rng(seedFrom(key)),spirit,activityWeather);
        const lap=plan.at(age);
        swim={key,plan};
        patch.position.set(lap.x,ISLAND.pondY-.35,lap.z);
        patch.rotation.y=lap.heading;
      }else{
        const seat = target ? null : seatFor(action,place);
        const spawn = seat ? [seat.x, seat.z] : action==='eat'&&place==='beach'&&!target?nearestWalkable(...beachMeal,solids):nearestWalkable(px,pz,solids);
        if (spawn) patch.position.set(spawn[0],groundHeight(...spawn),spawn[1]);
        if (seat) patch.rotation.y = seat.heading;
      }
    }
    state = next; hasLiveState = true; demo = false;
    updateOutfit();
    renderCare(next.patch);
    renderStream(next.feed);
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
const rainGeometry = new THREE.BufferGeometry();
const dropVertices = [], dropTips = [];
for (let i = 0; i < 1700; i++) {
  const drop = [(Math.random()-.5)*54, Math.random()*26, (Math.random()-.5)*54];
  dropVertices.push(...drop, ...drop);
  dropTips.push(0, 1);
}
rainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dropVertices, 3));
rainGeometry.setAttribute('tip', new THREE.Float32BufferAttribute(dropTips, 1));
const rainTime = { value: 0 }, rainStrength = { value: 0 };
const rain = new THREE.LineSegments(rainGeometry, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { rainTime, rainStrength },
  vertexShader: `
    attribute float tip;
    uniform float rainTime, rainStrength;
    varying float rainAlpha;
    void main() {
      vec3 drop = position;
      drop.y = mod(drop.y-rainTime,26.0)-11.0;
      drop.x = mod(drop.x+27.0+rainTime*.15,54.0)-27.0;
      rainAlpha = (1.0-smoothstep(12.0,26.0,length(drop.xz)))*mix(.12,.62,tip)*rainStrength;
      drop += tip*vec3(.09,-mix(.37,.74,rainStrength),.028);
      gl_Position = projectionMatrix*modelViewMatrix*vec4(drop,1.0);
    }`,
  fragmentShader: `
    varying float rainAlpha;
    void main() {
      gl_FragColor = vec4(.68,.81,.85,rainAlpha);
      #include <colorspace_fragment>
    }`
}));
rain.frustumCulled = false;
scene.add(rain);
let last=performance.now();const spawn=nearestWalkable(0,0,solids);patch.position.set(spawn[0],groundHeight(...spawn),spawn[1]);
const findPatch = $('#find-patch'), followPatch = $('#follow-patch');
const sleepingInHammock = () => inFurniture && state?.patch.action === 'sleep' && state.patch.place === 'hammock';
findPatch.onclick = () => {
  if (state) controls.findPatch(patch.position, false, sleepingInHammock());
};
$('#jump-to-patch').onclick = () => {
  if (state && patch.visible) controls.jumpToPatch(patch.position);
};
followPatch.onchange = () => {
  if (followPatch.checked && state) controls.findPatch(patch.position, true, sleepingInHammock());
  else controls.stopFollowing();
};

const aerialSunPosition = new THREE.Vector3(), aerialSunColor = new THREE.Color();
function renderAerial(view) {
  const background = scene.background, fog = scene.fog;
  const hemiIntensity = hemi.intensity, sunIntensity = sunLight.intensity, wasRaining = rain.visible;
  const cloudVisibility = clouds.map(cloud => cloud.visible);
  aerialSunPosition.copy(sunLight.position);
  aerialSunColor.copy(sunLight.color);
  scene.background = skyDay;
  scene.fog = null;
  rain.visible = false;
  clouds.forEach(cloud => { cloud.visible = false; });
  hemi.intensity = 2.2;
  sunLight.intensity = 2.5;
  sunLight.position.set(-250, 650, 180);
  sunLight.color.copy(sunColor);
  scenery.setTrackingTarget(null);
  try {
    renderer.render(scene, view);
  } finally {
    scene.background = background;
    scene.fog = fog;
    rain.visible = wasRaining;
    clouds.forEach((cloud, index) => { cloud.visible = cloudVisibility[index]; });
    hemi.intensity = hemiIntensity;
    sunLight.intensity = sunIntensity;
    sunLight.position.copy(aerialSunPosition);
    sunLight.color.copy(aerialSunColor);
  }
}
const captureChoice = new URLSearchParams(location.search).get('social-camera');
const socialCamera = /^([0-9]|1[01])$/.test(captureChoice || '') ? Number(captureChoice) : null;
const captureFrame = socialCamera === null ? null : Object.assign(document.createElement('canvas'), {
  id: 'social-camera-frame', width: 720, height: 480,
});
if (captureFrame) {
  captureFrame.style.cssText = 'position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;background:#173c38';
  document.body.append(captureFrame);
}
function renderIsland(now) {
  updateMap(now, camera.position, patch.visible ? patch.position : null, dialog.open && !mapHome.hidden);
  const renderView = view => {
    if (rain.visible) rain.position.set(view.position.x, view.position.y, view.position.z);
    scenery.setTrackingTarget(patch.visible && !cameraFeeds.open && followPatch.checked ? patch.position : null);
    renderer.render(scene, view);
  };
  if (captureFrame && hasLiveState && patchModel) {
    if (!captureFrame.dataset.ready && cameraFeeds.capture(socialCamera, captureFrame, renderView)) captureFrame.dataset.ready = 'true';
    return;
  }
  if (cameraFeeds.open) cameraFeeds.render(now, renderView);
  else renderView(controls.camera);
}
function frame(now){requestAnimationFrame(frame);sound.pause(animations.isOpen() || (cameraFeeds.open && !cameraFeeds.audio));cameraFeeds.update();sound.setDroneMotion(cameraFeeds.droneMotion);if(animations.isOpen()){last=now;return;}adaptiveTick?.(now);const dt=Math.min((now-last)/1000,.05);last=now;let t=(now-start)/1000;
if (demo) { let n=Math.floor(t/9); const mockAction=mockActions[n%mockActions.length];state={patch:{...sampleState.patch,mail:n%3,action:mockAction,place:mockAction==='computer'?'computer':ids[Math.floor(n/2)%ids.length],target:['walk','run','swing'].includes(mockActions[n%mockActions.length]) ? ids[(Math.floor(n/2)+1)%ids.length] : null,since:`n${n}n`,says:null},clock:{dayFraction:(.38+t/240)%1,weather:['clear','cloudy','rain','storm'][Math.floor(t/60)%4]}}; }
if (demo) renderCare(state.patch);
const walked = controls.update(dt) || 0;
findPatch.disabled = followPatch.disabled = !state;
if (!state) { sound.update(cameraFeeds.camera || controls.camera,{daylight:1,weather:'clear',walked}); patch.visible=false; scene.background=skyDay; rain.visible=false; scenery.update(reducedMotion.matches?0:dt,1); renderIsland(now); return; }
patch.visible=true;previousPatchPosition.copy(patch.position);
const {action,place,target,since,until,speech}=state.patch,mail=Number(state.patch.mail)||0;scenery.setComputer(mail,action,place,target,(Date.parse(until)-Date.now()-serverOffset)/1000);
$('#status').textContent = statusText(state.patch)+(mail&&!(place==='computer'&&!target)?` ✉ ${mail} letter${mail===1?'':'s'} waiting at his coconut computer.`:'');
foodPose=null;scenery.resetRopes();let heldRope=null, heldGrip=null, fishing=null, meal=null;
const climbKey=`${action}|${place}|${since||''}`,spirit=state.patch.spirit||'okay',sleeping=action==='sleep'&&!target;
const activityWeather=place==='cave'||place==='computer'?'clear':state.patch.activityWeather;
const serverNow=Date.now()+serverOffset,timing=speechTiming(speech),talking=!!speech&&serverNow>=Date.parse(speech.at)&&serverNow<Date.parse(speech.until);
if(sleeping){ropeExit=null;riverRide=null;descent=null;wasAirborne=false;}
else if(climb?.line.kind==='rope'&&(climb.key!==climbKey||target)&&wasAirborne&&!ropeExit){
 const line=climb.line;ropeExit={line,plan:ropeExitPlan(line,{x:patch.position.x,y:patch.position.y,z:patch.position.z},currentName==='sleep-lay'),elapsed:0};
 descent=null;journey=null;climb=null;
}

if(!ropeExit&&action==='climb'&&!target&&(place==='lookout'||place==='tall-trees')){if(climb?.key!==climbKey){climb=startClimb(place,climbKey,since,until,spirit,activityWeather);climbTime=0;}}else climb=null;
if(action==='swim'&&place==='pond'&&!target){
 if(swim?.key!==climbKey)swim={key:climbKey,plan:swimPlan(rng(seedFrom(climbKey)),spirit,activityWeather)};
}else swim=null;
const activityTime=(serverNow-Date.parse(since))/1000,lap=swim?.plan.at(activityTime);
const seat=target?null:seatFor(action,place),dest=seat?[seat.x,seat.z]:climb?climb.start:lap?[lap.x,lap.z]:action==='eat'&&place==='beach'&&!target?beachMeal:places[target]||places[place];
const travel = !!(target && places[target] && ['walk','run','swing'].includes(action));
const swimmingHoleSwing = action==='swing'&&place==='pond'&&!target;
const swinging = action==='swing'&&!swimmingHoleSwing;
const key = `${action}|${place}|${target||''}|${since||''}`;
if(groundActivity!==key){
 groundActivity=key;groundApproach=null;inFurniture=false;swimAccess=null;enteringPond=false;
 if(pondSwing?.elapsed==null)pondSwing=swimmingHoleSwing?{index:seedFrom(key)%pondSwings.length,direction:1,elapsed:null}:null;
 if(!riverRide?.boarding)riverRide=lap&&pondSwing?.elapsed==null&&!inPond(patch.position.x,patch.position.z)?{boarding:false,station:null}:null;
}
const leavingPond=!lap&&(swimAccess||inPond(patch.position.x,patch.position.z));
let pondGrip=null, pondRope=-1;
if(riverRide&&!ropeExit){
 journey=null;descent=null;wasAirborne=false;
 patch.rotation.z=0;
 followRiver(dt);
} else if(pondSwing?.elapsed!=null){
 const swing=pondSwings[pondSwing.index],sample=pondSwingPose(swing,pondSwing.elapsed);
 pondSwing.elapsed+=dt;
 patch.position.set(...sample.position);
 patch.rotation.z=0;
 face(swing.heading,dt);
 playClip(sample.clip);
 if(sample.grip){
  heldGrip=pondGrip=sample.grip;
  pondRope=pondSwing.index;
 }
 if(sample.landed){
  scenery.pondScenery.splash(sample.position[0],sample.position[2]);
  pondSwing=swimmingHoleSwing?nextPondSwing(pondSwing):null;
 }
} else if(leavingPond){
 const here=[patch.position.x,patch.position.z];
 swimAccess ??= pondAccess(here,solids);
 if(swimAccess){
  const {bank}=swimAccess,dx=bank[0]-here[0],dz=bank[1]-here[1],distance=Math.hypot(dx,dz);
  const step=distance>0?Math.min(1,dt*1.7/distance):1,next=[here[0]+dx*step,here[1]+dz*step];
  if(clearGroundLine(here,next,solids,true)){
   const bed=groundHeight(...next);
   patch.position.set(next[0],inPond(...next)?Math.max(bed,ISLAND.pondY-.35):bed,next[1]);
   face(Math.atan2(dx,dz),dt);
   if(step===1)swimAccess=null;
  }
 }
 playClip('swim');
} else if(swimmingHoleSwing&&!ropeExit){
 const {mount,heading}=pondSwings[pondSwing.index];
 if(Math.hypot(patch.position.x-mount[0],patch.position.z-mount[1])<=GROUND_ARRIVAL_DISTANCE){
  pondSwing.elapsed=0;
  face(heading,dt);
 }else{
  const walking=approachGround(mount,dt);
  patch.position.y=groundHeight(patch.position.x,patch.position.z);
  playClip(walking?'walk':'idle');
 }
 journey=null;descent=null;wasAirborne=false;
} else if(ropeExit){
 ropeExit.elapsed+=dt;const seg=ropeExit.plan.at(ropeExit.elapsed),p=placement(ropeExit.line,seg);
 patch.position.set(p.x,p.y,p.z);patch.rotation.z=0;face(p.heading,dt);poseClip(p.clip,p.time);
 if(seg.mode==='rope-ground'){ropeExit=null;wasAirborne=false;climbTime=0;journey=null;}
} else if (travel || swinging) {
  if (!journey || journey.key !== key) {
    // Leave from where he is standing when that is near the place he is leaving.
    const here=[patch.position.x,patch.position.z],origin=Math.hypot(here[0]-places[place][0],here[1]-places[place][1])<60?here:places[place],seed=seedFrom(key);
    const start=nearestWalkable(...origin,solids)||origin;
    const ground=groundHeight(...start),fromAir=wasAirborne&&patch.position.y>ground+.5;
    const points=[{p:new THREE.Vector3(start[0],fromAir?patch.position.y:ground,start[1]),mode:'ground'}];
    if(fromAir)points.push({p:new THREE.Vector3(start[0],ground,start[1]),mode:'descent'});
    const groundPoints=route=>route.forEach(([x,z])=>points.push({p:new THREE.Vector3(x,groundHeight(x,z),z),mode:'ground'}));
    const wayTo=(from,to,remembered)=>patchRoute(from,to,seed+points.length,remembered,solids).slice(1);
    const branchPoints=holds=>holds.forEach((hold,i)=>{const [x,y,z]=hold.grip;points.push({p:new THREE.Vector3(x,y-1.8,z),hold,mode:travel&&i===0?'climb':'branch'});});
    if(swinging){
      if(travel){
        const [ax,,az]=swingLoop()[0],mount=nearestWalkable(ax,az,solids);
        if(mount){
          groundPoints(wayTo(start,mount,[start,...walkRoute(place,'tall-trees'),mount]));
          const last=points.at(-1).p;
          if(Math.hypot(last.x-mount[0],last.z-mount[1])<.01){
            branchPoints(traversalLoop());
            if(target!=='tall-trees'){
              const tip=points.at(-1).p,landing=nearestWalkable(tip.x,tip.z,solids);
              if(landing){
                points.push({p:new THREE.Vector3(landing[0],groundHeight(...landing),landing[1]),mode:'descent'});
                groundPoints(wayTo(landing,places[target],[landing,...walkRoute('tall-trees',target)]));
              }
            }
          }
        }
      }
      else {points.length=0;branchPoints(traversalLoop());}
    } else groundPoints(wayTo(start,places[target],[start,...walkRoute(place,target)]));
    const lengths=[];let total=0;for(let i=1;i<points.length;i++){const length=points[i-1].p.distanceTo(points[i].p);lengths.push(length);total+=length;}
    const transfers=points.slice(1).map((point,i)=>point.mode==='branch'&&points[i].hold?makeTransfer(points[i].hold,point.hold):null);
    journey={key,points,lengths,total,transfers};
  }
  const j=journey;
  const elapsed=Math.max(0,(Date.now()+serverOffset-Date.parse(since))/1000||0);
  const mounting=!travel&&elapsed<4;
  const rhythm=travel||!j.lengths.length?null:swingRhythm(elapsed-4,j.lengths,spirit,activityWeather);
  let remaining=rhythm?.distance??j.total*travelFraction(since,until,serverNow),index=0;while(index<j.lengths.length-1&&remaining>j.lengths[index]+1e-8)remaining-=j.lengths[index++];
  const from=j.points[index],to=j.points[index+1];if(to){
    const progress=j.lengths[index]?Math.min(1,remaining/j.lengths[index]):0,branch=to.mode==='branch';
    patch.position.lerpVectors(from.p,to.p,progress);
    if(branch&&!mounting){
      const sample=j.transfers[index].at(progress),dx=to.p.x-from.p.x,dz=to.p.z-from.p.z;
      patch.position.set(sample.grip[0],sample.grip[1]-1.8,sample.grip[2]);
      heldGrip=sample.grip;if(sample.hold?.type==='rope')heldRope=sample.hold.index;
      face(Math.atan2(dx,dz),dt);patch.rotation.z=heldRope!==null?Math.sin(Math.PI*progress)*.12:0;
      playClip(sample.hold?(sample.hold.type==='rope'?(rhythm?.resting?'rope-hang':'rope-swing'):'hang'):'swing');
    }else if(!mounting){
      if(to.mode!=='climb'&&to.mode!=='descent')patch.position.y=groundHeight(patch.position.x,patch.position.z);
      // He climbs the trunk facing it.
      const trunk=to.mode==='climb'&&trees[to.hold.index];
      face(trunk?Math.atan2(trunk[0]-patch.position.x,trunk[1]-patch.position.z):Math.atan2(to.p.x-from.p.x,to.p.z-from.p.z),dt);patch.rotation.z=0;
      const pace=travel?j.total/Math.max(1,(Date.parse(until)-Date.parse(since))/1000):1;
      const clip=to.mode==='climb'?'tree-climb':to.mode==='descent'?'jump-down':action==='run'||pace>1.9?'run':walkClip(spirit,activityWeather);
      if(to.mode==='descent')poseClip('jump-down',progress*CLIPS['jump-down'].duration);
      else if(travel&&progress===1&&index===j.lengths.length-1)playClip('idle');
      else playClip(clip);
    }
  }
  if(mounting){const hold=holdFor(0),f=THREE.MathUtils.smoothstep(elapsed/4,0,1),[x,y,z]=hold.grip;patch.position.set(x,THREE.MathUtils.lerp(groundHeight(x,z),y-1.8,f),z);patch.rotation.z=0;if(f<.7){const [tx,tz]=trees[hold.index];face(Math.atan2(tx-x,tz-z),dt);playClip('tree-climb');}else playClip('swing-start',true);if(f>.98)heldGrip=hold.grip;}
  if(!to){patch.position.copy(from.p);playClip('idle');}
  wasAirborne=swinging&&!!to;descent=null;
} else {
  if(wasAirborne&&action!=='climb'){const ground=groundHeight(patch.position.x,patch.position.z);if(patch.position.y>ground+.5)descent={start:patch.position.y,ground,elapsed:0};wasAirborne=false;}
  if(action!=='climb')climbTime=0;
  journey=null;
  const names={idle:'idle',think:'idle',computer:'typing',research:'tablet-stand',write:'tablet-stand',look:'look-around',wave:'look-around',walk:'walk',run:'run',climb:'hang',swim:'swim',fish:'sit-ground',sit:'sit-ground',sleep:'sleep',eat:'idle',explore:'look-around','watch-sky':'sit-ground',archery:'bow-idle',dance:'dance-swing-2'};
  // Exploring and similar activities are a shared roam: he picks spots, walks there, stops and looks around.
  const foraging=action==='eat'&&place==='banana-grove',roams=foraging||!!ROAM[action]?.radius[place],roamKey=`${action}|${place}|${since||''}`;
  if(roams&&roam?.key!==roamKey)roam={key:roamKey,plan:foraging?foragePlan(seedFrom(roamKey),solids,spirit,activityWeather):roamPlan(action,place,seedFrom(roamKey),solids,spirit,activityWeather)};
  if(!roams)roam=null;
  // Standing still, he follows the activity's seeded beats instead of one looping clip.
  const beatName=roams||lap||climb?null:place==='computer'&&seat?deskBeats(action):beatsFor(action,place,!!seat);
  if(beatName&&beats?.key!==roamKey){
    const spot=nearestWalkable(...dest,solids);
    const room=place!=='cave'&&!!spot&&hasAnimationRoom(...spot,solids);
    beats={key:roamKey,plan:beatPlan(beatName,rng(seedFrom(roamKey)),spirit,activityWeather,room)};
  }
  if(!beatName)beats=null;
  const elapsed=(Date.now()+serverOffset-Date.parse(since))/1000,pose=roam?.plan.at(Number.isFinite(elapsed)?Math.max(0,elapsed):t%9);
  if(!(climb&&!descent&&followClimb(Number.isFinite(elapsed)?elapsed:t,dt))){
  const here=[patch.position.x,patch.position.z];
  const inWater=inPond(...here);
  if(lap&&!inWater){
    swimAccess ??= pondAccess(places.pond,solids);
    if(swimAccess&&Math.hypot(here[0]-swimAccess.bank[0],here[1]-swimAccess.bank[1])<=GROUND_ARRIVAL_DISTANCE)enteringPond=true;
  }
  if(enteringPond&&Math.hypot(here[0]-swimAccess.water[0],here[1]-swimAccess.water[1])<.25)enteringPond=false;
  const swimming=!!lap&&(inWater||enteringPond);
  // Travel to bed is a separate activity. Once asleep, he stays at the bed.
  if(sleeping)inFurniture=true;
  const goal=pose?[pose.x,pose.z]:lap?(enteringPond?swimAccess.water:swimming?dest:swimAccess?.bank||here):nearestWalkable(...dest,solids)||here;
  const dx=goal[0]-here[0],dz=goal[1]-here[1],dist=Math.hypot(dx,dz);
  let arriving=!inFurniture&&dist>(swimming?SWIM_ARRIVAL_DISTANCE:GROUND_ARRIVAL_DISTANCE),moving=false;
  if(!descent&&pose&&dist<1.5&&clearGroundLine(here,goal,solids)){
    patch.position.x=pose.x;patch.position.z=pose.z;arriving=false;
    if(pose.heading!==null)face(pose.heading,dt);
  }else if(!descent&&swimming){
    const fraction=dist<SWIM_ARRIVAL_DISTANCE?1:Math.min(1,dt*1.7/dist);
    const next=[here[0]+dx*fraction,here[1]+dz*fraction];
    if(clearGroundLine(here,next,solids,true)){
      patch.position.x=next[0];patch.position.z=next[1];face(dist<SWIM_ARRIVAL_DISTANCE?lap.heading:Math.atan2(dx,dz),dt);
    }
  }else if(!descent&&arriving)moving=approachGround(goal,dt);
  if(pose?.basket&&!arriving&&!descent)foodPose=pose;
  if(climb&&!arriving)climbTime=Math.min(4,climbTime+dt);
  patch.position.y=swimming&&inPond(patch.position.x,patch.position.z)?ISLAND.pondY-.35:climb&&!arriving?THREE.MathUtils.lerp(groundHeight(patch.position.x,patch.position.z),climb.line.point(0)[1]-1.8,THREE.MathUtils.smoothstep(climbTime/4,0,1)):groundHeight(patch.position.x,patch.position.z);
  patch.rotation.z=0;
  let clip=arriving&&!swimming?(moving?walkClip(spirit,activityWeather):'idle'):pose?pose.clip:names[action]||'idle';
  if(climb&&!arriving){wasAirborne=true;clip=climb.line.kind==='rope'?'rope-climb':'swing-start';}
  if(swimming&&!arriving&&!lap.stroke)clip='tread';
  if(descent){descent.elapsed+=dt;const f=Math.min(1,descent.elapsed/2);patch.position.y=THREE.MathUtils.lerp(descent.start,descent.ground,f);clip='fall';heldGrip=null;if(f===1)descent=null;}
  if(sleeping){
    if(place==='hammock'){
      patch.rotation.y=0;
      patch.position.set(hammock.x,groundHeight(hammock.x,hammock.z)+hammock.sidePose,hammock.z+hammock.sleepOffsetZ);
    } else {
      patch.rotation.y=0;
      patch.position.set(goal[0],groundHeight(...goal),goal[1]);
    }
    const beat=beats.plan.at(elapsed);
    poseClip(beat.clip,beat.time);
  } else if(seat&&!arriving&&!descent){
    // On a seat he settles onto it facing its way; at the coconut computer he reaches for the keys, types, and sits back near the end.
    const sitTime=Number.isFinite(elapsed)?Math.max(0,elapsed):t;
    // A visitor who arrives well into the sit finds him already seated.
    if(!inFurniture)satAt=sitTime>20?-Infinity:sitTime;
    inFurniture=true;
    // The approach ends on clear ground. Sitting aligns the pose to the furniture.
    patch.position.x+=(seat.x-patch.position.x)*Math.min(1,dt*6);patch.position.z+=(seat.z-patch.position.z)*Math.min(1,dt*6);face(seat.heading,dt);
    if(place==='computer'){
      const left=(Date.parse(until)-serverNow)/1000,desk=deskClip(action,sitTime,left,beats.plan);
      seatShift=(CLIPS[desk.clip].seat??CLIPS.sit.seat)-CLIPS.sit.seat;
      poseClip(desk.clip,desk.time);
    }
    else{
      // He lowers himself onto the seat, then follows the seat's beats. Each clip is slid so his hips stay on it.
      // Fishing starts on the server's clock so refreshing during the first cast keeps his pose.
      const down=CLIPS['stand-to-sit'].duration,seatedFor=action==='fish'?sitTime:sitTime-satAt;
      const beat=seatedFor<down?{clip:'stand-to-sit',time:seatedFor}:beats?.plan.at(sitTime)??{clip:'seat-idle',time:sitTime%CLIPS['seat-idle'].duration};
      seatShift=(CLIPS[beat.clip].seat-CLIPS.sit.seat)*(beat.clip==='stand-to-sit'?THREE.MathUtils.smoothstep(seatedFor/down,.25,.9):1);
      poseClip(beat.clip,beat.time);
      if(action==='fish'&&beat.clip==='seat-idle')fishing=fishingPose(Math.max(0,sitTime-down),spirit,activityWeather,seedFrom(roamKey));
    }
  } else if(foodPose){
    if(foodPose.moving)playClip(foodPose.clip);
    else poseClip(foodPose.clip,foodPose.time);
    if(foodPose.meal)meal=mealPose(foodPose.time,spirit,'banana',foodPose.t1-foodPose.t0);
  }
  else if(pose&&!pose.moving&&!arriving&&!descent){
    if(talking&&CLIPS[pose.clip].quiet)playClip('idle');
    else poseClip(pose.clip,pose.time);
  }
  else if(beats&&!arriving&&!descent&&!swimming){
    // A yawn or a grumble waits while he is talking.
    const beat=beats.plan.at(Number.isFinite(elapsed)?elapsed:t);
    if(talking&&CLIPS[beat.clip].quiet)playClip(clip);
    else{
      patch.position.y-=CLIPS[beat.clip].lift||0;poseClip(beat.clip,beat.time);
      if(action==='eat'&&beat.base)meal=mealPose(beat.elapsed,spirit,state.patch.food,beat.duration);
    }
  }
  else playClip(clip,['sit','swing-start','rope-to-ground','fall','jump-down'].includes(clip));
  }
}
if(dt>0)patchVelocity.subVectors(patch.position,previousPatchPosition).multiplyScalar(1/dt).clampLength(0,5);
// Match the stride to his ground speed so his feet neither slide nor race.
if(currentAction&&strideSpeed[currentName]&&dt>0&&['walk','run','swing','swim','carry-walk','carry-jog','carry-run','happy-walk'].includes(currentName)){const speed=Math.hypot(patchVelocity.x,patchVelocity.z);currentAction.timeScale=speed>.05?THREE.MathUtils.clamp(speed/strideSpeed[currentName],.45,2.2):1;}
if(patchModel)patchModel.position.set(0,0,seatShift);seatShift=0;
interactions.reset();
if(mixer) mixer.update(dt);
if(fishing)interactions.fish(fishing);
if(meal)interactions.eat(meal,state.patch.food);
foodProps.update(foodPose,patch,leftHandBone,rightHandBone);
patchEyes?.update(dt, action==='sleep' && ['sleep','sleep-lay','sleep-roll'].includes(currentName), {rate:blinkRate(action,talking), shift:currentName!==faceClip, drowsy:action==='sleep'?0:drowsiness(state.patch.needs?.energy)});faceClip=currentName;
scenery.pondScenery.hold(pondRope,pondGrip);
if(rightHandBone&&heldGrip){
  patch.updateMatrixWorld(true);rightHandBone.getWorldPosition(handWorld);
  const correction=new THREE.Vector3(...heldGrip).sub(handWorld);patch.worldToLocal(correction.add(patch.position));patchModel.position.copy(correction);
  patch.updateMatrixWorld(true);rightHandBone.getWorldPosition(handWorld);
  if(heldRope!==null)scenery.setRope(heldRope,[handWorld.x,handWorld.y,handWorld.z]);
}
// The tablet sits between his hands when both hold it, otherwise in his right hand, screen turned to his face.
tablet.visible=!!(rightHandBone&&headBone&&usesTablet(action,place)&&!target&&(currentName==='walk-texting'||currentName==='texting'||currentName==='tablet-stand'&&currentAction.time>=CLIPS['tablet-stand'].out));
if(tablet.visible){patch.updateMatrixWorld(true);rightHandBone.getWorldPosition(handWorld);headBone.getWorldPosition(headWorld);if(leftHandBone&&currentName!=='texting'&&(currentName==='walk-texting'||currentAction.time>=CLIPS['tablet-stand'].held)){leftHandBone.getWorldPosition(otherHand);handWorld.lerp(otherHand,.5);}tablet.position.copy(handWorld);tablet.lookAt(headWorld);tablet.translateZ(.03);}
bow.visible=bowString.visible=!!(leftHandBone&&rightHandBone&&action==='archery'&&!target&&currentName?.startsWith('bow-'));
if(bow.visible){
  patch.updateMatrixWorld(true);leftHandBone.getWorldPosition(bow.position);leftHandBone.getWorldQuaternion(bow.quaternion).multiply(bowGrip);bow.updateMatrixWorld(true);
  const drawn=currentName==='bow-aim'||currentName==='bow-draw'&&currentAction.time>CLIPS['bow-draw'].duration*.6,top=bow.localToWorld(bowTips[0].clone()),bottom=bow.localToWorld(bowTips[1].clone());
  if(drawn)rightHandBone.getWorldPosition(handWorld);else handWorld.lerpVectors(top,bottom,.5);
  bowString.geometry.setFromPoints([top,handWorld,bottom]);
}
ping.visible=mail>0&&!(place==='computer'&&!target)&&action!=='sleep';if(ping.visible)ping.position.set(patch.position.x,patch.position.y+1.7+Math.sin(t*3)*.06,patch.position.z);
// The ground sit animates his head, so the tilt goes on top of each frame's pose.
if(action==='watch-sky' && headBone && (currentName==='sit-ground'||currentName==='sit-idle-2')) headBone.quaternion.multiply(lookUp);
if(travel&&headBone&&['walk','happy-walk','run'].includes(currentName)&&Number.isFinite(activityTime)){
  // Brief glances leave the route and stride unchanged.
  const interval=spirit==='happy'?14:spirit==='tired'?30:20;
  const glance=Math.max(0,Math.sin(activityTime/interval*Math.PI*2)-.8)*5;
  const exposed=['beach','meadow','lookout'].includes(place)||['beach','meadow','lookout'].includes(target);
  headBone.rotateY(glance*(currentName==='run'||activityWeather==='storm'?.1:exposed?.26:.16));
}
patchMouth?.update(speech,timing,serverNow,action==='sleep',dt,talking?0:meal?.open);
const caption=talking?captionAt(speech.text,timing,serverNow-Date.parse(speech.at)):'';$('#bubble').hidden=!caption;if($('#bubble').textContent!==caption)$('#bubble').textContent=caption;
let day=Number.isFinite(state.clock.dayFraction)?state.clock.dayFraction:.5;let daylight=THREE.MathUtils.smoothstep(Math.sin((day-.25)*Math.PI*2),-.12,.2);let weather=state.clock.weather;let overcast=weather==='cloudy'||weather==='rain'||weather==='storm';sky.copy(skyNight).lerp(skyDay,daylight*(overcast?.65:1));updateSky(daylight);scene.background=skyTexture;scene.fog.color.copy(sky);hemi.intensity=1.25+daylight*(overcast?.4:1.15);sunLight.intensity=daylight*(overcast?.6:2.4)+(1-daylight)*.65;sunLight.color.copy(moonColor).lerp(sunColor,daylight);let angle=(day-.25)*Math.PI*2;sun.position.set(Math.cos(angle)*900,Math.sin(angle)*900,0);moon.position.copy(sun.position).multiplyScalar(-1);sunLight.position.copy(daylight>.05?sun.position:moon.position);stars.material.opacity=1-daylight;stars.visible=daylight<.98;clouds.forEach((c,i)=>{c.visible=overcast||i<5;c.position.x+=reducedMotion.matches?0:dt*.14;if(c.position.x>520)c.position.x=-520;});rain.visible=weather==='rain'||weather==='storm';
controls.track(patch.position,dt,sleepingInHammock());
sound.update(cameraFeeds.camera || controls.camera, {
  daylight, weather, walked, patch: patch.position, previousPatch: previousPatchPosition,
  clip: currentName, clipTime: currentAction?.time, action, place, since, mail, target,
  carrying: state.patch.carrying, gift: state.patch.giftSound, speech, now: Date.now() + serverOffset
});
const rainAmount = weather==='storm' ? 1 : weather==='rain' ? .58 : 0;
rainStrength.value = rainAmount;
if (rain.visible && !reducedMotion.matches) rainTime.value += dt*(10+rainAmount*7);
scenery.update(reducedMotion.matches?0:dt,daylight,rainAmount);
renderIsland(now);}
requestAnimationFrame(frame);addEventListener('resize',()=>{controls.resize(innerWidth/innerHeight);renderer.setSize(innerWidth,innerHeight);});
