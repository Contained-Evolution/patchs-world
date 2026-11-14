const diaryPrefix = 'diary:';
export const validMonth = month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

export async function journalMonths(storage) {
  const months = [];
  let end;
  while (true) {
    const page = await storage.list({ prefix: diaryPrefix, reverse: true, limit: 1, ...(end && { end }) });
    const key = page.keys().next().value;
    if (!key) return months;
    const month = key.slice(diaryPrefix.length, diaryPrefix.length + 7);
    if (validMonth(month)) {
      months.push(month);
      end = diaryPrefix + month; // Skip directly to the previous volume without reading this month's entries.
    } else {
      end = key;
    }
  }
}

export async function journalVolume(storage, month) {
  const days = new Map();
  for (const [key, entry] of await storage.list({ prefix: diaryPrefix + month + '-' })) {
    // The key and stored date use New York time. Date-only legacy entries must not shift at UTC midnight.
    const date = key.slice(diaryPrefix.length, diaryPrefix.length + 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !entry?.text?.trim()) continue;
    if (!days.has(date)) days.set(date, []);
    days.get(date).push({ title: entry.title, text: entry.text, at: entry.at || 0 });
  }
  return [...days].reverse().map(([date, entries]) => ({
    date,
    entries: entries.sort((a, b) => a.at - b.at).map(({ title, text }) => ({ title, text })),
  }));
}
