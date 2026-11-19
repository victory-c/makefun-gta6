// Progress saved in localStorage: money, story step, weapons, stats, collectibles.
import { G } from './state.js';

const KEY = 'palmera-bay-save-v1';

export function saveGame() {
  if (G.shot) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: G.money, storyStep: G.storyStep, weapons: { ...G.weapons, fists: 0 }, armor: G.armor,
      stats: G.stats, unlocks: G.unlocks, shells: G.shells,
    }));
  } catch { /* storage may be unavailable */ }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s) return false;
    Object.assign(G, { money: s.money, storyStep: s.storyStep, armor: s.armor ?? 0, stats: s.stats, unlocks: s.unlocks ?? { smg: false }, shells: s.shells ?? [] });
    G.weapons = { ...s.weapons, fists: Infinity };
    return true;
  } catch { return false; }
}

export function wipeSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
