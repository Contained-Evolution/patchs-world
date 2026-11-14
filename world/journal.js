const $ = id => document.getElementById(id);
const book = $('book'), stage = $('stage'), ruler = $('ruler'), status = $('status');
const endpoint = './api/journal/archive';
const fullDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
// Entries are dated in New York time.
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const calendarDate = date => new Date(date + 'T12:00:00Z');
const graphemes = new Intl.Segmenter();
const words = new Intl.Segmenter(undefined, { granularity: 'word' });
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
if (window.self !== window.top) document.body.classList.add('framed');

let months = [], month = 0, days = [], larger = false;
let pos = { kind: 'cover' }, flip = null, busy = false, failed = false, drag = null, stale = false;
const volumes = new Map(), pagesByDay = new Map();
const move = (part, offset) => ({ part, offset });
const before = (a, b) => a.part < b.part || (a.part === b.part && a.offset < b.offset);
const monthName = () => monthLabel.format(calendarDate((months[month] || today.slice(0, 7)) + '-01'));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Journal unavailable');
  return response.json();
}

async function loadMonth(index) {
  const key = months[index];
  let data = volumes.get(key);
  if (!data) {
    data = await get(endpoint + '?month=' + encodeURIComponent(key));
    volumes.set(key, data);
  }
  month = index;
  days = data.days;
  pagesByDay.clear();
}

// Faces

function entryShell(date) {
  const face = el('section', 'sheet paper entry');
  const head = el('header'), title = el('h1', '', date), size = el('label', 'size'), box = el('input');
  title.tabIndex = -1;
  box.type = 'checkbox';
  box.checked = larger;
  box.onchange = () => {
    larger = box.checked;
    book.classList.toggle('larger', larger);
    relayout();
    stage.querySelector('.size input')?.focus({ preventScroll: true });
  };
  size.append(box, 'Larger text');
  head.append(title, size);
  const writing = el('div', 'writing');
  const foot = el('footer'), index = el('button', '', 'Index'), count = el('span', 'count', '1 / 1');
  index.type = 'button';
  foot.append(index, count);
  face.append(head, writing, foot);
  return { face, writing, title, index, count };
}

const rulerShell = entryShell('');
ruler.append(rulerShell.face);

function coverFace() {
  const face = el('section', 'sheet cover');
  face.append(el('strong', '', 'Patch'), el('span', 'cover-month', monthName()));
  return face;
}

function indexFace() {
  const face = el('section', 'sheet paper index');
  const head = el('header'), title = el('h1', '', monthName());
  const older = el('button', 'month', '‹'), newer = el('button', 'month', '›');
  title.tabIndex = -1;
  older.type = newer.type = 'button';
  older.setAttribute('aria-label', 'Earlier month');
  newer.setAttribute('aria-label', 'Later month');
  older.disabled = month + 1 >= months.length;
  newer.disabled = month === 0;
  older.onclick = () => changeMonth(month + 1);
  newer.onclick = () => changeMonth(month - 1);
  head.append(older, title, newer);
  const list = el('ol', 'days');
  const current = days.findIndex(item => item.date === today);
  const marked = current >= 0 ? current : month === 0 ? 0 : -1;
  days.forEach((item, index) => {
    const row = el('li'), button = el('button', index === marked ? 'today' : '');
    button.type = 'button';
    button.append(el('span', '', shortDate.format(calendarDate(item.date))));
    if (index === marked) button.append(el('small', '', current >= 0 ? 'Today' : 'Latest'));
    if (item.date === today) button.setAttribute('aria-current', 'date');
    button.onclick = () => jump({ kind: 'entry', day: index, page: 0 });
    row.append(button);
    list.append(row);
  });
  if (!days.length) list.append(el('li', 'empty', 'Patch hasn’t written in this volume yet.'));
  face.append(head, list);
  return face;
}

function entryFace(day, page) {
  const pages = pagesFor(day);
  const shell = entryShell(fullDate.format(calendarDate(days[day].date)));
  shell.writing.append(...pages[page].nodes.map(node => node.cloneNode(true)));
  shell.count.textContent = (page + 1) + ' / ' + pages.length;
  shell.index.onclick = () => jump({ kind: 'index' });
  return shell.face;
}

const blankFace = () => el('section', 'sheet blank');

function curl(dir, label) {
  const button = el('button', dir < 0 ? 'curl back' : 'curl');
  button.type = 'button';
  button.dataset.dir = dir;
  button.setAttribute('aria-label', label);
  button.append(el('i'));
  return button;
}

function view(p) {
  const face = p.kind === 'cover' ? coverFace() : p.kind === 'index' ? indexFace() : entryFace(p.day, p.page);
  if (next(p)) face.append(curl(1, p.kind === 'cover' ? 'Open the journal' : 'Flip to the next page'));
  if (prev(p)) face.append(curl(-1, 'Flip to the previous page'));
  return face;
}

// Pagination: a day's writing is split into pages that fit the ruler, an invisible copy of an entry page.

function pagesFor(day) {
  const cached = pagesByDay.get(day);
  if (cached) return cached;
  const writing = rulerShell.writing;
  rulerShell.title.textContent = fullDate.format(calendarDate(days[day].date));
  const parts = (days[day].entries || []).flatMap(({ title, text }) => [
    ...(title?.trim() ? [{ tag: 'h2', text: title }] : []),
    { tag: 'p', text },
  ]);
  const pages = [];
  let start = move(0, 0);
  function whole() {
    return [{ start, nodes: parts.map(part => el(part.tag, '', part.text)) }];
  }
  if (!parts.length) parts.push({ tag: 'p', text: 'Patch hasn’t written in this volume yet.' });
  // Without layout (a hidden frame) nothing fits, so keep the day on one page until the book has a size.
  if (writing.getBoundingClientRect().height < 24) return whole();
  writing.replaceChildren();
  function save(end) {
    pages.push({ start, nodes: [...writing.childNodes] });
    writing.replaceChildren();
    start = end;
  }
  function fits(node) {
    // Include fractional line height; integer scrollHeight would occasionally clip the final line.
    return node.getBoundingClientRect().bottom <= writing.getBoundingClientRect().bottom + .05;
  }
  for (const [index, part] of parts.entries()) {
    let offset = 0;
    while (offset < part.text.length) {
      const node = document.createElement(part.tag);
      writing.append(node);
      const rest = part.text.slice(offset);
      node.textContent = rest;
      if (fits(node)) {
        // Keep a title with at least the first line of its entry when there is already writing on the page.
        if (part.tag === 'h2' && node.previousSibling && parts[index + 1]) {
          const probe = document.createElement('p');
          probe.textContent = 'M';
          writing.append(probe);
          const room = fits(probe);
          probe.remove();
          if (!room) {
            node.remove();
            save(move(index, offset));
            continue;
          }
        }
        break;
      }
      const boundaries = [...words.segment(rest)].map(piece => piece.index + piece.segment.length);
      const findFit = limits => {
        let low = 0, high = limits.length;
        while (low < high) {
          const mid = Math.floor((low + high) / 2);
          node.textContent = rest.slice(0, limits[mid]);
          if (fits(node)) low = mid + 1;
          else high = mid;
        }
        return low ? limits[low - 1] : 0;
      };
      let length = findFit(boundaries);
      if (!length && node.previousSibling) {
        node.remove();
        save(move(index, offset));
        continue;
      }
      if (!length) {
        const fallback = [...graphemes.segment(rest)].map(piece => piece.index + piece.segment.length);
        length = findFit(fallback) || fallback[0];
      }
      node.textContent = rest.slice(0, length);
      offset += length;
      if (offset < part.text.length) save(move(index, offset));
    }
  }
  if (writing.firstChild) save(move(parts.length, 0));
  writing.replaceChildren();
  pagesByDay.set(day, pages);
  return pages;
}

// Order of the book: cover, index, then each day's pages.

function next(p) {
  if (p.kind === 'cover') return { kind: 'index' };
  if (p.kind === 'index') return days.length ? { kind: 'entry', day: 0, page: 0 } : null;
  if (p.page + 1 < pagesFor(p.day).length) return { kind: 'entry', day: p.day, page: p.page + 1 };
  return p.day + 1 < days.length ? { kind: 'entry', day: p.day + 1, page: 0 } : null;
}

function prev(p) {
  if (p.kind === 'cover') return null;
  if (p.kind === 'index') return { kind: 'cover' };
  if (p.page) return { kind: 'entry', day: p.day, page: p.page - 1 };
  return p.day ? { kind: 'entry', day: p.day - 1, page: pagesFor(p.day - 1).length - 1 } : { kind: 'index' };
}

function setLive(p) {
  pos = p.kind === 'entry' ? { ...p, start: pagesFor(p.day)[p.page].start } : p;
  stage.replaceChildren(view(pos));
}

const focusTitle = () => stage.querySelector('h1')?.focus({ preventScroll: true });

function relayout() {
  // A resize or text-size change during a page turn is applied once the turn ends.
  if (busy || flip) { stale = true; return; }
  stale = false;
  if (pos.kind !== 'entry') { pagesByDay.clear(); return; }
  const anchor = pos.start;
  pagesByDay.clear();
  const page = pagesFor(pos.day).findLastIndex(item => !before(anchor, item.start));
  setLive({ kind: 'entry', day: pos.day, page: Math.max(0, page) });
}

// Page turns

function makeLeaf(face) {
  const leaf = el('div', 'leaf');
  const back = el('section', 'sheet back ' + (face.classList.contains('cover') ? 'endpaper' : 'paper reverse'));
  leaf.append(face, back);
  return leaf;
}

// t is how far the turn has gone: 0 leaves the pages as they were, 1 completes it.
const angle = (dir, t) => dir > 0 ? -180 * t : -180 * (1 - t);
const rotation = degrees => `rotateY(${degrees}deg)`;

function begin(dir) {
  const target = dir > 0 ? next(pos) : prev(pos);
  if (!target) return null;
  const leaf = makeLeaf(view(dir > 0 ? pos : target));
  stage.replaceChildren(view(dir > 0 ? target : pos), leaf);
  flip = { dir, target, leaf, t: 0 };
  leaf.style.transform = rotation(angle(dir, 0));
  return flip;
}

function setTurn(t) {
  flip.t = t;
  flip.leaf.style.transform = rotation(angle(flip.dir, t));
}

async function finish(done) {
  const { dir, target, leaf, t } = flip, to = done ? 1 : 0;
  busy = true;
  const duration = reduced.matches ? 0 : 140 + 380 * Math.abs(to - t);
  await leaf.animate([{ transform: rotation(angle(dir, t)) }, { transform: rotation(angle(dir, to)) }],
    { duration, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
  flip = null;
  busy = false;
  setLive(done ? target : pos);
  focusTitle();
  if (stale) relayout();
}

function quick(dir) {
  if (busy || flip) return;
  if (failed && pos.kind === 'cover') { start(); return; }
  if (begin(dir)) finish(true);
}

// Flipping through several leaves to reach the index or a day.
async function jump(target) {
  if (busy || flip) return;
  const forward = target.kind === 'entry';
  const count = Math.min(6, 2 + (forward ? target.day : pos.day));
  busy = true;
  const leaves = Array.from({ length: count }, (_, i) => {
    const face = forward ? (i ? blankFace() : view(pos)) : (i === count - 1 ? view(target) : blankFace());
    const leaf = makeLeaf(face);
    leaf.style.zIndex = forward ? count - i : i + 1;
    leaf.style.transform = rotation(forward ? 0 : -180);
    return leaf;
  });
  stage.replaceChildren(view(forward ? target : pos), ...leaves);
  const frames = [{ transform: rotation(angle(forward ? 1 : -1, 0)) }, { transform: rotation(angle(forward ? 1 : -1, 1)) }];
  await Promise.all(leaves.map((leaf, i) => leaf.animate(frames, {
    duration: reduced.matches ? 0 : 560, delay: reduced.matches ? 0 : i * 110, easing: 'ease-in-out', fill: 'both',
  }).finished.catch(() => {})));
  setLive(target);
  busy = false;
  focusTitle();
  if (stale) relayout();
}

async function changeMonth(index) {
  if (busy || flip) return;
  busy = true;
  try {
    await loadMonth(index);
    status.textContent = '';
    setLive({ kind: 'index' });
    focusTitle();
  } catch {
    status.textContent = 'Couldn’t open this volume. Try again.';
  } finally {
    busy = false;
  }
}

// Dragging a page by its corner or swiping across it turns it as far as the pointer goes.

book.addEventListener('pointerdown', event => {
  if (busy || flip || event.button > 0) return;
  const curlButton = event.target.closest('.curl');
  if (!curlButton && event.target.closest('button, input, label, a')) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), curl: curlButton, cover: !!event.target.closest('.cover'), dir: 0, vx: 0, lastX: event.clientX, lastAt: performance.now() };
});

book.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y, now = performance.now();
  if (!flip) {
    if (Math.hypot(dx, dy) < 8) return;
    const dir = drag.curl ? (drag.curl.classList.contains('back') ? -1 : 1) : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : -1) : 0;
    if (!dir || !begin(dir)) { drag = null; return; }
    drag.dir = dir;
    book.setPointerCapture(event.pointerId);
  }
  drag.vx = .6 * drag.vx + .4 * (event.clientX - drag.lastX) / Math.max(1, now - drag.lastAt);
  drag.lastX = event.clientX;
  drag.lastAt = now;
  setTurn(Math.min(1, Math.max(0, (drag.dir > 0 ? -dx : dx) / (book.clientWidth * .8))));
});

book.addEventListener('pointerup', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const { curl: curlButton, cover, at, vx, dir } = drag;
  drag = null;
  if (flip) {
    const speed = dir > 0 ? -vx : vx;
    finish(speed > .4 || (flip.t > .4 && speed > -.4));
  } else if (performance.now() - at < 600 && (curlButton || cover)) {
    quick(curlButton?.classList.contains('back') ? -1 : 1);
  }
});

book.addEventListener('pointercancel', () => {
  drag = null;
  if (flip && !busy) finish(false);
});

// Keyboard and screen readers use the corner buttons, which click with no pointer detail.
book.addEventListener('click', event => {
  const button = event.target.closest('.curl');
  if (button && event.detail === 0) quick(Number(button.dataset.dir));
});
document.addEventListener('keydown', event => {
  if (event.target.closest('input, select, textarea')) return;
  if (event.key === 'ArrowRight') quick(1);
  else if (event.key === 'ArrowLeft') quick(-1);
});

new ResizeObserver(relayout).observe(book);

async function start() {
  busy = true;
  failed = false;
  status.textContent = 'Finding the journal…';
  try {
    ({ months } = await get(endpoint));
    if (months.length) await loadMonth(0);
    status.textContent = '';
  } catch {
    failed = true;
    status.textContent = 'Couldn’t open the journal. Tap the cover to try again.';
  }
  await document.fonts.ready;
  busy = false;
  setLive({ kind: 'cover' });
}

start();
