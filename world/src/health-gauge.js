export const NEEDS = [
  ['hunger', 'Fullness', '🍌'],
  ['energy', 'Energy', '⚡'],
  ['fun', 'Fun', '🎈'],
  ['comfort', 'Comfort', '🌿'],
  ['social', 'Social', '💬']
];

const clamp = value => Math.max(0, Math.min(1, value));

// The average of Patch's needs, 0 to 1, or null when none are known.
export function overallHealth(needs) {
  const values = NEEDS.map(([key]) => needs?.[key]).filter(Number.isFinite);
  return values.length ? clamp(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

const SVG = 'http://www.w3.org/2000/svg';
// A horseshoe open at the bottom: it starts low on the left (red), arches over the top (yellow) and ends low on the right (green).
const HORSESHOE = 'M10.56 37.44A19 19 0 1 1 37.44 37.44';

// A horseshoe gauge with an icon in its middle; the fill grows from the left.
export function makeGauge(icon, label) {
  const el = document.createElement('span');
  el.className = 'gauge';
  el.setAttribute('role', 'img');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(SVG, 'path'), fill = document.createElementNS(SVG, 'path');
  for (const [path, className] of [[track, 'gauge-track'], [fill, 'gauge-fill']]) {
    path.setAttribute('d', HORSESHOE);
    path.setAttribute('pathLength', '100');
    path.setAttribute('class', className);
    svg.append(path);
  }
  const face = document.createElement('span');
  face.className = 'gauge-icon';
  face.setAttribute('aria-hidden', 'true');
  face.textContent = icon;
  el.append(svg, face);
  return {
    el,
    set(value) {
      const percent = Number.isFinite(value) ? Math.round(clamp(value) * 100) : null;
      fill.setAttribute('stroke-dasharray', `${percent ?? 0} 100`);
      el.setAttribute('aria-label', percent === null ? label : `${label} ${percent}%`);
      el.title = percent === null ? label : `${label} ${percent}%`;
    }
  };
}
