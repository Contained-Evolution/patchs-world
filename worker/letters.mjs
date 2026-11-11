// Rules for letters to Patch and posts on the message board. Pure functions, so they're easy to test.

export const LIMITS = {
  letterLength: 1000,
  lettersPerDay: 3,
  postLength: 280,
  postsPerDay: 20,
  postGapMs: 30_000,
  unreadCap: 200,
  lettersPerWake: 3,
  reportsToHide: 3,
};

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ly|gg|xyz|app|dev|co)\b)/i;

export function cleanText(text) {
  return typeof text === 'string' ? text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim() : '';
}

const fingerprint = text => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// A visitor's counters reset each day. `limits` is { day, letters, posts, lastPostAt, seen: [fingerprints] }.
export function freshLimits(limits, day) {
  return limits?.day === day ? limits : { day, letters: 0, posts: 0, lastPostAt: 0, seen: [] };
}

export function checkLetter(text, limits, unreadCount) {
  if (!text) return 'Write something to Patch first.';
  if (text.length > LIMITS.letterLength) return `Letters can be up to ${LIMITS.letterLength} characters.`;
  if (limits.letters >= LIMITS.lettersPerDay) return `You can send Patch ${LIMITS.lettersPerDay} letters a day. Write again tomorrow!`;
  if (limits.seen.includes(fingerprint(text))) return 'You already sent that today.';
  if (unreadCount >= LIMITS.unreadCap) return "Patch's mailbox is full right now. Try again tomorrow.";
  return null;
}

export function checkPost(text, limits, now) {
  if (!text) return 'Write something first.';
  if (text.length > LIMITS.postLength) return `Posts can be up to ${LIMITS.postLength} characters.`;
  if (LINK.test(text)) return 'Links aren’t allowed on the message board.';
  if (limits.posts >= LIMITS.postsPerDay) return 'That’s enough posts for today. Come back tomorrow!';
  if (now - limits.lastPostAt < LIMITS.postGapMs) return 'Slow down a little. Try again in a few seconds.';
  if (limits.seen.includes(fingerprint(text))) return 'You already posted that today.';
  return null;
}

export function countLetter(limits, text) {
  return { ...limits, letters: limits.letters + 1, seen: [...limits.seen, fingerprint(text)].slice(-40) };
}

export function countPost(limits, text, now) {
  return { ...limits, posts: limits.posts + 1, lastPostAt: now, seen: [...limits.seen, fingerprint(text)].slice(-40) };
}

// Which unread letters Patch reads next: people he hasn't heard from before come first, then the oldest.
export function pickLetters(unread, people, count = LIMITS.lettersPerWake) {
  return [...unread]
    .sort((a, b) => Number(Boolean(people[a.from.id]?.answered)) - Number(Boolean(people[b.from.id]?.answered)) || a.at - b.at)
    .slice(0, count);
}

// Board keys sort newest first.
export const postKey = (now, id) => `post:${String(1e15 - now).padStart(16, '0')}-${id}`;
