// Low-poly people: one builder for the player, pedestrians, gang members and police.
import * as THREE from 'three';

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

// opts: { skin, shirt, pants, hair, cap, police }
export function buildHuman(opts) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const part = (g, color, x, y, z) => {
    const m = new THREE.Mesh(g, mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    body.add(m);
    return m;
  };
  const torso = part(geo.torso, opts.shirt, 0, 1.25, 0);
  part(geo.hips, opts.pants, 0, 0.88, 0);
  const head = part(geo.head, opts.skin, 0, 1.75, 0);
  part(geo.hair, opts.hair ?? 0x2b1d14, 0, 1.94, 0);
  if (opts.cap) part(geo.cap, opts.cap, 0, 1.97, 0.05);
  const legL = part(geo.limb, opts.pants, -0.13, 0.82, 0);
  const legR = part(geo.limb, opts.pants, 0.13, 0.82, 0);
  const armL = part(geo.arm, opts.shirt, -0.34, 1.52, 0);
  const armR = part(geo.arm, opts.shirt, 0.34, 1.52, 0);
  const handCol = opts.skin;
  for (const a of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat(handCol));
    hand.position.y = -0.62; a.add(hand);
  }
  const gun = new THREE.Mesh(geo.gun, mat(0x1a1a1a));
  gun.position.set(0, -0.62, 0.15); gun.visible = false;
  armR.add(gun);
  if (opts.police) {
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), mat(0xffd23f));
    badge.position.set(-0.13, 0.12, 0.16); torso.add(badge);
  }
  root.userData = { body, legL, legR, armL, armR, head, gun, phase: Math.random() * 6 };
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
