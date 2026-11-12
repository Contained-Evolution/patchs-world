import { think, localDate, spend, overBudget } from './mind.mjs';
import { PERSONA } from './persona.mjs';
import { drafts, configured, publish, storedXHeaders } from './social.mjs';

const origin = 'https://patch.containedevolution.com';
const platforms = Object.keys(drafts);
const key = id => 'conversation:' + id;
const size = { x: 260, facebook: 1500, instagram: 1500 };
const cameras = { hammock: 0, camp: 0, 'banana-grove': 1, 'tall-trees': 2, pond: 3, beach: 4, lookout: 5, meadow: 6, cave: 7, 'tide-pools': 8, waterfall: 9, computer: 11 };
const clean = (text, limit) => typeof text === 'string' && text.trim().length <= limit ? text.trim() : '';
const allowed = new Set(['fish', 'swim', 'swing', 'climb', 'waterfall', 'forage', 'explore', 'play', 'jump', 'bounce', 'gather', 'archery', 'dance', 'watch-sky']);

export function socialSources(entries, body, since) {
  const journal = entries.map(entry => ({
    id: 'journal-' + entry.at, at: entry.at, title: entry.title, text: entry.text,
    kind: 'journal', place: body.activity.place, url: '/journal.html',
  }));
  const log = body.log || [];
  const activities = log.slice(0, -1).flatMap((entry, i) => {
    const end = log[i + 1].at;
    if (end < since || entry.target || !allowed.has(entry.action)) return [];
    return [{ id: 'activity-' + entry.at, at: end, kind: 'activity', action: entry.action, place: entry.place }];
  });
  return [...journal, ...activities].slice(0, 6);
}

export async function enqueueSocial(storage, sources) {
  if (!sources.length) return;
  const added = await storage.transaction(async txn => {
    let count = 0;
    for (const source of sources) {
      if (!/^(journal|activity)-\d+$/.test(source.id) || await txn.get('source:' + source.id)) continue;
      await txn.put('source:' + source.id, true);
      await txn.put('queue:' + source.id, { source, attempts: 0 });
      count++;
    }
    return count;
  });
  if (added && !(await storage.getAlarm())) await storage.setAlarm(Date.now() + 1000);
}

async function capture(env, source) {
  if (!env.BROWSER || env.PATCH_SOCIAL_CAMERA !== 'true') return null;
  const camera = cameras[source.place] ?? 0;
  const at = Date.now();
  const response = await env.BROWSER.quickAction('screenshot', {
    url: origin + '/social-camera.html?social-camera=' + camera,
    selector: '#social-camera-frame',
    waitForSelector: '#social-camera-frame[data-ready="true"]',
    viewport: { width: 720, height: 480 },
    screenshotOptions: { type: 'jpeg', quality: 66 },
  });
  if (!response.ok) throw new Error('Island camera unavailable.');
  const bytes = await response.arrayBuffer();
  const jpeg = new Uint8Array(bytes);
  if (jpeg.length > 115000 || jpeg.length < 1000 || jpeg[0] !== 255 || jpeg[1] !== 216) throw new Error('Invalid camera image.');
  return { bytes, at, camera };
}

async function compose(env, storage, source, revision) {
  const now = Date.now();
  const mind = await storage.get('social:mind-budget') || {};
  if (!env.OPENROUTER_API_KEY || overBudget(mind, now)) throw new Error('Patch’s writing service is unavailable.');
  const { reply, cost } = await think(env, [
    { role: 'system', content: PERSONA + '\nYou are texting Contained Evolution, your reality show host. Decide if this public island event is worth a social post. Use only the facts provided. Camera photos show the island around capture time, never claim they show the event. Host revision feedback is about the draft. Return JSON {share:boolean,message:string,x:string,facebook:string,instagram:string}; empty strings omit a platform. Keep X under 240 characters. Captions in your own voice, no invented facts, links or hashtags. A revision should reply to the host and provide revised captions.' },
    { role: 'user', content: JSON.stringify({ source, revision }) },
  ], 'everyday', 850);
  spend(mind, cost, now);
  await storage.put('social:mind-budget', mind);
  if (reply.share !== true && !revision && !source.requested) return null;
  const message = clean(reply.message, 600);
  const captions = Object.fromEntries(platforms.flatMap(p => {
    const text = clean(reply[p], size[p]);
    return text ? [[p, text]] : [];
  }));
  if (!message || !Object.keys(captions).length) throw new Error('Patch did not return a complete draft.');
  return { message, captions };
}

export async function processSocial(storage, env, notify) {
  const publications = await storage.list({ prefix: 'publish:', limit: 1 });
  const publication = publications.entries().next().value;
  if (publication) {
    const [jobKey, id] = publication;
    const draft = await storage.get(key(id));
    if (draft?.state === 'publishing') await publishReviewed(storage, env, draft);
    await storage.delete(jobKey);
    await storage.setAlarm(Date.now() + 1000);
    return;
  }
  const revisions = await storage.list({ prefix: 'revision:', limit: 1 });
  const day = localDate(Date.now());
  const countKey = 'social:daily:' + day;
  const count = await storage.get(countKey) || 0;
  const next = revisions.size ? revisions : count < 3 ? await storage.list({ prefix: 'queue:', limit: 1 }) : new Map();
  const [jobKey, job] = next.entries().next().value || [];
  if (job) {
    try {
      const previous = job.id ? await storage.get(key(job.id)) : null;
      const source = previous?.source || job.source;
      if (job.id && previous?.state !== 'revising') { await storage.delete(jobKey); return; }
      const proposal = await compose(env, storage, source, previous && { feedback: job.feedback, captions: previous.captions });
      if (!proposal) { await storage.delete(jobKey); return; }
      const id = previous?.id || crypto.randomUUID();
      let photo = previous?.photo || null;
      if (!previous && (proposal.captions.instagram || proposal.captions.facebook)) {
        try {
          const image = await capture(env, source);
          if (image) {
            await storage.put('photo:' + id, image.bytes);
            photo = { camera: image.camera, at: image.at };
          }
        } catch (error) { console.warn('Social camera capture failed', error.message); }
      }
      const now = Date.now();
      const draft = {
        id, source, at: previous?.at || now, revision: (previous?.revision || 0) + 1,
        state: 'review', captions: proposal.captions, photo,
        thread: [...(previous?.thread || []), { author: 'Patch', text: proposal.message, at: now }],
      };
      await storage.transaction(async txn => {
        await txn.put(key(id), draft);
        if (!previous) await txn.put(countKey, count + 1);
        await txn.delete(jobKey);
      });
      try { await notify(id, Boolean(previous)); } catch (error) { console.warn('Social approval alert failed', error.message); }
    } catch (error) {
      console.warn('Social draft preparation failed', error.message);
      if (job.attempts >= 2) {
        await storage.delete(jobKey);
        if (job.id) {
          const previous = await storage.get(key(job.id));
          if (previous?.state === 'revising') await storage.put(key(job.id), {
            ...previous, state: 'held', thread: [...previous.thread, { author: 'Patch', text: "I couldn't finish that revision. Can you ask me again later?", at: Date.now() }],
          });
        }
      } else await storage.put(jobKey, { ...job, attempts: job.attempts + 1 });
    } finally {
      await storage.setAlarm(Date.now() + 60000);
    }
  } else if ((await storage.list({ prefix: 'queue:', limit: 1 })).size) {
    // Recheck across midnight in New York, including daylight saving changes.
    await storage.setAlarm(Date.now() + 30 * 60000);
  }
}

export async function reviewDraft(storage, env, id, body) {
  const action = body?.action;
  const feedback = clean(body?.feedback, 600);
  const targets = Array.isArray(body?.platforms) ? [...new Set(body.platforms)] : [];
  if (!['approve', 'revise', 'hold'].includes(action) || (action === 'revise' && !feedback) ||
      (action === 'approve' && (!targets.length || targets.some(p => !platforms.includes(p))))) {
    return { status: 400, error: 'Choose a valid review action.' };
  }
  const result = await storage.transaction(async txn => {
    const draft = await txn.get(key(id));
    if (!draft) return { status: 404, error: 'Draft not found.' };
    const retry = draft.state === 'finished' && action === 'approve' &&
      targets.every(p => ['error', 'reconnect'].includes(draft.outcomes?.[p]?.state));
    if ((!['review', 'held'].includes(draft.state) && !retry) || draft.revision !== body.revision) {
      return { status: 409, error: 'This draft has changed. Reload it before approving.' };
    }
    if (action === 'approve' && targets.includes('x') && !(await txn.get('social:x-token'))?.refresh_token) {
      return { status: 409, error: 'Connect Patch’s X account first.' };
    }
    if (action === 'approve' && targets.some(p => !draft.captions[p] || !configured(env, p) || (p === 'instagram' && !draft.photo))) {
      return { status: 400, error: 'A selected destination needs a caption, photo, or connection.' };
    }
    const state = { approve: 'publishing', revise: 'revising', hold: 'held' }[action];
    const text = { approve: 'Approved for ' + targets.join(', ') + '.', revise: feedback, hold: 'Hold this draft for now.' }[action];
    const updated = { ...draft, state, thread: [...draft.thread, { author: 'Contained Evolution', text, at: Date.now() }] };
    if (action === 'approve') {
      updated.selected = targets;
      await txn.put('publish:' + id, id);
    }
    if (action === 'revise') await txn.put('revision:' + id, { id, feedback, attempts: 0 });
    await txn.put(key(id), updated);
    return { status: 200, draft: updated };
  });
  if (result.status === 200 && action !== 'hold') {
    const alarm = await storage.getAlarm();
    if (!alarm || alarm > Date.now() + 1000) await storage.setAlarm(Date.now() + 1000);
  }
  return result;
}

export async function publishReviewed(storage, env, draft) {
  const outcomes = { ...draft.outcomes };
  for (const platform of draft.selected) {
    const existing = await storage.get('post:' + draft.id + ':' + platform);
    if (existing) { outcomes[platform] = existing; continue; }
    try {
      const auth = platform === 'x' ? await storedXHeaders(storage, env) : null;
      let image;
      if (draft.photo && platform !== 'x') {
        const ticket = crypto.randomUUID();
        await storage.put('media-ticket:' + draft.id, { ticket, expires: Date.now() + 86400000 });
        image = origin + '/api/social/media/' + draft.id + '?ticket=' + ticket;
      }
      outcomes[platform] = await publish(storage, env, platform, auth,
        { text: draft.captions[platform], image }, 'post:' + draft.id + ':' + platform);
    } catch (error) {
      outcomes[platform] = { state: error.reconnect ? 'reconnect' : 'error', error: error.message };
    }
    await storage.put(key(draft.id), { ...draft, outcomes });
  }
  const summary = draft.selected.map(p => p + ' ' + ({
    published: 'published', reconnect: 'needs reconnection', submitted: 'needs an account check', error: 'needs attention',
  })[outcomes[p].state]).join(', ');
  const final = {
    ...draft, outcomes, state: 'finished',
    thread: [...draft.thread, { author: 'Contained Evolution', text: summary + '.', at: Date.now() }],
  };
  await storage.put(key(draft.id), final);
  return final;
}

export async function inbox(storage) {
  const drafts = await storage.list({ prefix: 'conversation:', limit: 100 });
  return [...drafts.values()].sort((a, b) => b.at - a.at);
}

export async function socialPhoto(storage, id, ticket, owner) {
  if (!owner) {
    const saved = await storage.get('media-ticket:' + id);
    if (!ticket || saved?.ticket !== ticket || saved.expires < Date.now()) return null;
  }
  return storage.get('photo:' + id);
}
