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
    meal: gifts.meal?.status || null,
    canSendMeal: gifts.meal?.day !== day && gifts.meal?.status !== 'waiting',
    offer: gifts.offer?.status || null,
    canSendBall: gifts.offer?.status !== 'waiting' && (!gifts.ball || ballWear(gifts.ball, now) >= 0.9),
    ball: gifts.ball ? { wear: ballWear(gifts.ball, now), condition: condition(ballWear(gifts.ball, now)), plays: gifts.ball.plays } : null,
  };
}

export function giftNotes(gifts = [], now) {
  return gifts.map(({ id, meal, offer, ball }) => {
    const options = [];
    if (meal?.status === 'waiting') options.push('a banana left for you (eat)');
    if (offer?.status === 'waiting') options.push(ball ? 'a new ball from the same visitor. Keep the old ball (keep) or take the new one (replace)' : 'a new ball to keep (keep)');
    if (ball) options.push(`your ball, ${condition(ballWear(ball, now)).toLowerCase()} (play)`);
    return options.length ? `At camp (computer, shelves or hammock), gift ${id}: ${options.join('; ')}.` : '';
  }).filter(Boolean).join('\n');
}

export function useGift(gifts, action, body, now) {
  if (body.activity.target || !CAMP.includes(body.activity.place)) return false;
  if (action === 'eat' && gifts.meal?.status === 'waiting') {
    gifts.meal.status = 'eaten';
    body.needs.hunger = Math.min(1, body.needs.hunger + 0.24);
    return 'I ate a banana a visitor left for me at camp.';
  }
  if (action === 'play' && gifts.ball && now - (gifts.ball.lastPlayed || 0) >= 20 * 60_000) {
    gifts.ball.plays += 1;
    gifts.ball.lastPlayed = now;
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
