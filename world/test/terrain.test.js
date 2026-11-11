import test from 'node:test';
import assert from 'node:assert/strict';
import {places, paths, groundHeight, shoreFraction, coastRadius, walkShoreLimit} from '../src/terrain.js';

test('coast is irregular, continuous and contains all activity places',()=>{
  const radii=Array.from({length:360},(_,i)=>coastRadius(i*Math.PI/180));
  assert.ok(Math.max(...radii)-Math.min(...radii)>.1);
  assert.ok(Math.max(...radii.map((r,i)=>Math.abs(r-radii[(i+1)%360])))<.02);
  for(const [name,[x,z]] of Object.entries(places)) assert.ok(shoreFraction(x,z)<walkShoreLimit,`${name} outside coast`);
});
test('activity clearings retain their established elevations',()=>{
  for(const [name,[x,z]] of Object.entries(places)){
    const previous=.9+5.2*Math.exp(-(((x+16)/6.5)**2+((z+22)/7)**2));
    assert.ok(Math.abs(groundHeight(x,z)-previous)<.01,`${name} elevation changed`);
  }
  assert.ok(Math.abs(groundHeight(18,10)-.9)<.01);
});
test('all route segments remain continuous and walkable',()=>{
  for(const [name,route] of Object.entries(paths)) for(let i=1;i<route.length;i++){
    const [x,z]=route[i-1],[xx,zz]=route[i],n=Math.ceil(Math.hypot(xx-x,zz-z)/.25);
    let last=groundHeight(x,z);
    for(let j=1;j<=n;j++) {const t=j/n,px=x+(xx-x)*t,pz=z+(zz-z)*t,h=groundHeight(px,pz);assert.ok(shoreFraction(px,pz)<walkShoreLimit,`${name} leaves the island`);assert.ok(Math.abs(h-last)/(Math.hypot(xx-x,zz-z)/n)<1.1,`${name} too steep`);last=h;}
  }
});
