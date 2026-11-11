import test from 'node:test';
import assert from 'node:assert/strict';
import { newBody, choose, didSince, view, ACTIVITIES } from '../body.mjs';
import { ponder, research, writeJournal, webLeft, WEB_MINUTES, SEARCH_MINUTES, MODELS } from '../mind.mjs';

// 2026-06-01 in New York (EDT).
const at = (h, m = 0) => Date.UTC(2026, 5, 1, h + 4, m);
const env = { OPENROUTER_API_KEY: 'test' };

// Replies in order; each call records its request. A reply may carry `annotations` for web results.
function fakeOpenRouter(...replies) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    const { annotations = [], ...reply } = replies[Math.min(calls.length, replies.length) - 1];
    return Response.json({ model: calls.at(-1).models[0], choices: [{ message: { content: JSON.stringify(reply), annotations } }], usage: { cost: 0.001 } });
  };
  return calls;
}
const world = now => ({ body: newBody(now, 1), mind: {}, memories: [], categories: {} });
const hereAt = (w, action, place, now, minutes = 20) => { w.body.activity = { action, place, target: null, start: now, end: now + minutes * 60000, effects: {} }; };

test('the phone is gone; the coconut computer is only at camp and the tablet works anywhere', () => {
  const w = world(at(10));
  assert.equal(ACTIVITIES.some(choice => choice.action === 'phone'), false);
  assert.match(choose(w.body, { do: 'phone', minutes: 10 }, at(10)), /not something you can do/);
  assert.match(choose(w.body, { do: 'computer', where: 'beach', minutes: 10 }, at(10)), /only computer at: computer/);
  assert.equal(choose(w.body, { do: 'research', where: 'beach', minutes: 10 }, at(10)), null);
  assert.equal(choose(w.body, { do: 'write', where: 'beach', minutes: 10 }, at(10)), null);
  assert.equal(view(w.body, at(10), 2).patch.mail, 2);
});

test('waiting letters ping his tablet in his thoughts', async () => {
  const calls = fakeOpenRouter({ thought: 'Mail!', plan: { do: 'computer', where: 'computer', minutes: 15, why: 'letters', search: null } });
  const w = world(at(10));
  await ponder(env, { ...w, mail: 2 }, at(10));
  assert.match(calls[0].messages[1].content, /Ping! Your tablet says 2 letters are waiting for you at the coconut computer/);
  assert.equal(w.body.activity.target, 'computer');
  assert.equal(w.mind.wantSearch, undefined);
});

test('he knows whether he was at the computer since he last thought', () => {
  const w = world(at(10));
  hereAt(w, 'swim', 'pond', at(10));
  assert.equal(didSince(w.body, at(9), { place: 'computer' }), false);
  w.body.log = [{ action: 'computer', place: 'computer', target: null, at: at(9, 30) }];
  assert.equal(didSince(w.body, at(9), { place: 'computer' }), true);
  assert.equal(didSince(w.body, at(9, 45), { place: 'computer' }), false);
  w.body.log = [{ action: 'walk', place: 'hammock', target: 'computer', at: at(9, 30) }];
  assert.equal(didSince(w.body, at(9), { place: 'computer' }), false);
});

test('a search waits until he is on his tablet, reads the web safely, and uses up internet minutes', async () => {
  const calls = fakeOpenRouter(
    { thought: 'How do crabs breathe?', plan: { do: 'research', where: 'meadow', minutes: 15, search: 'how do crabs breathe' } },
    { learned: 'Crabs breathe with gills, and they keep them wet!', kidSafe: true, remember: null, newWords: [{ word: 'gills', meaning: 'how fish and crabs breathe', from: 'the internet' }],
      annotations: [{ type: 'url_citation', url_citation: { url: 'https://kids.example.org/crabs', title: 'Crab facts' } }, { type: 'url_citation', url_citation: { url: 'javascript:alert(1)', title: 'bad' } }] },
    { allowed: true, reason: null },
  );
  const w = world(at(10));
  await ponder(env, w, at(10));
  assert.equal(w.mind.wantSearch.query, 'how do crabs breathe');
  // Still walking to the meadow: nothing yet.
  assert.equal(await research(env, w, at(10, 1)), null);
  assert.equal(calls.length, 1);
  hereAt(w, 'research', 'meadow', at(10, 20));
  const entry = await research(env, w, at(10, 25));
  assert.equal(entry.where, 'tablet');
  assert.equal(entry.learned, 'Crabs breathe with gills, and they keep them wet!');
  assert.deepEqual(entry.sources, [{ title: 'Crab facts', url: 'https://kids.example.org/crabs' }]);
  assert.equal(calls[1].plugins[0].id, 'web');
  assert.ok(calls[1].plugins[0].exclude_domains.includes('pornhub.com'));
  assert.match(calls[2].messages[1].content, /Crab facts/);
  assert.equal(w.mind.words[0].word, 'gills');
  assert.equal(webLeft(w.mind, at(10, 25)), WEB_MINUTES - SEARCH_MINUTES);
  assert.equal(w.mind.wantSearch, null);
});

test('a search the filter blocks is closed, and an empty allowance stops searching', async () => {
  fakeOpenRouter({ learned: 'Something grown-up.', kidSafe: true }, { allowed: false, reason: 'no' });
  const w = world(at(10));
  hereAt(w, 'computer', 'computer', at(10));
  w.mind.wantSearch = { query: 'something odd', at: at(10) };
  const blocked = await research(env, w, at(10, 5));
  assert.equal(blocked.where, 'computer');
  assert.equal(blocked.learned, null);
  assert.deepEqual(blocked.sources, []);
  assert.match(blocked.note, /not right for kids/);
  const calls = fakeOpenRouter({ learned: 'x' });
  w.mind.web = { day: '2026-06-01', minutes: WEB_MINUTES };
  w.mind.wantSearch = { query: 'more', at: at(10) };
  const out = await research(env, w, at(10, 6));
  assert.match(out.note, /Out of internet minutes/);
  assert.equal(calls.length, 0);
});

test('on his tablet he writes his own journal, adds memories and rewrites island ones, but not childhood ones', async () => {
  const calls = fakeOpenRouter({
    journal: { title: 'Crab day', text: 'I watched a crab and looked it up. Gills!' },
    memories: [{ category: 'Ocean Friends', subcategory: 'crabs', title: 'The sideways crab', text: 'A crab walked right past my foot.', feeling: 'happy', strength: 3, tags: ['crab'] }],
    revise: [{ id: 'island-1', text: 'The pond fish was silver AND blue.', category: 'pond life', subcategory: 'fish' }, { id: 'first-word', text: 'changed' }],
    newWords: [],
  });
  const w = world(at(15));
  w.memories.push({ id: 'island-1', category: 'island', subcategory: 'everyday', title: 'A silver fish', text: 'I saw a silver fish.', source: 'island', tags: [] });
  hereAt(w, 'write', 'meadow', at(15));
  w.mind.wantWrite = { about: 'the crab', at: at(15) };
  const entry = await writeJournal(env, w, at(15, 10));
  assert.deepEqual(calls[0].models, MODELS.quality);
  assert.match(calls[0].messages[1].content, /island-1 \[island\/everyday\] A silver fish/);
  assert.equal(entry.kind, 'tablet');
  assert.equal(entry.title, 'Crab day');
  assert.equal(w.memories[0].text, 'The pond fish was silver AND blue.');
  assert.equal(w.memories[0].category, 'pond-life');
  assert.deepEqual(w.categories['pond-life'].subcategories, ['fish']);
  assert.equal(w.memories[1].category, 'ocean-friends');
  assert.equal(w.mind.wantWrite, null);
  assert.equal(await writeJournal(env, w, at(15, 20)), null);
});
