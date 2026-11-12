const labels = { x: 'X', facebook: 'Facebook', instagram: 'Instagram' };
const cameras = ['Camp', 'Banana grove', 'Tall trees', 'Pond', 'Beach', 'Lookout', 'Meadow', 'Cave', 'Tide pools', 'Waterfall', 'Upper River', 'Coconut Computer'];
const status = document.querySelector('#social-status');
const panel = document.querySelector('#social-drafts');
const list = document.querySelector('#social-conversations');
const accounts = document.querySelector('#social-accounts');
const params = new URLSearchParams(location.search);
const stamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function element(tag, text, parent) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  parent?.append(node);
  return node;
}

async function api(path, body) {
  const response = await fetch('/api/social/' + path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status, signIn: result.signIn });
  return result;
}

function link(parent, url, text) {
  const anchor = element('a', text, parent);
  anchor.href = url;
  return anchor;
}

function button(parent, text, action) {
  const control = element('button', text, parent);
  control.type = 'button';
  control.onclick = action;
  return control;
}

function conversation(draft, connections) {
  const article = element('article');
  article.className = 'host-conversation';
  article.id = 'draft-' + draft.id;
  element('h3', draft.source.title || draft.source.action + ' · ' + draft.source.place.replaceAll('-', ' '), article);
  if (draft.source.url) link(article, draft.source.url, 'Read Patch’s journal');
  const transcript = element('ol', '', article);
  for (const message of draft.thread) {
    const line = element('li', '', transcript);
    line.className = message.author === 'Patch' ? 'patch-message' : 'host-message';
    element('strong', message.author, line);
    element('p', message.text, line);
    const time = element('time', stamp.format(message.at), line);
    time.dateTime = new Date(message.at).toISOString();
  }
  if (draft.photo) {
    const figure = element('figure', '', article);
    const image = element('img', '', figure);
    image.loading = 'lazy';
    image.src = '/api/social/media/' + draft.id;
    image.alt = 'Island view from the ' + cameras[draft.photo.camera] + ' camera';
    element('figcaption', cameras[draft.photo.camera] + ' camera · ' + stamp.format(draft.photo.at), figure);
  }

  const editable = ['review', 'held'].includes(draft.state);
  const retryable = draft.state === 'finished' && Object.values(draft.outcomes || {}).some(result => ['error', 'reconnect'].includes(result.state));
  const selection = [];
  const destinations = element('fieldset', '', article);
  element('legend', 'Destinations', destinations);
  for (const [platform, caption] of Object.entries(draft.captions)) {
    const card = element('section', '', destinations);
    const outcome = draft.outcomes?.[platform];
    const missingPhoto = platform === 'instagram' && !draft.photo;
    const available = connections[platform] && !missingPhoto;
    const choice = element('label', '', card);
    if (editable || (retryable && ['error', 'reconnect'].includes(outcome?.state))) {
      const check = element('input', '', choice);
      check.type = 'checkbox';
      check.checked = available && !outcome;
      check.disabled = !available;
      selection.push([platform, check]);
    }
    element('strong', labels[platform], choice);
    element('p', caption, card);
    if (draft.photo && platform !== 'x') element('small', 'Includes the camera photo above.', card);
    if (outcome?.state === 'published') {
      if (outcome.url) link(card, outcome.url, 'View published post');
      else element('small', 'Published', card);
    } else if (outcome?.state === 'submitted') element('small', 'Check the account before attempting another post.', card);
    else if (outcome?.error) element('small', outcome.error, card);
    else if (missingPhoto) element('small', 'Needs a photo', card);
    else if (!connections[platform]) element('small', 'Account setup pending', card);
  }
  const info = element('p', { held: 'Held for review', revising: 'Patch is working on a revision.', publishing: 'Sending approved posts…' }[draft.state], article);
  info.setAttribute('role', 'status');
  if (!editable && !retryable) return article;

  async function submit(action, values = {}) {
    controls.disabled = true;
    try {
      const { draft: updated } = await api('inbox/' + draft.id, { action, revision: draft.revision, ...values });
      article.replaceWith(conversation(updated, connections));
      if (['revising', 'publishing'].includes(updated.state)) setTimeout(refresh, 6000);
    } catch (error) {
      info.textContent = error.message || 'Could not save your decision.';
      controls.disabled = false;
    }
  }
  const controls = element('fieldset', '', article);
  element('legend', 'Host decision', controls);
  const approve = button(controls, 'Approve and publish', () => submit('approve', {
    platforms: selection.filter(([, check]) => check.checked).map(([platform]) => platform),
  }));
  const update = () => { approve.disabled = !selection.some(([, check]) => check.checked); };
  selection.forEach(([, check]) => check.addEventListener('change', update));
  update();
  if (editable) {
    button(controls, 'Hold', () => submit('hold'));
    const label = element('label', 'What should Patch change?', controls);
    const feedback = element('textarea', '', label);
    feedback.maxLength = 600;
    const revise = button(controls, 'Ask for a revision', () => submit('revise', { feedback: feedback.value.trim() }));
    feedback.addEventListener('input', () => { revise.disabled = !feedback.value.trim(); });
    revise.disabled = true;
  }
  return article;
}

async function refresh() {
  try {
    const { drafts, connections } = await api('inbox');
    accounts.replaceChildren();
    const callbackError = params.get('social');
    if (callbackError) status.textContent = callbackError;
    if (!connections.x) button(accounts, 'Connect X', async event => {
      event.currentTarget.disabled = true;
      try { window.top.location.assign((await api('x/connect', {})).authorize); }
      catch (error) { status.textContent = error.message; }
    });
    if (!connections.facebook || !connections.instagram) element('p', 'Facebook and Instagram publishing needs the linked Page credential.', accounts);
    const showing = params.get('draft');
    const ordered = showing ? [...drafts].sort((a, b) => Number(b.id === showing) - Number(a.id === showing)) : drafts;
    list.replaceChildren(...ordered.map(draft => conversation(draft, connections)));
    if (!drafts.length) {
      element('p', 'Patch hasn’t sent a new draft yet.', list);
      button(list, 'Ask Patch about his latest journal entry', async event => {
        event.currentTarget.disabled = true;
        try {
          await api('journal-draft', {});
          status.textContent = 'Patch is considering his latest journal entry.';
          setTimeout(refresh, 12000);
        } catch (error) { status.textContent = error.message; }
      });
    }
    panel.hidden = false;
    if (showing && !window.location.hash) document.getElementById('draft-' + showing)?.scrollIntoView();
    if (drafts.some(draft => ['publishing', 'revising'].includes(draft.state))) setTimeout(refresh, 8000);
  } catch (error) {
    if (!location.pathname.endsWith('/tablet.html')) return;
    panel.hidden = false;
    status.textContent = error.status === 401 ? 'Sign in to review messages from Patch.' : error.message || 'The inbox could not open.';
    if (error.signIn) link(accounts, error.signIn, 'Sign in to Contained Evolution');
  }
}

refresh();
