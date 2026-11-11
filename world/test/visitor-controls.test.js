import test from 'node:test';
import assert from 'node:assert/strict';
import {walkable} from '../src/visitor-controls.js';
import {places,paths,ISLAND,coastRadius,walkShoreLimit} from '../src/terrain.js';
test('each planned trail can be followed with walking collision enabled',()=>{
 for(const [name,route] of Object.entries(paths))for(let i=1;i<route.length;i++){
  const [x,z]=route[i-1],[xx,zz]=route[i],n=Math.ceil(Math.hypot(xx-x,zz-z));let px=x,pz=z;
  for(let j=1;j<=n;j++){const t=j/n,nx=x+(xx-x)*t,nz=z+(zz-z)*t;assert.ok(walkable(nx,nz,px,pz),`${name} blocked at ${nx},${nz}`);px=nx;pz=nz;}
 }
 for(let i=0;i<32;i++){const a=i*Math.PI/16,r=coastRadius(a)*(walkShoreLimit+.002);assert.equal(walkable(ISLAND.radiusX*r*Math.cos(a),ISLAND.radiusZ*r*Math.sin(a)),false);}
});
test('cave entry is open and its back blocks a visitor',()=>{
 const [x,z]=places.cave;assert.equal(walkable(x,z-6,x,z-5),true);assert.equal(walkable(x,z-16,x,z-14),false);assert.equal(walkable(x+5.5,z-8,x+4,z-8),false);
});
