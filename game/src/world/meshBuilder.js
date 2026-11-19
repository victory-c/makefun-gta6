// Accumulates boxes and quads into one BufferGeometry (one draw call per material).
import * as THREE from 'three';

export class MeshBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }

  quad(a, b, c, d, n, uvs, color) {
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) this.pos.push(p[0], p[1], p[2]);
    for (let i = 0; i < 4; i++) { this.nor.push(n[0], n[1], n[2]); this.col.push(color.r, color.g, color.b); }
    this.uv.push(...uvs);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Axis-aligned box. tile = [meters per texture repeat horizontally, vertically].
  box(x0, y0, z0, x1, y1, z1, color, { tile = [4, 4], top = true, sides = true, bottom = false } = {}) {
    const [tw, th] = tile;
    const w = x1 - x0, d = z1 - z0;
    const v0 = y0 / th, v1 = y1 / th;
    if (sides) {
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [0, v0, w / tw, v0, w / tw, v1, 0, v1], color);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [0, v0, w / tw, v0, w / tw, v1, 0, v1], color);
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [0, v0, d / tw, v0, d / tw, v1, 0, v1], color);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [0, v0, d / tw, v0, d / tw, v1, 0, v1], color);
    }
    if (top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0 / tw, z1 / tw, x1 / tw, z1 / tw, x1 / tw, z0 / tw, x0 / tw, z0 / tw], color);
    if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [0, 0, 1, 0, 1, 1, 0, 1], color);
  }

  // Flat horizontal rectangle at height y.
  flat(x0, z0, x1, z1, y, color, tile = 4) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [x0 / tile, z1 / tile, x1 / tile, z1 / tile, x1 / tile, z0 / tile, x0 / tile, z0 / tile], color);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export const col = (hex) => new THREE.Color(hex);

// Merge positioned primitive geometries into one geometry with per-part vertex colours.
// parts: [{ geo, x, y, z, color }] — fewer meshes means fewer draw calls for cars and people.
export function mergeParts(parts) {
  const pos = [], nor = [], colr = [], idx = [];
  let off = 0;
  const c = new THREE.Color();
  for (const p of parts) {
    const gp = p.geo.attributes.position, gn = p.geo.attributes.normal;
    c.set(p.color ?? 0xffffff);
    for (let i = 0; i < gp.count; i++) {
      pos.push(gp.getX(i) + (p.x ?? 0), gp.getY(i) + (p.y ?? 0), gp.getZ(i) + (p.z ?? 0));
      nor.push(gn.getX(i), gn.getY(i), gn.getZ(i));
      colr.push(c.r, c.g, c.b);
    }
    if (p.geo.index) for (let i = 0; i < p.geo.index.count; i++) idx.push(p.geo.index.getX(i) + off);
    else for (let i = 0; i < gp.count; i++) idx.push(i + off);
    off += gp.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
