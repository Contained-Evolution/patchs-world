// The stream of what Patch thinks and says, newest last, shown to every visitor.
// A thought is { at, thought, says }; each one becomes a thought line and, when he said something aloud, a speech line.
export function feedFrom(thoughts, limit = 30) {
  const lines = [];
  for (const entry of Array.isArray(thoughts) ? thoughts : []) {
    if (!Number.isFinite(entry?.at)) continue;
    const at = new Date(entry.at).toISOString();
    if (typeof entry.thought === 'string' && entry.thought.trim()) lines.push({ at, kind: 'thought', text: entry.thought.trim() });
    if (typeof entry.says === 'string' && entry.says.trim()) lines.push({ at, kind: 'says', text: entry.says.trim() });
  }
  return lines.slice(-limit);
}
