import test from 'node:test';
import { valleyBoundary } from '../src/valley/companion-layout.js';
import assert from 'node:assert/strict';
import {places, paths, groundHeight, ISLAND, pondFraction} from '../src/terrain.js';
test('all activity places are inside the walkable valley boundary', () => {
 for (const [name, [x,z]] of Object.entries(places)) {
  assert.ok(!valleyBoundary(x, z), name + ' outside the valley');
 }
});
test('ground height is finite, continuous and provides a pond basin',()=>{
 for(const [name,[x,z]] of Object.entries(places)){let h=groundHeight(x,z);assert.ok(Number.isFinite(h),name);assert.ok(Math.abs(groundHeight(x+.05,z)-h)<.1,name);}
 assert.ok(pondFraction(ISLAND.pondX,ISLAND.pondZ)<.01);assert.ok(groundHeight(ISLAND.pondX,ISLAND.pondZ)<ISLAND.pondY);
});
test('all route segments remain continuous and walkable',()=>{
 for(const [name,route] of Object.entries(paths))for(let i=1;i<route.length;i++){
  const [x,z]=route[i-1],[xx,zz]=route[i],n=Math.ceil(Math.hypot(xx-x,zz-z)/.5);let last=groundHeight(x,z);
  for(let j=1;j<=n;j++){const t=j/n,px=x+(xx-x)*t,pz=z+(zz-z)*t,h=groundHeight(px,pz);assert.ok(!valleyBoundary(px,pz),`${name} leaves island`);assert.ok(Math.abs(h-last)/(Math.hypot(xx-x,zz-z)/n)<1.1,`${name} too steep`);last=h;}
 }
});
