// City layout data (blocks, buildings, landmarks) and the spatial queries every actor uses:
// circle collision, line-of-sight, ground height, road nodes and district names.
import { CITY, DISTRICTS, PALETTE } from '../config.js';
import { makeRng } from '../core/rng.js';

export const roadAt = (i) => -CITY.half + i * CITY.cell;
const N = CITY.roads - 1; // blocks per axis

export const layout = {
  blocks: [], buildings: [], props: [], palms: [], lights: [], billboards: [], neon: [],
  umbrellas: [], containers: [], pois: {}, land: null, beach: null,
};

const grid = new Map();
const cellKey = (i, j) => (i + 4) * 64 + (j + 4);
const cellOf = (v) => Math.floor((v + CITY.half) / CITY.cell);

function classify(i, j) {
  if ((i === 1 && j === 2) || (i === 5 && j === 5)) return 'park';
  if (i >= 3 && i <= 4 && j >= 3 && j <= 4) return 'downtown';
  if (i === 7) return 'hotel';
  if (i <= 1 && j >= 6) return 'docks';
  if (i >= 3 && i <= 4 && j >= 6) return 'club';
  if (i === 0 || j === 0 || (i <= 2 && j <= 1)) return 'residential';
  return 'midrise';
}

function addBuilding(b) {
  layout.buildings.push(b);
  for (let i = cellOf(b.x0); i <= cellOf(b.x1); i++) {
    for (let j = cellOf(b.z0); j <= cellOf(b.z1); j++) {
      const k = cellKey(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(b);
    }
  }
}

const BRANDS = [
  ['SOLMAR COLA', 'taste the sunset', '#ff3b3b', '#fff4e0'],
  ['PELICAN AIR', 'fly the Suncoast', '#ffffff', '#1d6fb8'],
  ['GATOR BURGER', 'snap it up', '#2a8a3a', '#ffd23f'],
  ['VOLTAGE ENERGY', 'stay electric', '#9dff00', '#151515'],
  ['TÍO RAMÓN CAFÉ', 'cafecito since 1989', '#7a3b12', '#ffe6c2'],
  ['WAVE 104.2 FM', 'Radio Palmera', '#ff4fa3', '#1b1033'],
  ['MERCY PALMS', 'hospital & trauma', '#c81d25', '#ffffff'],
  ['NAVARRO MOTORS', 'no credit? no problem', '#ffb703', '#023047'],
];
const NEON = ['FLAMINGO ROYALE', 'HOTEL CORALINA', 'SEAGLASS INN', 'PALM NOIR', 'THE TIDEWATER', 'CASA LUMEN', 'BLUE MARLIN', 'SOLMAR GRAND'];
const NEON_COL = ['#ff4fa3', '#3ef0ff', '#ffe14f', '#b06bff', '#ff7a3d', '#4fff9a'];

export function generateLayout(seed = 7) {
  const r = makeRng(seed);
  const half = CITY.half, sw = CITY.sidewalk;
  layout.land = { x0: -half - 26, x1: half + CITY.road / 2 + CITY.beachWidth, z0: -half - 26, z1: half + 26 };
  layout.beach = { x0: half + CITY.road / 2, x1: layout.land.x1, z0: layout.land.z0, z1: layout.land.z1 };
  let neonIdx = 0, boardIdx = 0;

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x0 = roadAt(i) + CITY.road / 2, x1 = roadAt(i + 1) - CITY.road / 2;
      const z0 = roadAt(j) + CITY.road / 2, z1 = roadAt(j + 1) - CITY.road / 2;
      const kind = classify(i, j);
      const block = { i, j, x0, z0, x1, z1, kind, grass: kind === 'park' || kind === 'residential' };
      layout.blocks.push(block);
      const lx0 = x0 + sw, lx1 = x1 - sw, lz0 = z0 + sw, lz1 = z1 - sw;
      const pastel = () => r.pick(PALETTE.pastel);

      if (kind === 'park') {
        for (let k = 0; k < 14; k++) layout.palms.push({ x: r.range(lx0 + 3, lx1 - 3), z: r.range(lz0 + 3, lz1 - 3), s: r.range(0.8, 1.3) });
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        layout.props.push({ type: 'fountain', x: cx, z: cz });
        addBuilding({ x0: cx - 3, x1: cx + 3, z0: cz - 3, z1: cz + 3, h: 1, style: 'none', solidOnly: true });
      } else if (kind === 'downtown') {
        const twin = r.chance(0.5);
        const spots = twin ? [[lx0 + 2, lz0 + 2, 23], [lx1 - 25, lz1 - 25, 23]] : [[lx0 + 9, lz0 + 9, 36]];
        for (const [sx, sz, s] of spots) {
          const h = r.range(55, 125);
          addBuilding({ x0: sx, z0: sz, x1: sx + s, z1: sz + s, h, style: 'glass', color: r.pick(PALETTE.glass), crown: true });
        }
        if (twin) {
          addBuilding({ x0: lx1 - 20, z0: lz0 + 2, x1: lx1 - 2, z1: lz0 + 18, h: r.range(14, 24), style: 'deco', color: pastel() });
        }
      } else if (kind === 'hotel') {
        const depth = 26;
        for (let k = 0; k < 3; k++) {
          const pz0 = lz0 + k * 18 + 1, pz1 = pz0 + 16;
          const h = r.range(14, 30);
          addBuilding({ x0: lx1 - depth, z0: pz0, x1: lx1 - 1, z1: pz1, h, style: 'deco', color: pastel(), deco: true });
          layout.neon.push({ x: lx1 - 0.6, y: h - 3.2, z: (pz0 + pz1) / 2, rot: Math.PI / 2, w: 13, h: 3.2, text: NEON[neonIdx % NEON.length], color: NEON_COL[neonIdx % NEON_COL.length] });
          neonIdx++;
        }
        addBuilding({ x0: lx0 + 1, z0: lz0 + 2, x1: lx1 - depth - 4, z1: lz0 + 24, h: r.range(6, 10), style: 'house', color: pastel() });
        addBuilding({ x0: lx0 + 1, z0: lz1 - 24, x1: lx1 - depth - 4, z1: lz1 - 2, h: r.range(6, 12), style: 'house', color: pastel() });
      } else if (kind === 'docks') {
        addBuilding({ x0: lx0 + 2, z0: lz0 + 2, x1: lx0 + 26, z1: lz1 - 14, h: 10, style: 'metal', color: r.pick([0xb5603c, 0x6b8fa3, 0x9aa1a6]) });
        for (let k = 0; k < 7; k++) {
          const cx = r.range(lx0 + 31, lx1 - 4), cz = r.range(lz0 + 4, lz1 - 8), rot = r.chance(0.5);
          const w = rot ? 6 : 2.5, d = rot ? 2.5 : 6;
          const stack = r.int(1, 2);
          addBuilding({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, h: 2.6 * stack, style: 'container', color: r.pick([0xd62828, 0x1d70a2, 0xf77f00, 0x2a9d8f, 0x6c757d]) });
        }
      } else if (kind === 'residential') {
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const px0 = lx0 + a * 27, pz0 = lz0 + b * 27;
          const w = r.range(12, 17), d = r.range(11, 16);
          const ox = px0 + (a === 0 ? 3 : 24 - w), oz = pz0 + (b === 0 ? 3 : 24 - d);
          addBuilding({ x0: ox, z0: oz, x1: ox + w, z1: oz + d, h: r.range(4.5, 7.5), style: 'house', color: pastel(), flatRoof: r.chance(0.5) });
          layout.palms.push({ x: px0 + 13.5 + r.range(-3, 3), z: pz0 + 13.5 + r.range(-3, 3), s: r.range(0.7, 1.1) });
        }
      } else {
        // midrise and club: a grid of pastel art-deco parcels
        const nx = r.int(2, 3), nz = r.int(2, 3);
        const pw = (lx1 - lx0) / nx, pd = (lz1 - lz0) / nz;
        for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
          if (r.chance(0.08) && kind !== 'club') continue;
          const ins = r.range(0.6, 2.2);
          const bx0 = lx0 + a * pw + ins, bz0 = lz0 + b * pd + ins;
          const bx1 = lx0 + (a + 1) * pw - ins, bz1 = lz0 + (b + 1) * pd - ins;
          const h = kind === 'club' ? r.range(9, 20) : r.range(9, 34);
          const color = kind === 'club' ? r.pick([0x3a2a4f, 0x24324a, 0x4a2742, 0xf7efe2]) : pastel();
          const bld = { x0: bx0, z0: bz0, x1: bx1, z1: bz1, h, style: 'deco', color, deco: r.chance(0.6) };
          addBuilding(bld);
          if (kind === 'club' && (a === 0 || a === nx - 1)) {
            const east = a === nx - 1;
            layout.neon.push({ x: east ? bx1 + 0.15 : bx0 - 0.15, y: Math.min(h - 2.5, 7.5), z: (bz0 + bz1) / 2, rot: east ? Math.PI / 2 : -Math.PI / 2, w: Math.min(10, bz1 - bz0 - 1), h: 2.6, text: NEON[neonIdx % NEON.length], color: NEON_COL[neonIdx % NEON_COL.length] });
            neonIdx++;
          }
          if (h > 14 && r.chance(0.28)) {
            const B = BRANDS[boardIdx++ % BRANDS.length];
            const alongX = r.chance(0.5);
            layout.billboards.push({ x: (bx0 + bx1) / 2, y: h, z: (bz0 + bz1) / 2, rot: alongX ? 0 : Math.PI / 2, brand: B });
          }
        }
      }

      // palms and streetlights along the sidewalks
      if (kind !== 'downtown' && kind !== 'docks') {
        for (let t = x0 + 7; t < x1 - 4; t += 15) {
          layout.palms.push({ x: t, z: z0 + 1.3, s: r.range(0.85, 1.15) });
          layout.palms.push({ x: t + 4, z: z1 - 1.3, s: r.range(0.85, 1.15) });
        }
        for (let t = z0 + 9; t < z1 - 4; t += 15) {
          layout.palms.push({ x: x0 + 1.3, z: t, s: r.range(0.85, 1.15) });
          layout.palms.push({ x: x1 - 1.3, z: t + 3, s: r.range(0.85, 1.15) });
        }
      }
      layout.lights.push({ x: x0 + 1, z: z0 + 1, rot: Math.PI * 1.25 }, { x: x1 - 1, z: z1 - 1, rot: Math.PI * 0.25 });
    }
  }

  // beach: palms, umbrellas, lifeguard towers, pier
  const B = layout.beach;
  for (let z = B.z0 + 8; z < B.z1 - 6; z += 11) layout.palms.push({ x: B.x0 + 4 + r.range(-1, 2), z: z + r.range(-2, 2), s: r.range(1.0, 1.4) });
  for (let k = 0; k < 46; k++) layout.umbrellas.push({ x: r.range(B.x0 + 12, B.x1 - 12), z: r.range(B.z0 + 10, B.z1 - 10), color: r.pick([0xff595e, 0xffca3a, 0x1982c4, 0xff8fab, 0x2ec4b6, 0xffffff]) });
  for (const z of [-200, 30, 230]) {
    layout.props.push({ type: 'lifeguard', x: B.x1 - 14, z });
    addBuilding({ x0: B.x1 - 16, x1: B.x1 - 12, z0: z - 2, z1: z + 2, h: 4, style: 'none', solidOnly: true });
  }
  layout.props.push({ type: 'pier', x: B.x1 - 6, z: -60, len: 90, w: 9 });
  // outer green border palms
  for (let t = -CITY.half; t <= CITY.half; t += 13) {
    layout.palms.push({ x: t, z: -CITY.half - 16 + r.range(-2, 2), s: r.range(0.9, 1.3) });
    layout.palms.push({ x: t, z: CITY.half + 16 + r.range(-2, 2), s: r.range(0.9, 1.3) });
    layout.palms.push({ x: -CITY.half - 16 + r.range(-2, 2), z: t, s: r.range(0.9, 1.3) });
  }

  definePois();
  return layout;
}

// Landmarks: where the story's people live, the shops and services.
function definePois() {
  const side = (i, j, s, onRoad = false) => {
    const b = layout.blocks.find((q) => q.i === i && q.j === j);
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const o = onRoad ? 4.5 : -1.5;
    if (s === 's') return { x: cx, z: b.z1 + o };
    if (s === 'n') return { x: cx, z: b.z0 - o };
    if (s === 'e') return { x: b.x1 + o, z: cz };
    return { x: b.x0 - o, z: cz };
  };
  layout.pois = {
    safehouse: { ...side(1, 3, 's'), name: 'Safehouse', kind: 'safe' },
    ramon: { ...side(2, 4, 'e'), name: "Tío Ramón's Café", kind: 'story', who: 'Tío Ramón' },
    dex: { ...side(3, 6, 'n'), name: 'Club Voltage', kind: 'story', who: 'Dex Navarro' },
    jolene: { ...side(1, 6, 'e'), name: 'Mangrove Docks', kind: 'story', who: 'Jolene Park' },
    gunshop: { ...side(5, 1, 's'), name: 'Bullet Bay Arms', kind: 'shop' },
    respray: { ...side(2, 1, 'e', true), name: 'Fresh Coat Garage', kind: 'respray' },
    hospital: { ...side(6, 2, 'w'), name: 'Mercy Palms Hospital', kind: 'service' },
    police: { ...side(4, 2, 's'), name: 'Bay PD Precinct', kind: 'service' },
    race: { ...side(4, 7, 'n', true), name: 'Neon Mile Street Race', kind: 'side' },
    taxi: { ...side(6, 4, 'w', true), name: 'Coastline Cabs', kind: 'side' },
  };
}

// ---------- queries ----------

export function nearbyBuildings(x, z, r) {
  const out = [];
  for (let i = cellOf(x - r); i <= cellOf(x + r); i++) {
    for (let j = cellOf(z - r); j <= cellOf(z + r); j++) {
      const list = grid.get(cellKey(i, j));
      if (list) for (const b of list) if (!out.includes(b)) out.push(b);
    }
  }
  return out;
}

// Push a circle out of buildings and the island edge. Returns the corrected position and contact normal.
export function collideCircle(x, z, r) {
  let hit = false, nx = 0, nz = 0;
  for (const b of nearbyBuildings(x, z, r + 1)) {
    const cx = Math.max(b.x0, Math.min(x, b.x1));
    const cz = Math.max(b.z0, Math.min(z, b.z1));
    let dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 < 1e-6) {
      // centre inside: leave by the shallowest side
      const pens = [[x - b.x0, -1, 0], [b.x1 - x, 1, 0], [z - b.z0, 0, -1], [b.z1 - z, 0, 1]];
      pens.sort((p, q) => p[0] - q[0]);
      const [pen, px, pz] = pens[0];
      x += px * (pen + r); z += pz * (pen + r); nx += px; nz += pz;
    } else {
      const d = Math.sqrt(d2);
      dx /= d; dz /= d;
      x += dx * (r - d); z += dz * (r - d); nx += dx; nz += dz;
    }
  }
  const L = layout.land;
  if (x < L.x0 + r) { x = L.x0 + r; nx += 1; hit = true; }
  if (x > L.x1 - r) { x = L.x1 - r; nx -= 1; hit = true; }
  if (z < L.z0 + r) { z = L.z0 + r; nz += 1; hit = true; }
  if (z > L.z1 - r) { z = L.z1 - r; nz -= 1; hit = true; }
  const nl = Math.hypot(nx, nz) || 1;
  return { x, z, hit, nx: nx / nl, nz: nz / nl };
}

// Distance along a 2D ray to the first building (Infinity when clear). Bullets and sight lines use it.
export function rayBuildings(ax, az, dx, dz, maxT, y = 1.2) {
  let best = Infinity;
  const steps = Math.ceil(maxT / CITY.cell) + 1;
  const seen = new Set();
  for (let s = 0; s <= steps; s++) {
    const t = Math.min(maxT, s * CITY.cell);
    for (const b of nearbyBuildings(ax + dx * t, az + dz * t, CITY.cell * 0.75)) {
      if (seen.has(b) || b.h < y) continue;
      seen.add(b);
      const t1 = slab(ax, az, dx, dz, b);
      if (t1 < best) best = t1;
    }
  }
  return best <= maxT ? best : Infinity;
}

function slab(ax, az, dx, dz, b) {
  let tmin = 0, tmax = Infinity;
  for (const [o, d, lo, hi] of [[ax, dx, b.x0, b.x1], [az, dz, b.z0, b.z1]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

export function lineOfSight(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
  if (L < 0.01) return true;
  return rayBuildings(ax, az, dx / L, dz / L, L) === Infinity;
}

export function blockAt(x, z) {
  const i = cellOf(x), j = cellOf(z);
  if (i < 0 || j < 0 || i >= N || j >= N) return null;
  const b = layout.blocks[i * N + j];
  return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 ? b : null;
}

export function groundY(x, z) {
  if (blockAt(x, z)) return 0.2;
  const B = layout.beach;
  if (x > B.x0 + 1) return 0.12;
  return 0;
}

export function districtAt(x, z) {
  if (x > layout.beach.x0) return z < 0 ? 'Flamingo Beach' : 'Pelican Sands Beach';
  const u = x / CITY.half, v = z / CITY.half;
  const d = DISTRICTS.find((q) => u >= q.x0 && u < q.x1 && v >= q.z0 && v < q.z1);
  return d ? d.name : 'Palmera Bay';
}

export const nodePos = (i, j) => ({ x: roadAt(i), z: roadAt(j) });
export function nearestNode(x, z) {
  const c = (v) => Math.max(0, Math.min(CITY.roads - 1, Math.round((v + CITY.half) / CITY.cell)));
  return { i: c(x), j: c(z) };
}

// A random point on a road lane at least minD (and at most maxD) from (x, z).
export function randomRoadPoint(r, x, z, minD, maxD) {
  for (let k = 0; k < 40; k++) {
    const i = r.int(0, CITY.roads - 1), j = r.int(0, CITY.roads - 1);
    const p = nodePos(i, j);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d >= minD && d <= maxD) return { i, j, ...p };
  }
  const n = nearestNode(x + minD, z);
  return { ...n, ...nodePos(n.i, n.j) };
}
