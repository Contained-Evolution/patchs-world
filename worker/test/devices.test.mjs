import test from 'node:test';
import assert from 'node:assert/strict';
import { newBody, choose, didSince, view, ACTIVITIES } from '../body.mjs';
import { ponder, research, writeJournal, internetStatus, DAILY_SEARCH_BUDGET, SEARCH_RESERVE, MODELS } from '../mind.mjs';

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

test('the coconut computer is only at camp and the tablet works anywhere', () => {
  const w = world(at(10));
  assert.ok(ACTIVITIES.some(choice => choice.action === 'computer' && choice.place === 'computer'));
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

test('a search waits until he is on his tablet, can be about anything, and records the whole search cost', async () => {
  const calls = fakeOpenRouter(
    { thought: 'Who won the World Cup?', plan: { do: 'research', where: 'meadow', minutes: 15, search: 'who won the last World Cup' } },
    { learned: 'A team won the World Cup and everyone cheered!', closed: [], remember: null, newWords: [{ word: 'tournament', meaning: 'lots of games to find the best team', from: 'the internet' }],
      annotations: [{ type: 'url_citation', url_citation: { url: 'https://www.sports.example.com/cup', title: 'World Cup final', content: 'The final was played...' } }, { type: 'url_citation', url_citation: { url: 'javascript:alert(1)', title: 'bad' } }] },
    { close: [], learnedOk: true },
  );
  const w = world(at(10));
  await ponder(env, w, at(10));
  assert.equal(w.mind.wantSearch.query, 'who won the last World Cup');
  // Still walking to the meadow: nothing yet.
  assert.equal(await research(env, w, at(10, 1)), null);
  assert.equal(calls.length, 1);
  hereAt(w, 'research', 'meadow', at(10, 20));
  const entry = await research(env, w, at(10, 25));
  assert.equal(entry.where, 'tablet');
  assert.equal(entry.learned, 'A team won the World Cup and everyone cheered!');
  assert.deepEqual(entry.sources, [{ title: 'World Cup final', url: 'https://www.sports.example.com/cup' }]);
  assert.equal(entry.note, null);
  assert.equal(calls[1].plugins[0].id, 'web');
  assert.ok(calls[1].plugins[0].exclude_domains.includes('pornhub.com'));
  assert.match(calls[1].messages[1].content, /sports, news, politics/);
  // The page check allows real-world topics and sees each page.
  assert.match(calls[2].messages[0].content, /politics and elections/);
  assert.match(calls[2].messages[1].content, /1\. World Cup final \(https:\/\/www\.sports\.example\.com\/cup\)\n   The final was played/);
  assert.equal(w.mind.words[0].word, 'tournament');
  assert.deepEqual(w.mind.searchSpend, { day: "2026-06-01", spent: 0.002 });
  assert.equal(w.mind.wantSearch, null);
});

test('inappropriate pages are closed, kept out of what he learned, and their sites are never searched again', async () => {
  const pages = [
    { type: 'url_citation', url_citation: { url: 'https://news.example.com/election', title: 'Election results' } },
    { type: 'url_citation', url_citation: { url: 'https://www.bad.example.net/x', title: 'Something explicit' } },
    { type: 'url_citation', url_citation: { url: 'https://gory.example.org/y', title: 'Gore' } },
  ];
  // He closes one page himself; the page check closes another.
  let calls = fakeOpenRouter({ learned: 'People voted for a new leader.', closed: ['https://www.bad.example.net/x', 'https://not-in-results.example.com'], annotations: pages }, { close: [3], learnedOk: true });
  const w = world(at(10));
  hereAt(w, 'computer', 'computer', at(10));
  w.mind.wantSearch = { query: 'election results', at: at(10) };
  const entry = await research(env, w, at(10, 5));
  assert.equal(entry.where, 'computer');
  assert.equal(entry.learned, 'People voted for a new leader.');
  assert.deepEqual(entry.sources.map(source => source.title), ['Election results']);
  assert.deepEqual(w.mind.closedSites, ['bad.example.net', 'gory.example.org']);
  assert.match(entry.note, /Closed bad\.example\.net, gory\.example\.org, and won't go back/);
  // Next time: those sites are excluded from the search, and he's reminded of them.
  calls = fakeOpenRouter({ thought: 'More news.' }, { learned: 'x', closed: [], annotations: [] }, { close: [], learnedOk: true });
  await ponder(env, w, at(10, 10));
  assert.match(calls[0].messages[1].content, /won't go back to: bad\.example\.net, gory\.example\.org/);
  w.mind.wantSearch = { query: 'more news', at: at(10, 10) };
  await research(env, w, at(10, 15));
  assert.ok(calls[1].plugins[0].exclude_domains.includes('gory.example.org'));
});

test('what he learned is dropped when it is itself inappropriate, and an empty allowance stops searching', async () => {
  fakeOpenRouter({ learned: 'Something explicit.', closed: [] }, { close: [], learnedOk: false });
  const w = world(at(10));
  hereAt(w, 'research', 'beach', at(10));
  w.mind.wantSearch = { query: 'something odd', at: at(10) };
  const dropped = await research(env, w, at(10, 5));
  assert.equal(dropped.learned, null);
  assert.equal(w.mind.thoughts, undefined);
  const calls = fakeOpenRouter({ learned: 'x' });
  w.mind.searchSpend = { day: '2026-06-01', spent: DAILY_SEARCH_BUDGET - SEARCH_RESERVE / 2 };
  w.mind.wantSearch = { query: 'more', at: at(10) };
  const out = await research(env, w, at(10, 6));
  assert.match(out.note, /Out of internet/);
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

test('memories made in the same wake each get their own id', async () => {
  fakeOpenRouter(
    { thought: 'Crabs!', plan: { do: 'research', where: 'beach', minutes: 15, search: 'crabs' }, remember: { title: 'A crab', text: 'A crab waved at me.', tags: ['crab'] } },
    { learned: 'Crabs have ten legs.', closed: [], annotations: [{ type: 'url_citation', url_citation: { url: 'https://example.org/crabs', title: 'Crabs' } }], remember: { title: 'Ten legs', text: 'Crabs have ten legs!', tags: ['crab'] } },
    { close: [], learnedOk: true },
  );
  const w = world(at(10));
  await ponder(env, w, at(10));
  await research(env, w, at(10));
  assert.equal(w.memories.length, 2);
  assert.notEqual(w.memories[0].id, w.memories[1].id);
});

test('the daily search warning omits dollars and resets at New York midnight', async () => {
  const calls = fakeOpenRouter({ thought: 'Internet.' });
  const w = world(at(10));
  w.mind.searchSpend = { day: '2026-06-01', spent: 22.5 };
  await ponder(env, w, at(10));
  assert.match(calls[0].messages[1].content, /almost out of internet for today/);
  assert.doesNotMatch(calls[0].messages[1].content, /22\.5|\$25/);
  assert.equal(internetStatus(w.mind.searchSpend, at(24)), 'available');
});

test('a failed provider call leaves the search reservation on the ledger', async () => {
  globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
  const w = world(at(10));
  hereAt(w, 'research', 'beach', at(10));
  w.mind.wantSearch = { query: 'hermit crabs', at: at(10) };
  const ledger = [];
  w.saveSearchSpend = async value => ledger.push(structuredClone(value));
  await assert.rejects(research(env, w, at(10)), /OpenRouter 503/);
  assert.deepEqual(ledger, [{ day: '2026-06-01', spent: SEARCH_RESERVE }]);
});
