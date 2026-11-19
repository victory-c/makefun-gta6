// Pedestrians: sidewalk walkers who flee from danger, gang members who fight, and police on foot.
import { G, emit } from '../core/state.js';
import { CITY, PALETTE, RULES } from '../config.js';
import { rng, angleDiff } from '../core/rng.js';
import { layout, collideCircle, groundY, blockAt, lineOfSight } from '../world/cityLayout.js';
import { buildHuman, animateHuman } from './characters.js';
import { fx } from '../gameplay/effects.js';
import { sfx } from '../core/audio.js';

const RING_INSET = 1.5;

function ringRect(b) {
  return { x0: b.x0 + RING_INSET, z0: b.z0 + RING_INSET, x1: b.x1 - RING_INSET, z1: b.z1 - RING_INSET };
}
function ringPoint(b, p) {
  const r = ringRect(b), w = r.x1 - r.x0, d = r.z1 - r.z0, P = 2 * (w + d);
  p = ((p % P) + P) % P;
  if (p < w) return { x: r.x0 + p, z: r.z0 };
  if (p < w + d) return { x: r.x1, z: r.z0 + (p - w) };
  if (p < 2 * w + d) return { x: r.x1 - (p - w - d), z: r.z1 };
  return { x: r.x0, z: r.z1 - (p - 2 * w - d) };
}
function ringParam(b, x, z) {
  const r = ringRect(b), w = r.x1 - r.x0, d = r.z1 - r.z0;
  const opts = [
    [Math.abs(z - r.z0), Math.min(Math.max(x - r.x0, 0), w)],
    [Math.abs(x - r.x1), w + Math.min(Math.max(z - r.z0, 0), d)],
    [Math.abs(z - r.z1), w + d + Math.min(Math.max(r.x1 - x, 0), w)],
    [Math.abs(x - r.x0), 2 * w + d + Math.min(Math.max(r.z1 - z, 0), d)],
  ];
  opts.sort((a, c) => a[0] - c[0]);
  return opts[0][1];
}

export class Ped {
  constructor(kind, x, z, opts = {}) {
    this.kind = kind;                 // civ | gang | cop | story
    const look = kind === 'cop'
      ? { skin: rng.pick(PALETTE.skin), shirt: 0x24385b, pants: 0x1b2333, cap: 0x14213d, police: true }
      : kind === 'gang'
        ? { skin: rng.pick(PALETTE.skin), shirt: 0xd4a017, pants: 0x222222, cap: 0xd4a017 }
        : { skin: rng.pick(PALETTE.skin), shirt: rng.pick(PALETTE.shirt), pants: rng.pick(PALETTE.pants), hair: rng.pick([0x2b1d14, 0x5a3a22, 0xe6c27a, 0x111111, 0x8c4a2f]), ...opts.look };
    this.mesh = buildHuman(look);
    G.scene.add(this.mesh);
    this.x = x; this.z = z; this.y = groundY(x, z); this.h = rng.range(0, 6.28);
    this.health = kind === 'cop' ? 90 : kind === 'gang' ? 80 : 50;
    this.state = kind === 'civ' ? 'walk' : 'hostile';
    this.speed = 0; this.timer = 0; this.fire = rng.range(0.5, 1.5);
    this.vx = 0; this.vz = 0;
    this.block = blockAt(x, z);
    this.param = this.block ? ringParam(this.block, x, z) : 0;
    this.dir = rng.chance(0.5) ? 1 : -1;
    this.walkSpeed = rng.range(1.1, 1.7);
    this.armed = kind !== 'civ';
    this.dead = false; this.deadTime = 0;
    this.tag = opts.tag ?? null;
  }

  hurt(amount, fromX, fromZ, byPlayer = true) {
    if (this.dead) return;
    this.health -= amount;
    fx.hit(this.x, this.y + 1.2, this.z);
    if (this.health <= 0) {
      this.dead = true; this.deadTime = G.time; this.state = 'dead';
      if (byPlayer) {
        G.stats.kills++;
        emit(this.kind === 'cop' ? 'cop_killed' : 'ped_killed', { x: this.x, z: this.z, ped: this });
      }
      G.onPedKilled?.(this, byPlayer);
    } else {
      if (this.kind === 'civ') this.flee(fromX, fromZ);
      if (byPlayer) emit(this.kind === 'cop' ? 'cop_hurt' : 'assault', { x: this.x, z: this.z });
    }
  }

  flee(fx_, fz) {
    if (this.dead || this.kind !== 'civ') return;
    this.state = 'flee';
    this.timer = rng.range(6, 10);
    this.h = Math.atan2(this.x - fx_, this.z - fz);
  }

  update(dt) {
    const p = G.player;
    if (this.dead) {
      animateHuman(this.mesh, dt, 0, { down: true });
      this.x += this.vx * dt; this.z += this.vz * dt;
      this.vx *= Math.exp(-4 * dt); this.vz *= Math.exp(-4 * dt);
      this.sync();
      return;
    }
    let moveSpeed = 0, aiming = false;
    if (this.state === 'walk' && this.block) {
      this.param += this.dir * this.walkSpeed * dt;
      const t = ringPoint(this.block, this.param);
      const dx = t.x - this.x, dz = t.z - this.z;
      if (dx * dx + dz * dz > 0.0004) this.h = Math.atan2(dx, dz);
      this.x = t.x; this.z = t.z;
      moveSpeed = this.walkSpeed;
      // step aside for a car on the sidewalk or the player close by
    } else if (this.state === 'flee') {
      this.timer -= dt;
      moveSpeed = 5.2;
      this.x += Math.sin(this.h) * moveSpeed * dt; this.z += Math.cos(this.h) * moveSpeed * dt;
      const c = collideCircle(this.x, this.z, 0.35);
      if (c.hit) { this.h += rng.range(0.6, 1.6); this.x = c.x; this.z = c.z; }
      if (this.timer <= 0) {
        this.block = blockAt(this.x, this.z) ?? nearestBlock(this.x, this.z);
        this.param = ringParam(this.block, this.x, this.z);
        const t = ringPoint(this.block, this.param);
        this.x = t.x; this.z = t.z;
        this.state = 'walk';
      }
    } else if (this.state === 'hostile') {
      const tgt = p.inCar ?? p;
      const dx = tgt.x - this.x, dz = tgt.z - this.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      this.h += angleDiff(this.h, want) * Math.min(1, dt * 6);
      const engage = this.kind === 'gang' ? 40 : 55;
      const seen = d < engage && lineOfSight(this.x, this.z, tgt.x, tgt.z);
      const shoots = this.kind === 'gang' || G.wanted >= 2;
      const keep = shoots ? 10 : 1.2;
      if (d > keep || !seen) {
        moveSpeed = this.kind === 'cop' ? 4.8 : 4.2;
        this.x += Math.sin(this.h) * moveSpeed * dt; this.z += Math.cos(this.h) * moveSpeed * dt;
        const c = collideCircle(this.x, this.z, 0.35);
        if (c.hit) { this.x = c.x + c.nz * 0.05; this.z = c.z - c.nx * 0.05; }
      }
      if (seen && shoots && d < engage && !p.dead) {
        aiming = true;
        this.fire -= dt;
        if (this.fire <= 0) {
          this.fire = this.kind === 'cop' ? rng.range(0.7, 1.2) : rng.range(0.8, 1.4);
          const accuracy = Math.max(0.12, 0.62 - d / 90 - (p.inCar ? Math.abs(p.inCar.speed) / 80 : p.speed / 30));
          const hitIt = rng.next() < accuracy;
          const ox = hitIt ? 0 : rng.range(-2, 2), oz = hitIt ? 0 : rng.range(-2, 2);
          fx.tracer(this.x, this.y + 1.45, this.z, tgt.x + ox, 1.2, tgt.z + oz, this.kind === 'cop' ? 0x9ad0ff : 0xffd27a);
          fx.muzzle(this.x + Math.sin(this.h) * 0.5, this.y + 1.45, this.z + Math.cos(this.h) * 0.5);
          sfx.gun('pistol', this);
          if (hitIt) {
            if (p.inCar) p.inCar.damage(this.kind === 'cop' ? 22 : 18);
            else G.hurtPlayer?.(this.kind === 'cop' ? 7 : 6);
          }
        }
      }
    }
    this.speed = moveSpeed;
    this.y = groundY(this.x, this.z);
    animateHuman(this.mesh, dt, moveSpeed, { aiming });
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.h;
  }

  remove() {
    G.scene.remove(this.mesh);
    const i = G.peds.indexOf(this);
    if (i >= 0) G.peds.splice(i, 1);
  }
}

function nearestBlock(x, z) {
  let best = layout.blocks[0], bd = Infinity;
  for (const b of layout.blocks) {
    const d = Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

export function spawnPed(kind, x, z, opts) {
  const p = new Ped(kind, x, z, opts);
  G.peds.push(p);
  return p;
}

function spawnCivNear(cx, cz, minD, maxD) {
  for (let k = 0; k < 20; k++) {
    const b = rng.pick(layout.blocks);
    const P = 2 * ((b.x1 - b.x0) + (b.z1 - b.z0) - 4 * RING_INSET);
    const t = ringPoint(b, rng.range(0, P));
    const d = Math.hypot(t.x - cx, t.z - cz);
    if (d >= minD && d <= maxD) return spawnPed('civ', t.x, t.z);
  }
  return null;
}

// Beachgoers stroll the sand between the umbrellas.
function spawnBeachgoer(cx, cz) {
  const B = layout.beach;
  const x = rng.range(B.x0 + 8, B.x1 - 10), z = cz + rng.range(-90, 90);
  if (z < B.z0 + 5 || z > B.z1 - 5) return null;
  const p = spawnPed('civ', x, z, { look: { shirt: rng.pick([0xff595e, 0x2ec4b6, 0xffca3a, 0xff8fab]), pants: rng.pick([0x1982c4, 0xff595e, 0xffffff]) } });
  p.block = null; p.state = 'stroll'; p.walkSpeed = rng.range(0.8, 1.3);
  return p;
}

export function populatePeds() {
  const p = G.player;
  for (let k = 0; k < RULES.pedCount; k++) spawnCivNear(p.x, p.z, 8, 110);
}

export function updatePeds(dt) {
  const p = G.player;
  const civs = G.peds.filter((q) => q.kind === 'civ');
  let alive = 0;
  for (const q of civs) if (!q.dead) alive++;
  if (alive < RULES.pedCount) {
    if (p.x > layout.beach.x0 - 70 && rng.chance(0.5)) spawnBeachgoer(p.x, p.z);
    else spawnCivNear(p.x, p.z, 60, 120);
  }
  for (const q of [...G.peds]) {
    if (q.state === 'stroll' && !q.dead) {
      q.x += Math.sin(q.h) * q.walkSpeed * dt; q.z += Math.cos(q.h) * q.walkSpeed * dt;
      if (rng.chance(dt * 0.3) || q.x < layout.beach.x0 + 6 || q.x > layout.beach.x1 - 6) q.h = Math.atan2(layout.beach.x0 + 30 - q.x + rng.range(-20, 20), rng.range(-1, 1));
      q.y = groundY(q.x, q.z);
      animateHuman(q.mesh, dt, q.walkSpeed, {});
      q.sync();
    } else q.update(dt);
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (q.kind === 'civ' && (d > 150 || (q.dead && G.time - q.deadTime > 25 && d > 50))) q.remove();
    if (q.kind === 'cop' && (d > 200 || (q.dead && G.time - q.deadTime > 30))) q.remove();
  }
  hitByVehicles();
}

// Cars that touch people knock them down; a fast car kills.
function hitByVehicles() {
  for (const v of G.vehicles) {
    const sp = Math.hypot(v.vx, v.vz);
    if (sp < 2.5) continue;
    const f = v.forward, r = { x: f.z, z: -f.x };
    for (const q of G.peds) {
      if (q.dead) continue;
      const dx = q.x - v.x, dz = q.z - v.z;
      if (dx * dx + dz * dz > 16) continue;
      const lf = dx * f.x + dz * f.z, lr = dx * r.x + dz * r.z;
      if (Math.abs(lf) < v.spec.len / 2 + 0.35 && Math.abs(lr) < v.spec.w / 2 + 0.35) {
        const byPlayer = v.driver === 'player';
        q.vx = v.vx * 0.8 + Math.sign(lr || 1) * r.x * 2; q.vz = v.vz * 0.8 + Math.sign(lr || 1) * r.z * 2;
        q.hurt(sp > 7 ? 999 : sp * 6, v.x, v.z, byPlayer);
        v.vx *= 0.93; v.vz *= 0.93;
        sfx.punch();
      }
    }
  }
}

export function panic(x, z, radius) {
  for (const q of G.peds) {
    if (q.kind === 'civ' && !q.dead && Math.hypot(q.x - x, q.z - z) < radius) q.flee(x, z);
  }
}

export function ejectDriver(vehicle) {
  const f = vehicle.forward;
  const x = vehicle.x + f.z * (vehicle.spec.w / 2 + 0.9), z = vehicle.z - f.x * (vehicle.spec.w / 2 + 0.9);
  const kind = vehicle.driver === 'cop' ? 'cop' : vehicle.driver === 'gang' ? 'gang' : 'civ';
  const q = spawnPed(kind, x, z);
  if (kind === 'civ') q.flee(vehicle.x, vehicle.z);
  return q;
}
