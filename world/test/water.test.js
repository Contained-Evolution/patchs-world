import test from 'node:test';
import assert from 'node:assert/strict';
import {ISLAND,STREAM,TIDE_POOLS,groundHeight,tideWaterHeight} from '../src/terrain.js';
test('flowing water and tidal pools have ground beneath their surfaces',()=>{
 for(let i=1;i<STREAM.length;i++){const a=STREAM[i-1],b=STREAM[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),n=Math.ceil(length);for(let j=0;j<=n;j++){const t=j/n,y=a[2]+(b[2]-a[2])*t;for(const offset of [-1.5,0,1.5]){const x=a[0]+dx*t-dz/length*offset,z=a[1]+dz*t+dx/length*offset;assert.ok(groundHeight(x,z)<y-.05,`stream bed at ${x},${z}`);}}}
 for(const pool of TIDE_POOLS)assert.ok(groundHeight(pool[0],pool[1])<tideWaterHeight(pool));
 assert.ok(groundHeight(ISLAND.pondX,ISLAND.pondZ)<ISLAND.pondY);
});
