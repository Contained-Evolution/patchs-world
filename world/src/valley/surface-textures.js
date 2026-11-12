import * as THREE from 'three';

function random(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function makeTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const seeds = { grass: 31, sand: 47, stone: 61, dirt: 73, gravel: 89,
    glass: 101, water: 113, wood: 127, rock: 139, snow: 151 };
  const rnd = random(seeds[kind]);
  const bases = { grass: '#456c34', sand: '#aa9875', stone: '#626b68',
    dirt: '#584839', gravel: '#565a56', glass: '#7eafb0',
    water: '#1b505a', wood: '#76583e', rock: '#676964', snow: '#dae6e8' };
  context.fillStyle = bases[kind];
  context.fillRect(0, 0, 128, 128);
  const dots = kind === 'grass' ? 1500 : kind === 'gravel' ? 500 : 900;
  const palettes = {
    grass: ['#5f9042', '#79a54b', '#94b661', '#315a30'],
    sand: ['#c1ad84', '#d1bd94', '#82785e', '#e0c99c'],
    stone: ['#79817d', '#4c5857', '#8e9690', '#a0a39a'],
    dirt: ['#80634b', '#3c332e', '#9a7955', '#6b5d44'],
    gravel: ['#777d76', '#303c3a', '#a0a398', '#a38d71'],
    glass: ['#a9d4d0', '#c5e4db', '#4e858b', '#e1f5e8'],
    water: ['#276a70', '#43898c', '#80adaa', '#103b48'],
    wood: ['#957250', '#513b2f', '#b58b5e', '#644832'],
    rock: ['#888982', '#454b4b', '#999b93', '#555a57'],
    snow: ['#f0f5f4', '#c4d3d7', '#e3eef0', '#aebfc6'],
  };
  for (let i = 0; i < dots; i++) {
    const x = rnd() * 128, y = rnd() * 128;
    context.strokeStyle = context.fillStyle = palettes[kind][Math.floor(rnd() * 4)];
    if (kind === 'grass') {
      context.lineWidth = .45 + rnd() * .8;
      context.beginPath();
      context.moveTo(x, y + 1 + rnd() * 3);
      context.lineTo(x + (rnd() - .5) * 4, y - 1 - rnd() * 5);
      context.stroke();
    } else if (kind === 'gravel') {
      context.beginPath();
      context.ellipse(x, y, 1 + rnd() * 3, .7 + rnd() * 2, rnd() * 6, 0, Math.PI * 2);
      context.fill();
    } else {
      const size = kind === 'sand' ? .5 + rnd() : 1 + rnd() * 2;
      context.fillRect(x, y, size, size);
    }
  }
  if (kind === 'stone' || kind === 'glass') {
    context.strokeStyle = kind === 'stone' ? '#343e3c66' : '#e9fffa88';
    context.lineWidth = kind === 'stone' ? 2 : 1.5;
    for (let i = 0; i < 7; i++) {
      const x = rnd() * 128, y = rnd() * 128;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 6 + rnd() * 18, y + (rnd() - .5) * 14);
      context.stroke();
    }
  }
  if (kind === 'wood') {
    context.strokeStyle = '#2d241d99';
    context.lineWidth = 2;
    for (const y of [0, 42, 84, 127]) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(128, y); context.stroke();
    }
    context.strokeStyle = '#c59a6a66';
    context.lineWidth = 1;
    for (let i = 0; i < 25; i++) {
      const y = rnd() * 128;
      context.beginPath(); context.moveTo(rnd() * 30, y);
      context.lineTo(75 + rnd() * 55, y + (rnd() - .5) * 5); context.stroke();
    }
  }
  if (kind === 'water') {
    for (let i = 0; i < 16; i++) {
      const x = rnd() * 128, y = rnd() * 128;
      context.strokeStyle = '#a4cfcb55';
      context.lineWidth = 1 + rnd();
      context.beginPath(); context.ellipse(x, y, 8 + rnd() * 15, 2 + rnd() * 3,
        0, .1, Math.PI * 1.1); context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
