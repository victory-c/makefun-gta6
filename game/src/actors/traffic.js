// Civilian traffic: AI drivers follow right-hand lanes on the road grid, turn at junctions,
// queue behind obstacles and get unstuck. Also exports steering helpers the police reuse.
import { G } from '../core/state.js';
import { CITY, PALETTE, RULES } from '../config.js';
import { rng, clamp, angleDiff } from '../core/rng.js';
import { nodePos, roadAt } from '../world/cityLayout.js';
import { spawnVehicle } from './vehicles.js';

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const inGrid = (i, j) => i >= 0 && j >= 0 && i < CITY.roads && j < CITY.roads;

export function laneTarget(ai) {
  const A = nodePos(ai.fi, ai.fj), B = nodePos(ai.ti, ai.tj);
  const dx = Math.sign(B.x - A.x), dz = Math.sign(B.z - A.z);
  return { A, B, dx, dz, rx: -dz, rz: dx };
}

function chooseNext(i, j, pi, pj) {
  const opts = [];
  for (const [dx, dz] of DIRS) {
    const ni = i + dx, nj = j + dz;
    if (!inGrid(ni, nj) || (ni === pi && nj === pj)) continue;
    const straight = ni - i === i - pi && nj - j === j - pj;
    opts.push({ ni, nj, w: straight ? 2.2 : 1 });
  }
  if (!opts.length) return { ni: pi, nj: pj };
  let t = rng.next() * opts.reduce((s, o) => s + o.w, 0);
  for (const o of opts) { t -= o.w; if (t <= 0) return o; }
  return opts[0];
}

// Pure-pursuit controls toward a point at a wanted speed.
export function steerTo(v, tx, tz, want) {
  const desired = Math.atan2(tx - v.x, tz - v.z);
  const diff = angleDiff(v.h, desired);
  const reverse = Math.abs(diff) > 2.3 && Math.hypot(tx - v.x, tz - v.z) < 12;
  const steer = clamp(diff * 2.2, -1, 1) * (reverse ? -1 : 1);
  const target = reverse ? -4 : want * (1 - Math.min(0.6, Math.abs(diff) * 0.5));
  const throttle = clamp((target - v.speed) * 0.4, -1, 1);
  return { throttle, steer, brake: false };
}

function blockedAhead(v) {
  const f = v.forward;
  const look = 6 + Math.max(0, v.speed) * 0.9;
  const check = (x, z, rad) => {
    const dx = x - v.x, dz = z - v.z;
    const ahead = dx * f.x + dz * f.z;
    if (ahead < 1 || ahead > look + v.spec.len / 2) return false;
    return Math.abs(dx * f.z - dz * f.x) < rad;
  };
  for (const o of G.vehicles) if (o !== v && check(o.x, o.z, 2.3)) return true;
  const p = G.player;
  if (!p.inCar && check(p.x, p.z, 1.8)) return true;
  for (const q of G.peds) if (!q.dead && check(q.x, q.z, 1.6)) return true;
  return false;
}

export function aiDrive(v, dt) {
  const ai = v.ai;
  const L = laneTarget(ai);
  const toB = Math.hypot(L.B.x - v.x, L.B.z - v.z);
  if (toB < 9) {
    const nx = chooseNext(ai.ti, ai.tj, ai.fi, ai.fj);
    ai.fi = ai.ti; ai.fj = ai.tj; ai.ti = ai.ni ?? nx.ni; ai.tj = ai.nj ?? nx.nj;
    const nn = chooseNext(ai.ti, ai.tj, ai.fi, ai.fj);
    ai.ni = nn.ni; ai.nj = nn.nj;
    if (ai.depth++ > 3) { ai.depth = 0; return; }
    return aiDrive(v, dt);
  }
  ai.depth = 0;
  const s = (v.x - L.B.x) * L.dx + (v.z - L.B.z) * L.dz;   // negative before the junction
  const ahead = s + 8;
  const tx = L.B.x + L.dx * ahead + L.rx * CITY.laneOffset;
  const tz = L.B.z + L.dz * ahead + L.rz * CITY.laneOffset;
  const turning = ai.ni !== undefined && (ai.ni - ai.ti !== L.dx || ai.nj - ai.tj !== L.dz);
  let want = ai.cruise * (turning && toB < 26 ? 0.55 : 1);
  if (blockedAhead(v)) { want = 0; ai.blocked += dt; } else ai.blocked = 0;
  let c = steerTo(v, tx, tz, want);
  if (want === 0) c = { throttle: v.speed > 0.3 ? -1 : 0, steer: c.steer, brake: false };
  if (ai.blocked > 2.5 && ai.blocked - dt <= 2.5 && Math.hypot(G.player.x - v.x, G.player.z - v.z) < 25) ai.honk = 1;
  // unstick: back up when wedged against something
  if (Math.abs(v.speed) < 0.4 && want > 0) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt);
  if (ai.stuck > 2.5) ai.reverse = 1.4;
  if (ai.reverse > 0) { ai.reverse -= dt; c = { throttle: -1, steer: -c.steer, brake: false }; if (ai.reverse <= 0) ai.stuck = 0; }
  if (dt > 0) v.drive(dt, c);
}

export function makeAi(fi, fj, ti, tj, cruise) {
  const ai = { fi, fj, ti, tj, cruise: cruise ?? rng.range(10, 14), blocked: 0, stuck: 0, reverse: 0, depth: 0 };
  const nn = chooseNext(ti, tj, fi, fj);
  ai.ni = nn.ni; ai.nj = nn.nj;
  return ai;
}

const TYPES = [['sedan', 30], ['compact', 25], ['suv', 14], ['taxi', 11], ['pickup', 10], ['sports', 10]];
function pickType() {
  let t = rng.next() * 100;
  for (const [id, w] of TYPES) { t -= w; if (t <= 0) return id; }
  return 'sedan';
}

// Put a car on a lane leaving node (i, j) toward a neighbour.
export function spawnOnLane(i, j, typeId, driver = 'ai', along = 12) {
  const opts = DIRS.filter(([dx, dz]) => inGrid(i + dx, j + dz));
  const [dx, dz] = rng.pick(opts);
  const A = nodePos(i, j);
  const x = A.x + dx * along + -dz * CITY.laneOffset, z = A.z + dz * along + dx * CITY.laneOffset;
  const v = spawnVehicle(typeId ?? pickType(), x, z, Math.atan2(dx, dz), typeId === 'police' || typeId === 'taxi' ? undefined : rng.pick(PALETTE.car));
  v.driver = driver;
  v.ai = makeAi(i, j, i + dx, j + dz);
  v.vx = dx * 6; v.vz = dz * 6; v.speed = 6;
  return v;
}

export function updateTraffic(dt) {
  const p = G.player;
  const civ = G.vehicles.filter((v) => v.driver === 'ai' && !v.mission);
  if (civ.length < RULES.trafficCount) {
    const i = rng.int(0, CITY.roads - 1), j = rng.int(0, CITY.roads - 1);
    const d = Math.hypot(roadAt(i) - p.x, roadAt(j) - p.z);
    if (d > 70 && d < 200) spawnOnLane(i, j);
  }
  for (const v of [...G.vehicles]) {
    if (v.driver === 'ai' && v.ai && !v.dead) aiDrive(v, dt);
    else if (v.driver !== 'player' && v.driver !== 'cop' && !v.ai?.custom) v.drive(dt, { throttle: 0, steer: 0, brake: true });
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (v !== p.inCar && !v.mission && v !== p.lastCar && (d > 240 || (v.dead && v.burn <= 0 && d > 80))) v.remove();
  }
}

export function populateTraffic() {
  for (let k = 0; k < RULES.trafficCount; k++) {
    const i = rng.int(0, CITY.roads - 1), j = rng.int(0, CITY.roads - 1);
    spawnOnLane(i, j, undefined, 'ai', rng.range(10, 50));
  }
}
