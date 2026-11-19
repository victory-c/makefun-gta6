// Glowing world markers (mission destinations, shops, pickups) and the blips the minimap draws.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { groundY } from '../world/cityLayout.js';

const markers = new Map();
const ringGeo = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
const gemGeo = new THREE.OctahedronGeometry(0.55);

export function addMarker(id, x, z, { color = 0xffd23f, radius = 2.2, height = 2.4, blip = true, label = '', icon = 'dot', gem = true } = {}) {
  removeMarker(id);
  const g = new THREE.Group();
  const col = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
  col.scale.set(radius, height, radius);
  col.position.y = height / 2;
  g.add(col);
  let gm = null;
  if (gem) {
    gm = new THREE.Mesh(gemGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    gm.position.y = height + 1.2;
    g.add(gm);
  }
  g.position.set(x, groundY(x, z) + 0.02, z);
  G.scene.add(g);
  const m = { id, x, z, radius, color, blip, label, icon, mesh: g, gem: gm };
  markers.set(id, m);
  return m;
}

export function removeMarker(id) {
  const m = markers.get(id);
  if (!m) return;
  G.scene.remove(m.mesh);
  markers.delete(id);
}

export function clearMarkers(prefix) {
  for (const id of [...markers.keys()]) if (id.startsWith(prefix)) removeMarker(id);
}

export function insideMarker(id, extra = 0) {
  const m = markers.get(id);
  if (!m) return false;
  const p = G.player;
  return Math.hypot(p.x - m.x, p.z - m.z) < m.radius + extra;
}

export const getMarker = (id) => markers.get(id);

export function moveMarker(id, x, z) {
  const m = markers.get(id);
  if (!m) return;
  m.x = x; m.z = z;
  m.mesh.position.set(x, groundY(x, z) + 0.02, z);
}

export function updateMarkers(dt) {
  for (const m of markers.values()) {
    if (m.gem) { m.gem.rotation.y += dt * 2; m.gem.position.y = m.mesh.children[0].scale.y + 1.2 + Math.sin(G.time * 3) * 0.25; }
  }
}

// Every blip the minimap and the big map draw this frame.
export function blips() {
  const out = [];
  for (const m of markers.values()) if (m.blip) out.push({ x: m.x, z: m.z, color: m.color, icon: m.icon, label: m.label });
  return out;
}
