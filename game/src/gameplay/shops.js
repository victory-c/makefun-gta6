// Bullet Bay Arms (weapons, ammo, armour) and Fresh Coat Garage (respray clears your wanted level).
import { G } from '../core/state.js';
import { layout } from '../world/cityLayout.js';
import { hit } from '../core/input.js';
import { addMarker, insideMarker } from './markers.js';
import { hud } from '../ui/hud.js';
import { sfx } from '../core/audio.js';
import { clearWanted } from '../actors/police.js';
import { rng } from '../core/rng.js';
import { saveGame } from '../core/save.js';

const STOCK = [
  { key: 'Digit1', label: 'Pistol ammo x24', price: 120, buy: () => { G.weapons.pistol += 24; } },
  { key: 'Digit2', label: 'SMG + 90 rounds', price: 1200, locked: () => !G.unlocks.smg, buy: () => { G.weapons.smg += 90; } },
  { key: 'Digit3', label: 'Shotgun + 16 shells', price: 2000, locked: () => G.storyStep < 4, buy: () => { G.weapons.shotgun += 16; } },
  { key: 'Digit4', label: 'Body armour', price: 300, buy: () => { G.armor = 100; } },
];

export function placeShops() {
  const P = layout.pois;
  addMarker('shop:gun', P.gunshop.x, P.gunshop.z, { color: 0x4fc3f7, radius: 1.6, label: 'Bullet Bay Arms', icon: 'gun' });
  addMarker('shop:respray', P.respray.x, P.respray.z, { color: 0x4fc3f7, radius: 4, label: 'Fresh Coat Garage', icon: 'spray' });
  addMarker('shop:safe', P.safehouse.x, P.safehouse.z, { color: 0xc77dff, radius: 1.4, label: 'Safehouse', icon: 'safe', gem: false });
}

export function updateShops() {
  const p = G.player;
  if (!p.inCar && insideMarker('shop:gun')) {
    hud.shop('BULLET BAY ARMS', STOCK.map((s, i) => `${i + 1}  ${s.label} — ${s.locked?.() ? 'locked' : '$' + s.price}`));
    for (const s of STOCK) {
      if (!hit(s.key)) continue;
      if (s.locked?.()) { hud.toast('Not available yet — keep playing the story'); continue; }
      if (G.money < s.price) { hud.toast("You can't afford that"); continue; }
      G.money -= s.price; s.buy(); sfx.cash(); hud.toast(`Bought: ${s.label}`); saveGame();
    }
  } else hud.shop(null);

  if (p.inCar && insideMarker('shop:respray') && !G.mission) {
    if (G.wanted > 0) {
      if (G.money >= 100) {
        G.money -= 100;
        p.inCar.mesh.userData.paint.color.setHSL(rng.next(), 0.75, 0.5);
        clearWanted();
        sfx.cash();
        hud.toast('Fresh Coat: new paint, no heat. -$100');
      } else hud.prompt('Respray costs $100');
    } else hud.prompt('Fresh Coat Garage — come back when the cops are on you');
  }
  if (!p.inCar && insideMarker('shop:safe')) {
    hud.prompt('Safehouse — progress saved, health restored');
    if (p.health < 100) { p.health = 100; saveGame(); }
  }
}
