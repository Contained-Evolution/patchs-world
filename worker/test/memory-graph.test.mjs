import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lightUp, recordRecall, conceptGraph, tagsIn, normalTags, concepts } from '../memory-graph.mjs';

const childhood = JSON.parse(readFileSync(new URL('../seed/childhood.json', import.meta.url)));
const HOUR = 3600000, now = Date.UTC(2026, 10, 11, 15);

test('seeing a banana lights every banana memory, and the light spreads to linked things', () => {
  const lit = lightUp(childhood, ['banana'], {}, now, 20);
  const banana = childhood.filter(memory => memory.tags.includes('banana')).map(memory => memory.id);
  assert.ok(banana.length >= 6);
  for (const id of banana) assert.ok(lit.memories.some(entry => entry.memory.id === id), `${id} stayed dark`);
  const tags = lit.tags.map(entry => entry.tag);
  for (const linked of ['food', 'mom', 'family']) assert.ok(tags.includes(linked), `${linked} did not light`);
  assert.equal(lit.tags[0].tag, 'banana');
  assert.equal(lightUp(childhood, ['bananas'], {}, now).tags[0].tag, 'banana');
});

test('strong feelings and recent recall glow brighter', () => {
  const a = { id: 'a', tags: ['rain'], strength: 4 }, b = { id: 'b', tags: ['rain'], strength: 5 };
  assert.equal(lightUp([a, b], ['rain'], {}, now).memories[0].memory.id, 'b');
  const recalls = recordRecall({}, ['a'], now - HOUR);
  assert.equal(lightUp([a, b], ['rain'], recalls, now).memories[0].memory.id, 'a');
  const faded = recordRecall({}, ['a'], now - 2000 * HOUR);
  assert.equal(lightUp([a, b], ['rain'], faded, now).memories[0].memory.id, 'b');
});

test('new memories strengthen links and nothing unrelated lights', () => {
  const before = conceptGraph(childhood).get('banana').links.get('swinging') || 0;
  const island = [...childhood, { id: 'island-1', tags: ['banana', 'swinging'], strength: 4, at: now }];
  assert.equal(conceptGraph(island).get('banana').links.get('swinging'), before + 1);
  assert.equal(lightUp(childhood, ['spaceship'], {}, now).memories.length, 0);
});

test('tags are tidy and letters can mention things he knows', () => {
  assert.deepEqual(normalTags(['#Little-Sister', 'Banana', 'banana', '', 42]), ['little sister', 'banana']);
  const graph = conceptGraph(childhood);
  assert.ok(tagsIn('Do you like bananas and the river?', graph).includes('banana'));
  assert.ok(tagsIn('Do you like bananas and the river?', graph).includes('river'));
  assert.ok(concepts(childhood).find(concept => concept.tag === 'banana').count >= 6);
});
