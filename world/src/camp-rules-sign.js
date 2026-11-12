import * as THREE from 'three';
import { groundHeight } from './terrain.js';

const width = 4.2;
const height = 2.55;
const plankColors = ['#bd8a53', '#b9814d', '#be8b55', '#b8834f', '#bb8751'];

function paintBoard(context, title, rules) {
  const { width, height } = context.canvas;
  for (const [index, color] of plankColors.entries()) {
    const top = height * index / plankColors.length;
    context.fillStyle = color;
    context.fillRect(0, top, width, height / plankColors.length);
    context.fillStyle = '#634126';
    context.fillRect(0, top, width, 3);
    context.fillStyle = '#e4b67a';
    context.fillRect(0, top + 3, width, 2);
  }
  // Long, wavy grain runs along each plank underneath the lettering.
  for (let i = 0; i < 185; i++) {
    const start = (i * 79) % height;
    context.strokeStyle = i % 3 ? '#60371826' : '#ffdc9b45';
    context.lineWidth = 1 + i % 3;
    context.beginPath();
    context.moveTo(0, start);
    for (let x = 16; x <= width; x += 16) {
      const y = start + Math.sin(x / 147 + i) * (2 + i % 5) + Math.sin(x / 43 + i * 2) * 1.5;
      context.lineTo(x, y);
    }
    context.stroke();
  }

  function carve(text, x, y) {
    context.fillStyle = '#f5c888';
    context.fillText(text, x, y + 2);
    context.fillStyle = '#302013';
    context.fillText(text, x, y);
  }

  context.textAlign = 'center';
  context.font = '88px Pangolin, sans-serif';
  carve(title, width / 2, 116);
  context.textAlign = 'left';
  context.font = '46px Pangolin, sans-serif';
  let y = 190;
  for (const rule of rules) {
    carve('•', 85, y);
    let line = '';
    for (const word of rule.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && context.measureText(next).width > width - 228) {
        carve(line, 127, y);
        y += 49;
        line = word;
      } else {
        line = next;
      }
    }
    carve(line, 127, y);
    y += 77;
  }
}

export function addCampRulesSign(scene, solids, { bark, wood, rope, foliage }, blade) {
  const sign = new THREE.Group();
  sign.name = 'Camp rules sign';
  sign.position.set(3.9, groundHeight(3.9, 6) - .32, 6);
  sign.scale.x = .74;
  sign.rotation.y = .63;
  scene.add(sign);

  function mesh(geometry, material, x, y, z) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    sign.add(object);
    return object;
  }

  for (const side of [-1, 1]) {
    const post = mesh(new THREE.CylinderGeometry(.15, .25, 3.75, 9), bark, side * 2.22, 1.65, -.14);
    post.rotation.z = side * .04;
    for (const y of [.83, .9, 2.98, 3.05]) {
      const lashing = mesh(new THREE.TorusGeometry(.225, .026, 5, 12), rope, side * 2.16, y, -.05);
      lashing.rotation.x = Math.PI / 2;
    }
  }

  const boardY = 1.94;
  const boardDepth = .16;
  mesh(new THREE.BoxGeometry(width, height, boardDepth), wood, 0, boardY, 0);
  const canvas = document.createElement('canvas');
  canvas.width = 1344;
  canvas.height = 816;
  const context = canvas.getContext('2d');
  const title = document.querySelector('#rules-title').textContent;
  const rules = [...document.querySelectorAll('#camp-rules li')].map(item => item.textContent);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const face = new THREE.MeshStandardMaterial({
    map: texture, roughness: .95,
    emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: .12
  });
  mesh(new THREE.PlaneGeometry(width, height), face, 0, boardY, boardDepth / 2 + .002);
  function repaint() {
    paintBoard(context, title, rules);
    texture.needsUpdate = true;
  }
  repaint();
  document.fonts.load('46px Pangolin').then(repaint, () => {});

  const crossbar = mesh(new THREE.CylinderGeometry(.12, .16, 4.8, 9), bark, 0, 3.28, -.13);
  crossbar.rotation.z = Math.PI / 2 - .04;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const leaf = mesh(blade, foliage, side * (1.55 + i * .18), 3.34 + (i % 2) * .09, .02);
      leaf.scale.setScalar(.24 + i * .025);
      leaf.rotation.set(.25 + i * .18, side * (.35 + i * .61), side * (.25 - i * .16));
    }
  }

  sign.updateMatrixWorld();
  const left = sign.localToWorld(new THREE.Vector3(-2.2, 0, 0));
  const right = sign.localToWorld(new THREE.Vector3(2.2, 0, 0));
  solids.log(left.x, left.z, right.x, right.z, .25);
}
