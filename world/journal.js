const status = document.querySelector('#status');
const zone = 'America/New_York';
const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: zone });
const dayAndTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: zone });
if (window.self !== window.top) document.body.classList.add('framed');

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
  const { diary } = await response.json();
  const entries = [...diary].sort((a, b) => Date.parse(when(b)) - Date.parse(when(a)));
  if (entries.length) { fillDrawer(entries); toggle.hidden = false; }
  else document.querySelector('#entry').textContent = 'Patch hasn’t written here yet.';
  status.hidden = true;
  document.querySelector('#journal').hidden = false;
}

openJournal().catch(() => { status.textContent = 'Patch’s journal couldn’t open. Try refreshing the page.'; });
