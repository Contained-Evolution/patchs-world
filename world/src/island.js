import * as THREE from 'three';
import { places, paths, trees, anchorFor, groundHeight } from './world-state.js';
import { coastRadius } from './terrain.js';

export function createIsland(scene) {
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:1,...extra});
  const sand=material(0xe4cc89),grass=material(0x79ad68),bark=material(0x78563c), darkBark=material(0x644a34),leaf=material(0x397b4c),leaf2=material(0x559b58),rock=material(0x8d9886),water=material(0x55b8bd,{roughness:.35}),white=material(0xc5edeb),dark=material(0x192820), pathMat=material(0xc3ac79),flower=material(0xf5ce75);
  leaf.side=leaf2.side=bark.side=pathMat.side=water.side=THREE.DoubleSide;
  const tex=new THREE.TextureLoader();
  function texture(mat,file,repeat){let t=tex.load(new URL('./assets/'+file,document.baseURI).href);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);mat.map=t;mat.needsUpdate=true;}
  texture(grass,'meadow-grass.jpg',[10,8]);texture(bark,'pine-bark.jpg',[1,2]);texture(rock,'rock-boulder-dry.jpg',[1,1]);
  function mesh(g,m,x=0,y=0,z=0){let o=new THREE.Mesh(g,m);o.position.set(x,y,z);scene.add(o);return o;}
  function oval(m,x,y,z,sx,sy,sz){let o=mesh(new THREE.SphereGeometry(1,14,10),m,x,y,z);o.scale.set(sx,sy,sz);return o;}
  function beam(m,a,b,r1,r2=r1){let v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));let o=mesh(new THREE.CylinderGeometry(r2,r1,v.length(),8),m);o.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;}
  // One continuous polar mesh carries grass, dry sand and the submerged edge.
  const rings=72, slices=192, verts=[], uvs=[], colors=[], indices=[];
  const grassColor=new THREE.Color(0x79ad68), sandColor=new THREE.Color(0xe4cc89), wetColor=new THREE.Color(0xb9a576), color=new THREE.Color();
  for(let j=0;j<=rings;j++) for(let i=0;i<=slices;i++) {
    const angle=i/slices*Math.PI*2, fraction=j/rings, radius=coastRadius(angle)*fraction;
    const x=Math.cos(angle)*45*radius,z=Math.sin(angle)*36*radius;
    verts.push(x,groundHeight(x,z),z); uvs.push(x/45,z/36);
    const sandMix=THREE.MathUtils.smoothstep(fraction,.78,.9), wetMix=THREE.MathUtils.smoothstep(fraction,.95,1);
    color.copy(grassColor).lerp(sandColor,sandMix).lerp(wetColor,wetMix); colors.push(color.r,color.g,color.b);
  }
  for(let j=0;j<rings;j++) for(let i=0;i<slices;i++) {const a=j*(slices+1)+i,b=a+1,c=a+slices+1,d=c+1;indices.push(a,b,c,b,d,c);}
  const terrainGeometry=new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));terrainGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));terrainGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainGeometry.setIndex(indices);terrainGeometry.computeVertexNormals();
  mesh(terrainGeometry,material(0xffffff,{vertexColors:true}));
  let sea=mesh(new THREE.PlaneGeometry(600,600),material(0x438e97),0,.1,0);sea.rotation.x=-Math.PI/2;
  // A separate, inaccessible landmass across the eastern water.
  oval(material(0x698e7a),-118,3,-4,25,7,23);oval(material(0x769981),-134,4,-8,22,10,19);
  function strip(points,width,mat,heightOffset=.09){for(let i=0;i<points.length-1;i++){const [x,z]=points[i],[xx,zz]=points[i+1],len=Math.hypot(xx-x,zz-z),steps=Math.ceil(len/1.2),v=[],ind=[],nx=-(zz-z)/len*width/2,nz=(xx-x)/len*width/2;for(let j=0;j<=steps;j++){let t=j/steps,cx=x+(xx-x)*t,cz=z+(zz-z)*t;for(let s of [-1,1]){let px=cx+nx*s,pz=cz+nz*s;v.push(px,groundHeight(px,pz)+heightOffset,pz);}}for(let j=0;j<steps;j++){let k=j*2;ind.push(k,k+2,k+1,k+1,k+2,k+3);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(ind);geo.computeVertexNormals();mesh(geo,mat);}}
  for(const route of Object.values(paths))strip(route,1.15,pathMat);
  const occluders=[];
  function jungleTree([x,z,h],i){let y=groundHeight(x,z);occluders.push(beam(bark,[x,y,z],[x,y+h,z],.35,.22));let a=anchorFor([x,z,h]);beam(bark,[x,y+h-1,z],a,.18,.13);for(let k=0;k<3;k++)occluders.push(oval(k%2?leaf2:leaf,x+Math.cos(k*2.1)*1.5,y+h+.3,z+Math.sin(k*2.1)*1.5,2.8,1.25,2.5));}
  trees.forEach(jungleTree);
  function palm(x,z,h,banana=false){let y=groundHeight(x,z);occluders.push(beam(bark,[x,y,z],[x+.3,y+h,z],.23,.13));for(let i=0;i<7;i++){let a=i*Math.PI*2/7,frond=oval(i%2?leaf:leaf2,x+.3+Math.cos(a)*1.25,y+h,z+Math.sin(a)*1.25,2,.12,.42);frond.rotation.y=-a;frond.rotation.z=-.16;occluders.push(frond);}for(let i=0;i<3;i++)oval(banana?flower:darkBark,x+.4+i*.18,y+h-.35,z,.13,banana?.35:.15,.13);}
  for(let row=0;row<4;row++)for(let col=0;col<5;col++)palm(-16+col*2+(row%2)*.5,5+row*2.6,4.8+(col%3)*.35,true);
  for(let z=-10;z<=20;z+=5)palm(32-Math.abs(z)*.13,z,5.5,false);
  // Camp: hammock and shelves grouped at the center.
  const cord=material(0xcab487),cloth=material(0xc27555);beam(cord,[-1,3,2],[0,2.1,2],.04);beam(cord,[3,2.1,2],[4,3,2],.04);oval(cloth,1.5,2,2,1.7,.22,.6);for(let y of [2,3]){mesh(new THREE.BoxGeometry(2,.12,.7),bark,4,y,1);for(let x of [3.15,4.85])beam(cord,[x,y,1],[x,5,1],.035);}oval(flower,4,3.3,1,.4,.22,.25);
  // Pond, stream and cascade among low rocks.
  oval(water,18,.94,10,4.1,.10,2.8);for(let i=0;i<15;i++){let a=i*Math.PI*2/15;oval(rock,18+Math.cos(a)*4.2,.96,10+Math.sin(a)*2.9,.48,.23,.38);}
  strip([[21,3],[20,5],[19,7],[18,9]],1.1,water,.07);oval(rock,21,1.7,3,2.3,1.1,1.3);let fall=mesh(new THREE.PlaneGeometry(1.15,1.55),white,21,1.85,4.15);fall.material.side=THREE.DoubleSide;
  // Tide pools and cave are recognizable even from the orbit camera.
  for(let i=0;i<15;i++){let a=i*2.4,r=2+(i%4)*1.1,x=22+Math.cos(a)*r,z=-20+Math.sin(a)*r;oval(rock,x,1,z,.7+(i%3)*.25,.35,.6);}for(const [x,z] of [[21,-21],[24,-19],[20,-18]])oval(water,x,.96,z,1.1,.08,.7);
  oval(rock,-6,2.35,-34,4.2,2.2,3);let entrance=oval(dark,-6,1.85,-30.98,1.4,1.25,.13);
  // Meadow flowers are sparse, retaining open sky; lookout hill is the highest ground.
  for(let i=0;i<45;i++){let a=i*2.4,r=1+(i%8)*.8,x=-20+Math.cos(a)*r,z=2+Math.sin(a)*r;oval(flower,x,groundHeight(x,z)+.08,z,.09,.11,.09);}
  const ly=groundHeight(-16,-22);for(let x of [-17,-15])for(let z of [-23,-21])beam(bark,[x,ly,z],[x,ly+1.1,z],.08);beam(bark,[-17,ly+1,-23],[-15,ly+1,-23],.07);beam(bark,[-17,ly+1,-21],[-15,ly+1,-21],.07);
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3();
  return { update(camera, target) {
    for (const item of occluders) item.visible=true;
    direction.subVectors(target,camera.position); const distance=direction.length();
    ray.set(camera.position,direction.normalize()); ray.far=distance;
    for (const hit of ray.intersectObjects(occluders)) hit.object.visible=false;
  }};
}
