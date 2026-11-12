import test from 'node:test';
import assert from 'node:assert/strict';
import { places, paths, groundHeight, walkRoute, swingLoop, trees, anchorFor, swingRoute, statusText, isLocalPreview, safePatch } from '../src/world-state.js';

test('status describes activity, place and travel', () => {
  assert.equal(statusText({action:'fish', place:'pond'}), 'Patch is fishing at the pond.');
  assert.equal(statusText({action:'think', place:'hammock'}), 'Patch is thinking by his hammock.');
  assert.equal(statusText({action:'sit', place:'hammock'}), 'Patch is sitting by his hammock.');
  assert.equal(statusText({action:'sleep', place:'hammock'}), 'Patch is asleep in his hammock.');
  assert.equal(statusText({action:'swing', place:'tall-trees', target:'banana-grove'}), 'Patch is on his way to the banana grove.');
});
test('demo hosts are limited to loopback', () => {
  for (const host of ['localhost','127.0.0.1','127.0.0.2','[::1]','preview.localhost']) assert.equal(isLocalPreview(host),true);
  for (const host of ['tenari.world','localhost.example.com','example.local']) assert.equal(isLocalPreview(host),false);
});
test('every place pair connects through nearby real tree anchors', () => {
  const anchors=trees.map(anchorFor);
  for (const from of Object.values(places)) for (const to of Object.values(places)) {
    const route=swingRoute(from,to);
    assert.ok(route.length);
    for (const anchor of route) assert.ok(anchors.some(a => a.every((v,i) => v===anchor[i])));
    for (let i=1;i<route.length;i++) assert.ok(Math.hypot(route[i][0]-route[i-1][0], route[i][2]-route[i-1][2]) < 12);
    const closest = p => trees.reduce((best,t,i) => Math.hypot(t[0]-p[0],t[1]-p[1]) < Math.hypot(trees[best][0]-p[0],trees[best][1]-p[1]) ? i : best,0);
    assert.deepEqual(route[0],anchors[closest(from)]);
    assert.deepEqual(route.at(-1),anchors[closest(to)]);
  }
});


test('all shared places have connected walking paths on the valley heightfield', async () => {
  const { PLACES, ACTIONS } = await import('../../shared/state.js');
  assert.deepEqual(Object.keys(places).sort(), [...PLACES].sort());
  for (const from of PLACES) for (const to of PLACES) {
    assert.deepEqual(paths[from].at(-1), places[from]);
    assert.deepEqual(walkRoute(from,to).at(-1), places[to]);
  }
  for (const id of PLACES) assert.ok(Number.isFinite(groundHeight(...places[id])));
  assert.ok(ACTIONS.includes('explore') && ACTIONS.includes('watch-sky'));
  assert.equal(statusText({action:'explore',place:'cave'}), 'Patch is exploring the cave.');
});

test('in-place swinging cycles through multiple branches', () => {
  const route=swingLoop();
  assert.ok(new Set(route.map(a=>a.join(','))).size >= 3);
  assert.deepEqual(route[0],route.at(-1));
});


test('unknown live places and actions fall back to idle at camp', () => {
  for (const patch of [{place:'unknown',action:'walk'}, {place:'pond',action:'unknown'}, {place:'pond',action:'walk',target:'unknown'}]) {
    const safe=safePatch(patch); assert.equal(safe.place,'hammock'); assert.equal(safe.action,'idle'); assert.equal(safe.target,null);
  }
  assert.equal(safePatch({place:'cave',action:'explore'}).action,'explore');
});

test('swing arcs keep clear of the swing trunks',()=>{
 const loop=swingLoop();for(let i=1;i<loop.length;i++){const a=loop[i-1],b=loop[i],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);for(let j=0;j<=40;j++){const t=j/40;let nx=-dz/len,nz=dx/len;if(Math.abs(nx)>.1&&nx<0){nx=-nx;nz=-nz;}const x=a[0]+dx*t+nx*Math.sin(Math.PI*t)*2,z=a[2]+dz*t+nz*Math.sin(Math.PI*t)*2;for(const [tx,tz] of trees)assert.ok(Math.hypot(x-tx,z-tz)>.6,`swing crossed a trunk at ${x},${z}`);}}
});
