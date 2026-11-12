const status = document.querySelector('#status');
const zone = 'America/New_York';
const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: zone });
const dayAndTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: zone });
if (window.self !== window.top) document.body.classList.add('framed');

function card(list, title, body, at, sources = []) {
  const article = document.createElement('article');
  const heading = document.createElement('h3');
  heading.textContent = title;
  article.append(heading);
  if (at) {
    const time = document.createElement('time');
    time.dateTime = at;
    time.textContent = day.format(new Date(at));
    article.append(time);
  }
  const paragraph = document.createElement('p');
  paragraph.textContent = body;
  article.append(paragraph);
  for (const source of sources) {
    if (!source.url?.startsWith('https://')) continue;
    const line = document.createElement('p');
    const link = document.createElement('a');
    link.href = source.url;
    link.textContent = source.title;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    line.append(link);
    article.append(line);
  }
  document.querySelector(list).append(article);
}

const when = entry => entry.at || (entry.date && entry.date + 'T12:00:00-05:00');
const stamp = entry => entry.at ? dayAndTime.format(new Date(entry.at)) : day.format(new Date(when(entry)));

// The drawer slides in from the left with every entry, newest first.
const drawer = document.querySelector('#entries-drawer'), toggle = document.querySelector('#entries-toggle'), backdrop = document.querySelector('#drawer-backdrop');
function setDrawer(open) {
  drawer.classList.toggle('open', open);
  drawer.inert = !open;
  backdrop.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}
toggle.onclick = () => setDrawer(!drawer.classList.contains('open'));
backdrop.onclick = () => setDrawer(false);
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !drawer.classList.contains('open')) return;
  setDrawer(false);
  toggle.focus();
});

function showEntry(entry, button) {
  const article = document.createElement('article');
  const heading = document.createElement('h3');
  heading.textContent = entry.title;
  const time = document.createElement('time');
  if (when(entry)) { time.dateTime = when(entry); time.textContent = stamp(entry); }
  const text = document.createElement('p');
  text.textContent = entry.text;
  article.append(heading, time, text);
  document.querySelector('#entry').replaceChildren(article);
  for (const item of document.querySelectorAll('#entries-list button')) item.removeAttribute('aria-current');
  button?.setAttribute('aria-current', 'true');
}

function fillDrawer(entries) {
  const list = document.querySelector('#entries-list');
  for (const entry of entries) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const title = document.createElement('strong'), time = document.createElement('small');
    title.textContent = entry.title;
    time.textContent = stamp(entry);
    button.type = 'button';
    button.append(title, time);
    button.onclick = () => { showEntry(entry, button); setDrawer(false); window.scrollTo(0, 0); };
    item.append(button);
    list.append(item);
  }
  showEntry(entries[0], list.querySelector('button'));
}

async function openJournal() {
  const response = await fetch('./api/journal');
  if (!response.ok) throw new Error('Journal unavailable');
  const { diary, words, searches } = await response.json();
  const entries = [...diary].sort((a, b) => Date.parse(when(b)) - Date.parse(when(a)));
  if (entries.length) { fillDrawer(entries); toggle.hidden = false; }
  else document.querySelector('#entry').textContent = 'Patch hasn’t written here yet.';
  for (const word of [...words].reverse()) card('#words', word.word, word.meaning, word.at);
  for (const search of searches) card('#research', search.query, [search.learned, search.note].filter(Boolean).join('\n\n'), search.at, search.sources);
  if (!words.length) document.querySelector('#words').textContent = 'Patch’s new words will appear here.';
  if (!searches.length) document.querySelector('#research').textContent = 'Patch’s discoveries and sources will appear here.';
  status.hidden = true;
  document.querySelector('#journal').hidden = false;
}

openJournal().catch(() => { status.textContent = 'Patch’s journal couldn’t open. Try refreshing the page.'; });

async function openSocialDrafts() {
  const response = await fetch('./api/social/drafts');
  if (!response.ok) return;
  const drafts = await response.json();
  const section = document.querySelector('#social-drafts');
  const status = document.querySelector('#social-status');
  const previews = document.querySelector('#social-previews');
  const error = new URLSearchParams(location.search).get('social');
  if (error) status.textContent = error;
  for (const draft of drafts) {
    const card = document.createElement('article');
    const heading = document.createElement('h3');
    const platform = { x: 'X', facebook: 'Facebook', instagram: 'Instagram' }[draft.platform];
    heading.textContent = platform + ' ' + draft.account;
    const body = document.createElement('p');
    body.textContent = draft.text;
    card.append(heading, body);
    if (draft.image) {
      const image = document.createElement('img');
      image.src = draft.image;
      image.alt = 'Patch portrait on the Zoom, Crab Cloud! journal card';
      card.append(image);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = draft.receipt?.state === 'published' ? 'Published' :
      draft.receipt ? 'Check the account' : draft.ready ? 'Approve and publish' : 'Account setup pending';
    button.disabled = Boolean(draft.receipt) || !draft.ready;
    button.onclick = async () => {
      button.disabled = true;
      status.textContent = 'Submitting to ' + platform + '...';
      try {
        const response = await fetch('./api/social/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: draft.platform }),
        });
        const result = await response.json();
        if (result.authorize) {
          window.top.location.assign(result.authorize);
          return;
        }
        if (!response.ok) {
          status.textContent = result.error || 'The post could not be sent.';
          if (result.state === 'submitted' || response.status === 409) {
            button.textContent = 'Check the account';
            return;
          }
          button.disabled = false;
          return;
        }
        button.textContent = 'Published';
        status.textContent = platform + ' confirmed publication.';
      } catch {
        status.textContent = 'Could not confirm publication. Reload the journal to check the submission record.';
      }
    };
    card.append(button);
    previews.append(card);
  }
  section.hidden = false;
}
openSocialDrafts().catch(() => {});
