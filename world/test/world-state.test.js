import test from 'node:test';
import assert from 'node:assert/strict';
import { places, trees, anchorFor, swingRoute, statusText, isLocalPreview } from '../src/world-state.js';

test('status describes activity, place and travel', () => {
  assert.equal(statusText({action:'fish', place:'pond'}), 'Patch is fishing at the pond.');
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
