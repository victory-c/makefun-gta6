// Side jobs (street race, taxi fares) and the seashell collectibles scattered around the island.
import { G } from '../core/state.js';
import { layout, roadAt, nodePos } from '../world/cityLayout.js';
import { CITY } from '../config.js';
import { rng } from '../core/rng.js';
import { spawnPed } from '../actors/pedestrians.js';
import { insideMarker, addMarker, removeMarker } from './markers.js';
import { hud } from '../ui/hud.js';
import { sfx } from '../core/audio.js';
import { fx } from './effects.js';

const lane = (i, j) => nodePos(i, j);

function checkpoint(text, p, timer, keepTimer) {
  return () => ({
    text, timer, keepTimer, marker: { x: p.x, z: p.z, radius: 7, color: 0x57e389 },
    update() {
      if (!G.player.inCar) return 'fail:You left your car.';
      return insideMarker('m:goal') ? 'done' : undefined;
    },
  });
}

const RACE_ROUTE = [[4, 7], [6, 7], [6, 5], [8, 5], [8, 2], [5, 2], [5, 4], [3, 4]];

function farePoint(fromX, fromZ, minD, maxD) {
  for (let k = 0; k < 40; k++) {
    const b = rng.pick(layout.blocks);
    const side = rng.int(0, 3);
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const p = [{ x: cx, z: b.z0 - 3 }, { x: cx, z: b.z1 + 3 }, { x: b.x0 - 3, z: cz }, { x: b.x1 + 3, z: cz }][side];
    const d = Math.hypot(p.x - fromX, p.z - fromZ);
    if (d > minD && d < maxD) return p;
  }
  return { x: roadAt(4), z: roadAt(4) };
}

function taxiFare(n) {
  return [
    (d) => ({
      text: `Pick up the fare (${n}/3)`,
      start() {
        d.pick = farePoint(G.player.x, G.player.z, 60, 220);
        d.rider = spawnPed('civ', d.pick.x, d.pick.z);
        d.rider.state = 'idle';
      },
      get marker() { return { x: d.pick.x, z: d.pick.z, radius: 6, color: 0x57e389 }; },
      update() {
        if (!G.player.inCar || G.player.inCar.type !== 'taxi') return 'fail:You left the cab.';
        if (insideMarker('m:goal') && Math.abs(G.player.inCar.speed) < 3) { d.rider.remove(); return 'done'; }
      },
    }),
    (d) => {
      const drop = farePoint(G.player.x, G.player.z, 140, 380);
      const secs = Math.round(Math.hypot(drop.x - G.player.x, drop.z - G.player.z) / 9 + 18);
      return {
        text: `Drive the fare to the destination (${n}/3)`, timer: secs,
        marker: { x: drop.x, z: drop.z, radius: 6, color: 0x57e389 },
        update() {
          if (!G.player.inCar || G.player.inCar.type !== 'taxi') return 'fail:You left the cab.';
          if (insideMarker('m:goal') && Math.abs(G.player.inCar.speed) < 4) {
            const tip = Math.round(40 + Math.max(0, G.mission.deadline) * 6);
            G.money += tip; hud.toast(`Fare paid +$${tip}`); sfx.cash();
            return 'done';
          }
        },
      };
    },
  ];
}

export const SIDE_JOBS = [
  {
    id: 'race', side: true, title: 'Neon Mile Sprint', giver: 'race', reward: 800,
    canStart: () => (G.player.inCar ? null : 'Street races need a car'),
    intro: [['Race marshal', 'Eight checkpoints, seventy seconds. Lights out!']],
    stages: RACE_ROUTE.map(([i, j], k) => checkpoint(`Street race: checkpoint ${k + 1}/${RACE_ROUTE.length}`, lane(i, j), k === 0 ? 70 : undefined, k > 0)),
    cleanup: (d, ok) => { if (ok) G.stats.races++; },
  },
  {
    id: 'taxi', side: true, title: 'Coastline Cabs', giver: 'taxi', reward: 450,
    canStart: () => (G.player.inCar?.type === 'taxi' ? null : 'Get in a Coastline Cab to start fares'),
    intro: [['Dispatcher', 'Three fares waiting. Drive nice, they tip.']],
    stages: [...taxiFare(1), ...taxiFare(2), ...taxiFare(3)],
    cleanup: (d) => { if (d.rider && !d.rider.dead) d.rider.remove(); },
  },
];

// Twelve glowing seashells hidden around the island.
export const SHELLS = [];
export function placeShells() {
  const B = layout.beach;
  const spots = [
    [B.x1 - 8, -60 + 0], [B.x0 + 30, -230], [B.x0 + 25, 120], [B.x1 - 10, 250],
    [-CITY.half - 14, -CITY.half - 14], [-CITY.half - 14, CITY.half + 14], [0, -CITY.half - 18], [roadAt(1) + 38, roadAt(2) + 38],
    [roadAt(5) + 38, roadAt(5) + 38], [roadAt(0) + 30, roadAt(6) + 18], [roadAt(3) + 38, roadAt(3) + 5], [roadAt(6) + 38, roadAt(7) + 38],
  ];
  spots.forEach(([x, z], i) => {
    const id = 'shell:' + i;
    SHELLS.push({ id, x, z });
    if (!G.shells.includes(id)) addMarker(id, x, z, { color: 0xff8fd8, radius: 0.9, height: 0.8, blip: false, gem: true });
  });
}

export function updateShells() {
  for (const s of SHELLS) {
    if (G.shells.includes(s.id)) continue;
    if (insideMarker(s.id, 0.8)) {
      G.shells.push(s.id);
      removeMarker(s.id);
      G.money += 150;
      fx.collect(s.x, 1, s.z);
      sfx.pickup();
      hud.toast(`Seashell ${G.shells.length}/${SHELLS.length} found  +$150`);
      if (G.shells.length === SHELLS.length) { G.money += 2500; hud.big('ALL SEASHELLS', '+$2,500 and the island\'s respect', '#ff8fd8', 4); }
    }
  }
}
