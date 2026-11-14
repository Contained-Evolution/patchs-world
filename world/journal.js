const $ = id => document.getElementById(id);
const cover = $('cover'), reader = $('reader'), volume = $('volume'), writing = $('writing');
const endpoint = './api/journal/archive';
const fullDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const calendarDate = date => new Date(date + 'T12:00:00Z');
const graphemes = new Intl.Segmenter();
const words = new Intl.Segmenter(undefined, { granularity: 'word' });
if (window.self !== window.top) document.body.classList.add('framed');

let days = [], day = 0, pages = [], page = 0, generation = 0;
const cache = new Map();
const selectedMonth = () => volume.value;
const move = (part, offset) => ({ part, offset });
const before = (a, b) => a.part < b.part || (a.part === b.part && a.offset < b.offset);

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Journal unavailable');
  return response.json();
}

function openCover() {
  cover.hidden = true;
  reader.hidden = false;
  day = page = 0;
  paginate();
  $('date').focus();
}

async function openVolume() {
  const request = ++generation, month = selectedMonth();
  $('status').textContent = 'Opening the journal…';
  cover.disabled = true;
  try {
    let data = cache.get(month);
    if (!data) {
      data = await get(endpoint + '?month=' + encodeURIComponent(month));
      cache.set(month, data);
    }
    if (request !== generation) return;
    days = data.days;
    $('status').textContent = '';
    openCover();
  } catch {
    if (request === generation) $('status').textContent = 'Couldn’t open this volume. Try again.';
    if (request === generation && !reader.hidden) closeBook();
  } finally {
    if (request === generation) cover.disabled = false;
  }
}

function closeBook() {
  reader.hidden = true;
  cover.hidden = false;
  cover.disabled = false;
  cover.focus();
}

function paginate(anchor = move(0, 0), last = false) {
  const current = days[day];
  $('date').textContent = current ? fullDate.format(calendarDate(current.date)) : 'No writing yet';
  const parts = (current?.entries || []).flatMap(({ title, text }) => [
    ...(title?.trim() ? [{ tag: 'h2', text: title }] : []),
    { tag: 'p', text },
  ]);
  if (!parts.length) parts.push({ tag: 'p', text: 'Patch hasn’t written in this volume yet.' });
  writing.replaceChildren();
  pages = [];
  let start = move(0, 0);
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
  page = last ? pages.length - 1 : Math.max(0, pages.findLastIndex(item => !before(anchor, item.start)));
  render();
}

function render() {
  writing.replaceChildren(...pages[page].nodes);
  $('page').textContent = (page + 1) + ' / ' + pages.length;
  $('next').disabled = page + 1 === pages.length && day + 1 >= days.length;
  $('back').setAttribute('aria-label', page || day ? 'Previous page' : 'Close journal');
}

$('next').onclick = () => {
  if (page + 1 < pages.length) { page++; render(); }
  else if (day + 1 < days.length) { day++; paginate(); }
  $('date').focus();
};
$('back').onclick = () => {
  if (page) { page--; render(); }
  else if (day) { day--; paginate(undefined, true); }
  else { closeBook(); return; }
  $('date').focus();
};
function resize() {
  if (!reader.hidden) paginate(pages[page]?.start);
}
new ResizeObserver(resize).observe(writing);
document.fonts.ready.then(resize);
$('larger').onchange = event => {
  document.body.classList.toggle('larger', event.target.checked);
  resize();
};
volume.onchange = () => {
  $('cover-month').textContent = volume.selectedOptions[0].textContent;
  if (!reader.hidden) openVolume();
};

async function discover() {
  $('status').textContent = 'Finding journal volumes…';
  cover.disabled = true;
  try {
    const { months } = await get(endpoint);
    volume.replaceChildren(...months.map(month =>
      new Option(monthLabel.format(calendarDate(month + '-01')), month)));
    if (months.length) {
      volume.disabled = false;
      volume.onchange();
      cover.onclick = openVolume;
    } else {
      volume.add(new Option('No volumes yet', ''));
      cover.onclick = () => { $('status').textContent = ''; openCover(); };
    }
    $('status').textContent = '';
  } catch {
    $('status').textContent = 'Couldn’t find the journal volumes. Open the cover to try again.';
    cover.onclick = discover;
  } finally {
    cover.disabled = false;
  }
}

discover();
