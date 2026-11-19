// Vehicle models (all original designs and names), arcade driving physics, damage and explosions.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { collideCircle, groundY } from '../world/cityLayout.js';
import { clamp } from '../core/rng.js';
import { fx } from '../gameplay/effects.js';
import { sfx } from '../core/audio.js';
import { mergeParts } from '../world/meshBuilder.js';
import { softDot } from '../world/textures.js';

let haloTexture = null;
const haloTex = () => (haloTexture ??= softDot());

export const VEHICLE_TYPES = {
  compact: { name: 'Brisa', len: 3.9, w: 1.8, h: 1.45, max: 36, accel: 10, grip: 8, hp: 900, mass: 1 },
  sedan: { name: 'Monarch', len: 4.7, w: 1.95, h: 1.45, max: 42, accel: 11, grip: 8, hp: 1000, mass: 1.1 },
  sports: { name: 'Vespera GT', len: 4.5, w: 2.0, h: 1.2, max: 62, accel: 17, grip: 10, hp: 850, mass: 1 },
  suv: { name: 'Caiman', len: 4.9, w: 2.1, h: 1.85, max: 40, accel: 10, grip: 7, hp: 1300, mass: 1.4 },
  pickup: { name: 'Marlin', len: 5.1, w: 2.05, h: 1.75, max: 40, accel: 10, grip: 7, hp: 1200, mass: 1.3 },
  taxi: { name: 'Coastline Cab', len: 4.7, w: 1.95, h: 1.45, max: 42, accel: 11, grip: 8, hp: 1000, mass: 1.1, color: 0xffc20e },
  police: { name: 'Bay PD Cruiser', len: 4.8, w: 2.0, h: 1.5, max: 54, accel: 15, grip: 9, hp: 1300, mass: 1.2, color: 0x111318 },
  van: { name: 'Bulwark Armored', len: 5.8, w: 2.4, h: 2.6, max: 34, accel: 8, grip: 7, hp: 3200, mass: 2.4, color: 0x5b6770 },
};

const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.2, metalness: 0.5 });
const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
const burntMat = new THREE.MeshStandardMaterial({ color: 0x1c1a19, roughness: 1 });
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12); wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8); rimGeo.rotateZ(Math.PI / 2);
const wheelMerged = mergeParts([{ geo: wheelGeo, color: 0x161616 }, { geo: rimGeo, color: 0xd8d8d8 }]);

function taperedBox(w, h, d, topW, topD, shiftZ) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) { p.setX(i, p.getX(i) * topW); p.setZ(i, p.getZ(i) * topD + shiftZ); }
  }
  g.computeVertexNormals();
  return g;
}

// Per-type merged geometry: paint shell, glass + trim, lamps. Built once, shared by every car of that type.
const geoCache = new Map();
function carGeometry(typeId) {
  if (geoCache.has(typeId)) return geoCache.get(typeId);
  const t = VEHICLE_TYPES[typeId];
  const L = t.len, W = t.w, H = t.h;
  const lowH = H * (typeId === 'van' ? 0.75 : 0.45);
  let cabinLen = L * 0.5, cabinZ = -L * 0.05;
  if (typeId === 'sports') { cabinLen = L * 0.4; cabinZ = -L * 0.08; }
  if (typeId === 'pickup') { cabinLen = L * 0.32; cabinZ = L * 0.08; }
  if (typeId === 'van') { cabinLen = L * 0.25; cabinZ = L * 0.33; }
  const cabH = H - lowH;
  const paint = [
    { geo: taperedBox(W, lowH, L, 0.97, 0.97, 0), y: 0.32 + lowH / 2 },
    { geo: new THREE.BoxGeometry(W * 0.76, 0.06, cabinLen * 0.62), y: 0.32 + H + 0.01, z: cabinZ - (typeId === 'sports' ? 0.3 : 0.05) },
    // hood bulge and side skirts give the silhouette some shape
    { geo: taperedBox(W * 0.8, 0.08, L * 0.28, 0.85, 0.9, 0), y: 0.32 + lowH + 0.03, z: L * 0.3 },
  ];
  if (typeId === 'van') paint.push({ geo: new THREE.BoxGeometry(W, H * 0.25, L * 0.68), y: 0.32 + lowH + H * 0.12, z: -L * 0.15 });
  if (typeId === 'pickup') paint.push({ geo: new THREE.BoxGeometry(W * 0.96, 0.4, L * 0.4), y: 0.32 + lowH + 0.2, z: -L * 0.28 });
  if (typeId === 'sports') paint.push({ geo: new THREE.BoxGeometry(W * 0.9, 0.06, 0.4), y: 0.32 + lowH + 0.35, z: -L / 2 + 0.25 });
  const trim = [
    { geo: taperedBox(W * 0.9, cabH, cabinLen, 0.86, typeId === 'sports' ? 0.55 : 0.75, typeId === 'sports' ? -0.12 : -0.04), y: 0.32 + lowH + cabH / 2, z: cabinZ, color: 0x1b2a38 },
    { geo: new THREE.BoxGeometry(W * 1.01, 0.16, 0.18), y: 0.42, z: L / 2, color: 0x2a2a2a },
    { geo: new THREE.BoxGeometry(W * 1.01, 0.16, 0.18), y: 0.42, z: -L / 2, color: 0x2a2a2a },
    { geo: new THREE.BoxGeometry(W * 1.012, 0.1, L * 0.62), y: 0.38, z: 0, color: 0x222222 },
  ];
  if (typeId === 'sports') trim.push({ geo: new THREE.BoxGeometry(0.08, 0.3, 0.08), y: 0.32 + lowH + 0.18, z: -L / 2 + 0.25, color: 0x222222 });
  if (typeId === 'police') {
    trim.push({ geo: new THREE.BoxGeometry(W * 1.005, lowH * 0.55, L * 0.42), y: 0.32 + lowH * 0.55, z: -L * 0.03, color: 0xf4f4f4 });
    trim.push({ geo: new THREE.BoxGeometry(1.6, 0.08, 0.36), y: 0.32 + H + 0.04, z: cabinZ, color: 0x222222 });
  }
  if (typeId === 'taxi') trim.push({ geo: new THREE.BoxGeometry(W * 1.01, 0.12, L * 0.9), y: 0.32 + lowH * 0.55, z: 0, color: 0x222222 });
  const lamps = [];
  for (const s of [-1, 1]) {
    lamps.push({ geo: new THREE.BoxGeometry(0.42, 0.14, 0.05), x: s * (W / 2 - 0.35), y: 0.32 + lowH * 0.7, z: L / 2 + 0.01, color: 0xfff6dc });
    lamps.push({ geo: new THREE.BoxGeometry(0.4, 0.14, 0.05), x: s * (W / 2 - 0.33), y: 0.32 + lowH * 0.75, z: -L / 2 - 0.01, color: 0xff2020 });
  }
  if (typeId === 'taxi') lamps.push({ geo: new THREE.BoxGeometry(0.8, 0.25, 0.3), y: 0.32 + H + 0.16, z: cabinZ, color: 0xfff1b0 });
  const out = { paint: mergeParts(paint), trim: mergeParts(trim), lamps: mergeParts(lamps), H, cabinZ, L, W };
  geoCache.set(typeId, out);
  return out;
}

export function buildCarMesh(typeId, color) {
  const g = carGeometry(typeId);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.32, metalness: 0.4 });
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; body.add(o); return o; };
  add(g.paint, paint);
  add(g.trim, glassMat);
  add(g.lamps, lampMat).castShadow = false;
  let lightbar = null;
  if (typeId === 'police') {
    const bar = new THREE.BoxGeometry(0.6, 0.16, 0.3);
    const red = new THREE.Mesh(bar, new THREE.MeshBasicMaterial({ color: 0x550000 }));
    const blue = new THREE.Mesh(bar, new THREE.MeshBasicMaterial({ color: 0x001655 }));
    red.position.set(-0.35, 0.32 + g.H + 0.14, g.cabinZ); blue.position.set(0.35, 0.32 + g.H + 0.14, g.cabinZ);
    // additive glow halos make the flashing lights readable from far away
    for (const [m, c] of [[red, 0xff2020], [blue, 0x2a6bff]]) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      halo.scale.setScalar(2.6);
      halo.visible = false;
      m.add(halo);
      m.userData.halo = halo;
    }
    body.add(red, blue);
    lightbar = [red, blue];
  }
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelMerged, wheelMat); tire.castShadow = true;
    w.add(tire);
    w.position.set(sx * (g.W / 2 - 0.12), 0.36, sz * (g.L / 2 - 0.85));
    root.add(w);
    wheels.push(w);
  }
  root.userData = { body, wheels, lightbar, paint };
  return root;
}

export class Vehicle {
  constructor(typeId, x, z, heading, color) {
    const t = VEHICLE_TYPES[typeId];
    this.type = typeId; this.spec = t;
    this.color = color ?? t.color ?? 0xcccccc;
    this.mesh = buildCarMesh(typeId, this.color);
    this.x = x; this.z = z; this.y = 0; this.h = heading;
    this.vx = 0; this.vz = 0; this.speed = 0; this.steer = 0; this.yawRate = 0;
    this.health = t.hp; this.dead = false; this.burn = 0;
    this.driver = null;      // 'player' | 'ai' | 'cop' | 'gang' | null
    this.ai = null;
    this.siren = typeId === 'police';
    this.sirenOn = false;
    this.lastHit = 0;
    this.slip = 0;
    this.radius = t.w / 2;
    G.scene.add(this.mesh);
    this.sync(0);
  }

  get forward() { return { x: Math.sin(this.h), z: Math.cos(this.h) }; }

  // controls: { throttle -1..1, steer -1..1, brake bool (handbrake) }
  drive(dt, c) {
    const t = this.spec;
    const f = this.forward;
    const r = { x: f.z, z: -f.x };
    let fwd = this.vx * f.x + this.vz * f.z;
    let lat = this.vx * r.x + this.vz * r.z;
    if (this.dead) c = { throttle: 0, steer: 0, brake: true };
    const top = t.max * (this.health < t.hp * 0.25 ? 0.6 : 1);
    if (c.throttle > 0) {
      fwd += (fwd < -0.5 ? t.accel * 2.2 : t.accel * (1 - Math.max(0, fwd) / top)) * c.throttle * dt;
    } else if (c.throttle < 0) {
      fwd += (fwd > 0.5 ? -t.accel * 2.2 : -t.accel * 0.6 * (fwd > -top * 0.35 ? 1 : 0)) * -c.throttle * dt;
    }
    fwd -= fwd * (0.18 + (c.throttle === 0 ? 0.35 : 0)) * dt;
    if (c.brake) fwd -= fwd * 1.6 * dt;
    // steering: tighter at low speed, softer at speed
    this.steer += (clamp(c.steer, -1, 1) - this.steer) * Math.min(1, dt * 7);
    const steerAngle = this.steer * (0.62 - Math.min(0.38, Math.abs(fwd) / 90));
    const wheelbase = t.len * 0.62;
    this.yawRate = (fwd / wheelbase) * Math.tan(steerAngle) * (c.brake ? 1.35 : 1);
    this.h += this.yawRate * dt;
    // lateral grip: handbrake lets the rear slide
    const grip = c.brake ? 1.4 : t.grip;
    lat *= Math.exp(-grip * dt);
    this.slip = Math.abs(lat);
    const nf = this.forward, nr = { x: nf.z, z: -nf.x };
    this.vx = nf.x * fwd + nr.x * lat;
    this.vz = nf.z * fwd + nr.z * lat;
    this.speed = fwd;
    this.integrate(dt);
  }

  integrate(dt) {
    this.x += this.vx * dt; this.z += this.vz * dt;
    // two collision circles along the body
    const f = this.forward, off = this.spec.len / 2 - this.radius;
    for (const s of [1, -1]) {
      const cx = this.x + f.x * off * s, cz = this.z + f.z * off * s;
      const res = collideCircle(cx, cz, this.radius);
      if (res.hit) {
        this.x += res.x - cx; this.z += res.z - cz;
        const vn = this.vx * res.nx + this.vz * res.nz;
        if (vn < 0) {
          this.vx -= vn * res.nx * 1.3; this.vz -= vn * res.nz * 1.3;
          this.vx *= 0.92; this.vz *= 0.92;
          this.impact(-vn);
        }
      }
    }
    const gy = groundY(this.x, this.z);
    this.y += (gy - this.y) * Math.min(1, dt * 10);
  }

  impact(v) {
    if (v < 3.5) return;
    this.damage(v * v * 1.2);
    if (G.time - this.lastHit > 0.25) {
      this.lastHit = G.time;
      fx.sparks(this.x, this.y + 0.6, this.z, Math.min(18, v * 1.5));
      sfx.crash(Math.min(1, v / 20), this);
      if (this.driver === 'player') G.shake = Math.min(1, G.shake + v / 25);
    }
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) this.explode();
  }

  explode() {
    this.dead = true; this.health = 0; this.burn = 14;
    this.mesh.traverse((o) => { if (o.isMesh && o.material !== glassMat) o.material = burntMat; });
    fx.explosion(this.x, this.y + 1, this.z);
    sfx.explosion(this);
    G.shake = Math.min(1.5, G.shake + 1.2);
    G.onExplosion?.(this.x, this.z, this);
    this.vx *= 0.3; this.vz *= 0.3;
  }

  sync(dt) {
    const m = this.mesh;
    m.position.set(this.x, this.y, this.z);
    m.rotation.y = this.h;
    const u = m.userData;
    // body lean for feel
    const lean = clamp(-this.yawRate * Math.abs(this.speed) * 0.006, -0.08, 0.08);
    u.body.rotation.z += (lean - u.body.rotation.z) * Math.min(1, dt * 6);
    for (let i = 0; i < 4; i++) {
      const w = u.wheels[i];
      w.children[0].rotation.x += this.speed * dt / 0.36;
      if (i < 2) w.rotation.y = this.steer * 0.5;
    }
    if (u.lightbar) {
      const on = this.sirenOn && Math.floor(G.time * 6) % 2 === 0;
      u.lightbar[0].material.color.setHex(this.sirenOn ? (on ? 0xff2a2a : 0x330000) : 0x550000);
      u.lightbar[1].material.color.setHex(this.sirenOn ? (on ? 0x001133 : 0x2a6bff) : 0x001655);
      u.lightbar[0].userData.halo.visible = this.sirenOn && on;
      u.lightbar[1].userData.halo.visible = this.sirenOn && !on;
    }
    if (this.dead && this.burn > 0) {
      this.burn -= dt;
      if (Math.random() < dt * 12) fx.fire(this.x, this.y + 1.3, this.z);
    } else if (!this.dead && this.health < this.spec.hp * 0.35 && Math.random() < dt * 8) {
      fx.smoke(this.x + this.forward.x * this.spec.len * 0.4, this.y + 1.1, this.z + this.forward.z * this.spec.len * 0.4, 1);
    }
    if (this.slip > 5 && Math.abs(this.speed) > 6 && Math.random() < dt * 30) {
      fx.tireSmoke(this.x - this.forward.x * this.spec.len * 0.35, this.z - this.forward.z * this.spec.len * 0.35);
    }
  }

  remove() {
    G.scene.remove(this.mesh);
    const i = G.vehicles.indexOf(this);
    if (i >= 0) G.vehicles.splice(i, 1);
  }
}

export function spawnVehicle(typeId, x, z, heading, color) {
  const v = new Vehicle(typeId, x, z, heading, color);
  G.vehicles.push(v);
  return v;
}

// Pairwise car-vs-car pushes with a simple momentum exchange.
export function resolveVehicleContacts() {
  const vs = G.vehicles;
  for (let a = 0; a < vs.length; a++) {
    for (let b = a + 1; b < vs.length; b++) {
      const A = vs[a], B = vs[b];
      const dx = B.x - A.x, dz = B.z - A.z;
      const reach = (A.spec.len + B.spec.len) / 2;
      if (dx * dx + dz * dz > reach * reach) continue;
      const fa = A.forward, fb = B.forward;
      const oa = A.spec.len / 2 - A.radius, ob = B.spec.len / 2 - B.radius;
      for (const sa of [1, 0, -1]) for (const sb of [1, 0, -1]) {
        const ax = A.x + fa.x * oa * sa, az = A.z + fa.z * oa * sa;
        const bx = B.x + fb.x * ob * sb, bz = B.z + fb.z * ob * sb;
        let nx = bx - ax, nz = bz - az;
        const d = Math.hypot(nx, nz), min = A.radius + B.radius;
        if (d >= min || d < 1e-4) continue;
        nx /= d; nz /= d;
        const pen = min - d, ma = A.spec.mass, mb = B.spec.mass, tot = ma + mb;
        A.x -= nx * pen * (mb / tot); A.z -= nz * pen * (mb / tot);
        B.x += nx * pen * (ma / tot); B.z += nz * pen * (ma / tot);
        const rel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
        if (rel < 0) {
          const j = -1.4 * rel / tot;
          A.vx -= j * mb * nx; A.vz -= j * mb * nz;
          B.vx += j * ma * nx; B.vz += j * ma * nz;
          A.impact(-rel * 0.8); B.impact(-rel * 0.8);
          G.onCarContact?.(A, B, -rel);
        }
      }
    }
  }
}
