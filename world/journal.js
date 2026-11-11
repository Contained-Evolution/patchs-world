const status = document.querySelector('#status');
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'America/New_York' });

function card(list, title, body, at, sources = []) {
  const article = document.createElement('article');
  const heading = document.createElement('h3');
  heading.textContent = title;
  article.append(heading);
  if (at) {
    const time = document.createElement('time');
    time.dateTime = at;
    time.textContent = date.format(new Date(at));
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

async function openJournal() {
  const response = await fetch('./api/journal');
  if (!response.ok) throw new Error('Journal unavailable');
  const { diary, words, searches } = await response.json();
  for (const entry of diary) card('#entries', entry.title, entry.text, entry.at || (entry.date && entry.date + 'T12:00:00-05:00'));
  for (const word of [...words].reverse()) card('#words', word.word, word.meaning, word.at);
  for (const search of searches) card('#research', search.query, [search.learned, search.note].filter(Boolean).join('\n\n'), search.at, search.sources);
  if (!diary.length) document.querySelector('#entries').textContent = 'Patch hasn’t written here yet.';
  if (!words.length) document.querySelector('#words').textContent = 'Patch’s new words will appear here.';
  if (!searches.length) document.querySelector('#research').textContent = 'Patch’s discoveries and sources will appear here.';
  status.hidden = true;
  document.querySelector('#journal').hidden = false;
}

openJournal().catch(() => { status.textContent = 'Patch’s journal couldn’t open. Try refreshing the page.'; });
