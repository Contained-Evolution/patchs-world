// The furniture Patch sits on and the coconut computer he answers letters from.
import * as THREE from 'three';
import { groundHeight } from './terrain.js';
import { SEATS, SEAT_HEIGHT, COMPUTER } from './furniture.js';

export function createFurniture(scene, { bark, wood, blade, foliage }, block) {
 const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
 const bamboo = material(0xc9b26a), shell = material(0x6b4a2e), husk = material(0x8a6a3e), lightWood = material(0xa7794c);
 // Each piece is built around its seat: +z is the way he faces, the seat sits just behind his feet.
 function group(x, z, heading) { const g = new THREE.Group(); g.position.set(x, groundHeight(x, z), z); g.rotation.y = heading; scene.add(g); return g; }
 function box(parent, mat, w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); block(m); return m; }
 function post(parent, mat, r, h, x, z, y = 0) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * .85, r, h, 7), mat); m.position.set(x, y + h / 2, z); parent.add(m); block(m); return m; }

 function chair(parent, back = .12) {
  box(parent, lightWood, .44, .05, .34, 0, SEAT_HEIGHT - .025, -back);
  for (const [x, z] of [[-.18, -back + .14], [.18, -back + .14], [-.18, -back - .14], [.18, -back - .14]]) post(parent, bamboo, .025, SEAT_HEIGHT - .05, x, z);
  for (const x of [-.18, .18]) post(parent, bamboo, .022, .5, x, -back - .16, SEAT_HEIGHT - .05);
  for (const y of [.42, .62]) { const slat = box(parent, bamboo, .42, .05, .03, 0, SEAT_HEIGHT + y - .2, -back - .16); slat.rotation.x = -.08; }
 }
 // A bench on the camp side of a little plank table.
 function benchAndTable(seat) {
  const g = group(seat.x, seat.z, seat.heading);
  box(g, lightWood, 1.3, .06, .3, 0, SEAT_HEIGHT - .03, -.1);
  for (const x of [-.55, .55]) box(g, wood, .07, SEAT_HEIGHT - .06, .24, x, (SEAT_HEIGHT - .06) / 2, -.1);
  box(g, lightWood, 1.4, .06, .6, 0, .46, .55);
  for (const x of [-.6, .6]) for (const z of [.32, .78]) post(g, wood, .035, .43, x, z);
  // A coconut cup and a banana on the table.
  const cup = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shell); cup.rotation.x = Math.PI; cup.position.set(.3, .57, .5); g.add(cup);
  const banana = new THREE.Mesh(new THREE.TorusGeometry(.09, .025, 6, 10, Math.PI), material(0xd7bc58)); banana.rotation.set(Math.PI / 2, 0, .4); banana.position.set(-.25, .5, .6); g.add(banana);
 }
 function driftwoodChair(seat) {
  const g = group(seat.x, seat.z, seat.heading);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(.16, .19, .7, 9), material(0x9c8a72)); log.rotation.z = Math.PI / 2; log.position.set(0, SEAT_HEIGHT - .16, -.12); g.add(log); block(log);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, .8, 8), material(0x9c8a72)); back.rotation.set(-.35, 0, Math.PI / 2); back.position.set(0, SEAT_HEIGHT + .3, -.34); g.add(back); block(back);
  for (const x of [-.3, .3]) { const prop = post(g, material(0x8f7c63), .05, .55, x, -.32); prop.rotation.x = -.3; }
 }
 function stump(seat) {
  const g = group(seat.x, seat.z, seat.heading);
  post(g, bark, .2, SEAT_HEIGHT, 0, -.12);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .02, 12), material(0xc8a676)); top.position.set(0, SEAT_HEIGHT, -.12); g.add(top);
  // His bait pot beside the stool.
  const pot = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), shell); pot.rotation.x = Math.PI; pot.position.set(.35, .09, -.05); g.add(pot);
 }

 // The coconut computer. A leaning palm holds a bamboo-framed screen at Patch's seated eye level.
 const seat = SEATS.computer, computer = group(seat.x, seat.z, seat.heading);
 chair(computer, .1);
 const palmBase = .65 + .5, desk = .5;
 box(computer, lightWood, .9, .05, .4, 0, .44, desk);
 for (const x of [-.38, .38]) post(computer, bamboo, .03, .42, x, desk);
 // Coconut-shell keyboard and a half-coconut mouse.
 const keyboard = new THREE.Group(); keyboard.position.set(0, .47, desk - .05); keyboard.rotation.x = -.12; computer.add(keyboard);
 const tray = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), shell); tray.scale.set(1.15, .12, .5); tray.rotation.x = Math.PI; tray.position.y = .02; keyboard.add(tray);
 const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(.03, .012, .028), material(0xe8d9b5), 27), pose = new THREE.Object3D();
 for (let i = 0; i < 27; i++) { pose.position.set(-.16 + (i % 9) * .04, .028, -.04 + Math.floor(i / 9) * .036); pose.updateMatrix(); keys.setMatrixAt(i, pose.matrix); }
 keyboard.add(keys);
 const mouse = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), husk); mouse.scale.set(1, .7, 1.3); mouse.position.set(.32, .47, desk - .02); computer.add(mouse);
 // The palm: a curved trunk of stacked rings, coconuts and fronds.
 const trunk = new THREE.Group(); trunk.position.set(0, 0, palmBase); computer.add(trunk);
 const rings = 14;
 for (let i = 0; i < rings; i++) { const t = i / rings, ring = new THREE.Mesh(new THREE.CylinderGeometry(.2 - t * .06, .23 - t * .06, .42, 9), bark); ring.position.set(Math.sin(t * 1.6) * .5, .21 + i * .4, -Math.sin(t * 1.2) * .25); ring.rotation.z = -Math.cos(t * 1.6) * .1; trunk.add(ring); if (i < 5) block(ring); }
 const crown = new THREE.Vector3(Math.sin(1.6) * .5, rings * .4 + .1, -Math.sin(1.2) * .25);
 for (let j = 0; j < 9; j++) { const frond = new THREE.Mesh(blade, foliage); frond.position.copy(crown); frond.rotation.set(-.15 - (j % 3) * .15, j * Math.PI * 2 / 9, 0); frond.scale.setScalar(1.15); trunk.add(frond); }
 for (let k = 0; k < 4; k++) { const nut = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), husk); nut.position.set(crown.x + Math.cos(k * 1.7) * .2, crown.y - .2, crown.z + Math.sin(k * 1.7) * .2); trunk.add(nut); }
 // A carved bamboo frame bolted to the trunk faces the chair.
 const screenY = .95, frame = new THREE.Group(); frame.position.set(0, screenY, palmBase - .27); computer.add(frame);
 box(frame, bamboo, .74, .06, .06, 0, .27, 0); box(frame, bamboo, .74, .06, .06, 0, -.27, 0);
 for (const x of [-.37, .37]) box(frame, bamboo, .06, .6, .06, x, 0, 0);
 box(frame, wood, .68, .5, .04, 0, 0, .04);
 post(computer, bamboo, .03, screenY - .27, 0, palmBase - .27);
 // The screen glows with Coconut OS and shows how many letters are waiting.
 const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 176;
 const context = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
 const glass = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
 const screen = new THREE.Mesh(new THREE.PlaneGeometry(.64, .44), glass); screen.position.set(0, 0, -.025); screen.rotation.y = Math.PI; frame.add(screen);
 let mail = -1, pulse = 0, daylight = 1;
 function drawScreen() {
  const g = context, letters = Math.max(0, mail);
  const gradient = g.createLinearGradient(0, 0, 0, 176); gradient.addColorStop(0, '#2f7d6d'); gradient.addColorStop(1, '#174a43');
  g.fillStyle = gradient; g.fillRect(0, 0, 256, 176);
  g.fillStyle = '#f6e7b8'; g.font = '22px Pangolin, sans-serif'; g.textAlign = 'center'; g.fillText('Coconut OS', 128, 34);
  g.font = '64px sans-serif'; g.fillText(letters ? '✉' : '🥥', 128, 112);
  g.font = '20px Pangolin, sans-serif'; g.fillStyle = letters ? '#ffd27a' : '#cfe8dd';
  g.fillText(letters ? `${letters} new letter${letters === 1 ? '' : 's'}` : 'All caught up', 128, 152);
  texture.needsUpdate = true;
 }
 function setMail(count) { const n = Math.max(0, Math.floor(Number(count) || 0)); if (n === mail) return; mail = n; drawScreen(); }
 setMail(0);
 // Redraw once the Pangolin font has loaded.
 document.fonts?.ready.then(drawScreen);

 benchAndTable(SEATS.hammock);
 driftwoodChair(SEATS.beach);
 stump(SEATS.pond);

 return {
  setMail,
  update(dt, light) {
   daylight = light; pulse += dt;
   // Brighter at night and when letters are waiting, so it reads as a glowing screen.
   const waiting = mail > 0 ? .12 + .1 * Math.sin(pulse * 3) : 0, glow = .78 + (1 - daylight) * .2 + waiting;
   glass.color.setScalar(Math.min(1.15, glow));
  },
 };
}
