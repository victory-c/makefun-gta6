// Wanted level and the Bay PD response: crimes raise heat, cruisers route through the grid to
// the player, officers bail out and shoot or arrest, a helicopter joins at 4 stars.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { CITY, RULES } from '../config.js';
import { rng, clamp } from '../core/rng.js';
import { lineOfSight, nearestNode, nodePos, roadAt } from '../world/cityLayout.js';
import { spawnOnLane, steerTo, makeAi } from './traffic.js';
import { spawnPed } from './pedestrians.js';
import { sfx } from '../core/audio.js';
import { fx } from '../gameplay/effects.js';

const THRESH = [0.9, 2.5, 5, 9, 14];
const CARS_FOR = [0, 1, 2, 3, 5, 6];
let heli = null, bustTimer = 0, spawnTimer = 0;

export function setWanted(n) {
  const before = G.wanted;
  G.wanted = clamp(n, 0, RULES.maxWanted);
  G.wantedHeat = G.wanted > 0 ? THRESH[G.wanted - 1] + 0.01 : 0;
  G.wantedUnseen = 0;
  if (G.wanted > before) sfx.star();
}

export function clearWanted() {
  setWanted(0);
  for (const v of G.vehicles) if (v.driver === 'cop') toPatrol(v);
}

function addHeat(h) {
  G.wantedHeat = Math.min(THRESH[4] + 1, G.wantedHeat + h);
  let stars = 0;
  for (const t of THRESH) if (G.wantedHeat >= t) stars++;
  if (stars > G.wanted) { G.wanted = stars; sfx.star(); G.onWantedUp?.(stars); }
  G.wantedUnseen = 0;
}

function copNear(x, z, r) {
  for (const v of G.vehicles) if (v.driver === 'cop' && Math.hypot(v.x - x, v.z - z) < r) return true;
  for (const q of G.peds) if (q.kind === 'cop' && !q.dead && Math.hypot(q.x - x, q.z - z) < r) return true;
  return false;
}

function processCrimes() {
  for (const e of G.events) {
    switch (e.type) {
      case 'gunshot': addHeat(copNear(e.x, e.z, 60) ? 0.5 : 0.12); break;
      case 'assault': addHeat(0.35); break;
      case 'ped_killed': addHeat(1); break;
      case 'cop_hurt': addHeat(G.wanted < 2 ? THRESH[1] - G.wantedHeat + 0.01 : 0.4); break;
      case 'cop_killed': addHeat(G.wanted < 3 ? THRESH[2] - G.wantedHeat + 0.01 : 1.6); break;
      case 'carjack': addHeat(copNear(e.x, e.z, 45) ? 1 : 0.45); break;
      case 'cop_carjack': addHeat(Math.max(2.6 - G.wantedHeat, 0.6)); break;
      case 'ram_cop': addHeat(0.5); break;
      default: break;
    }
  }
  G.events.length = 0;
}

function toPatrol(v) {
  const n = nearestNode(v.x, v.z);
  const ni = n.i + (n.i < CITY.roads - 1 ? 1 : -1);
  v.driver = 'ai'; v.sirenOn = false;
  v.ai = makeAi(n.i, n.j, ni, n.j, 11);
}

function spawnCopCar() {
  const p = G.player;
  for (let k = 0; k < 12; k++) {
    const i = rng.int(0, CITY.roads - 1), j = rng.int(0, CITY.roads - 1);
    const d = Math.hypot(roadAt(i) - p.x, roadAt(j) - p.z);
    if (d > 80 && d < 170) {
      const v = spawnOnLane(i, j, 'police', 'cop', 10);
      v.ai = { cop: true, ti: i, tj: j };
      v.sirenOn = true;
      return v;
    }
  }
  return null;
}

function copCarDrive(v, dt) {
  const p = G.player;
  const tgt = p.inCar ?? p;
  const d = Math.hypot(tgt.x - v.x, tgt.z - v.z);
  let c;
  if (d < 50 && lineOfSight(v.x, v.z, tgt.x, tgt.z)) {
    const lead = p.inCar ? 0.6 : 0;
    const tx = tgt.x + (p.inCar ? p.inCar.vx * lead : 0), tz = tgt.z + (p.inCar ? p.inCar.vz * lead : 0);
    const want = p.inCar ? 36 : clamp(d * 1.2, 0, 22);
    c = steerTo(v, tx, tz, want);
    if (!p.inCar && d < 14) c = { throttle: v.speed > 1 ? -1 : 0, steer: 0, brake: true };
  } else {
    const ai = v.ai;
    const goal = nearestNode(tgt.x, tgt.z);
    const here = nodePos(ai.ti, ai.tj);
    if (Math.hypot(here.x - v.x, here.z - v.z) < 10) {
      const di = Math.sign(goal.i - ai.ti), dj = Math.sign(goal.j - ai.tj);
      const preferI = Math.abs(goal.i - ai.ti) >= Math.abs(goal.j - ai.tj);
      if (di === 0 && dj === 0) { ai.ti = goal.i; ai.tj = goal.j; } else if ((preferI && di) || !dj) ai.ti += di; else ai.tj += dj;
    }
    const n = nodePos(ai.ti, ai.tj);
    c = steerTo(v, n.x, n.z, 30);
  }
  // unstick
  const ai = v.ai;
  if (Math.abs(v.speed) < 0.6 && c.throttle > 0) ai.stuck = (ai.stuck ?? 0) + dt; else ai.stuck = Math.max(0, (ai.stuck ?? 0) - dt);
  if (ai.stuck > 1.6) ai.reverse = 1.2;
  if (ai.reverse > 0) { ai.reverse -= dt; c = { throttle: -1, steer: -c.steer, brake: false }; if (ai.reverse <= 0) ai.stuck = 0; }
  v.drive(dt, c);

  // officers bail out next to a player on foot, or next to a stopped car
  const stopped = !p.inCar || Math.abs(p.inCar.speed) < 2;
  if (!v.unloaded && d < 16 && Math.abs(v.speed) < 3 && stopped) {
    v.unloaded = true;
    const f = v.forward;
    for (const s of [1, -1]) {
      const q = spawnPed('cop', v.x + f.z * s * 2, v.z - f.x * s * 2);
      q.h = v.h;
    }
    v.driver = null;
  }
  // at 3+ stars officers fire from the window
  if (G.wanted >= 3 && d < 32 && lineOfSight(v.x, v.z, tgt.x, tgt.z)) {
    ai.gun = (ai.gun ?? rng.range(0.5, 1.5)) - dt;
    if (ai.gun <= 0) {
      ai.gun = rng.range(0.9, 1.6);
      fx.tracer(v.x, 1.4, v.z, tgt.x + rng.range(-1, 1), 1.1, tgt.z + rng.range(-1, 1), 0x9ad0ff);
      sfx.gun('pistol', v);
      if (rng.chance(0.35)) { if (p.inCar) p.inCar.damage(30); else G.hurtPlayer?.(6); }
    }
  }
}

function buildHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 4.4), new THREE.MeshStandardMaterial({ color: 0x14213d, roughness: 0.4 }));
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 5), body.material);
  tail.position.set(0, 0.4, -4.4);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.4, 4.45), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.6, roughness: 0.1 }));
  glass.position.set(0, 0.2, 2.2);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  rotor.position.y = 1.2;
  const rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2;
  const rotors = new THREE.Group(); rotors.add(rotor, rotor2);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.12, depthWrite: false }));
  beam.position.y = -13;
  g.add(body, tail, stripe, glass, rotors, beam);
  g.traverse((o) => { if (o.isMesh && o !== beam) o.castShadow = true; });
  g.userData = { rotors };
  G.scene.add(g);
  return { mesh: g, x: G.player.x + 120, z: G.player.z, y: 28, gun: 2 };
}

function updateHeli(dt) {
  const p = G.player;
  if (G.wanted >= 4 && !heli) heli = buildHeli();
  if (!heli) return;
  const leaving = G.wanted < 4;
  const tx = leaving ? heli.x + 50 : p.x + Math.sin(G.time * 0.4) * 14;
  const tz = leaving ? heli.z : p.z + Math.cos(G.time * 0.4) * 14;
  heli.x += (tx - heli.x) * Math.min(1, dt * 0.8);
  heli.z += (tz - heli.z) * Math.min(1, dt * 0.8);
  heli.y += ((leaving ? 80 : 26) - heli.y) * dt * 0.5;
  const m = heli.mesh;
  m.position.set(heli.x, heli.y, heli.z);
  m.rotation.y = Math.atan2(p.x - heli.x, p.z - heli.z);
  m.rotation.x = 0.12;
  m.userData.rotors.rotation.y += dt * 30;
  if (G.wanted >= 5) {
    heli.gun -= dt;
    if (heli.gun <= 0) {
      heli.gun = 0.15;
      fx.tracer(heli.x, heli.y - 1, heli.z, p.x + rng.range(-2, 2), 0.8, p.z + rng.range(-2, 2), 0xffb0b0);
      if (rng.chance(0.08)) { if (p.inCar) p.inCar.damage(25); else G.hurtPlayer?.(4); }
    }
  }
  if (leaving && heli.y > 70) { G.scene.remove(m); heli = null; }
}

export function updatePolice(dt) {
  const p = G.player;
  processCrimes();
  // keep the right number of cruisers in pursuit
  const cops = G.vehicles.filter((v) => v.driver === 'cop' && !v.dead);
  spawnTimer -= dt;
  if (G.wanted > 0 && cops.length < CARS_FOR[G.wanted] && spawnTimer <= 0) { spawnCopCar(); spawnTimer = 2.5; }
  for (const v of cops) copCarDrive(v, dt);
  for (const v of G.vehicles) if (v.type === 'police' && v.driver === 'cop' && G.wanted === 0) toPatrol(v);

  // sight and cooling off
  let seen = false, nearest = Infinity;
  for (const v of G.vehicles) {
    if (v.type !== 'police' || v.dead) continue;
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (v.sirenOn) nearest = Math.min(nearest, d);
    if (v.driver === 'cop' && d < 70 && lineOfSight(v.x, v.z, p.x, p.z)) seen = true;
  }
  for (const q of G.peds) if (q.kind === 'cop' && !q.dead && Math.hypot(q.x - p.x, q.z - p.z) < 45 && lineOfSight(q.x, q.z, p.x, p.z)) seen = true;
  if (heli && G.wanted >= 4) seen = true;
  G.copsSee = seen;
  G.sirenLevel = nearest < 150 ? 1 - nearest / 150 : 0;
  if (G.wanted > 0) {
    if (seen) G.wantedUnseen = 0;
    else {
      G.wantedUnseen += dt;
      if (G.wantedUnseen > RULES.wantedDecay + G.wanted * 2) {
        const n = G.wanted - 1;
        G.wanted = n; G.wantedHeat = n > 0 ? THRESH[n - 1] + 0.01 : 0;
        G.wantedUnseen = 0;
        if (n === 0) { clearWanted(); G.onWantedCleared?.(); }
      }
    }
  }
  // cops on foot stand down when the heat is gone
  for (const q of G.peds) if (q.kind === 'cop' && G.wanted === 0 && !q.dead) q.state = 'idle';

  // busted: an officer within arm's reach of a slow player
  let close = false;
  for (const q of G.peds) {
    if (q.kind !== 'cop' || q.dead) continue;
    if (Math.hypot(q.x - p.x, q.z - p.z) < (p.inCar ? 2.8 : 1.7)) close = true;
  }
  const slow = p.inCar ? Math.abs(p.inCar.speed) < 1 : p.speed < 2;
  if (G.wanted > 0 && close && slow && !p.dead) {
    bustTimer += dt;
    if (bustTimer > (p.inCar ? 2.2 : 1.3)) { bustTimer = 0; G.onPlayerDeath?.('busted'); }
  } else bustTimer = Math.max(0, bustTimer - dt);
  G.bustProgress = bustTimer;
  updateHeli(dt);
}

export function resetPolice() {
  if (heli) { G.scene.remove(heli.mesh); heli = null; }
  bustTimer = 0;
}
