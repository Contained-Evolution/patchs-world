import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMemories, sharedTagLinks, memoryLights } from '../src/memory-layout.js';

const memories = [
  { id: 'a', category: 'core', subcategory: 'me', strength: 1, tags: ['home', 'home', 'sky'] },
  { id: 'b', category: 'family', subcategory: 'dad', strength: 5, tags: ['home', 'sky'] },
  { id: 'c', category: 'island', subcategory: 'pond', strength: 3, tags: [] },
];
test('layout centers core, accommodates new categories and stays stable across API ordering', () => {
  const layout = layoutMemories(memories, { core: { title: 'My story', subcategories: ['me'] } });
  assert.deepEqual(layout.galaxies[0].position, [0, 0, 0]);
  assert.equal(layout.galaxies.length, 3);
  assert.ok(layout.stars[1].size > layout.stars[0].size);
  const reversed = layoutMemories([...memories].reverse(), { core: { title: 'My story', subcategories: ['me'] } });
  for (const star of layout.stars) assert.deepEqual(star, reversed.stars.find(s => s.memory.id === star.memory.id));
  assert.deepEqual(layoutMemories([], {}).stars, []);
});
test('links count distinct shared tags once per pair and omit unrelated memories', () => {
  assert.deepEqual(sharedTagLinks(memories), [{ from: 0, to: 1, count: 2, tags: ['home', 'sky'] }]);
});
test('recall handles absent thoughts and normalizes weighted memory scores', () => {
  assert.equal(memoryLights(null).size, 0);
  const lights = memoryLights({ memories: [{ id: 'a', light: 5 }, { id: 'b', light: 2.5 }, { id: 'c', light: -1 }] });
  assert.equal(lights.get('a'), 1); assert.equal(lights.get('b'), .5); assert.equal(lights.get('c'), 0);
  assert.equal(memoryLights({ memories: [{ id: 'a', light: .2 }] }).get('a'), .2);
});
