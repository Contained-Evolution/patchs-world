import test from 'node:test';
import assert from 'node:assert/strict';
import {ISLAND,RIVER,STREAM,TIDE_POOLS,groundHeight,riverPoint,riverSpeed,shoreFraction,tideWaterHeight} from '../src/terrain.js';
import {clearGroundLine,inPond,pondAccess,walkable} from '../src/island-collision.js';
import {patchRoute} from '../src/patch-motion.js';
test('flowing water and tidal pools have ground beneath their surfaces',()=>{
 for(let i=1;i<STREAM.length;i++){const a=STREAM[i-1],b=STREAM[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),n=Math.ceil(length);for(let j=0;j<=n;j++){const t=j/n,y=a[2]+(b[2]-a[2])*t;for(const offset of [-1.5,0,1.5]){const x=a[0]+dx*t-dz/length*offset,z=a[1]+dz*t+dx/length*offset;assert.ok(groundHeight(x,z)<y-.05,`stream bed at ${x},${z}`);}}}
 for(const pool of TIDE_POOLS)assert.ok(groundHeight(pool[0],pool[1])<tideWaterHeight(pool));
 assert.ok(groundHeight(ISLAND.pondX,ISLAND.pondZ)<ISLAND.pondY);
});

test('the downhill river starts offshore and carries Patch through the falls into the pool',()=>{
 const inlet=riverPoint(0);
 assert.ok(shoreFraction(inlet.x,inlet.z)>1);
 assert.equal(inlet.y,ISLAND.ocean);
 const entryBank=riverPoint(RIVER.entry,-1.42),entry=riverPoint(RIVER.entry);
 const bank=[entryBank.x,entryBank.z];
 assert.ok(walkable(...bank));
 const route=patchRoute([65,66],bank,0);
 assert.deepEqual(route.at(-1),bank);
 assert.ok(clearGroundLine(bank,[entry.x,entry.z],undefined,true));
 const lip=riverPoint(RIVER.lip),foot=riverPoint(RIVER.foot);
 assert.ok(lip.y-foot.y>4);
 assert.ok(riverSpeed(RIVER.foot)>riverSpeed(RIVER.entry));
 let previous=entry.y;
 for(let s=RIVER.entry;s<RIVER.length;s+=.25){
  const {x,y,z}=riverPoint(s,.08*Math.sin((s-RIVER.entry)*.32));
  assert.ok(y<=previous+1e-6);
  assert.ok(groundHeight(x,z)<y-.35,`dry at river station ${s}`);
  previous=y;
 }
 const end=riverPoint(RIVER.length);
 assert.ok(inPond(end.x,end.z));
 assert.ok(pondAccess([end.x,end.z]));
});
