// Deterministic screenshot scenes (?shot=chase|beach|downtown|map): real gameplay simulated for a few
// seconds with scripted input, then one rendered frame. Used to take the entry's screenshots.
import { G } from './core/state.js';
import { simulateKey, mouse } from './core/input.js';
import { cam } from './core/cameraRig.js';
import { CITY } from './config.js';
import { layout, roadAt } from './world/cityLayout.js';
import { spawnVehicle } from './actors/vehicles.js';
import { enterVehicle } from './actors/player.js';
import { setWanted } from './actors/police.js';
import { spawnPed, crowdAround } from './actors/pedestrians.js';
import { makeAi } from './actors/traffic.js';
import { startMission } from './gameplay/missionRunner.js';
import { STORY } from './gameplay/storyMissions.js';
import { reseed } from './core/rng.js';
import { hud } from './ui/hud.js';

const SCENES = {
  // Cover: a three-star chase up Ocean Drive with the van heist objective on screen.
  chase: {
    frames: 110,
    setup() {
      G.storyStep = 4; G.money = 18450; G.weaponIndex = 1; G.camLock = true;
      const x = roadAt(8) - CITY.laneOffset;
      const car = spawnVehicle('sports', x, -170, 0, 0xff3d8b);
      enterVehicle(car);
      car.vx = 0; car.vz = 26; car.speed = 26;
      for (const [dx, dz] of [[2.6, -9], [-1.8, -16], [1.5, -25]]) {
        const c = spawnVehicle('police', x + dx, -170 + dz, 0);
        c.driver = 'cop'; c.sirenOn = true; c.ai = { cop: true, ti: 8, tj: 2 };
        c.vz = 27; c.speed = 27;
      }
      // clear the lane ahead so the chase stays on Ocean Drive
      for (const v of [...G.vehicles]) if (v.driver === 'ai' && Math.abs(v.x - x) < 9 && v.z > -170 && v.z < 0) v.remove();
      setWanted(3);
      crowdAround(x, -55, 18, 4, 40);
      startMission(STORY[4]);
      G.mission.idx = 2;
      hud.say('Jolene Park', 'Three cruisers on your tail. Lose them before the safehouse!', 6, 2.6);
      cam.yaw = Math.PI + 0.4;
      simulateKey('KeyW', true);
    },
    camera() { cam.yaw = Math.PI + 0.55; cam.pitch = 0.04; cam.view = 3; },
  },
  // On foot on Pelican Sands, pistol drawn against the Gold Tide crew.
  beach: {
    frames: 70,
    setup() {
      G.storyStep = 3; G.money = 6120; G.godMode = true;
      G.weapons.pistol = 48; G.weaponIndex = 1;
      const p = G.player;
      p.x = layout.beach.x0 + 24; p.z = 196; p.h = Math.PI;
      startMission(STORY[3]);
      G.mission.idx = 0;
      G.mission.stage = { text: '', update: () => undefined };
      const gang = [];
      for (const [dx, dz] of [[-3, -10], [2, -14], [-6, -12], [4, -19], [-1, -17]]) gang.push(spawnPed('gang', p.x + dx, p.z + dz, { tag: 'gold' }));
      gang[1].hurt(999, p.x, p.z, false); gang[3].hurt(999, p.x, p.z, false);
      for (const q of gang) q.fire = 0.9 + Math.random();
      hud.objective('Take out the Gold Tide crew (2/5)');
      setWanted(1);
      cam.yaw = Math.PI + 0.25; cam.pitch = -0.04; cam.view = 0;
    },
    input(i) { if (i === 68) mouse.leftPressed = true; },
    camera() { cam.yaw = Math.PI + 0.25; cam.pitch = -0.04; },
  },
  // Rush hour in Midtown Palms: driving among traffic past pastel art-deco blocks.
  downtown: {
    frames: 90,
    setup() {
      G.storyStep = 2; G.money = 2740;
      const z = roadAt(2) - CITY.laneOffset, x = roadAt(5) - 14;
      const car = spawnVehicle('suv', x, z, -Math.PI / 2, 0x1d70a2);
      enterVehicle(car);
      car.vx = -12; car.speed = 12;
      const kinds = ['taxi', 'sedan', 'compact', 'sports', 'pickup', 'sedan'];
      const cols = [0xffc20e, 0xe63946, 0xf1faee, 0xffb703, 0x2a9d8f, 0x8338ec];
      for (let k = 0; k < 6; k++) {
        const west = k % 2 === 0;
        const t = spawnVehicle(kinds[k], x - 16 - k * 12, roadAt(2) + (west ? -CITY.laneOffset : CITY.laneOffset), west ? -Math.PI / 2 : Math.PI / 2, cols[k]);
        t.driver = 'ai';
        t.ai = west ? makeAi(5, 2, 4, 2) : makeAi(3, 2, 4, 2);
      }
      startMission(STORY[2]);
      crowdAround(x - 30, z, 26, 6, 45);
      cam.yaw = -Math.PI / 2;
      simulateKey('KeyW', true);
    },
    input(i) { simulateKey('KeyW', i < 50); },
    camera() { cam.yaw = -Math.PI / 2 + 0.45; cam.pitch = 0.22; cam.view = 1; },
  },
  map: {
    frames: 30,
    setup() {
      G.storyStep = 1; G.money = 1250;
      const p = G.player;
      p.x = roadAt(2) + 8; p.z = roadAt(4);
      startMission(STORY[1]);
    },
    after() {
      G.mode = 'map';
      document.getElementById('bigMap').classList.remove('hidden');
    },
  },
};

export function runShot(name, api) {
  const sc = SCENES[name] ?? SCENES.chase;
  reseed(42);
  G.camLock = true;
  api.startPlay();
  sc.setup();
  const dt = 1 / 30;
  const realRender = G.renderer.render.bind(G.renderer);
  G.renderer.render = () => {};
  for (let i = 0; i < sc.frames; i++) {
    sc.input?.(i);
    if (i > sc.frames - 25) sc.camera?.();
    api.step(dt);
    api.render(dt);
    mouse.leftPressed = false;
  }
  sc.after?.();
  G.renderer.render = realRender;
  api.render(dt);
  api.render(0.001);
  window.__shotReady = true;
}
