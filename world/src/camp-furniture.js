// The furniture Patch sits on and the coconut computer he answers letters from.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { groundHeight } from './terrain.js';
import { SEATS, SEAT_HEIGHT, COMPUTER_DESK_DISTANCE, COMPUTER_TENT, computerActivity } from './furniture.js';

export function createFurniture(scene, { bark, wood }, block) {
 const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
 const bamboo = material(0xc9b26a), shell = material(0x6b4a2e), lightWood = material(0xa7794c);
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

 const tent = COMPUTER_TENT;
 const tentGround = Math.min(...[-1, 1].flatMap(side => [-1, 1].map(end =>
  groundHeight(tent.x + end * tent.halfLength, tent.z + side * tent.halfWidth))));
 const loader = new GLTFLoader();
 loader.load(new URL('./assets/computer-tent.glb', document.baseURI).href, ({ scene: shelter }) => {
  shelter.position.set(tent.x, tentGround + .305908 * tent.scale, tent.z);
  shelter.rotation.y = Math.PI / 2;
  shelter.scale.setScalar(tent.scale);
  scene.add(shelter);
 });

 // The desk model faces +z, back toward the chair after rotation.
 const seat = SEATS.computer, computer = group(seat.x, seat.z, seat.heading);
 chair(computer, .1);
 const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 224;
 const g = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
 texture.colorSpace = THREE.SRGBColorSpace;
 const glass = new THREE.MeshBasicMaterial({ map: texture, alphaTest: .5, toneMapped: false });
 loader.load(new URL('./assets/coconut-computer.glb', document.baseURI).href, ({ scene: desk }) => {
  desk.position.set(0, .457764, COMPUTER_DESK_DISTANCE);
  desk.rotation.y = Math.PI;
  computer.add(desk);
  // Fit the display inside the blue glass of the shell.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.345, .242), glass);
  screen.position.set(-.025, .252, .008);
  desk.add(screen);
 });

 let mail = -1, activity = '', elapsed = 0, lastFrame = -1;
 function drawScreen() {
  g.clearRect(0, 0, 320, 224);
  g.save();
  g.beginPath(); g.roundRect(0, 0, 320, 224, 25); g.clip();
  g.fillStyle = '#123d37'; g.fillRect(0, 0, 320, 224);
  g.fillStyle = '#246b5c'; g.fillRect(0, 0, 320, 41);
  g.font = '24px Pangolin, sans-serif';
  g.fillStyle = '#ffe4a2'; g.fillText('Coconut OS', 20, 28);
  g.font = '36px Pangolin, sans-serif';
  g.fillStyle = '#fff0c8'; g.fillText(activity, 20, 86);
  const frame = Math.floor(elapsed * 3);
  if (activity === 'Inbox') {
   g.font = '25px Pangolin, sans-serif'; g.fillStyle = '#c9f0e5';
   g.fillText(mail ? `${mail} new letter${mail === 1 ? '' : 's'}` : 'All caught up', 20, 139);
  } else if (activity === 'Searching the web') {
   g.strokeStyle = '#96d9cb'; g.lineWidth = 2;
   g.beginPath(); g.roundRect(20, 104, 280, 32, 8); g.stroke();
   g.font = '21px Pangolin, sans-serif'; g.fillStyle = '#e1f9f2';
   g.fillText('Search…', 32, 127);
   for (let i = 0; i < 3; i++) {
    g.fillStyle = i === frame % 3 ? '#ebce85' : '#69b7a8';
    g.fillRect(24, 151 + i * 19, 195 - i * 22, 6);
   }
  } else {
   const reading = activity === 'Reading';
   const messaging = activity === 'Messaging';
   g.fillStyle = '#e3eacb';
   g.beginPath(); g.roundRect(20, 103, 280, 101, 10); g.fill();
   g.fillStyle = '#32645a';
   if (messaging) {
    g.beginPath(); g.roundRect(34, 119, 138, 19, 8); g.fill();
    g.beginPath(); g.roundRect(130, 151, 154, 36, 8); g.fill();
    g.fillStyle = '#f4f6db';
    for (let i = 0; i <= frame % 3; i++) {
     g.beginPath(); g.arc(190 + i * 17, 169, 4, 0, Math.PI * 2); g.fill();
    }
   } else {
    for (let i = 0; i < 4; i++) {
     const width = reading ? 226 - ((i + Math.floor(frame / 4)) % 4) * 23 : i < 3 ? 225 - i * 17 : 20 + (frame % 10) * 18;
     g.fillRect(36, 120 + i * 19, width, 6);
    }
   }
  }
  g.restore();
  texture.needsUpdate = true;
 }
 function setComputer(count, action, place, target, secondsLeft) {
  const nextMail = Math.max(0, Math.floor(Number(count) || 0));
  const nextActivity = computerActivity(action, place, target, secondsLeft);
  if (nextMail === mail && nextActivity === activity) return;
  mail = nextMail; activity = nextActivity; elapsed = 0; lastFrame = 0;
  drawScreen();
 }
 setComputer(0);
 document.fonts?.ready.then(drawScreen);

 benchAndTable(SEATS.hammock);
 driftwoodChair(SEATS.beach);
 stump(SEATS.pond);

 return {
  setComputer,
  update(dt, light) {
   elapsed += dt;
   const frame = Math.floor(elapsed * 3);
   if (activity !== 'Inbox' && lastFrame !== frame) { lastFrame = frame; drawScreen(); }
   // Brighter at night and when letters are waiting, so it reads as a glowing screen.
   const waiting = mail > 0 ? .12 + .1 * Math.sin(elapsed * 3) : 0, glow = .78 + (1 - light) * .2 + waiting;
   glass.color.setScalar(Math.min(1.15, glow));
  },
 };
}
