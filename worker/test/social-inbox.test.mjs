import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueSocial, processSocial, publishReviewed, reviewDraft, socialPhoto, socialSources } from '../social-inbox.mjs';
import { localDate } from '../mind.mjs';

class Storage {
  data = new Map();
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  async delete(key) { this.data.delete(key); }
  async list({ prefix, limit }) {
    return new Map([...this.data].filter(([key]) => key.startsWith(prefix)).slice(0, limit));
  }
  async transaction(fn) { return fn(this); }
  async getAlarm() { return this.alarm; }
  async setAlarm(at) { this.alarm = at; }
}

test('public sources omit private activity and defer a fourth new request', async () => {
  const storage = new Storage();
  const now = Date.now();
  const sources = socialSources([{ at: now, title: 'Cloud', text: 'I saw a crab cloud.' }], {
    activity: { place: 'pond' }, log: [
      { action: 'computer', place: 'computer', at: now - 3000 },
      { action: 'fish', place: 'pond', at: now - 2000 },
      { action: 'think', place: 'pond', at: now - 1000 },
    ],
  }, now - 5000);
  assert.deepEqual(sources.map(source => source.kind), ['journal', 'activity']);
  await enqueueSocial(storage, sources);
  await enqueueSocial(storage, sources);
  assert.equal((await storage.list({ prefix: 'queue:' })).size, 2);
  await storage.put('social:daily:' + localDate(now), 3);
  await processSocial(storage, {}, () => assert.fail('The daily limit must defer the draft.'));
  assert.equal((await storage.list({ prefix: 'queue:' })).size, 2);
  assert.equal((await storage.list({ prefix: 'conversation:' })).size, 0);
});

test('owner must review the exact revision and Instagram needs a photo', async () => {
  const storage = new Storage();
  const draft = { id: 'sample', revision: 2, state: 'review', thread: [], captions: { x: 'Crab!', instagram: 'Crab!' } };
  const env = { PATCH_X_CLIENT_ID: 'client', PATCH_META_PAGE_TOKEN: 'page' };
  await storage.put('conversation:sample', draft);
  await storage.put('social:x-token', { refresh_token: 'connected' });
  assert.equal((await reviewDraft(storage, env, draft.id, { action: 'approve', revision: 1, platforms: ['x'] })).status, 409);
  assert.equal((await reviewDraft(storage, env, draft.id, { action: 'approve', revision: 2, platforms: ['instagram'] })).status, 400);
  assert.equal((await reviewDraft(storage, env, draft.id, { action: 'approve', revision: 2, platforms: ['x'] })).status, 200);
  assert.equal((await reviewDraft(storage, env, draft.id, { action: 'approve', revision: 2, platforms: ['x'] })).status, 409);
  assert.equal(await storage.get('publish:sample'), 'sample');
});

test('publishing retains success, reserves uncertain outcomes, and releases photos only by ticket', async t => {
  const storage = new Storage();
  const draft = { id: 'sample', revision: 2, state: 'publishing', thread: [], captions: { x: 'Crab!', facebook: 'Unselected' }, selected: ['x'] };
  await storage.put('social:x-token', { access_token: 'sample', refresh_token: 'refresh', expires: Date.now() + 100000 });
  await storage.put('photo:sample', new Uint8Array([1, 2, 3]).buffer);
  assert.equal(await socialPhoto(storage, draft.id, null, false), null);
  assert.equal((await socialPhoto(storage, draft.id, null, true)).byteLength, 3);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push([url, JSON.parse(init.body)]);
    return new Response(null, { status: 503 });
  });
  const final = await publishReviewed(storage, {}, draft);
  assert.equal(final.outcomes.x.state, 'submitted');
  assert.deepEqual(calls, [['https://api.x.com/2/tweets', { text: 'Crab!' }]]);
  await publishReviewed(storage, {}, draft);
  assert.equal(calls.length, 1);
});

test('Patch can send and revise a camera draft without making a social API write', async t => {
  const storage = new Storage();
  const now = Date.now();
  await enqueueSocial(storage, [{
    id: 'journal-' + now, kind: 'journal', at: now, place: 'pond',
    title: 'At the pond', text: 'I found a round stone by the water.',
  }]);
  const replies = [
    { share: true, message: 'Can we show the pond?', facebook: 'I found a round stone!', instagram: 'Here is the pond.' },
    { share: true, message: 'I made it shorter.', facebook: 'A stone at the pond.', instagram: 'My pond.' },
  ];
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /^https:\/\/openrouter\.ai\//);
    return Response.json({ choices: [{ message: { content: JSON.stringify(replies.shift()) } }], usage: { cost: 0.001 } });
  });
  const image = new Uint8Array(2000);
  image.set([255, 216]);
  const env = { OPENROUTER_API_KEY: 'test', PATCH_SOCIAL_CAMERA: 'true', BROWSER: {
    async quickAction(action, options) {
      assert.equal(action, 'screenshot');
      assert.match(options.url, /social-camera=3$/);
      return new Response(image);
    },
  } };
  const alerts = [];
  await processSocial(storage, env, (id, revised) => alerts.push({ id, revised }));
  const [{ id }] = alerts;
  let draft = await storage.get('conversation:' + id);
  assert.equal(draft.photo.camera, 3);
  assert.equal(draft.revision, 1);
  assert.equal(await socialPhoto(storage, id, null, false), null);
  assert.equal((await socialPhoto(storage, id, null, true)).byteLength, 2000);
  assert.equal((await reviewDraft(storage, env, id, { action: 'revise', revision: 1, feedback: 'Make it shorter.' })).status, 200);
  await processSocial(storage, env, (id, revised) => alerts.push({ id, revised }));
  draft = await storage.get('conversation:' + id);
  assert.deepEqual(alerts, [{ id, revised: false }, { id, revised: true }]);
  assert.equal(draft.revision, 2);
  assert.equal(draft.thread.length, 3);
  assert.equal(draft.captions.facebook, 'A stone at the pond.');
  assert.equal((await storage.list({ prefix: 'publish:' })).size, 0);
});
