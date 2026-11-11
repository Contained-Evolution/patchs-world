// A journey has one shared position, independent of when a visitor opens the page.
export function travelFraction(since, until, now) {
  const start=Date.parse(since), end=Date.parse(until);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end<=start) return 0;
  return Math.max(0,Math.min(1,(now-start)/(end-start)));
}
