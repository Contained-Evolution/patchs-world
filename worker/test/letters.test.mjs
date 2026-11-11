import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, cleanText, freshLimits, checkLetter, checkPost, countLetter, countPost, pickLetters, postKey } from '../letters.mjs';
import { visitor } from '../accounts.mjs';
import { answerLetters, moderate } from '../mind.mjs';
import { newBody } from '../body.mjs';

const NOW = Date.UTC(2026, 5, 1, 15);

test('letters: empty, too long, too many, duplicate and full mailbox are refused', () => {
  let limits = freshLimits(null, '2026-06-01');
  assert.match(checkLetter('', limits, 0), /Write something/);
  assert.match(checkLetter('x'.repeat(LIMITS.letterLength + 1), limits, 0), /up to/);
  assert.equal(checkLetter('Hi Patch!', limits, 0), null);
  limits = countLetter(limits, 'Hi Patch!');
  assert.match(checkLetter('hi patch', limits, 0), /already sent/);
  limits = countLetter(countLetter(limits, 'two'), 'three');
  assert.match(checkLetter('four', limits, 0), /a day/);
  assert.match(checkLetter('new', freshLimits(null, 'x'), LIMITS.unreadCap), /full/);
});

test('limits reset each day', () => {
  const today = countLetter(freshLimits(null, '2026-06-01'), 'a');
  assert.equal(freshLimits(today, '2026-06-01').letters, 1);
  assert.equal(freshLimits(today, '2026-06-02').letters, 0);
});

test('board: links, floods and repeats are refused', () => {
  let limits = freshLimits(null, '2026-06-01');
  assert.match(checkPost('visit www.spam.com', limits, NOW), /Links/);
  assert.match(checkPost('see https://x.io now', limits, NOW), /Links/);
  assert.equal(checkPost('Go Patch!', limits, NOW), null);
  limits = countPost(limits, 'Go Patch!', NOW);
  assert.match(checkPost('Another one', limits, NOW + 5000), /Slow down/);
  assert.match(checkPost('go patch', limits, NOW + 60000), /already posted/);
  assert.equal(checkPost('Another one', limits, NOW + 60000), null);
});

test('text is cleaned of control characters and long blank runs', () => {
  assert.equal(cleanText('  hi\u0007\n\n\n\nthere  '), 'hi\n\nthere');
  assert.equal(cleanText(42), '');
});

test('new writers are read first, then the oldest letters', () => {
  const letters = [
    { id: 'a', from: { id: 'old' }, at: 1 },
    { id: 'b', from: { id: 'new1' }, at: 3 },
    { id: 'c', from: { id: 'new2' }, at: 2 },
    { id: 'd', from: { id: 'new3' }, at: 4 },
  ];
  assert.deepEqual(pickLetters(letters, { old: { answered: 2 } }).map(l => l.id), ['c', 'b', 'd']);
});

test('board keys list newest first', () => {
  assert.ok(postKey(NOW + 1000, 'b') < postKey(NOW, 'a'));
});

test('a visitor is read from the Contained Evolution session through the account service', async () => {
  const token = 't'.repeat(43);
  const env = { AUTH_SERVICE: { fetch: async request => {
    assert.equal(new URL(request.url).pathname, '/api/me');
    return request.headers.get('cookie') === `ce_session=${token}` ? Response.json({ user: { id: 7, gamertag: 'kiwi_fan', email: 'containedevolution@gmail.com' } }) : Response.json({}, { status: 401 });
  } } };
  const request = cookie => new Request('https://containedevolution.com/patch/api/me', { headers: { cookie } });
  assert.deepEqual(await visitor(request(`ce_session=${token}`), env), { id: '7', name: 'kiwi_fan', admin: true });
  assert.equal(await visitor(request(`ce_session=${'x'.repeat(43)}`), env), null);
  assert.equal(await visitor(request(''), env), null);
});

function fakeOpenRouter(reply) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({ model: 'z-ai/glm-5.3', choices: [{ message: { content: JSON.stringify(reply) } }], usage: { cost: 0.001 } });
  };
  return calls;
}

test('Patch answers only the letters he was given, and remembers the writer', async () => {
  const calls = fakeOpenRouter({ replies: [
    { id: 'a', reply: 'Hi Sam-fan! I love bananas too.', note: 'likes bananas' },
    { id: 'zzz', reply: 'not a real letter' },
  ], newWords: [] });
  const world = { body: newBody(NOW, 1), mind: {}, memories: [] };
  const letters = [{ id: 'a', from: { id: '1', name: 'kiwi_fan' }, text: 'Do you like bananas?' }];
  const replies = await answerLetters({ OPENROUTER_API_KEY: 'k' }, world, letters, {}, NOW);
  assert.deepEqual(replies.map(r => [r.id, r.note]), [['a', 'likes bananas']]);
  assert.match(calls[0].messages[1].content, /first time kiwi_fan wrote/);
});

test('the filter reports allowed or blocked with its cost', async () => {
  fakeOpenRouter({ allowed: false, reason: 'Please keep it kind.' });
  assert.deepEqual(await moderate({ OPENROUTER_API_KEY: 'k' }, 'mean words'), { allowed: false, reason: 'Please keep it kind.', cost: 0.001 });
});
