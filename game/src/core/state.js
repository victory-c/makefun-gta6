// The single shared game state every system reads and writes.
export const G = {
  scene: null,
  camera: null,
  renderer: null,
  time: 0,              // seconds of simulated play
  clock: 18.6,          // in-game hour (golden hour)
  mode: 'menu',         // menu | play | paused | map | dead
  player: null,
  vehicles: [],
  peds: [],
  cops: [],
  colliders: [],        // { x0, z0, x1, z1, h } building footprints
  money: 350,
  wanted: 0,
  wantedHeat: 0,        // fractional build-up toward the next star
  wantedUnseen: 0,
  stats: { kills: 0, carsStolen: 0, missions: 0, races: 0 },
  weapons: { fists: Infinity, pistol: 36, smg: 0, shotgun: 0 },
  weaponIndex: 0,
  unlocks: { smg: false },
  shells: [],
  armor: 0,
  mission: null,        // active mission runtime
  storyStep: 0,
  sideDone: {},
  shot: null,           // screenshot scene name when ?shot= is set
  events: [],           // queued crime events for the police
  shake: 0,
};

export function emit(type, data = {}) {
  G.events.push({ type, ...data });
}
