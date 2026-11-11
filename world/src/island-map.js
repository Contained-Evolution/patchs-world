import { ISLAND, STREAM, TIDE_POOLS, places, shoreFraction, terrainElevation } from './terrain.js';

const landmarks = [
  ['Lookout', places.lookout], ['Cave', places.cave],
  ['Tall trees', places['tall-trees']], ['Tide pools', places['tide-pools']],
  ['Meadow', places.meadow], ['Camp & coconut computer', places.hammock, [15, -14]],
  ['Banana grove', places['banana-grove']], ['Pond', [ISLAND.pondX, ISLAND.pondZ]],
  ['Beach', places.beach]
];
const visitorColor = '#78e6ff', patchColor = '#ffcb70';
const worldWidth = ISLAND.radiusX * 2.44, worldHeight = ISLAND.radiusZ * 2.38;
const project = (x, z, width, height) => [
  (x / worldWidth + .5) * width, (z / worldHeight + .5) * height
];

function terrainChart(width, height) {
  const chart = document.createElement('canvas');
  chart.width = width;
  chart.height = height;
  const context = chart.getContext('2d');
  const pixels = context.createImageData(width, height);
  for (let row = 0; row < height; row++) {
    const z = (row / height - .5) * worldHeight;
    for (let column = 0; column < width; column++) {
      const x = (column / width - .5) * worldWidth;
      const shore = shoreFraction(x, z);
      let color;
      if (shore >= 1) {
        const depth = Math.max(0, 1 - (shore - 1) * 7);
        color = [18 + depth * 27, 58 + depth * 45, 76 + depth * 43];
      } else {
        const elevation = Math.max(0, terrainElevation(x, z));
        const contour = elevation >= 6 && elevation % 6 < .45 ? 9 : 0;
        const relief = Math.min(elevation, 34);
        color = elevation < 1.1
          ? [224, 198, 139]
          : [107 + relief * 1.4 - contour, 154 - relief * .26 - contour, 100 - relief * .4 - contour];
      }
      const offset = (row * width + column) * 4;
      pixels.data.set(color, offset);
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  context.fillStyle = context.strokeStyle = '#4fa9ae';
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.beginPath();
  STREAM.forEach(([x, z], index) => context[index === 0 ? 'moveTo' : 'lineTo'](...project(x, z, width, height)));
  context.stroke();
  for (const [x, z, rx, rz] of [[ISLAND.pondX, ISLAND.pondZ, ISLAND.pondRX, ISLAND.pondRZ], ...TIDE_POOLS]) {
    context.beginPath();
    context.ellipse(...project(x, z, width, height), rx * width / worldWidth, rz * height / worldHeight, 0, 0, Math.PI * 2);
    context.fill();
  }
  return chart;
}

function drawPin(context, point, radius, color) {
  context.beginPath();
  context.arc(...point, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = radius < 8 ? 2 : 3;
  context.strokeStyle = '#173c38';
  context.stroke();
}

export function setupIslandMap(mini, full, key) {
  const { width, height } = full;
  const terrain = terrainChart(width, height);
  const detailed = document.createElement('canvas');
  detailed.width = width;
  detailed.height = height;
  const detailContext = detailed.getContext('2d');
  detailContext.drawImage(terrain, 0, 0);
  detailContext.font = 'bold 11px sans-serif';
  detailContext.textAlign = 'center';
  detailContext.textBaseline = 'middle';
  for (const [index, [name, position, offset]] of landmarks.entries()) {
    const item = document.createElement('li');
    item.textContent = name;
    key.append(item);
    const point = project(...position, width, height);
    if (offset) {
      detailContext.beginPath();
      detailContext.moveTo(...point);
      point[0] += offset[0];
      point[1] += offset[1];
      detailContext.lineTo(...point);
      detailContext.lineWidth = 2;
      detailContext.strokeStyle = '#29483c';
      detailContext.stroke();
    }
    drawPin(detailContext, point, 9, '#29483c');
    detailContext.fillStyle = '#fff7df';
    detailContext.fillText(String(index + 1), ...point);
  }
  const miniContext = mini.getContext('2d'), fullContext = full.getContext('2d');
  let lastDraw = -Infinity;
  return (now, visitor, patch, showFull) => {
    if (now - lastDraw < 80) return;
    lastDraw = now;
    const visitorPoint = project(visitor.x, visitor.z, width, height);
    const patchPoint = patch && project(patch.x, patch.z, width, height);
    function paint(context, background, radius) {
      context.drawImage(background, 0, 0);
      // Concentric markers keep both colors visible when you are standing by Patch.
      const close = patchPoint && Math.hypot(visitorPoint[0] - patchPoint[0], visitorPoint[1] - patchPoint[1]) < radius * 1.8;
      if (patchPoint) drawPin(context, patchPoint, close ? radius * 1.5 : radius, patchColor);
      drawPin(context, visitorPoint, close ? radius * .64 : radius, visitorColor);
    }
    paint(miniContext, terrain, 12);
    if (showFull) paint(fullContext, detailed, 6);
  };
}
