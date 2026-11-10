import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sampleState } from '../../shared/state.js';
import { createIsland } from './island.js';
import { places, groundHeight, walkRoute, swingRoute, swingLoop, statusText, isLocalPreview } from './world-state.js';

const $ = s => document.querySelector(s);
const dialog = $('#map');
$('#open-map').onclick = () => dialog.showModal();
$('#close-map').onclick = () => dialog.close();
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { $('#error').hidden = false; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#world').append(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xadd9d4, 150, 300);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 400);
camera.position.set(6, 6, 10);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(1, 2, 2); controls.enableDamping = true; controls.minDistance = 5; controls.maxDistance = 45; controls.maxPolarAngle = Math.PI * .48;
const hemi = new THREE.HemisphereLight(0xd9f5ee, 0x496d4c, 2.1); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffedbe, 2.4); scene.add(sunLight);
const mat = color => new THREE.MeshStandardMaterial({color, roughness: 1});
function mesh(geo,material,x=0,y=0,z=0,parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;}
function ellipsoid(material,x,y,z,sx,sy,sz,parent=scene){const m=mesh(new THREE.SphereGeometry(1,12,8),material,x,y,z,parent);m.scale.set(sx,sy,sz);return m;}
const scenery = createIsland(scene);
const patch = new THREE.Group(); scene.add(patch);
let mixer, clips = {}, currentAction, currentName, swingStarted = false;
new GLTFLoader().load(new URL('./assets/patch.glb', document.baseURI).href, gltf => {
  patch.add(gltf.scene);
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
let state = null, hasLiveState = false, demo = false, journey = null;
const localPreview = isLocalPreview(location.hostname), start = performance.now();
const mockActions=['idle','walk','run','climb','swing','swim','fish','eat','sit','sleep','think','write','phone','wave','look','explore','watch-sky'], ids=Object.keys(places);
async function poll() {
  try {
    const response = await fetch('/patch/api/state', {cache:'no-store'});
    if (!response.ok) throw new Error('State unavailable');
    const next = await response.json();
    if (!next.patch || !next.clock || !Object.hasOwn(places, next.patch.place)) throw new Error('Invalid state');
    if (!state) { const [x,z]=places[next.patch.place]; patch.position.set(x,groundHeight(x,z),z); const target=new THREE.Vector3(x,patch.position.y+1,z); camera.position.add(target.clone().sub(controls.target)); controls.target.copy(target); }
    state = next; hasLiveState = true; demo = false;
    $('#connection').hidden = true;
  } catch {
    demo = localPreview && !hasLiveState;
    $('#connection').hidden = demo;
    if (!state && !demo) $('#status').textContent = '';
  }
}
poll(); setInterval(poll,5000);
const skyDay=new THREE.Color(0xaddfdf),skyNight=new THREE.Color(0x101c40),sky=new THREE.Color();
const starsGeo=new THREE.BufferGeometry(),starPositions=[];for(let i=0;i<300;i++){let a=Math.random()*Math.PI*2,b=Math.random()*Math.PI*.47,r=120;starPositions.push(Math.cos(a)*Math.cos(b)*r,Math.sin(b)*r+5,Math.sin(a)*Math.cos(b)*r);}starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xfff8d7,size:.7,transparent:true,depthWrite:false}));scene.add(stars);
const sun=mesh(new THREE.SphereGeometry(3,16,12),new THREE.MeshBasicMaterial({color:0xffe6a0}));const moon=mesh(new THREE.SphereGeometry(2,16,12),new THREE.MeshBasicMaterial({color:0xe9eddd}));
const clouds=[];for(let i=0;i<12;i++){let g=new THREE.Group();for(let j=0;j<3;j++)ellipsoid(mat(0xffffff),j*1.8,Math.sin(j)*.5,0,2,1,1.4,g);g.position.set(Math.cos(i*2.4)*45,25+i%4*3,Math.sin(i*2.4)*45);scene.add(g);clouds.push(g);}
const rainGeo=new THREE.BufferGeometry(),drops=[];for(let i=0;i<500;i++)drops.push((Math.random()-.5)*50,Math.random()*35,(Math.random()-.5)*50);rainGeo.setAttribute('position',new THREE.Float32BufferAttribute(drops,3));const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xd6edf2,size:.12,transparent:true,opacity:.7}));scene.add(rain);
let last=performance.now();patch.position.set(1,.9,2);const follow=new THREE.Vector3();
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;let t=(now-start)/1000;
if (demo) { let n=Math.floor(t/9); state={patch:{...sampleState.patch,action:mockActions[n%mockActions.length],place:ids[Math.floor(n/2)%ids.length],target:['walk','run','swing'].includes(mockActions[n%mockActions.length]) ? ids[(Math.floor(n/2)+1)%ids.length] : null,since:String(n),says:null},clock:{dayFraction:(.38+t/240)%1,weather:['clear','cloudy','rain','storm'][Math.floor(t/60)%4]}}; }
if (!state) { patch.visible=false; controls.update(); renderer.render(scene,camera); return; }
patch.visible=true;
const {action,place,target,says,since}=state.patch;
$('#status').textContent = statusText(state.patch);
const dest=action==='sleep'&&place==='hammock'&&!target?[1.5,2]:action==='swim'&&place==='pond'&&!target?[-13,4]:places[target]||places[place];
const travel = !!(target && places[target] && ['walk','run','swing'].includes(action));
const swinging = action === 'swing';
const key = `${action}|${place}|${target||''}|${since||''}`;
if (travel || swinging) {
  if (!journey || journey.key !== key) {
    const points=[{p:patch.position.clone(), mode:'ground'}];
    const groundPoints = route => route.forEach(([x,z])=>points.push({p:new THREE.Vector3(x,groundHeight(x,z),z),mode:'ground'}));
    const branchPoints = anchors => anchors.forEach(([x,y,z])=>points.push({p:new THREE.Vector3(x,y-1.8,z),mode:'branch'}));
    if (swinging) {
      if (travel) {
        if (place !== 'tall-trees') groundPoints(walkRoute(place,'tall-trees'));
        branchPoints(swingRoute(places[place],places[target]));
        if (target !== 'tall-trees') groundPoints(walkRoute('tall-trees',target));
        else groundPoints([places[target]]);
      } else branchPoints(swingLoop());
    } else groundPoints(walkRoute(place,target));
    journey={key,points,index:0,progress:0,loop:swinging&&!travel};
  }
  const j=journey, from=j.points[j.index], to=j.points[j.index+1];
  if (to) {
    const branch=to.mode==='branch', length=Math.max(.1,from.p.distanceTo(to.p));
    j.progress=Math.min(1,j.progress+dt*(branch?3:action==='run'?4:1.7)/length);
    patch.position.lerpVectors(from.p,to.p,j.progress);
    if(branch) patch.position.y-=Math.sin(Math.PI*j.progress)*Math.min(.8,length*.15);
    else patch.position.y=groundHeight(patch.position.x,patch.position.z);
    patch.rotation.y=Math.atan2(to.p.x-from.p.x,to.p.z-from.p.z);patch.rotation.z=branch?Math.sin(Math.PI*j.progress)*.2:0;
    playClip(branch?'swing':action==='run'?'run':'walk');
    if(j.progress>=1){j.index++;j.progress=0;if(j.loop&&j.index===j.points.length-1){j.index=1;}}
  } else { patch.rotation.z=0; playClip('idle'); }
} else {
  journey=null;
  const dx=dest[0]-patch.position.x,dz=dest[1]-patch.position.z,dist=Math.hypot(dx,dz);
  if(dist>.15){let step=Math.min(dist,dt*1.7);patch.position.x+=dx/dist*step;patch.position.z+=dz/dist*step;patch.rotation.y=Math.atan2(dx,dz);}
  patch.position.y=action==='swim'?.55:action==='climb'?groundHeight(patch.position.x,patch.position.z)+1.5:action==='sleep'&&place==='hammock'?2.2:groundHeight(patch.position.x,patch.position.z);
  patch.rotation.z=0;
  const names={idle:'idle',think:'idle',phone:'idle',write:'idle',look:'look-around',wave:'look-around',walk:'walk',run:'run',climb:'hang',swim:'swim',fish:'sit',sit:'sit',sleep:'sleep',eat:'idle',explore:'look-around','watch-sky':'look-around'};
  playClip(names[action]||'idle',action==='sit'||action==='fish');
}
if(mixer) mixer.update(dt);
$('#bubble').hidden=!says;$('#bubble').textContent=says||'';
let day=Number.isFinite(state.clock.dayFraction)?state.clock.dayFraction:.5;let daylight=THREE.MathUtils.smoothstep(Math.sin((day-.25)*Math.PI*2),-.12,.2);let weather=state.clock.weather;let overcast=weather==='cloudy'||weather==='rain'||weather==='storm';sky.copy(skyNight).lerp(skyDay,daylight*(overcast?.65:1));scene.background=sky;scene.fog.color.copy(sky);hemi.intensity=.3+daylight*(overcast?1:1.8);sunLight.intensity=daylight*(overcast?.6:2.4);let angle=(day-.25)*Math.PI*2;sun.position.set(Math.cos(angle)*90,Math.sin(angle)*90,0);moon.position.copy(sun.position).multiplyScalar(-1);sunLight.position.copy(sun.position);stars.material.opacity=1-daylight;stars.visible=daylight<.98;clouds.forEach((c,i)=>{c.visible=overcast||i<5;c.position.x+=dt*.14;if(c.position.x>55)c.position.x=-55;});rain.visible=weather==='rain'||weather==='storm';if(rain.visible)rain.position.y=-(t*12%30);
follow.set(patch.position.x,patch.position.y+1,patch.position.z);let delta=follow.clone().sub(controls.target).multiplyScalar(Math.min(1,dt*8));controls.target.add(delta);camera.position.add(delta);controls.update();scenery.update(camera,follow);renderer.render(scene,camera);}
requestAnimationFrame(frame);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
