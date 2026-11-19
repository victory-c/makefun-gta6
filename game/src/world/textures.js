// Procedural canvas textures: facades, sidewalks, sand, asphalt, signs. No image files are loaded.
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Pastel art-deco facade: one floor, two windows with awnings-ish ledges. Tile = 6m x 3.5m.
export function decoFacade() {
  const [c, g] = canvas(256, 160);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#e9e4dc'; g.fillRect(0, 0, 256, 14);              // floor band
  g.fillStyle = '#d8d2c8'; g.fillRect(0, 150, 256, 10);
  for (let i = 0; i < 2; i++) {
    const x = 26 + i * 128;
    const grd = g.createLinearGradient(0, 34, 0, 128);
    grd.addColorStop(0, '#2b4a63'); grd.addColorStop(0.55, '#5f8fb0'); grd.addColorStop(1, '#a9c9dc');
    g.fillStyle = '#c8bfb2'; g.fillRect(x - 6, 30, 88, 104);
    g.fillStyle = grd; g.fillRect(x, 36, 76, 92);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 6, 40, 10, 84);
    g.fillStyle = '#f4efe7'; g.fillRect(x + 36, 36, 4, 92); g.fillRect(x, 80, 76, 4);
    g.fillStyle = '#bdb3a5'; g.fillRect(x - 10, 134, 96, 6);          // sill
  }
  return toTexture(c);
}

// Glass curtain wall with sky reflection gradient. Tile = 4m x 4m.
export function glassFacade() {
  const [c, g] = canvas(128, 128);
  const grd = g.createLinearGradient(0, 0, 128, 128);
  grd.addColorStop(0, '#cfe8f5'); grd.addColorStop(0.45, '#7fb6d6'); grd.addColorStop(1, '#3d6f94');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,240,220,0.18)';
  g.beginPath(); g.moveTo(0, 90); g.lineTo(90, 0); g.lineTo(128, 0); g.lineTo(0, 128); g.fill();
  g.fillStyle = '#dfe6ea';
  g.fillRect(0, 0, 128, 5); g.fillRect(0, 0, 4, 128); g.fillRect(62, 0, 3, 128);
  return toTexture(c);
}

// Small house / shopfront facade. Tile = 5m x 3m.
export function houseFacade() {
  const [c, g] = canvas(160, 96);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 160, 96);
  g.fillStyle = '#ece6dc'; for (let y = 0; y < 96; y += 8) g.fillRect(0, y, 160, 1);
  g.fillStyle = '#e3d9c9'; g.fillRect(48, 20, 64, 52);
  g.fillStyle = '#3b5a70'; g.fillRect(54, 26, 52, 40);
  g.fillStyle = '#86b0c8'; g.fillRect(54, 26, 52, 14);
  g.fillStyle = '#ffffff'; g.fillRect(79, 26, 3, 40);
  g.fillStyle = '#5c8a6e'; g.fillRect(44, 22, 6, 48); g.fillRect(110, 22, 6, 48); // shutters
  return toTexture(c);
}

// Corrugated metal for warehouses. Tile = 4m x 4m.
export function metalFacade() {
  const [c, g] = canvas(128, 128);
  for (let x = 0; x < 128; x += 8) {
    g.fillStyle = '#ffffff'; g.fillRect(x, 0, 5, 128);
    g.fillStyle = '#cfcfcf'; g.fillRect(x + 5, 0, 3, 128);
  }
  g.fillStyle = 'rgba(120,70,40,0.25)'; g.fillRect(0, 110, 128, 18);
  return toTexture(c);
}

function noiseFill(g, w, h, base, spread, seed, count = 4000) {
  const r = makeRng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = Math.floor((r.next() - 0.5) * spread);
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
    g.fillRect(r.next() * w, r.next() * h, 2, 2);
  }
}

export function asphalt() {
  const [c, g] = canvas(256, 256);
  noiseFill(g, 256, 256, '#4a4d52', 60, 7, 9000);
  return toTexture(c);
}

export function sidewalk() {
  const [c, g] = canvas(128, 128);
  noiseFill(g, 128, 128, '#d9d2c5', 30, 3, 1500);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 128; i += 32) { g.fillRect(i, 0, 2, 128); g.fillRect(0, i, 128, 2); }
  return toTexture(c);
}

export function sand() {
  const [c, g] = canvas(256, 256);
  noiseFill(g, 256, 256, '#f0d9a8', 50, 11, 12000);
  return toTexture(c);
}

export function grass() {
  const [c, g] = canvas(128, 128);
  noiseFill(g, 128, 128, '#6fae4f', 70, 5, 5000);
  return toTexture(c);
}

// Text sign: billboards and neon. Returns a texture sized to the text.
export function signTexture(text, { bg = '#111', fg = '#ff4fa3', glow = true, font = 'bold 64px Trebuchet MS, sans-serif', w = 512, h = 128, sub = '' } = {}) {
  const [c, g] = canvas(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font;
  if (glow) { g.shadowColor = fg; g.shadowBlur = 18; }
  g.fillStyle = fg;
  g.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
  if (sub) {
    g.shadowBlur = 0; g.font = `bold ${Math.floor(h * 0.17)}px Trebuchet MS, sans-serif`;
    g.fillStyle = '#ffffff'; g.fillText(sub, w / 2, h * 0.8);
  }
  return toTexture(c, false);
}

// Soft round sprite for particles.
export function softDot() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return toTexture(c, false);
}
