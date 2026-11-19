// Rotating radar minimap and the full-screen island map, both drawn from one pre-rendered city image.
import { G } from '../core/state.js';
import { CITY, DISTRICTS } from '../config.js';
import { layout, roadAt } from '../world/cityLayout.js';
import { blips } from '../gameplay/markers.js';

let base = null, ox = 0, oz = 0;
const PX = 1.2;          // pixels per meter in the base image

function renderBase() {
  const L = layout.land, pad = 60;
  ox = L.x0 - pad; oz = L.z0 - pad;
  const w = Math.ceil((L.x1 - L.x0 + pad * 2 + 40) * PX), h = Math.ceil((L.z1 - L.z0 + pad * 2) * PX);
  base = document.createElement('canvas');
  base.width = w; base.height = h;
  const g = base.getContext('2d');
  const X = (x) => (x - ox) * PX, Z = (z) => (z - oz) * PX;
  g.fillStyle = '#2f7fa6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7fb069'; g.fillRect(X(L.x0), Z(L.z0), (layout.beach.x0 - L.x0) * PX, (L.z1 - L.z0) * PX);
  g.fillStyle = '#f1d9a0'; g.fillRect(X(layout.beach.x0), Z(L.z0), (layout.beach.x1 - layout.beach.x0) * PX, (L.z1 - L.z0) * PX);
  g.fillStyle = '#5d6168';
  const e = CITY.half + CITY.road / 2;
  g.fillRect(X(-e), Z(-e), 2 * e * PX, 2 * e * PX);
  for (const b of layout.blocks) {
    g.fillStyle = b.kind === 'park' ? '#6fae4f' : b.kind === 'residential' ? '#9cc58a' : b.kind === 'docks' ? '#8d8f94' : '#c9c3b8';
    g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * PX, (b.z1 - b.z0) * PX);
  }
  for (const b of layout.buildings) {
    if (b.style === 'none') continue;
    g.fillStyle = b.style === 'glass' ? '#7f9fb3' : b.style === 'container' ? '#9a6b5a' : '#a7a097';
    g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * PX, (b.z1 - b.z0) * PX);
  }
  // pier
  for (const p of layout.props) if (p.type === 'pier') { g.fillStyle = '#a47148'; g.fillRect(X(p.x), Z(p.z - p.w / 2), p.len * PX, p.w * PX); }
  g.strokeStyle = 'rgba(255,215,90,0.55)'; g.lineWidth = 1;
  for (let i = 0; i < CITY.roads; i++) {
    g.beginPath(); g.moveTo(X(roadAt(i)), Z(-e)); g.lineTo(X(roadAt(i)), Z(e)); g.stroke();
    g.beginPath(); g.moveTo(X(-e), Z(roadAt(i))); g.lineTo(X(e), Z(roadAt(i))); g.stroke();
  }
}

const ICON_COL = { story: '#ffd23f', side: '#57e389', gun: '#4fc3f7', spray: '#4fc3f7', safe: '#c77dff', goal: null };

function drawBlip(g, x, y, b, s = 1) {
  g.save();
  g.translate(x, y);
  g.fillStyle = ICON_COL[b.icon] ?? '#' + b.color.toString(16).padStart(6, '0');
  g.strokeStyle = '#111'; g.lineWidth = 2;
  g.beginPath();
  if (b.icon === 'goal') { g.arc(0, 0, 6 * s, 0, Math.PI * 2); }
  else if (b.icon === 'safe') { g.rect(-5 * s, -5 * s, 10 * s, 10 * s); }
  else { g.moveTo(0, -7 * s); g.lineTo(6 * s, 0); g.lineTo(0, 7 * s); g.lineTo(-6 * s, 0); g.closePath(); }
  g.fill(); g.stroke();
  g.restore();
}

function drawArrow(g, x, y, rot, s = 1) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -9 * s); g.lineTo(6 * s, 7 * s); g.lineTo(0, 3 * s); g.lineTo(-6 * s, 7 * s); g.closePath();
  g.fill(); g.stroke(); g.restore();
}

function dynamicDots(g, toScreen) {
  const p = G.player;
  for (const v of G.vehicles) {
    if (v.type === 'police' && v.driver === 'cop') {
      const [sx, sy] = toScreen(v.x, v.z);
      g.fillStyle = Math.floor(G.time * 5) % 2 ? '#ff3030' : '#3060ff';
      g.beginPath(); g.arc(sx, sy, 4.5, 0, Math.PI * 2); g.fill();
    } else if (v.mission) {
      const [sx, sy] = toScreen(v.x, v.z);
      g.fillStyle = '#ff4f4f'; g.fillRect(sx - 5, sy - 5, 10, 10);
    }
  }
  for (const q of G.peds) {
    if (q.dead || (q.kind !== 'gang' && q.kind !== 'cop')) continue;
    const [sx, sy] = toScreen(q.x, q.z);
    g.fillStyle = q.kind === 'gang' ? '#ff4f4f' : '#5a8cff';
    g.beginPath(); g.arc(sx, sy, 3, 0, Math.PI * 2); g.fill();
  }
  void p;
}

export function drawMinimap(canvas, yaw) {
  if (!base) renderBase();
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, R = W / 2;
  const p = G.player;
  const zoom = p.inCar ? 0.75 + Math.max(0, 0.3 - Math.abs(p.inCar.speed) / 120) : 1.15;
  g.save();
  g.clearRect(0, 0, W, H);
  g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#2f7fa6'; g.fillRect(0, 0, W, H);
  g.translate(R, R);
  g.rotate(yaw - Math.PI);
  g.scale(zoom, zoom);
  g.drawImage(base, -(p.x - ox) * PX, -(p.z - oz) * PX);
  g.restore();
  const rot = yaw - Math.PI, c = Math.cos(rot), s = Math.sin(rot);
  const toScreen = (x, z) => {
    const dx = (x - p.x) * PX * zoom, dz = (z - p.z) * PX * zoom;
    return [R + dx * c - dz * s, R + dx * s + dz * c];
  };
  g.save();
  g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip();
  dynamicDots(g, toScreen);
  g.restore();
  for (const b of blips()) {
    let [sx, sy] = toScreen(b.x, b.z);
    const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy);
    if (d > R - 12) { sx = R + dx / d * (R - 12); sy = R + dy / d * (R - 12); }
    drawBlip(g, sx, sy, b, 0.9);
  }
  // north marker
  const [nx, ny] = (() => { const v = [R + 0 * c - (-1) * s * (R - 14), R + 0 * s + (-1) * c * (R - 14)]; return v; })();
  g.fillStyle = '#fff'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny);
  const heading = p.inCar ? p.inCar.h : p.h;
  drawArrow(g, R, R, yaw - heading);
  // wanted ring
  if (G.wanted > 0) {
    g.strokeStyle = Math.floor(G.time * 4) % 2 ? 'rgba(255,40,40,0.9)' : 'rgba(60,90,255,0.9)';
    g.lineWidth = 5; g.beginPath(); g.arc(R, R, R - 3, 0, Math.PI * 2); g.stroke();
  }
}

export function drawBigMap(canvas) {
  if (!base) renderBase();
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const k = Math.min(W / base.width, H / base.height);
  g.fillStyle = '#2f7fa6'; g.fillRect(0, 0, W, H);
  const offX = (W - base.width * k) / 2, offY = (H - base.height * k) / 2;
  g.drawImage(base, offX, offY, base.width * k, base.height * k);
  const toScreen = (x, z) => [offX + (x - ox) * PX * k, offY + (z - oz) * PX * k];
  // district names
  g.textAlign = 'center';
  g.font = 'italic bold 15px Georgia, serif';
  for (const d of DISTRICTS) {
    const [sx, sy] = toScreen(((d.x0 + Math.min(d.x1, 1)) / 2) * CITY.half, ((d.z0 + d.z1) / 2) * CITY.half);
    g.lineWidth = 4; g.strokeStyle = 'rgba(40,10,40,0.8)'; g.strokeText(d.name, sx, sy);
    g.fillStyle = '#ffe0f0'; g.fillText(d.name, sx, sy);
  }
  const [bx, by] = toScreen((layout.beach.x0 + layout.beach.x1) / 2, 0);
  g.save(); g.translate(bx, by); g.rotate(Math.PI / 2);
  g.strokeText('FLAMINGO · PELICAN SANDS BEACH', 0, 0); g.fillText('FLAMINGO · PELICAN SANDS BEACH', 0, 0);
  g.restore();
  g.font = 'bold 26px Arial Black, Impact, sans-serif';
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 5;
  g.strokeText('PALMERA BAY', W / 2, 34); g.fillText('PALMERA BAY', W / 2, 34);
  g.font = 'bold 12px Arial'; g.textAlign = 'center';
  for (const b of blips()) {
    const [sx, sy] = toScreen(b.x, b.z);
    drawBlip(g, sx, sy, b, 1.1);
    if (b.label) { g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText(b.label, sx, sy - 12); g.fillText(b.label, sx, sy - 12); }
  }
  dynamicDots(g, toScreen);
  const p = G.player;
  const [px, py] = toScreen(p.x, p.z);
  drawArrow(g, px, py, Math.PI - (p.inCar ? p.inCar.h : p.h), 1.3);
}
