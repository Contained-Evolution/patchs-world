import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sampleState } from '../../shared/state.js';
import { addScenery } from './scenery.js';

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
scene.fog = new THREE.Fog(0xadd9d4, 60, 160);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 240);
camera.position.set(-3, 5, 4);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-8, 2, -3); controls.enableDamping = true; controls.minDistance = 5; controls.maxDistance = 35; controls.maxPolarAngle = Math.PI * .48;
const hemi = new THREE.HemisphereLight(0xd9f5ee, 0x496d4c, 2.1); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffedbe, 2.4); scene.add(sunLight);
const mat = color => new THREE.MeshStandardMaterial({color, roughness: 1});
const sand=mat(0xe8d394), grass=mat(0x76aa63), trunk=mat(0x826047), leaf=mat(0x337b4e), leaf2=mat(0x489858), water=mat(0x59b4b4), rock=mat(0x879a85);
// CC0 textures also used by Tenari. Paths remain relative to /patch/.
const textureLoader = new THREE.TextureLoader();
function detailTexture(path, repeats) {
  const texture = textureLoader.load(new URL(path, document.baseURI).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeats); texture.anisotropy = 4;
  return texture;
}
grass.map = detailTexture('./assets/meadow-grass.jpg', [5, 4]); grass.color.set(0xc1e5ae);
trunk.map = detailTexture('./assets/pine-bark.jpg', [1, 2]); trunk.color.set(0xc6b6a3);
rock.map = detailTexture('./assets/rock-boulder-dry.jpg', [1, 1]); rock.color.set(0xc5d3c2);
function mesh(geo, material, x=0,y=0,z=0, parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;}
function ellipsoid(material,x,y,z,sx,sy,sz,parent=scene){const m=mesh(new THREE.SphereGeometry(1,12,8),material,x,y,z,parent);m.scale.set(sx,sy,sz);return m;}
function cylinder(material,x,y,z,r1,r2,h,parent=scene){return mesh(new THREE.CylinderGeometry(r1,r2,h,8),material,x,y,z,parent)}
function line(a,b,color=0xb69b6c){const points=[new THREE.Vector3(...a),new THREE.Vector3(...b)];scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color})));}
// Low-poly, entirely procedural assets keep the public repository self-contained.
ellipsoid(sand,0,-.9,0,20,1.8,16);ellipsoid(grass,0,-.35,0,17,1.3,13);
const sea=mesh(new THREE.PlaneGeometry(400,400),mat(0x438e97),0,-.32,0);sea.rotation.x=-Math.PI/2;
for(let i=0;i<5;i++){let a=i*1.27+.3;ellipsoid(mat(0x749b89),Math.cos(a)*85,-1,Math.sin(a)*85,12+i,3+i%2,8);}
ellipsoid(water,-3,.85,1,4,.12,2.7);for(let i=0;i<11;i++){let a=i*6.28/11;ellipsoid(rock,-3+Math.cos(a)*4,.84,1+Math.sin(a)*2.7,.45,.25,.35);}
function tree(x,z,h=7,banana=false){cylinder(trunk,x,h/2+.65,z,.24,.4,h);if(banana){for(let i=0;i<7;i++){let a=i*Math.PI*2/7;let l=ellipsoid(i%2?leaf:leaf2,x+Math.cos(a)*1.4,h+.55,z+Math.sin(a)*1.4,2.1,.16,.48);l.rotation.y=-a;l.rotation.z=-.2;}for(let i=0;i<3;i++)ellipsoid(mat(0xf3ce52),x+.35+i*.2,h-.4,z,.12,.38,.12);}else{for(let i=0;i<5;i++){let a=i*1.26;ellipsoid(i%2?leaf:leaf2,x+Math.cos(a)*1.2,h+.7+(i%2)*.6,z+Math.sin(a)*1.2,1.8,1.1,1.7);}ellipsoid(leaf2,x,h+1.7,z,1.8,1.2,1.7);}}
[[-12,-5,8],[-9,-9,9],[-4,-10,8],[1,-10,10],[6,-9,8],[11,-7,9],[13,-2,8],[-14,1,8],[-12,7,8],[-7,9,9],[1,10,8],[8,8,8],[13,5,8]].forEach(p=>tree(...p));
[[-9,-3],[-7,-5],[-5,-6],[-10,-.5]].forEach(([x,z])=>tree(x,z,4.5,true));
// Hammock and raised shelves.
line([5,3,4],[9,3,4]);const hammock=ellipsoid(mat(0xc27555),7,2.1,4,1.9,.25,.65);line([5,3,4],[5.3,2.2,4]);line([9,3,4],[8.7,2.2,4]);
for(let y of [2,3]){let shelf=mesh(new THREE.BoxGeometry(2,.12,.7),trunk,10,y,1);for(let x of [9.15,10.85])line([x,y,1],[x,5,1]);}ellipsoid(mat(0xe5b545),10,3.3,1,.4,.22,.25);
const scenery = addScenery(scene);
// The branch provides a fixed anchor for Patch's swinging arc.
const swingAnchor = new THREE.Vector3(2.5, 6.8, -8);
const branch = cylinder(trunk, 1.8, 6.8, -8, .17, .22, 3); branch.rotation.z = Math.PI / 2;
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
const places={'hammock':[7,4],shelves:[10,1],pond:[-3,4],'banana-grove':[-8,-3],'tall-trees':[1,-8],beach:[0,12],lookout:[12,-3]};
let state=structuredClone(sampleState), live=false, lastLive=0; const start=performance.now();
async function poll(){try{let r=await fetch('/patch/api/state',{cache:'no-store'});if(!r.ok)throw Error();let next=await r.json();if(!next.patch||!next.clock||!places[next.patch.place])throw Error();state=next;live=true;lastLive=performance.now();}catch{if(performance.now()-lastLive>15000)live=false;}}
poll();setInterval(poll,5000);
const mockActions=['idle','walk','run','climb','swing','swim','fish','eat','sit','sleep','think','write','phone','wave','look'];const ids=Object.keys(places);
const skyDay=new THREE.Color(0xaddfdf),skyNight=new THREE.Color(0x101c40),sky=new THREE.Color();
const starsGeo=new THREE.BufferGeometry(),starPositions=[];for(let i=0;i<300;i++){let a=Math.random()*Math.PI*2,b=Math.random()*Math.PI*.47,r=120;starPositions.push(Math.cos(a)*Math.cos(b)*r,Math.sin(b)*r+5,Math.sin(a)*Math.cos(b)*r);}starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xfff8d7,size:.7,transparent:true,depthWrite:false}));scene.add(stars);
const sun=mesh(new THREE.SphereGeometry(3,16,12),new THREE.MeshBasicMaterial({color:0xffe6a0}));const moon=mesh(new THREE.SphereGeometry(2,16,12),new THREE.MeshBasicMaterial({color:0xe9eddd}));
const clouds=[];for(let i=0;i<12;i++){let g=new THREE.Group();for(let j=0;j<3;j++)ellipsoid(mat(0xffffff),j*1.8,Math.sin(j)*.5,0,2,1,1.4,g);g.position.set(Math.cos(i*2.4)*45,25+i%4*3,Math.sin(i*2.4)*45);scene.add(g);clouds.push(g);}
const rainGeo=new THREE.BufferGeometry(),drops=[];for(let i=0;i<500;i++)drops.push((Math.random()-.5)*50,Math.random()*35,(Math.random()-.5)*50);rainGeo.setAttribute('position',new THREE.Float32BufferAttribute(drops,3));const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xd6edf2,size:.12,transparent:true,opacity:.7}));scene.add(rain);
let last=performance.now();patch.position.set(-8,.9,-3);const follow=new THREE.Vector3();
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;let t=(now-start)/1000; scenery.update(t);
if(!live){let n=Math.floor(t/9);state={patch:{...sampleState.patch,action:mockActions[n%mockActions.length],place:ids[Math.floor(n/2)%ids.length],target:ids[(Math.floor(n/2)+1)%ids.length],says:null},clock:{dayFraction:(.38+t/240)%1,weather:['clear','cloudy','rain','storm'][Math.floor(t/60)%4]}};}
const {action,place,target,says}=state.patch;const dest=places[(action==='walk'||action==='run'||action==='swing')&&places[target]?target:place]||places.beach;let dx=dest[0]-patch.position.x,dz=dest[1]-patch.position.z,dist=Math.hypot(dx,dz);if(action !== 'swing' && dist>.1){let step=Math.min(dist,dt*(action==='run'?4:1.7));patch.position.x+=dx/dist*step;patch.position.z+=dz/dist*step;patch.rotation.y=Math.atan2(dx,dz);}
if (action === 'swing') {
  if (!swingStarted && mixer) { swingStarted = true; playClip('swing-start', true); }
  if (mixer && currentName === 'swing-start' && currentAction.time >= clips['swing-start'].duration) playClip('swing');
  const angle = Math.sin(t * 1.8) * .6, radius = 1.8;
  patch.position.set(swingAnchor.x + Math.sin(angle) * radius, swingAnchor.y - Math.cos(angle) * radius, swingAnchor.z);
  patch.rotation.z = -angle;
} else {
  swingStarted = false;
  patch.position.y = action === 'swim' ? .55 : action === 'climb' ? 2.4 : action === 'sleep' && place === 'hammock' ? 2.2 : .9;
  patch.rotation.z = 0;
  const names = { idle:'idle', think:'idle', phone:'idle', write:'idle', look:'look-around', wave:'look-around', walk:'walk', run:'run', climb:'hang', swim:'swim', fish:'sit', sit:'sit', sleep:'sleep', eat:'idle' };
  playClip(names[action] || 'idle', action === 'sit' || action === 'fish');
}
if (mixer) mixer.update(dt);
$('#bubble').hidden=!says;$('#bubble').textContent=says||'';
let day=Number.isFinite(state.clock.dayFraction)?state.clock.dayFraction:.5;let daylight=THREE.MathUtils.smoothstep(Math.sin((day-.25)*Math.PI*2),-.12,.2);let weather=state.clock.weather;let overcast=weather==='cloudy'||weather==='rain'||weather==='storm';sky.copy(skyNight).lerp(skyDay,daylight*(overcast?.65:1));scene.background=sky;scene.fog.color.copy(sky);hemi.intensity=.3+daylight*(overcast?1:1.8);sunLight.intensity=daylight*(overcast?.6:2.4);let angle=(day-.25)*Math.PI*2;sun.position.set(Math.cos(angle)*90,Math.sin(angle)*90,0);moon.position.copy(sun.position).multiplyScalar(-1);sunLight.position.copy(sun.position);stars.material.opacity=1-daylight;stars.visible=daylight<.98;clouds.forEach((c,i)=>{c.visible=overcast||i<5;c.position.x+=dt*.14;if(c.position.x>55)c.position.x=-55;});rain.visible=weather==='rain'||weather==='storm';if(rain.visible)rain.position.y=-(t*12%30);
follow.set(patch.position.x,patch.position.y+1,patch.position.z);let delta=follow.clone().sub(controls.target).multiplyScalar(Math.min(1,dt*2));controls.target.add(delta);camera.position.add(delta);controls.update();renderer.render(scene,camera);}
requestAnimationFrame(frame);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
