// Gold Tide turf: crews loiter at the Mangrove Docks and on Neon Mile corners, and turn hostile
// when Mari gets close or starts shooting. Clearing a crew pays out and earns respect.
import { G } from '../core/state.js';
import { layout } from '../world/cityLayout.js';
import { spawnPed } from '../actors/pedestrians.js';
import { rng } from '../core/rng.js';
import { hud } from '../ui/hud.js';
import { sfx } from '../core/audio.js';

const TURFS = [
  { name: 'Mangrove Docks', block: [0, 7], size: 4, reward: 600 },
  { name: 'Neon Mile', block: [4, 7], size: 3, reward: 450 },
  { name: 'Little Havenna', block: [0, 4], size: 3, reward: 450 },
];

export function updateTurf(dt) {
  const p = G.player;
  for (const t of TURFS) {
    const b = layout.blocks.find((q) => q.i === t.block[0] && q.j === t.block[1]);
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const d = Math.hypot(p.x - cx, p.z - cz);
    if (!t.crew && d < 120 && d > 50 && !G.mission && (t.cooldown ?? 0) <= 0) {
      t.crew = [];
      for (let k = 0; k < t.size; k++) {
        const side = rng.int(0, 3);
        const x = side < 2 ? rng.range(b.x0 + 2, b.x1 - 2) : side === 2 ? b.x0 + 1.5 : b.x1 - 1.5;
        const z = side >= 2 ? rng.range(b.z0 + 2, b.z1 - 2) : side === 0 ? b.z0 + 1.5 : b.z1 - 1.5;
        const q = spawnPed('gang', x, z, { tag: 'turf' });
        q.state = 'idle';
        q.h = Math.atan2(cx - x, cz - z) + Math.PI;
        t.crew.push(q);
      }
    }
    if (!t.crew) { t.cooldown = (t.cooldown ?? 0) - dt; continue; }
    const alive = t.crew.filter((q) => !q.dead && G.peds.includes(q));
    // provoke: proximity, or any crew member getting hurt
    const provoked = alive.some((q) => q.state === 'hostile') || alive.some((q) => q.health < 80) || t.crew.some((q) => q.dead);
    for (const q of alive) {
      if (q.state === 'idle' && (provoked || Math.hypot(q.x - p.x, q.z - p.z) < 16)) {
        q.state = 'hostile';
        if (!t.warned) { t.warned = true; hud.say('Gold Tide', `This is Gold Tide turf, chica. Wrong street.`, 3); }
      }
    }
    if (alive.length === 0 && t.crew.length) {
      if (t.crew.every((q) => q.dead)) {
        G.money += t.reward;
        sfx.cash();
        hud.toast(`${t.name} cleared of Gold Tide  +$${t.reward}`);
      }
      t.crew = null; t.warned = false; t.cooldown = 120;
    } else if (d > 200) {
      for (const q of alive) q.remove();
      t.crew = null; t.warned = false;
    }
  }
}
