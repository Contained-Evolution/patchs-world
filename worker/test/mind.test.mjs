import test from 'node:test';
import assert from 'node:assert/strict';
import { newBody } from '../body.mjs';
import { ponder, writeDiary, nextWake, parseJson, MODELS, overBudget } from '../mind.mjs';

// 2026-06-01 in New York (EDT).
const at = (h, m = 0) => Date.UTC(2026, 5, 1, h + 4, m);
const env = { OPENROUTER_API_KEY: 'test' };

function fakeOpenRouter(reply, cost = 0.002) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({ model: calls.at(-1).models[0], choices: [{ message: { content: JSON.stringify(reply) } }], usage: { cost } });
  };
  return calls;
}

const world = now => ({ body: newBody(now, 1), mind: {}, memories: [], categories: {} });

test('a thought is recorded and can ask the body for an activity, a memory and a word', async () => {
  const calls = fakeOpenRouter({
    thought: 'The pond looks sparkly today.', says: 'Splash time!', want: 'swim',
    remember: { category: 'Pond Life', subcategory: 'fish', title: 'A silver fish', text: 'I saw a silver fish jump.', feeling: 'amazed' },
    newWords: [{ word: 'sparkly', meaning: 'shiny with little lights', from: 'the pond' }],
  });
  const w = world(at(10));
  await ponder(env, w, at(10));
  assert.deepEqual(calls[0].models, MODELS.everyday);
  assert.equal(calls[0].provider.data_collection, 'deny');
  assert.equal(w.mind.thoughts[0].thought, 'The pond looks sparkly today.');
  assert.equal(w.body.activity.says, 'Splash time!');
  assert.equal(w.body.activity.saysAt, at(10));
  assert.equal(w.body.want, 'swim');
  assert.equal(w.memories[0].category, 'pond-life');
  assert.deepEqual(w.categories['pond-life'].subcategories, ['fish']);
  assert.equal(w.mind.words[0].word, 'sparkly');
  assert.equal(w.mind.spend.total, 0.002);
});

test('unknown wants are ignored and the diary waits for evening', async () => {
  fakeOpenRouter({ thought: 'Hmm.', says: null, want: 'fly to the moon', remember: null, newWords: [] });
  const w = world(at(10));
  await ponder(env, w, at(10));
  assert.equal(w.body.want, null);
  assert.equal(await writeDiary(env, w, at(10)), null);
});

test('the evening diary uses the quality models, once a day', async () => {
  const calls = fakeOpenRouter({ title: 'A splashy day', text: 'Today I swam and swam.', newWords: [] });
  const w = world(at(20));
  const entry = await writeDiary(env, w, at(20));
  assert.equal(entry.title, 'A splashy day');
  assert.deepEqual(calls[0].models, MODELS.quality);
  assert.equal(await writeDiary(env, w, at(20, 40)), null);
});

test('he stops thinking near the monthly limit', async () => {
  const calls = fakeOpenRouter({ thought: 'x' });
  const w = world(at(10));
  w.mind.spend = { month: '2026-06', total: 24.5, day: '2026-06-01', today: 1 };
  assert.ok(overBudget(w.mind, at(10)));
  await ponder(env, w, at(10));
  assert.equal(calls.length, 0);
});

test('he wakes 30 to 60 minutes apart, and in the morning after sleeping', () => {
  const w = world(at(10));
  const gap = nextWake(w.body, at(10), () => 0.5) - at(10);
  assert.ok(gap >= 30 * 60000 && gap <= 60 * 60000);
  w.body.activity = { ...w.body.activity, action: 'sleep', end: at(6, 40) + 86400000 };
  assert.equal(nextWake(w.body, at(23)), at(6, 42) + 86400000);
});

test('JSON is read even when the model wraps it in words', () => {
  assert.deepEqual(parseJson('Sure! ```json\n{"a":1}\n```'), { a: 1 });
});

test('needs read as words, so a full tummy is full', async () => {
  const { feelings } = await import('../mind.mjs');
  assert.equal(feelings({ hunger: 0.84, energy: 0.1, fun: 0.5, comfort: 0.3, social: 1 }), 'full, exhausted, having fun, a bit restless, happy with company');
});
