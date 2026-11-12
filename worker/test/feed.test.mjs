import test from 'node:test';
import assert from 'node:assert/strict';
import { feedFrom } from '../../shared/feed.js';

test('each thought becomes a line, and what he said follows it', () => {
  const feed = feedFrom([{ at: 1000, thought: 'Hungry.', says: 'Banana time!' }, { at: 2000, thought: 'Nap.', says: null }]);
  assert.deepEqual(feed.map(line => [line.kind, line.text]), [['thought', 'Hungry.'], ['says', 'Banana time!'], ['thought', 'Nap.']]);
  assert.equal(feed[0].at, '1970-01-01T00:00:01.000Z');
});

test('the feed keeps the latest lines and skips bad entries', () => {
  const thoughts = Array.from({ length: 40 }, (_, index) => ({ at: index + 1, thought: `t${index}` }));
  assert.equal(feedFrom(thoughts, 5).at(-1).text, 't39');
  assert.equal(feedFrom(thoughts, 5).length, 5);
  assert.deepEqual(feedFrom([null, { thought: 'no time' }, { at: 1, thought: '  ' }]), []);
  assert.deepEqual(feedFrom(undefined), []);
});
