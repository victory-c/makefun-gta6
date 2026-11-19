// Player weapons: fists, pistol, SMG and shotgun. Hitscan shots against people, cars and walls.
import * as THREE from 'three';
import { G, emit } from '../core/state.js';
import { WEAPONS } from '../config.js';
import { mouse, hit } from '../core/input.js';
import { rayBuildings } from '../world/cityLayout.js';
import { fx } from './effects.js';
import { sfx } from '../core/audio.js';
import { panic } from '../actors/pedestrians.js';

let cooldown = 0;
const tmp = new THREE.Vector3();

export const currentWeapon = () => WEAPONS[G.weaponIndex];
const hasAmmo = (w) => w.id === 'fists' || (G.weapons[w.id] ?? 0) > 0;

export function cycleWeapon(dir) {
  for (let k = 1; k <= WEAPONS.length; k++) {
    const i = (G.weaponIndex + dir * k + WEAPONS.length * 4) % WEAPONS.length;
    if (hasAmmo(WEAPONS[i])) { G.weaponIndex = i; return; }
  }
}

// Closest target the ray (origin o, unit dir d) meets first, within range.
export function castShot(o, d, range, ignore) {
  let best = { t: range, kind: 'none' };
  const wallT = rayBuildings(o.x, o.z, d.x / Math.hypot(d.x, d.z), d.z / Math.hypot(d.x, d.z), range, 0.5);
  if (wallT < Infinity) {
    const t3 = wallT / Math.hypot(d.x, d.z);
    if (t3 < best.t) best = { t: t3, kind: 'wall' };
  }
  for (const q of G.peds) {
    if (q === ignore || q.dead) continue;
    const t = (q.x - o.x) * d.x + (q.y + 1.1 - o.y) * d.y + (q.z - o.z) * d.z;
    if (t < 0 || t > best.t) continue;
    const px = o.x + d.x * t - q.x, pz = o.z + d.z * t - q.z, py = o.y + d.y * t - q.y;
    if (px * px + pz * pz < 0.5 * 0.5 && py > -0.1 && py < 2.1) best = { t, kind: 'ped', target: q };
  }
  for (const v of G.vehicles) {
    if (v === ignore || v === G.player.inCar) continue;
    const t = (v.x - o.x) * d.x + (v.z - o.z) * d.z;
    if (t < 0 || t > best.t + 3) continue;
    // slab test in the car's frame
    const f = v.forward;
    const lo = { f: (o.x - v.x) * f.x + (o.z - v.z) * f.z, r: (o.x - v.x) * f.z - (o.z - v.z) * f.x };
    const ld = { f: d.x * f.x + d.z * f.z, r: d.x * f.z - d.z * f.x };
    let t0 = 0, t1 = best.t;
    for (const [a, b, h] of [[lo.f, ld.f, v.spec.len / 2], [lo.r, ld.r, v.spec.w / 2]]) {
      if (Math.abs(b) < 1e-6) { if (Math.abs(a) > h) { t0 = Infinity; break; } continue; }
      let ta = (-h - a) / b, tb = (h - a) / b;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    }
    if (t0 <= t1 && t0 < best.t) {
      const y = o.y + d.y * t0;
      if (y < v.y + v.spec.h + 0.4) best = { t: t0, kind: 'car', target: v };
    }
  }
  return best;
}

function fireBullet(o, dir, w, shooterIsPlayer = true) {
  const d = tmp.copy(dir);
  d.x += (Math.random() - 0.5) * w.spread * 2; d.y += (Math.random() - 0.5) * w.spread; d.z += (Math.random() - 0.5) * w.spread * 2;
  d.normalize();
  const res = castShot(o, d, w.range);
  const ex = o.x + d.x * res.t, ey = o.y + d.y * res.t, ez = o.z + d.z * res.t;
  fx.tracer(o.x, o.y, o.z, ex, ey, ez);
  if (res.kind === 'ped') res.target.hurt(w.dmg, o.x, o.z, shooterIsPlayer);
  else if (res.kind === 'car') { res.target.damage(w.dmg * 4); fx.sparks(ex, ey, ez, 4); G.onCarShot?.(res.target); }
  else if (res.kind === 'wall') fx.hit(ex, ey, ez, false);
}

export function updateWeapons(dt) {
  const p = G.player;
  cooldown -= dt;
  if (hit('KeyE') || mouse.wheel > 0) cycleWeapon(1);
  if (hit('KeyQ') || mouse.wheel < 0) cycleWeapon(-1);
  WEAPONS.forEach((w, i) => { if (hit('Digit' + (i + 1)) && hasAmmo(w)) G.weaponIndex = i; });
  if (!hasAmmo(currentWeapon())) G.weaponIndex = 0;
  const w = currentWeapon();
  const trigger = w.id === 'smg' ? mouse.left : mouse.leftPressed || (mouse.left && w.id !== 'fists' && cooldown < -0.15);
  p.aiming = !p.inCar && (mouse.right || (mouse.left && w.id !== 'fists'));
  if (p.dead || !trigger || cooldown > 0) return;
  if (p.inCar && w.id === 'fists') return;
  cooldown = w.rate;
  const dir = G.aimDir;
  if (w.id === 'fists') {
    p.punch = 1;
    sfx.punch();
    let best = null, bd = w.range;
    for (const q of G.peds) {
      if (q.dead) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * Math.sin(p.h) + dz * Math.cos(p.h)) / (d || 1) > 0.5) { bd = d; best = q; }
    }
    if (best) {
      best.hurt(w.dmg, p.x, p.z, true);
      best.vx = Math.sin(p.h) * 3; best.vz = Math.cos(p.h) * 3;
    }
    return;
  }
  G.weapons[w.id]--;
  const base = p.inCar ? p.inCar : p;
  const o = { x: base.x + dir.x * (p.inCar ? 1.6 : 0.6), y: (base.y || 0) + (p.inCar ? 1.3 : 1.45), z: base.z + dir.z * (p.inCar ? 1.6 : 0.6) };
  fx.muzzle(o.x + dir.x * 0.3, o.y, o.z + dir.z * 0.3);
  sfx.gun(w.id, p);
  const n = w.pellets ?? 1;
  for (let k = 0; k < n; k++) fireBullet(o, dir, w);
  G.shake = Math.min(1, G.shake + (w.id === 'shotgun' ? 0.25 : 0.06));
  emit('gunshot', { x: p.x, z: p.z });
  panic(p.x, p.z, 40);
}
