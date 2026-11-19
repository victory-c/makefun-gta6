// Tunable constants for the city, vehicles and rules of Palmera Bay.
export const CITY = {
  roads: 9,            // road lines per axis (8 x 8 blocks)
  block: 60,           // block size (meters)
  road: 16,            // road width
  sidewalk: 3,
  beachWidth: 46,      // sand strip east of the grid
};
CITY.cell = CITY.block + CITY.road;
CITY.size = (CITY.roads - 1) * CITY.cell;     // distance between the outer roads
CITY.half = CITY.size / 2;
CITY.laneOffset = 3.6;

export const PALETTE = {
  pastel: [0xf2a7b5, 0x9fe0cf, 0xffd29b, 0xf7efe2, 0xb9d7f5, 0xe8b9f0, 0xfff1a8, 0xa8e6a3, 0xf6c1a1],
  glass: [0x5aa6c8, 0x3f86a8, 0x77c0d9, 0x8fb4d6, 0x4c7f9e],
  car: [0xe63946, 0xf1faee, 0x1d3557, 0xffb703, 0x2a9d8f, 0x8338ec, 0xfb5607, 0x222222, 0x06d6a0, 0xd0d0d8, 0xff70a6],
  skin: [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x5c3a1e],
  shirt: [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xffffff, 0xff8fab, 0x2ec4b6, 0xf77f00],
  pants: [0x22223b, 0x4a4e69, 0x9a8c98, 0x3d5a80, 0xc9ada7, 0x2b2d42],
};

// Districts are named by grid quadrant; every name is original to this game.
export const DISTRICTS = [
  { name: 'Coral Heights', x0: -1, x1: -0.33, z0: -1, z1: -0.33 },
  { name: 'Midtown Palms', x0: -0.33, x1: 0.33, z0: -1, z1: -0.33 },
  { name: 'Flamingo Point', x0: 0.33, x1: 1.2, z0: -1, z1: -0.33 },
  { name: 'Little Havenna', x0: -1, x1: -0.33, z0: -0.33, z1: 0.33 },
  { name: 'Downtown Solmar', x0: -0.33, x1: 0.33, z0: -0.33, z1: 0.33 },
  { name: 'Ocean Drive', x0: 0.33, x1: 1.2, z0: -0.33, z1: 0.33 },
  { name: 'Mangrove Docks', x0: -1, x1: -0.33, z0: 0.33, z1: 1 },
  { name: 'Neon Mile', x0: -0.33, x1: 0.33, z0: 0.33, z1: 1 },
  { name: 'Pelican Sands', x0: 0.33, x1: 1.2, z0: 0.33, z1: 1 },
];

export const RULES = {
  maxWanted: 5,
  wantedDecay: 9,        // seconds unseen per star lost
  respawnFee: 250,
  bustFee: 400,
  trafficCount: 26,
  pedCount: 38,
  playerHealth: 100,
};

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', dmg: 18, range: 2.2, rate: 0.45, ammo: Infinity, spread: 0 },
  { id: 'pistol', name: 'PISTOL', dmg: 34, range: 70, rate: 0.28, ammo: 60, spread: 0.02, price: 300 },
  { id: 'smg', name: 'SMG', dmg: 18, range: 60, rate: 0.08, ammo: 0, spread: 0.06, price: 1200 },
  { id: 'shotgun', name: 'SHOTGUN', dmg: 22, range: 30, rate: 0.9, ammo: 0, spread: 0.12, pellets: 7, price: 2000 },
];
