import test from 'node:test';
import assert from 'node:assert/strict';
import { journalMonths, journalVolume, validMonth } from '../journal.mjs';

const records = new Map([
  ['diary:2026-10-31', { title: 'Legacy', text: 'Written in October.' }],
  ['diary:2026-11-01T01:15:1793513700000', { title: 'Second', text: 'After the clocks changed.', at: 1793513700000 }],
  ['diary:2026-11-01T01:50:1793512200000', { title: 'First', text: 'Before the clocks changed.', at: 1793512200000 }],
  ['diary:2026-11-04T20:00:1793840400000', { title: 'Latest', text: 'On a later day.', at: 1793840400000 }],
  ['thought:2026-11-05', { text: 'Not journal writing.' }],
]);
const storage = { async list({ prefix, end, reverse, limit }) {
  const keys = [...records.keys()].filter(key => key.startsWith(prefix) && (!end || key < end)).sort();
  if (reverse) keys.reverse();
  return new Map(keys.slice(0, limit ?? keys.length).map(key => [key, records.get(key)]));
} };

test('archive lists existing volumes and keeps local dates and chronological same-day writing', async () => {
  assert.deepEqual(await journalMonths(storage), ['2026-11', '2026-10']);
  const november = await journalVolume(storage, '2026-11');
  assert.deepEqual(november.map(day => day.date), ['2026-11-04', '2026-11-01']);
  assert.deepEqual(november[1].entries.map(entry => entry.title), ['First', 'Second']);
  assert.deepEqual(await journalVolume(storage, '2026-10'), [
    { date: '2026-10-31', entries: [{ title: 'Legacy', text: 'Written in October.' }] },
  ]);
  assert.deepEqual(await journalVolume(storage, '2026-09'), []);
  assert.equal(validMonth('2026-00'), false);
  assert.equal(validMonth('2026-11-01'), false);
});
