import * as THREE from 'three';

// Small, shared meshes add depth without a texture download or hundreds of draw calls.
export function addScenery(scene) {
  let seed = 2847;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const colors = { fern: material(0x397b4c), fernLight: material(0x66a963), flower: material(0xf3aa83), flowerYellow: material(0xf6d46e), stone: material(0x9aab94), wood: material(0x806148), rope: material(0xcab487), water: new THREE.MeshBasicMaterial({color:0xb9eeee, transparent:true, opacity:.48, side:THREE.DoubleSide, depthWrite:false}) };
  const ground = (x,z) => { const q=1-x*x/(17*17)-z*z/(13*13); return q>0 ? -.35+1.3*Math.sqrt(q) : null; };
  const dummy = new THREE.Object3D();
  function instances(geometry, mat, items) {
    const result = new THREE.InstancedMesh(geometry, mat, items.length);
    items.forEach((item,i)=>{ dummy.position.set(...item.pos); dummy.rotation.set(...item.rot); dummy.scale.set(...item.scale); dummy.updateMatrix(); result.setMatrixAt(i,dummy.matrix); });
    result.computeBoundingSphere(); scene.add(result); return result;
  }
  const fronds=[], blooms=[], gold=[], pebbles=[];
  for(let i=0;i<240;i++) {
    const x=(random()-.5)*32,z=(random()-.5)*24,y=ground(x,z);
    if(y===null || ((x+3)**2/23+(z-1)**2/12<1.3) || (x>4&&x<11&&z>0&&z<5)) continue;
    const s=.45+random()*.8, angle=random()*Math.PI*2;
    for(let j=0;j<3;j++) fronds.push({pos:[x,y+.12,z],rot:[0,angle+j*Math.PI*2/3,.58],scale:[s,s,s]});
    if(i%4===0) (i%8===0?gold:blooms).push({pos:[x,y+.34*s,z],rot:[0,angle,0],scale:[s,s,s]});
    if(i%11===0) pebbles.push({pos:[x,y+.06,z],rot:[0,angle,0],scale:[.3+s*.12,.12,.22+s*.1]});
  }
  const blade=new THREE.ConeGeometry(.12,1,5);blade.translate(0,.42,0);
  instances(blade,colors.fern,fronds);
  const flower=new THREE.IcosahedronGeometry(.14,0);
  instances(flower,colors.flower,blooms);instances(flower,colors.flowerYellow,gold);
  instances(new THREE.DodecahedronGeometry(1,0),colors.stone,pebbles);
  function add(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);scene.add(m);return m;}
  // Layered shallows and delicate ripples make the pond read as water.
  const rippleGeo=new THREE.RingGeometry(.94,1,48);
  const ripples=[];
  [[-4,1,.65],[-1.9,.5,.45],[-3,2,.35]].forEach(([x,z,size])=>{let m=add(rippleGeo,colors.water,x,.985,z);m.rotation.x=-Math.PI/2;m.scale.set(size,size,size);ripples.push({mesh:m,size});});
  // Broken highlights suggest waves without a costly water shader.
  const glints=[];
  for(let i=0;i<100;i++) {
    const a=random()*Math.PI*2, r=23+random()*45;
    glints.push({pos:[Math.cos(a)*r,-.30,Math.sin(a)*r],rot:[-Math.PI/2,0,random()*.4],scale:[.35+random()*.9,.025,1]});
  }
  instances(new THREE.CircleGeometry(1,8),colors.water,glints);
  // A small timber lookout and steps, above the eastern edge of the island.
  const beam=new THREE.BoxGeometry(1,1,1);
  function timber(x,y,z,sx,sy,sz){const m=add(beam,colors.wood,x,y,z);m.scale.set(sx,sy,sz);return m;}
  for(const x of [11,13])for(const z of [-4,-2]) timber(x,1.25,z,.18,2.5,.18);
  for(let i=0;i<6;i++)timber(12,2.5,-4+i*.4,2.5,.12,.33);
  for(const x of [10.9,13.1]){timber(x,3.1,-3,.12,1.2,.12);timber(x,3.6,-3,.12,.1,2.2);}
  for(let i=0;i<4;i++)timber(10.7-i*.45,.55+i*.35,-3,1,.12,.45);
  // Driftwood, shells and a natural edge to the beach.
  for(let i=0;i<32;i++){const a=.35+i*.08,x=Math.cos(a)*17.4,z=Math.sin(a)*13.1;const m=add(new THREE.DodecahedronGeometry(.13,0),i%3?colors.stone:colors.flower,x,.18,z);m.scale.set(1.3,.45,1);}
  const log=timber(2,.32,13,2.8,.22,.3);log.rotation.y=.3;
  return { update(t){ripples.forEach(({mesh,size},i)=>{const s=size*(1+.12*Math.sin(t*1.5+i));mesh.scale.set(s,s,s);});} };
}
