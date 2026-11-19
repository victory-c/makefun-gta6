// Palmera Bay: Sunset Heat — boot, world setup, the main loop and death / arrest handling.
import * as THREE from 'three';
import { G } from './core/state.js';
import { initInput, endFrame, hit, mouse } from './core/input.js';
import { initAudio, updateAudio } from './core/audio.js';
import { cam, updateCamera, snapCamera } from './core/cameraRig.js';
import { saveGame } from './core/save.js';
import { RULES } from './config.js';
import { generateLayout, layout } from './world/cityLayout.js';
import { buildCityMeshes } from './world/cityBuilder.js';
import { buildSky, updateSky } from './world/sky.js';
import { createPlayer, updatePlayer, hurtPlayer, nearbyCarPrompt, exitVehicle } from './actors/player.js';
import { spawnVehicle, resolveVehicleContacts } from './actors/vehicles.js';
import { populateTraffic, updateTraffic } from './actors/traffic.js';
import { populatePeds, updatePeds } from './actors/pedestrians.js';
import { updatePolice, clearWanted, resetPolice } from './actors/police.js';
import { initEffects, updateEffects } from './gameplay/effects.js';
import { updateWeapons } from './gameplay/weapons.js';
import { updateMarkers } from './gameplay/markers.js';
import { updateMissions, onPlayerDown } from './gameplay/missionRunner.js';
import { placeShells, updateShells } from './gameplay/sideJobs.js';
import { placeShops, updateShops } from './gameplay/shops.js';
import { hud, updateHud } from './ui/hud.js';
import { showTitle, showPause, hideMenu } from './ui/menu.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);
G.shot = params.get('shot');

function initRenderer() {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!G.shot });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.setSize(innerWidth, innerHeight, false);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.12;
  G.renderer = r;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 2400);
  addEventListener('resize', () => {
    r.setSize(innerWidth, innerHeight, false);
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
  });
}

function parkedCars() {
  const P = layout.pois;
  spawnVehicle('sports', P.safehouse.x + 6, P.safehouse.z + 4.5, Math.PI / 2, 0xff4fa3);
  spawnVehicle('taxi', P.taxi.x, P.taxi.z + 6, 0);
  spawnVehicle('compact', P.ramon.x + 4.5, P.ramon.z + 8, 0, 0x2ec4b6);
  for (const v of G.vehicles) v.parked = true;
}

function buildWorld() {
  initRenderer();
  initInput(canvas);
  generateLayout(7);
  buildSky(G.scene, G.renderer);
  buildCityMeshes(G.scene);
  initEffects(G.scene);
  const s = layout.pois.safehouse;
  createPlayer(s.x, s.z - 1);
  parkedCars();
  populateTraffic();
  populatePeds();
  placeShops();
  placeShells();
  G.hurtPlayer = hurtPlayer;
  G.onPlayerDeath = playerDown;
  const stations = ['WAVE 104.2 — Radio Palmera', 'WAVE 104.2 — synth hits from the Suncoast', 'WAVE 104.2 — sunset drive mix'];
  G.onEnterVehicle = (v) => {
    hud.toast(`${v.spec.name}  ·  ♪ ${stations[Math.floor(G.time) % stations.length]}`);
  };
  G.onCarContact = (a, b, power) => {
    const pc = G.player.inCar;
    if (!pc || power < 4) return;
    const other = a === pc ? b : b === pc ? a : null;
    if (other && other.type === 'police' && other.driver === 'cop') G.events.push({ type: 'ram_cop', x: other.x, z: other.z });
  };
  G.onExplosion = (x, z, src) => {
    for (const q of G.peds) {
      const d = Math.hypot(q.x - x, q.z - z);
      if (d < 7) q.hurt(120 * (1 - d / 7), x, z, src.driver === 'player' || src.lastShotByPlayer);
    }
    for (const v of G.vehicles) if (v !== src && Math.hypot(v.x - x, v.z - z) < 6) v.damage(400);
    const p = G.player;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < 8 && !p.inCar) hurtPlayer(70 * (1 - d / 8));
  };
}

// WASTED / BUSTED: slow motion, then respawn at the hospital or the precinct.
let downTimer = 0, downKind = '';
function playerDown(kind) {
  if (downTimer > 0) return;
  downKind = kind; downTimer = 3.2;
  G.player.dead = kind === 'wasted';
  hud.big(kind === 'wasted' ? 'WASTED' : 'BUSTED', kind === 'wasted' ? 'Mercy Palms will patch you up' : 'Bay PD keeps the change', kind === 'wasted' ? '#ff4f4f' : '#5a8cff', 3);
  canvas.classList.add('dead');
  onPlayerDown();
  G.deathCam = true;
}
function respawn() {
  const p = G.player;
  if (p.inCar) exitVehicle();
  const at = downKind === 'wasted' ? layout.pois.hospital : layout.pois.police;
  const fee = downKind === 'wasted' ? RULES.respawnFee : RULES.bustFee;
  G.money = Math.max(0, G.money - fee);
  p.x = at.x; p.z = at.z; p.dead = false; p.health = 100; p.y = 0.2;
  p.mesh.userData.body.rotation.x = 0;
  if (downKind === 'busted') { G.weapons.pistol = Math.min(G.weapons.pistol, 12); G.weapons.smg = 0; G.weapons.shotgun = 0; }
  clearWanted(); resetPolice();
  for (const q of [...G.peds]) if (q.kind === 'cop') q.remove();
  G.deathCam = false;
  canvas.classList.remove('dead');
  hud.toast(`-${fee}$ ${downKind === 'wasted' ? 'hospital bill' : 'bail'}`);
  snapCamera();
  saveGame();
}

let clockAcc = 0;
function step(dt) {
  G.time += dt;
  clockAcc += dt;
  G.clock = 18.5 + ((clockAcc / 60) % 2);  // golden hour loops 18:30-20:30
  if (G.mode === 'play') {
    updatePlayer(dt, cam.yaw);
    updateWeapons(dt);
    updateMissions(dt);
    updateShops();
    updateShells();
    const cp = nearbyCarPrompt();
    if (cp) hud.prompt(cp);
  }
  updateTraffic(dt);
  updatePolice(dt);
  resolveVehicleContacts();
  for (const v of G.vehicles) v.sync(dt);
  updatePeds(dt);
  updateMarkers(dt);
  updateEffects(dt);
  if (downTimer > 0) { downTimer -= dt; if (downTimer <= 0) respawn(); }
}

function render(dt) {
  const p = G.player;
  if (G.mode === 'menu') {
    // slow orbit over downtown for the title screen
    const a = G.time * 0.05;
    G.camera.position.set(Math.sin(a) * 260, 95, Math.cos(a) * 260);
    G.camera.lookAt(60, 10, 0);
    updateSky(dt, { x: 0, z: 0 }, G.camera);
  } else {
    updateCamera(dt);
    updateSky(dt, p.inCar ?? p, G.camera);
    updateHud(dt, cam.yaw);
    const pc = p.inCar;
    updateAudio(dt, { engineRpm: pc ? Math.min(1, Math.abs(pc.speed) / pc.spec.max) : 0, inCar: !!pc, sirenLevel: G.sirenLevel ?? 0 });
  }
  G.renderer.render(G.scene, G.camera);
}

function startPlay() {
  hideMenu();
  hud.show(true);
  G.mode = 'play';
  initAudio();
  snapCamera();
  if (G.storyStep === 0) {
    hud.say('Mari', 'Palmera Bay. Six years and it still smells like sunscreen and gasoline.', 4);
    hud.say('Mari', "Tío Ramón's café first — the yellow marker on the radar.", 4, 4.2);
  }
  canvas.requestPointerLock?.();
}

let last = performance.now();
function frame(now) {
  if (G.externalSim) { requestAnimationFrame(frame); return; }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.mode === 'play' || G.mode === 'menu') {
    if (G.mode === 'play' && G.player.dead) step(dt * 0.35); else step(dt);
    if (G.mode === 'play') {
      if (hit('KeyM')) { G.mode = 'map'; document.getElementById('bigMap').classList.remove('hidden'); }
      else if (hit('Escape') || hit('KeyP')) pause();
    }
  } else if (G.mode === 'map') {
    if (hit('KeyM') || hit('Escape')) { G.mode = 'play'; document.getElementById('bigMap').classList.add('hidden'); }
  }
  render(dt);
  endFrame();
  requestAnimationFrame(frame);
}

function pause() {
  document.exitPointerLock?.();
  showPause(() => { hideMenu(); G.mode = 'play'; canvas.requestPointerLock?.(); }, () => { saveGame(); location.reload(); });
}
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && G.mode === 'play' && !G.shot) pause();
});

buildWorld();
if (G.shot) {
  runShot(G.shot, { step, render, startPlay: () => { hideMenu(); hud.show(true); G.mode = 'play'; snapCamera(); } });
} else {
  showTitle(startPlay);
  requestAnimationFrame(frame);
}
window.__G = G;
window.__pois = layout.pois;
// test hook: advance the simulation without rendering (used by automated play-tests)
window.__sim = (n = 30, dt = 1 / 30) => {
  G.externalSim = true;
  for (let i = 0; i < n; i++) { step(dt); updateCamera(dt); endFrame(); }
  return G.time;
};
void mouse;
