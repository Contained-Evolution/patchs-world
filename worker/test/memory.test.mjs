import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STARTING_CATEGORIES } from '../../shared/memory.js';

const memories = JSON.parse(readFileSync(new URL('../seed/childhood.json', import.meta.url)));

test('every childhood memory is complete, unique and filed in a starting category', () => {
  const ids = new Set();
  for (const memory of memories) {
    for (const key of ['id', 'category', 'subcategory', 'title', 'text', 'feeling']) assert.ok(memory[key], `${memory.id} is missing ${key}`);
    assert.ok(!ids.has(memory.id), `duplicate ${memory.id}`);
    ids.add(memory.id);
    assert.ok(STARTING_CATEGORIES[memory.category]?.subcategories.includes(memory.subcategory), `${memory.id} is filed in ${memory.category}/${memory.subcategory}`);
    assert.ok(memory.age > 0 && memory.age <= 5, memory.id);
    assert.ok(Array.isArray(memory.people));
  }
});

test('every starting cluster has at least one memory', () => {
  for (const [category, { subcategories }] of Object.entries(STARTING_CATEGORIES))
    for (const sub of subcategories)
      assert.ok(memories.some(m => m.category === category && m.subcategory === sub), `${category}/${sub} is empty`);
});

test('every childhood memory has a strength, tags, and no names but Patch', () => {
  for (const memory of memories) {
    assert.ok(Number.isInteger(memory.strength) && memory.strength >= 1 && memory.strength <= 5, memory.id);
    assert.ok(Array.isArray(memory.tags) && memory.tags.length >= 2, memory.id);
    assert.ok(!/George|Sally|\bSam\b|Tiko/.test(JSON.stringify(memory)), `${memory.id} still names someone`);
  }
});
