import test from 'node:test';
import assert from 'node:assert/strict';
import {plantPositions} from '../src/world-dressing.js';
import {places, paths, trees} from '../src/world-state.js';
import {shoreFraction} from '../src/terrain.js';
function distance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
test('vegetation is deterministic and keeps routes and activity places clear',()=>{
  const plants=plantPositions();assert.deepEqual(plants,plantPositions());assert.ok(plants.length>100);
  for(const {x,z} of plants){assert.ok(shoreFraction(x,z)<=.79);for(const [px,pz] of Object.values(places))assert.ok(Math.hypot(x-px,z-pz)>=3.5);for(const route of Object.values(paths))for(let i=1;i<route.length;i++)assert.ok(distance(x,z,route[i-1],route[i])>=2.1);for(const [tx,tz] of trees)assert.ok(Math.hypot(x-tx,z-tz)>=1.2);}
});
