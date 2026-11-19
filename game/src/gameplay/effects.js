// Particle effects (smoke, fire, sparks, explosions, tracers) drawn as one pooled point cloud.
import * as THREE from 'three';
import { softDot } from '../world/textures.js';

const MAX = 2600;
let points, geo, pos, colr, size, alpha;
const parts = [];      // live particles
const free = [];
const tracers = [];
let scene;

export function initEffects(sc) {
  scene = sc;
  geo = new THREE.BufferGeometry();
  pos = new Float32Array(MAX * 3); colr = new Float32Array(MAX * 3); size = new Float32Array(MAX); alpha = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: softDot() }, scale: { value: 600 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
      void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 600.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }`,
    transparent: true, depthWrite: false,
  });
  points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  for (let i = MAX - 1; i >= 0; i--) free.push(i);
  flash(0, -50, 0);
  for (const f of flashes) f.t = 0;
}

function emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a0, gravity = 0, drag = 0.5) {
  if (!free.length) return;
  const i = free.pop();
  parts.push({ i, x, y, z, vx, vy, vz, life, t: 0, s0, s1, r, g, b, a0, gravity, drag });
}

const rnd = (a) => (Math.random() - 0.5) * a;

export const fx = {
  smoke(x, y, z, n = 1) {
    for (let k = 0; k < n; k++) emit(x + rnd(0.4), y, z + rnd(0.4), rnd(0.6), 1.2 + Math.random(), rnd(0.6), 2.5, 0.6, 2.4, 0.35, 0.35, 0.36, 0.55, -0.2);
  },
  tireSmoke(x, z) {
    emit(x + rnd(0.8), 0.3, z + rnd(0.8), rnd(1), 0.5, rnd(1), 1.4, 0.6, 2.2, 0.85, 0.85, 0.85, 0.35, 0);
  },
  fire(x, y, z) {
    emit(x + rnd(1.4), y, z + rnd(1.4), rnd(0.5), 2 + Math.random() * 2, rnd(0.5), 0.7, 1.0, 0.3, 1, 0.55, 0.15, 0.95, 0);
    if (Math.random() < 0.5) emit(x + rnd(1), y + 1, z + rnd(1), rnd(0.4), 2, rnd(0.4), 3, 1, 3.4, 0.12, 0.11, 0.1, 0.6, -0.1);
  },
  sparks(x, y, z, n = 8) {
    for (let k = 0; k < n; k++) emit(x, y, z, rnd(10), Math.random() * 6, rnd(10), 0.4 + Math.random() * 0.3, 0.18, 0.05, 1, 0.85, 0.4, 1, -14, 0.2);
  },
  hit(x, y, z, flesh = true) {
    for (let k = 0; k < 6; k++) emit(x, y, z, rnd(3), Math.random() * 2, rnd(3), 0.35, 0.22, 0.1, flesh ? 0.7 : 0.9, flesh ? 0.05 : 0.8, flesh ? 0.08 : 0.5, 1, -9);
  },
  muzzle(x, y, z) {
    emit(x, y, z, 0, 0, 0, 0.06, 0.6, 0.2, 1, 0.9, 0.5, 1);
  },
  collect(x, y, z) {
    for (let k = 0; k < 24; k++) emit(x, y, z, rnd(5), Math.random() * 5, rnd(5), 0.9, 0.35, 0.05, 1, 0.9, 0.3, 1, -6);
  },
  explosion(x, y, z) {
    for (let k = 0; k < 60; k++) emit(x + rnd(1), y + rnd(1), z + rnd(1), rnd(16), Math.random() * 10, rnd(16), 0.6 + Math.random() * 0.5, 2.2, 0.5, 1, 0.5 + Math.random() * 0.4, 0.1, 1, -2, 2.5);
    for (let k = 0; k < 40; k++) emit(x + rnd(3), y + rnd(2), z + rnd(3), rnd(4), 2 + Math.random() * 4, rnd(4), 3 + Math.random() * 2, 2, 6, 0.15, 0.14, 0.13, 0.7, -0.3, 1.2);
    this.sparks(x, y, z, 30);
    flash(x, y, z);
  },
  tracer(ax, ay, az, bx, by, bz, color = 0xffe08a) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    scene.add(l);
    tracers.push({ l, t: 0.07 });
  },
};

// Two persistent lights reused for blasts (adding lights at run time would recompile shaders).
const flashes = [];
function flash(x, y, z) {
  if (!flashes.length) {
    for (let k = 0; k < 2; k++) {
      const l = new THREE.PointLight(0xffa040, 0, 45, 1.6);
      scene.add(l);
      flashes.push({ l, t: 0 });
    }
  }
  const f = flashes.reduce((a, b) => (a.t < b.t ? a : b));
  f.l.position.set(x, y + 1, z);
  f.t = 0.45;
}

export function updateEffects(dt) {
  for (let k = parts.length - 1; k >= 0; k--) {
    const p = parts[k];
    p.t += dt;
    if (p.t >= p.life) {
      size[p.i] = 0; alpha[p.i] = 0;
      free.push(p.i); parts.splice(k, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    const dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; }
    const u = p.t / p.life;
    pos[p.i * 3] = p.x; pos[p.i * 3 + 1] = p.y; pos[p.i * 3 + 2] = p.z;
    colr[p.i * 3] = p.r; colr[p.i * 3 + 1] = p.g; colr[p.i * 3 + 2] = p.b;
    size[p.i] = p.s0 + (p.s1 - p.s0) * u;
    alpha[p.i] = p.a0 * (1 - u * u);
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  geo.attributes.size.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
  for (let k = tracers.length - 1; k >= 0; k--) {
    tracers[k].t -= dt;
    if (tracers[k].t <= 0) { scene.remove(tracers[k].l); tracers[k].l.geometry.dispose(); tracers.splice(k, 1); }
  }
  for (const f of flashes) {
    f.t = Math.max(0, f.t - dt);
    f.l.intensity = f.t * 400;
  }
}
