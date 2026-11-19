// Marisol "Mari" Vega, the player: walking, sprinting, jumping, getting in and out of cars,
// carjacking, driving controls, health and armour.
import { G, emit } from '../core/state.js';
import { key, hit, axis } from '../core/input.js';
import { RULES } from '../config.js';
import { angleDiff, clamp } from '../core/rng.js';
import { collideCircle, groundY } from '../world/cityLayout.js';
import { buildHuman, animateHuman } from './characters.js';
import { ejectDriver } from './pedestrians.js';
import { sfx } from '../core/audio.js';

export function createPlayer(x, z) {
  const mesh = buildHuman({ skin: 0xc68642, shirt: 0xff5d8f, pants: 0x1f3b57, hair: 0x1a0f0a, cap: 0xffffff });
  G.scene.add(mesh);
  const p = {
    x, z, y: 0, vy: 0, h: 0, speed: 0, mesh, inCar: null, lastCar: null,
    health: RULES.playerHealth, dead: false, aiming: false, punch: 0, enterCooldown: 0,
  };
  G.player = p;
  return p;
}

export function hurtPlayer(amount) {
  const p = G.player;
  if (p.dead || G.godMode) return;
  if (G.armor > 0) { const a = Math.min(G.armor, amount * 0.7); G.armor -= a; amount -= a; }
  p.health -= amount;
  G.shake = Math.min(1, G.shake + 0.15);
  G.hurtFlash = 0.35;
  if (p.health <= 0) { p.health = 0; p.dead = true; G.onPlayerDeath?.('wasted'); }
}

function nearestEnterable(p) {
  let best = null, bd = 4.2;
  for (const v of G.vehicles) {
    if (v.dead) continue;
    const d = Math.hypot(v.x - p.x, v.z - p.z) - v.spec.len * 0.25;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export function enterVehicle(v) {
  const p = G.player;
  if (v.driver && v.driver !== 'player') {
    const wasCop = v.driver === 'cop';
    ejectDriver(v);
    emit(wasCop ? 'cop_carjack' : 'carjack', { x: v.x, z: v.z });
  }
  if (v.driver !== 'player' && !v.owned) { G.stats.carsStolen++; v.owned = true; }
  v.driver = 'player'; v.ai = null; v.sirenOn = false;
  p.inCar = v; p.lastCar = v;
  p.mesh.visible = false;
  G.onEnterVehicle?.(v);
}

export function exitVehicle() {
  const p = G.player, v = p.inCar;
  if (!v) return;
  const f = v.forward;
  const side = v.spec.w / 2 + 0.7;
  const c = collideCircle(v.x + f.z * side, v.z - f.x * side, 0.4);
  p.x = c.x; p.z = c.z; p.h = v.h;
  v.driver = null;
  p.inCar = null;
  p.mesh.visible = true;
  p.enterCooldown = 0.4;
}

export function updatePlayer(dt, camYaw) {
  const p = G.player;
  if (p.dead) {
    animateHuman(p.mesh, dt, 0, { down: true });
    return;
  }
  p.enterCooldown -= dt;
  if (p.inCar) {
    const v = p.inCar;
    const throttle = axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const steer = axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
    v.drive(dt, { throttle, steer, brake: key('Space') });
    if (hit('KeyH')) { sfx.horn(); G.onHorn?.(v); }
    if (v.type === 'police' && hit('KeyG')) v.sirenOn = !v.sirenOn;
    p.x = v.x; p.z = v.z; p.y = v.y;
    if (v.dead) { exitVehicle(); hurtPlayer(55); }
    else if (hit('KeyF') && p.enterCooldown <= 0) {
      if (Math.abs(v.speed) > 9) hurtPlayer(10);   // bailing out at speed hurts
      exitVehicle();
    }
    return;
  }

  // on foot: camera-relative movement
  const fwd = axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
  const strafe = axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
  const sprint = key('ShiftLeft') || key('ShiftRight');
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const rx = -fz, rz = fx;
  let mx = fx * fwd + rx * strafe, mz = fz * fwd + rz * strafe;
  const ml = Math.hypot(mx, mz);
  const target = ml > 0 ? (sprint ? 8.2 : 4.4) : 0;
  p.speed += (target - p.speed) * Math.min(1, dt * 10);
  if (ml > 0) {
    mx /= ml; mz /= ml;
    p.moveH = Math.atan2(mx, mz);
  }
  if (p.speed > 0.05 && p.moveH !== undefined) {
    p.x += Math.sin(p.moveH) * p.speed * dt;
    p.z += Math.cos(p.moveH) * p.speed * dt;
  }
  const faceTo = p.aiming ? camYaw : (ml > 0 ? p.moveH : p.h);
  p.h += angleDiff(p.h, faceTo) * Math.min(1, dt * 12);
  // collisions: buildings, then cars
  let c = collideCircle(p.x, p.z, 0.4);
  p.x = c.x; p.z = c.z;
  for (const v of G.vehicles) {
    const dx = p.x - v.x, dz = p.z - v.z;
    if (dx * dx + dz * dz > 12) continue;
    const f = v.forward;
    const lf = dx * f.x + dz * f.z, lr = dx * f.z - dz * f.x;
    const hx = v.spec.len / 2 + 0.4, hw = v.spec.w / 2 + 0.4;
    if (Math.abs(lf) < hx && Math.abs(lr) < hw) {
      const pf = hx - Math.abs(lf), pr = hw - Math.abs(lr);
      if (pf < pr) { p.x += f.x * Math.sign(lf) * pf; p.z += f.z * Math.sign(lf) * pf; }
      else { p.x += f.z * Math.sign(lr) * pr; p.z += -f.x * Math.sign(lr) * pr; }
      const sp = Math.hypot(v.vx, v.vz);
      if (sp > 6 && v.driver !== 'player') hurtPlayer(sp * 1.5);
    }
  }
  // jump and ground
  const gy = groundY(p.x, p.z);
  if (hit('Space') && p.y <= gy + 0.01) p.vy = 5.2;
  p.vy -= 16 * dt;
  p.y += p.vy * dt;
  if (p.y < gy) { p.y = gy; p.vy = 0; }
  p.punch = Math.max(0, p.punch - dt * 3);

  if (hit('KeyF') && p.enterCooldown <= 0) {
    const v = nearestEnterable(p);
    if (v) enterVehicle(v);
  }
  animateHuman(p.mesh, dt, p.speed * (p.y > gy + 0.1 ? 0.2 : 1), { aiming: p.aiming && G.weaponIndex > 0, punch: p.punch });
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.h;
  p.health = clamp(p.health, 0, RULES.playerHealth);
}

export function nearbyCarPrompt() {
  const p = G.player;
  if (p.inCar || p.dead) return null;
  const v = nearestEnterable(p);
  if (!v) return null;
  return v.driver && v.driver !== 'player' ? `F  Carjack ${v.spec.name}` : `F  Get in ${v.spec.name}`;
}
