import test from 'node:test';
import assert from 'node:assert/strict';
import { ballWear, campBalls, giftView, useGift } from '../gifts.mjs';

const day = 86_400_000;
const now = Date.UTC(2026, 10, 11, 14);
const camp = () => ({ activity: { place: 'computer' }, needs: { hunger: 0.4, fun: 0.4 } });

test('the banana waits until Patch chooses to eat it at camp', () => {
  const gifts = { meal: { day: '2026-11-11', status: 'waiting' } };
  assert.equal(useGift(gifts, 'eat', { activity: { place: 'beach' } }, now), false);
  const body = camp();
  assert.ok(useGift(gifts, 'eat', body, now));
  assert.equal(body.needs.hunger, 0.64);
  assert.equal(useGift(gifts, 'eat', body, now), false);
  assert.equal(giftView(gifts, '2026-11-11', now).canSendMeal, false);
  assert.equal(giftView(gifts, '2026-11-12', now + day).canSendMeal, true);
});

test('the same ball wears down, gives less fun, and stays until Patch chooses a replacement', () => {
  const gifts = { offer: { status: 'waiting' } };
  assert.ok(useGift(gifts, 'keep', camp(), now));
  const old = gifts.ball;
  const fresh = camp(), worn = camp();
  assert.ok(useGift(gifts, 'play', fresh, now));
  assert.ok(useGift(gifts, 'play', worn, now + 30 * day));
  assert.ok(fresh.needs.fun > worn.needs.fun);
  assert.equal(ballWear(old, now + 90 * day), 1);
  assert.equal(gifts.ball, old);
  gifts.offer = { status: 'waiting' };
  assert.ok(useGift(gifts, 'keep', camp(), now + 31 * day));
  assert.equal(gifts.ball, old);
  gifts.offer = { status: 'waiting' };
  assert.ok(useGift(gifts, 'replace', camp(), now + 32 * day));
  assert.notEqual(gifts.ball, old);
  assert.equal(ballWear(gifts.ball, now + 32 * day), 0);
});

test('Patch can put on Chris’s hoodie once when he is at camp', () => {
  const gifts = { hoodie: { status: 'waiting' }, offer: { status: 'waiting' } };
  assert.equal(useGift(gifts, 'wear', { activity: { place: 'beach' } }, now), false);
  assert.equal(useGift(gifts, 'wear', { activity: { place: 'computer', target: 'beach' } }, now), false);
  assert.match(useGift(gifts, 'wear', camp(), now), /Chris/);
  assert.equal(giftView(gifts, '2026-11-11', now).hoodie, 'worn');
  assert.equal(gifts.offer.status, 'waiting');
  assert.equal(useGift(gifts, 'wear', camp(), now), false);
});

test('only actual offers and kept balls show at camp, and play returns to the shelf', () => {
  const gifts = { id: 'private', offer: { status: 'waiting' } };
  assert.deepEqual(campBalls([gifts], now), [{ place: 'drop-off', wear: 0 }]);
  assert.equal(useGift(gifts, 'play', camp(), now), false);
  assert.ok(useGift(gifts, 'keep', camp(), now));
  assert.deepEqual(campBalls([gifts], now), [{ place: 'shelves', wear: 0, play: null }]);
  const body = camp();
  assert.ok(useGift(gifts, 'play', body, now));
  assert.equal(body.needs.fun, .4 + .2);
  assert.equal(useGift(gifts, 'play', body, now + 1000), false);
  assert.deepEqual(campBalls([gifts], now)[0].play, { at: now, place: 'computer' });
  assert.equal(campBalls([gifts], now + 12_000)[0].play, null);
  assert.equal(gifts.ball.plays, 1);
});
