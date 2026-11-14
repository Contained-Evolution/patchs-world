import { BALL_PLAY_DURATION } from '../shared/state.js';

const DAY = 86_400_000;
const CAMP = ['computer', 'shelves', 'hammock'];

export function ballWear(ball, now) {
  return ball ? Math.min(1, Math.max(0, (now - ball.keptAt) / (30 * DAY))) : 0;
}

function condition(wear) {
  if (wear >= 0.85) return 'Dented and barely bounces';
  if (wear >= 0.45) return 'Scuffed with a few dents';
  if (wear >= 0.15) return 'A little scuffed';
  return 'Shiny and bouncy';
}

export function giftView(gifts, day, now) {
  return {
    hoodie: gifts.hoodie?.status || null,
    meal: gifts.meal?.status || null,
    canSendMeal: gifts.meal?.day !== day && gifts.meal?.status !== 'waiting',
    offer: gifts.offer?.status || null,
    canSendBall: gifts.offer?.status !== 'waiting' && (!gifts.ball || ballWear(gifts.ball, now) >= 0.9),
    ball: gifts.ball ? { wear: ballWear(gifts.ball, now), condition: condition(ballWear(gifts.ball, now)), plays: gifts.ball.plays } : null,
  };
}

export function campBalls(records, now) {
  return records.flatMap(({ offer, ball }) => {
    const items = [];
    if (offer?.status === 'waiting') items.push({ place: 'drop-off', wear: 0 });
    if (ball) items.push({
      place: 'shelves',
      wear: ballWear(ball, now),
      play: ball.play && now >= ball.play.at && now - ball.play.at < BALL_PLAY_DURATION ? ball.play : null,
    });
    return items;
  });
}

export function giftNotes(gifts = [], now) {
  return gifts.map(({ id, meal, offer, ball, hoodie }) => {
    const options = [];
    if (hoodie?.status === 'waiting') options.push('a gray hoodie with PATCH on it, a gift from Chris. Put it on (wear)');
    if (meal?.status === 'waiting') options.push('a banana left for you (eat)');
    if (offer?.status === 'waiting') options.push(ball ? 'a new ball from the same visitor. Keep the old ball (keep) or take the new one (replace)' : 'a new ball to keep (keep)');
    if (ball) {
      const ready = now - (ball.lastPlayed || 0) >= 20 * 60_000;
      options.push(`your ball on the rope shelf, ${condition(ballWear(ball, now)).toLowerCase()}${ready ? ' (play)' : ' (you just played with it; let it rest)'}`);
    }
    return options.length ? `At camp (computer, shelves or hammock), gift ${id}: ${options.join('; ')}.` : '';
  }).filter(Boolean).join('\n');
}

export function canPlayBall(gifts, activity, now) {
  return Boolean(gifts?.ball && !activity.target && CAMP.includes(activity.place)
    && now - (gifts.ball.lastPlayed || 0) >= 20 * 60_000);
}

export function useGift(gifts, action, body, now) {
  if (body.activity.target || !CAMP.includes(body.activity.place)) return false;
  if (action === 'wear' && gifts.hoodie?.status === 'waiting') {
    gifts.hoodie.status = 'worn';
    return 'I put on the hoodie Chris gave me.';
  }
  if (action === 'eat' && gifts.meal?.status === 'waiting') {
    gifts.meal.status = 'eaten';
    body.needs.hunger = Math.min(1, body.needs.hunger + 0.24);
    return 'I ate a banana a visitor left for me at camp.';
  }
  if (action === 'play' && canPlayBall(gifts, body.activity, now)) {
    gifts.ball.plays += 1;
    gifts.ball.lastPlayed = now;
    gifts.ball.play = { at: now, place: body.activity.place };
    const wear = ballWear(gifts.ball, now);
    body.needs.fun = Math.min(1, body.needs.fun + 0.2 - wear * 0.16);
    return wear >= 0.85 ? 'I played with my ball. It barely bounced!' : 'I bounced a ball a visitor gave me.';
  }
  if (gifts.offer?.status !== 'waiting') return false;
  if (action === 'keep' && gifts.ball) {
    gifts.offer.status = 'kept-old';
    return 'I decided to keep my old ball.';
  }
  if ((action === 'replace' && gifts.ball) || (action === 'keep' && !gifts.ball)) {
    gifts.offer.status = gifts.ball ? 'replaced' : 'accepted';
    gifts.ball = { keptAt: now, plays: 0 };
    return 'I kept a new ball a visitor left for me.';
  }
  return false;
}
