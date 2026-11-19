// The story of Marisol "Mari" Vega: five missions from homecoming to the armored-van heist.
import { G } from '../core/state.js';
import { layout, roadAt } from '../world/cityLayout.js';
import { CITY } from '../config.js';
import { rng } from '../core/rng.js';
import { spawnPed } from '../actors/pedestrians.js';
import { spawnOnLane } from '../actors/traffic.js';
import { setWanted, clearWanted } from '../actors/police.js';
import { insideMarker } from './markers.js';
import { hud } from '../ui/hud.js';
import { sfx } from '../core/audio.js';
import { fx } from './effects.js';

const poi = (k) => layout.pois[k];
const roadPoint = (i, j, di = 0, dj = 0) => ({ x: roadAt(i) + di, z: roadAt(j) + dj });
function walkPoint(i, j, side) {
  const b = layout.blocks.find((q) => q.i === i && q.j === j);
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  return side === 'n' ? { x: cx, z: b.z0 + 1.5 } : side === 's' ? { x: cx, z: b.z1 - 1.5 } : side === 'e' ? { x: b.x1 - 1.5, z: cz } : { x: b.x0 + 1.5, z: cz };
}

// A stage that completes when the player reaches a point (optionally in a vehicle).
function reach(text, where, { inCar = false, radius = 3, color, timer, label, onArrive, require } = {}) {
  return () => ({
    text, timer, marker: { ...where(), radius, color, label },
    update() {
      if (inCar && !G.player.inCar) { hud.prompt('You need a vehicle'); return; }
      if (!insideMarker('m:goal')) return;
      if (require) { const why = require(); if (why) { hud.prompt(why); return; } }
      onArrive?.();
      return 'done';
    },
  });
}

const getCar = (text = 'Get a vehicle') => () => ({ text, update: () => (G.player.inCar ? 'done' : undefined) });

export const STORY = [
  {
    id: 'welcome', title: 'Welcome Home', giver: 'ramon', reward: 500,
    intro: [
      ['Tío Ramón', 'Mari! Six years, and you walk in like you never left.'],
      ['Tío Ramón', "Teo's in county lockup. The Gold Tide crew framed him and towed his ride."],
      ['Mari', 'Then I need wheels. Fast, and nothing anyone recognises.'],
      ['Tío Ramón', 'Take any car. Fresh Coat Garage will give it new paint. Then come back.'],
    ],
    stages: [
      getCar('Steal a car — walk up to one and press F'),
      reach('Drive to Fresh Coat Garage for a respray', () => poi('respray'), {
        inCar: true, radius: 4, label: 'Fresh Coat Garage',
        onArrive: () => {
          const v = G.player.inCar;
          v.mesh.userData.paint.color.setHSL(rng.next(), 0.7, 0.5);
          clearWanted();
          hud.toast('Fresh paint. Nobody will recognise this ride.');
          sfx.cash();
        },
      }),
      reach("Head back to Tío Ramón's Café", () => poi('ramon'), { radius: 3 }),
    ],
    outro: [['Tío Ramón', 'Ha! Teo would love that colour. Come back when you want real work.']],
  },
  {
    id: 'pastelitos', title: 'Hot Pastelitos', giver: 'ramon', reward: 900,
    intro: [
      ['Tío Ramón', 'Box of pastelitos for my friend in Flamingo Point. Still warm.'],
      ['Mari', "Why do pastries need a getaway driver?"],
      ['Tío Ramón', "Don't look under the pastry. And don't be late — 75 seconds."],
    ],
    stages: [
      getCar('Get a vehicle for the delivery'),
      reach('Deliver the box to Flamingo Point', () => roadPoint(7, 1, -CITY.laneOffset, 0), { inCar: true, radius: 5, timer: 75, label: 'Drop-off' }),
      reach("Return to Tío Ramón's Café", () => poi('ramon'), {}),
    ],
    outro: [['Tío Ramón', 'Warm and on time. Go see Dex Navarro at Club Voltage — he pays better than me.']],
  },
  {
    id: 'collections', title: 'Collections', giver: 'dex', reward: 1500,
    intro: [
      ['Dex Navarro', "Ramón's niece. Heard you can drive. Can you also be persuasive?"],
      ['Dex Navarro', 'Three shops on Neon Mile are behind on their "insurance". Collect.'],
    ],
    stages: [
      reach('Collect from the bodega (1/3)', () => walkPoint(3, 7, 'e'), { radius: 2.5 }),
      reach('Collect from the record store (2/3)', () => walkPoint(4, 6, 'n'), { radius: 2.5 }),
      reach('Collect from the tattoo parlor (3/3)', () => walkPoint(4, 7, 'w'), { radius: 2.5, onArrive: () => { setWanted(2); hud.say('Mari', 'Silent alarm. Of course.', 3); } }),
      () => ({ text: 'Lose the cops', update: () => (G.wanted === 0 ? 'done' : undefined) }),
    ],
    outro: [['Dex Navarro', 'Clean. The SMG at Bullet Bay Arms is yours to buy now.']],
    cleanup: (d, ok) => { if (ok) G.unlocks.smg = true; },
  },
  {
    id: 'beach', title: 'Gold Tide Beach Party', giver: 'dex', reward: 2200,
    intro: [
      ['Dex Navarro', 'Valdane\'s Gold Tide boys are selling on Pelican Sands. My beach.'],
      ['Dex Navarro', 'Go tell them the party is over. Here, some ammo.'],
    ],
    begin: () => { G.weapons.pistol = Math.max(G.weapons.pistol, 60); },
    stages: [
      reach('Go to Pelican Sands', () => ({ x: layout.beach.x0 + 18, z: 170 }), { radius: 12, label: 'Pelican Sands' }),
      (d) => ({
        text: 'Take out the Gold Tide crew',
        start() {
          d.gang = [];
          for (let k = 0; k < 5; k++) {
            const q = spawnPed('gang', layout.beach.x0 + 16 + rng.range(0, 20), 175 + rng.range(-14, 22), { tag: 'gold' });
            q.health = 70;
            d.gang.push(q);
          }
        },
        update() {
          const left = d.gang.filter((q) => !q.dead).length;
          hud.objective(`Take out the Gold Tide crew (${5 - left}/5)`);
          return left === 0 ? 'done' : undefined;
        },
      }),
    ],
    outro: [['Dex Navarro', "Word travels fast. Valdane knows your name now. Jolene at the docks wants to meet."]],
  },
  {
    id: 'bulwark', title: 'The Bulwark Job', giver: 'jolene', reward: 10000,
    intro: [
      ['Jolene Park', "Cesar Valdane moves Gold Tide cash in a Bulwark armored van. It's on the street right now."],
      ['Jolene Park', 'Wreck it till it stops, grab the bag, lose the heat, stash it at your safehouse.'],
      ['Mari', "And Teo's bail?"],
      ['Jolene Park', 'Paid twice over.'],
    ],
    stages: [
      getCar('Get a fast car'),
      (d) => ({
        text: 'Stop the armored van — ram it or shoot it',
        marker: { x: 0, z: 0, color: 0xff4f4f, follow: () => d.van },
        start() {
          const v = spawnOnLane(8, 0, 'van', 'ai', 20);
          v.mission = true; v.ai.cruise = 15;
          d.van = v;
          hud.say('Jolene Park', 'Van is northeast, heading into town. Go!', 3);
        },
        update() {
          const v = d.van;
          if (v.health < v.spec.hp * 0.4 || v.dead) {
            v.driver = null; v.ai = null;
            fx.smoke(v.x, 2, v.z, 6);
            for (let k = 0; k < 2; k++) spawnPed('gang', v.x + rng.range(-3, 3), v.z + rng.range(-3, 3));
            return 'done';
          }
        },
      }),
      (d) => ({
        text: 'Grab the cash bag from the van',
        marker: { x: d.van.x, z: d.van.z, radius: 4, color: 0x57e389 },
        update() {
          if (!insideMarker('m:goal', 1)) return;
          setWanted(3);
          hud.toast('$$$ Cash bag secured');
          sfx.cash();
          return 'done';
        },
      }),
      reach('Lose the cops and stash the cash at the safehouse', () => poi('safehouse'), { radius: 3, require: () => (G.wanted > 0 ? 'Lose the cops first!' : null) }),
    ],
    outro: [
      ['Mari', "Teo walks out tomorrow. Valdane's going to come looking."],
      ['Jolene Park', 'Let him. Palmera Bay is yours now.'],
    ],
    cleanup: (d) => { if (d.van && !d.van.dead) { d.van.mission = false; } },
  },
];
