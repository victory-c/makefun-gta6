// Low-poly people: one builder for the player, pedestrians, gang members and police.
import * as THREE from 'three';
import { mergeParts } from '../world/meshBuilder.js';

const geo = {
  torso: new THREE.BoxGeometry(0.52, 0.62, 0.3),
  hips: new THREE.BoxGeometry(0.48, 0.2, 0.28),
  head: new THREE.BoxGeometry(0.3, 0.32, 0.3),
  hair: new THREE.BoxGeometry(0.32, 0.12, 0.32),
  limb: new THREE.BoxGeometry(0.16, 0.62, 0.16),
  arm: new THREE.BoxGeometry(0.13, 0.58, 0.13),
  cap: new THREE.BoxGeometry(0.34, 0.08, 0.42),
  gun: new THREE.BoxGeometry(0.08, 0.12, 0.34),
};
for (const k of ['limb', 'arm']) geo[k].translate(0, -0.29, 0);
const matCache = new Map();
function mat(hex) {
  if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 }));
  return matCache.get(hex);
}
const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const handGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const eyeGeo = new THREE.BoxGeometry(0.22, 0.05, 0.02);
const armCache = new Map();
function armGeo(shirt, skin) {
  const k = shirt + ':' + skin;
  if (!armCache.has(k)) armCache.set(k, mergeParts([{ geo: geo.arm, color: shirt }, { geo: handGeo, y: -0.62, color: skin }]));
  return armCache.get(k);
}

// opts: { skin, shirt, pants, hair, cap, police, shades }
export function buildHuman(opts) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // torso, hips, head, hair, cap and details merged into one mesh
  const parts = [
    { geo: geo.torso, y: 1.25, color: opts.shirt },
    { geo: geo.hips, y: 0.88, color: opts.pants },
    { geo: geo.head, y: 1.75, color: opts.skin },
    { geo: geo.hair, y: 1.94, color: opts.hair ?? 0x2b1d14 },
    { geo: eyeGeo, y: 1.79, z: 0.155, color: opts.shades ? 0x111111 : 0x2a1a10 },
  ];
  if (opts.cap) parts.push({ geo: geo.cap, y: 1.97, z: 0.05, color: opts.cap });
  if (opts.police) parts.push({ geo: new THREE.BoxGeometry(0.1, 0.1, 0.02), x: -0.13, y: 1.37, z: 0.16, color: 0xffd23f });
  if (opts.police) parts.push({ geo: new THREE.BoxGeometry(0.54, 0.08, 0.32), y: 0.98, color: 0x111111 });
  const trunk = new THREE.Mesh(mergeParts(parts), skinMat);
  trunk.castShadow = true;
  body.add(trunk);
  const limb = (g, m, x, y) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, 0); o.castShadow = true; body.add(o); return o; };
  const legL = limb(geo.limb, mat(opts.pants), -0.13, 0.82);
  const legR = limb(geo.limb, mat(opts.pants), 0.13, 0.82);
  const arms = armGeo(opts.shirt, opts.skin);
  const armL = limb(arms, skinMat, -0.34, 1.52);
  const armR = limb(arms, skinMat, 0.34, 1.52);
  const gun = new THREE.Mesh(geo.gun, mat(0x1a1a1a));
  gun.position.set(0, -0.62, 0.15); gun.visible = false;
  armR.add(gun);
  root.userData = { body, legL, legR, armL, armR, head: trunk, gun, phase: Math.random() * 6 };
  return root;
}

// speed in m/s drives the stride; aiming raises the right arm; down lays the body flat.
export function animateHuman(h, dt, speed, { aiming = false, down = false, punch = 0 } = {}) {
  const u = h.userData;
  if (down) {
    u.body.rotation.x = THREE.MathUtils.lerp(u.body.rotation.x, -Math.PI / 2, Math.min(1, dt * 8));
    u.body.position.y = THREE.MathUtils.lerp(u.body.position.y, 0.15, Math.min(1, dt * 8));
    return;
  }
  u.body.rotation.x = 0; u.body.position.y = 0;
  u.phase += dt * speed * 2.4;
  const amp = Math.min(0.9, speed * 0.16);
  const s = Math.sin(u.phase) * amp;
  u.legL.rotation.x = s; u.legR.rotation.x = -s;
  u.armL.rotation.x = -s * 0.8;
  u.body.position.y = Math.abs(Math.cos(u.phase)) * amp * 0.06;
  if (aiming) { u.armR.rotation.x = -Math.PI / 2; u.armR.rotation.z = 0; }
  else if (punch > 0) { u.armR.rotation.x = -Math.PI / 2 * Math.sin(punch * Math.PI); }
  else u.armR.rotation.x = s * 0.8;
  u.gun.visible = aiming;
}
