// A locker-style stage for every clip wired to Patch: he stands on a lit pedestal,
// turns on a turntable and plays whichever clip is picked. Hanging clips show the
// ledge, branch or rope they are meant for.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CLIPS } from './patch-clips.js';

const $ = s => document.querySelector(s);
const GROUPS = ['Ground','Water','Sleep','Trees','Free hang','Braced hang'];

export function setupAnimationViewer() {
  const root=$('#animations'),canvas=$('#locker-canvas'),list=$('#locker-list'),name=$('#locker-name'),use=$('#locker-use'),meta=$('#locker-meta');
  const play=$('#locker-play'),scrub=$('#locker-scrub'),speed=$('#locker-speed'),spin=$('#locker-spin');
  let renderer,scene,camera,turntable,props,mixer,action,clips={},selected=null,frame=0,last=0,paused=false,rate=1,spinning=true,yaw=-.5,distance=4.2,drag=null,returnFocus=null;
  const isOpen=()=>!root.hidden;

  function build(){
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.1,100);
    scene.add(new THREE.HemisphereLight(0xcfe3ff,0x2a1840,1.4));
    const key=new THREE.DirectionalLight(0xfff1d6,2.6);key.position.set(2,4,3);scene.add(key);
    const rim=new THREE.DirectionalLight(0x7fd8ff,2.2);rim.position.set(-3,2.5,-3);scene.add(rim);
    // The pedestal: a dark disc with a glowing rim and a soft light pool.
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.15,.14,64),new THREE.MeshStandardMaterial({color:0x1d1a3d,roughness:.4,metalness:.3}));disc.position.y=-.07;scene.add(disc);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.08,.025,10,96),new THREE.MeshBasicMaterial({color:0x6fe7ff}));ring.rotation.x=Math.PI/2;ring.position.y=.005;scene.add(ring);
    const pool=document.createElement('canvas');pool.width=pool.height=128;const g=pool.getContext('2d'),grad=g.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(140,220,255,.55)');grad.addColorStop(1,'rgba(140,220,255,0)');g.fillStyle=grad;g.fillRect(0,0,128,128);
    const glow=new THREE.Mesh(new THREE.CircleGeometry(1.6,48),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(pool),transparent:true,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.y=.008;scene.add(glow);
    turntable=new THREE.Group();scene.add(turntable);props=new THREE.Group();turntable.add(props);
    new GLTFLoader().load(new URL('./assets/patch.glb',document.baseURI).href,gltf=>{
      turntable.add(gltf.scene);mixer=new THREE.AnimationMixer(gltf.scene);
      for(const clip of gltf.animations){
        // Keep him on the pedestal: travel across the ground is removed, height is kept.
        const tracks=clip.tracks.map(track=>{const copy=track.clone();if(/(?:mixamorig[:_]?Hips).*\.position$/i.test(copy.name)){const n=copy.times.length,span=copy.times[n-1]-copy.times[0];if(span>0)for(const c of [0,2]){const drift=copy.values[(n-1)*3+c]-copy.values[c];for(let i=0;i<n;i++)copy.values[i*3+c]-=drift*(copy.times[i]-copy.times[0])/span;}}return copy;});
        clips[clip.name]=new THREE.AnimationClip(clip.name,clip.duration,tracks);
      }
      select(selected||'idle');
    },undefined,()=>{name.textContent='Patch could not be loaded';});
    canvas.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);setSpin(false);});
    canvas.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;yaw+=(e.clientX-drag.x)*.01;drag.x=e.clientX;});
    for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,()=>{drag=null;});
    canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.003,2.2,7);},{passive:false});
  }

  // A light outline of the hold each hanging clip is made for.
  function showProps(clip){
    props.clear();const info=CLIPS[clip],hands=info?.hands;if(!hands)return;
    const [fwd,up]=hands.find(Boolean),material=new THREE.MeshStandardMaterial({color:0x8a86c9,roughness:.8,transparent:true,opacity:.55});
    if(info.group==='Braced hang'){
      const top=(hands.at(-1)||hands[0])[1],wall=new THREE.Mesh(new THREE.BoxGeometry(1.8,top,.3),material);wall.position.set(0,top/2,fwd+.15);props.add(wall);
      if(clip==='braced-hop-up'){const lip=new THREE.Mesh(new THREE.BoxGeometry(1.6,.06,.12),material);lip.position.set(0,hands[0][1]-.03,fwd-.06);props.add(lip);}
    } else if(clip==='rope-hang'){const rope=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,2.4,8),new THREE.MeshStandardMaterial({color:0xd8c79a}));rope.position.set(0,up+.6,fwd);props.add(rope);}
    else {const branch=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1.8,10),new THREE.MeshStandardMaterial({color:0x8a6a4a,roughness:1}));branch.rotation.z=Math.PI/2;branch.position.set(0,up+.04,fwd);props.add(branch);}
  }
  function select(clip){
    selected=clip;const info=CLIPS[clip];
    list.querySelectorAll('button').forEach(b=>{const on=b.dataset.clip===clip;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
    name.textContent=info.label;use.textContent=info.use;meta.textContent=`${clip} · ${info.duration.toFixed(1)} s`;
    if(!mixer||!clips[clip])return;
    const next=mixer.clipAction(clips[clip]);next.reset().setLoop(THREE.LoopRepeat,Infinity).play();
    if(action&&action!==next)next.crossFadeFrom(action,.25,false);
    action=next;action.paused=paused;showProps(clip);
  }
  function setSpin(on){spinning=on;spin.setAttribute('aria-pressed',String(on));}
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function loop(now){
    if(!isOpen())return;frame=requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000||0);last=now;
    if(spinning&&!drag)yaw+=dt*.35;turntable.rotation.y=yaw;
    // A narrow stage pulls the camera back so all of him fits.
    const tall=selected&&CLIPS[selected].hands?1.2:.75,back=distance*Math.max(1,Math.min(2,.9/camera.aspect));
    camera.position.set(0,tall+.35,back);camera.lookAt(0,tall,0);
    if(mixer){mixer.update(paused?0:dt*rate);if(action&&document.activeElement!==scrub)scrub.value=String(Math.round(action.time/action.getClip().duration*1000));}
    renderer.render(scene,camera);
  }

  // Cards for every registered clip, grouped like a locker's tabs.
  for(const group of GROUPS){
    const heading=document.createElement('h3');heading.textContent=group;list.append(heading);
    for(const [clip,info] of Object.entries(CLIPS).filter(([,i])=>i.group===group)){
      const card=document.createElement('button');card.type='button';card.dataset.clip=clip;card.setAttribute('aria-pressed','false');
      const title=document.createElement('strong');title.textContent=info.label;const time=document.createElement('small');time.textContent=`${info.duration.toFixed(1)} s`;
      card.append(title,time);card.addEventListener('click',()=>select(clip));list.append(card);
    }
  }
  play.onclick=()=>{paused=!paused;if(action)action.paused=paused;play.textContent=paused?'Play':'Pause';};
  speed.onclick=()=>{rate=rate===1?.5:rate===.5?.25:1;speed.textContent=`${rate}×`;};
  spin.onclick=()=>setSpin(!spinning);
  scrub.oninput=()=>{if(!action)return;action.time=Number(scrub.value)/1000*action.getClip().duration;if(paused)mixer.update(0);};
  $('#close-animations').onclick=()=>close();
  addEventListener('keydown',e=>{if(isOpen()&&e.key==='Escape'){e.preventDefault();close();}});
  addEventListener('resize',()=>{if(isOpen())resize();});
  function open(){returnFocus=document.activeElement;root.hidden=false;if(!renderer)build();resize();last=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(loop);if(!selected)select('idle');list.querySelector('.selected')?.focus();}
  function close(){root.hidden=true;cancelAnimationFrame(frame);returnFocus?.focus?.();}
  return {open,close,isOpen};
}
