// Turns the city layout into three.js meshes: ground, blocks, buildings, markings, palms, signs, beach.
import * as THREE from 'three';
import { CITY } from '../config.js';
import { layout, roadAt } from './cityLayout.js';
import { MeshBuilder, col } from './meshBuilder.js';
import * as TX from './textures.js';

const shadowy = (m, cast = true, receive = true) => { m.castShadow = cast; m.receiveShadow = receive; return m; };

export function buildCityMeshes(scene) {
  const L = layout.land, B = layout.beach;
  const tex = {
    deco: TX.decoFacade(), glass: TX.glassFacade(), house: TX.houseFacade(), metal: TX.metalFacade(),
    asphalt: TX.asphalt(), walk: TX.sidewalk(), sand: TX.sand(), grass: TX.grass(),
  };

  // --- ground: asphalt, grass border, sand, sea wall
  const ground = new MeshBuilder();
  ground.flat(L.x0, L.z0, B.x0, L.z1, 0, col(0xffffff), 10);
  const groundMesh = shadowy(new THREE.Mesh(ground.build(), new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.95 })), false);
  scene.add(groundMesh);

  const green = new MeshBuilder();
  const e = CITY.half + CITY.road / 2;
  green.box(L.x0, -3, L.z0, B.x0, 0.06, -e, col(0xffffff), { tile: [6, 6] });
  green.box(L.x0, -3, e, B.x0, 0.06, L.z1, col(0xffffff), { tile: [6, 6] });
  green.box(L.x0, -3, -e, -e, 0.06, e, col(0xffffff), { tile: [6, 6] });
  scene.add(shadowy(new THREE.Mesh(green.build(), new THREE.MeshStandardMaterial({ map: tex.grass, vertexColors: true, roughness: 1 })), false));

  const sandB = new MeshBuilder();
  sandB.flat(B.x0, B.z0, B.x1, B.z1, 0.12, col(0xffffff), 8);
  sandB.quad([B.x1, 0.12, B.z1], [B.x1, 0.12, B.z0], [B.x1 + 26, -2.4, B.z0], [B.x1 + 26, -2.4, B.z1], [0.1, 1, 0], [0, 0, 60, 0, 60, 4, 0, 4], col(0xf3e2bd));
  for (const z of [B.z0, B.z1]) sandB.box(B.x0, -3, z - 0.01, B.x1, 0.11, z + 0.01, col(0xe8d3a5), { top: false });
  scene.add(shadowy(new THREE.Mesh(sandB.build(), new THREE.MeshStandardMaterial({ map: tex.sand, vertexColors: true, roughness: 1 })), false));

  // --- blocks: raised sidewalks, grass lots
  const walk = new MeshBuilder(), lots = new MeshBuilder();
  for (const b of layout.blocks) {
    walk.box(b.x0, 0, b.z0, b.x1, 0.2, b.z1, col(0xffffff), { tile: [3, 3] });
    if (b.grass) lots.box(b.x0 + CITY.sidewalk, 0.2, b.z0 + CITY.sidewalk, b.x1 - CITY.sidewalk, 0.26, b.z1 - CITY.sidewalk, col(0xffffff), { tile: [6, 6] });
    else if (b.kind === 'docks') lots.box(b.x0 + CITY.sidewalk, 0.2, b.z0 + CITY.sidewalk, b.x1 - CITY.sidewalk, 0.22, b.z1 - CITY.sidewalk, col(0x8a8a8a), { tile: [6, 6] });
  }
  scene.add(shadowy(new THREE.Mesh(walk.build(), new THREE.MeshStandardMaterial({ map: tex.walk, vertexColors: true, roughness: 0.9 })), false));
  scene.add(shadowy(new THREE.Mesh(lots.build(), new THREE.MeshStandardMaterial({ map: tex.grass, vertexColors: true, roughness: 1 })), false));

  buildMarkings(scene);
  buildBuildings(scene, tex);
  buildPalms(scene);
  buildStreetLights(scene);
  buildSigns(scene);
  buildBeachProps(scene);
}

function buildMarkings(scene) {
  const mb = new MeshBuilder();
  const yellow = col(0xf2c230), white = col(0xf4f4f4);
  const y = 0.025, half = CITY.road / 2;
  for (let line = 0; line < CITY.roads; line++) {
    const c = roadAt(line);
    for (let s = 0; s < CITY.roads - 1; s++) {
      const a = roadAt(s) + half, b = roadAt(s + 1) - half;
      // roads running along x (z = c) and along z (x = c)
      mb.flat(a, c - 0.28, b, c - 0.14, y, yellow); mb.flat(a, c + 0.14, b, c + 0.28, y, yellow);
      mb.flat(c - 0.28, a, c - 0.14, b, y, yellow); mb.flat(c + 0.14, a, c + 0.28, b, y, yellow);
      for (const o of [-half + 0.7, half - 0.85]) {
        mb.flat(a, c + o, b, c + o + 0.15, y, white);
        mb.flat(c + o, a, c + o + 0.15, b, y, white);
      }
      // crosswalks at both ends
      for (let k = -half + 1; k < half - 1; k += 1.3) {
        mb.flat(a + 0.4, c + k, a + 3.2, c + k + 0.65, y, white);
        mb.flat(b - 3.2, c + k, b - 0.4, c + k + 0.65, y, white);
        mb.flat(c + k, a + 0.4, c + k + 0.65, a + 3.2, y, white);
        mb.flat(c + k, b - 3.2, c + k + 0.65, b - 0.4, y, white);
      }
    }
  }
  const m = new THREE.Mesh(mb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.receiveShadow = true;
  scene.add(m);
}

function shade(hex, f) { return col(hex).multiplyScalar(f); }

function pitchedRoof(mb, b, color) {
  const y = b.h, rh = Math.min(3, (b.z1 - b.z0) * 0.35), zm = (b.z0 + b.z1) / 2, d = b.z1 - b.z0;
  const ov = 0.5, x0 = b.x0 - ov, x1 = b.x1 + ov, z0 = b.z0 - ov, z1 = b.z1 + ov;
  const n1 = new THREE.Vector3(0, d / 2, rh).normalize(), n2 = new THREE.Vector3(0, d / 2, -rh).normalize();
  mb.quad([x0, y, z1], [x1, y, z1], [x1, y + rh, zm], [x0, y + rh, zm], [n1.x, n1.y, n1.z], [0, 0, 1, 0, 1, 1, 0, 1], color);
  mb.quad([x1, y, z0], [x0, y, z0], [x0, y + rh, zm], [x1, y + rh, zm], [n2.x, n2.y, n2.z], [0, 0, 1, 0, 1, 1, 0, 1], color);
  const g = col(0xf3ece0);
  mb.quad([b.x1, y, b.z1], [b.x1, y, b.z0], [b.x1, y + rh, zm], [b.x1, y + rh, zm], [1, 0, 0], [0, 0, 1, 0, 1, 1, 1, 1], g);
  mb.quad([b.x0, y, b.z0], [b.x0, y, b.z1], [b.x0, y + rh, zm], [b.x0, y + rh, zm], [-1, 0, 0], [0, 0, 1, 0, 1, 1, 1, 1], g);
}

function buildBuildings(scene, tex) {
  const walls = { deco: new MeshBuilder(), glass: new MeshBuilder(), house: new MeshBuilder(), metal: new MeshBuilder() };
  const tiles = { deco: [6, 3.5], glass: [4, 4], house: [5, 3], metal: [4, 4] };
  const roofs = new MeshBuilder();
  const containers = new MeshBuilder();
  let n = 0;
  for (const b of layout.buildings) {
    n++;
    if (b.style === 'none') continue;
    if (b.style === 'container') {
      const c = col(b.color);
      for (let y = 0; y < b.h - 0.1; y += 2.6) containers.box(b.x0, 0.2 + y, b.z0, b.x1, 0.2 + y + 2.55, b.z1, c, { tile: [3, 2.6] });
      continue;
    }
    const style = b.style;
    walls[style].box(b.x0, 0.2, b.z0, b.x1, b.h, b.z1, col(b.color), { tile: tiles[style], top: false });
    const roofCol = style === 'glass' ? col(0x9aa3ab) : style === 'metal' ? shade(b.color, 0.8) : col(0xd9d4cb);
    if (style === 'house' && !b.flatRoof) {
      roofs.box(b.x0, b.h - 0.01, b.z0, b.x1, b.h, b.z1, roofCol, { sides: false });
      pitchedRoof(roofs, b, col([0xc8553d, 0xb5838d, 0x6d6875, 0xe76f51][n % 4]));
    } else {
      roofs.box(b.x0, b.h - 0.01, b.z0, b.x1, b.h, b.z1, roofCol, { sides: false });
      // white art-deco cornice / parapet
      const p = style === 'glass' ? 0.2 : 0.35;
      const trim = style === 'glass' ? col(0xe7eef2) : style === 'metal' ? shade(b.color, 0.7) : col(0xfbf7f0);
      roofs.box(b.x0 - p, b.h, b.z0 - p, b.x1 + p, b.h + 0.9, b.z0 + 0.4, trim, { tile: [4, 4] });
      roofs.box(b.x0 - p, b.h, b.z1 - 0.4, b.x1 + p, b.h + 0.9, b.z1 + p, trim, { tile: [4, 4] });
      roofs.box(b.x0 - p, b.h, b.z0, b.x0 + 0.4, b.h + 0.9, b.z1, trim, { tile: [4, 4] });
      roofs.box(b.x1 - 0.4, b.h, b.z0, b.x1 + p, b.h + 0.9, b.z1, trim, { tile: [4, 4] });
      if (b.deco) {
        // stepped deco crown and a coloured stripe
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, w = (b.x1 - b.x0) * 0.3, d = (b.z1 - b.z0) * 0.3;
        roofs.box(cx - w, b.h, cz - d, cx + w, b.h + 3, cz + d, col(b.color), { tile: [4, 4] });
        roofs.box(cx - w * 0.5, b.h + 3, cz - d * 0.5, cx + w * 0.5, b.h + 5, cz + d * 0.5, trim, { tile: [4, 4] });
        roofs.box(b.x0 - 0.12, 4.2, b.z0 - 0.12, b.x1 + 0.12, 4.7, b.z1 + 0.12, shade(b.color, 0.75), { top: false });
      }
      if (b.crown) {
        const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, s = (b.x1 - b.x0) * 0.32;
        roofs.box(cx - s, b.h, cz - s, cx + s, b.h + 6, cz + s, col(0xdfe7ec), { tile: [4, 4] });
        roofs.box(cx - 0.3, b.h + 6, cz - 0.3, cx + 0.3, b.h + 20, cz + 0.3, col(0xcccccc));
      }
      if (b.h > 10 && style !== 'glass') {
        for (let k = 0; k < 2; k++) {
          const ax = b.x0 + 2 + ((n * 7 + k * 13) % 10) / 10 * (b.x1 - b.x0 - 5), az = b.z0 + 2 + ((n * 3 + k * 5) % 10) / 10 * (b.z1 - b.z0 - 5);
          roofs.box(ax, b.h, az, ax + 1.6, b.h + 1.2, az + 1.2, col(0xb8b8b8));
        }
      }
    }
  }
  const mats = {
    deco: new THREE.MeshStandardMaterial({ map: tex.deco, vertexColors: true, roughness: 0.75 }),
    glass: new THREE.MeshStandardMaterial({ map: tex.glass, vertexColors: true, roughness: 0.25, metalness: 0.15 }),
    house: new THREE.MeshStandardMaterial({ map: tex.house, vertexColors: true, roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ map: tex.metal, vertexColors: true, roughness: 0.6, metalness: 0.2 }),
  };
  for (const k of Object.keys(walls)) scene.add(shadowy(new THREE.Mesh(walls[k].build(), mats[k])));
  scene.add(shadowy(new THREE.Mesh(roofs.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }))));
  scene.add(shadowy(new THREE.Mesh(containers.build(), new THREE.MeshStandardMaterial({ map: tex.metal, vertexColors: true, roughness: 0.6 }))));
}

// One bent trunk and one crown of drooping fronds, instanced over every palm in the layout.
function palmGeometries() {
  const trunk = new THREE.CylinderGeometry(0.17, 0.3, 9, 7, 8);
  trunk.translate(0, 4.5, 0);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.pow(y / 9, 2) * 1.3); }
  trunk.computeVertexNormals();
  const pos = [], idx = [];
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const segs = 5, len = 4.2;
    const base = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, r = t * len, y = Math.sin(t * Math.PI * 0.6) * 1.2 - t * t * 2.4;
      const w = Math.sin(t * Math.PI) * 0.75 + 0.05;
      pos.push(1.3 + ca * r - sa * w, 9 + y, sa * r + ca * w);
      pos.push(1.3 + ca * r + sa * w, 9 + y - 0.15, sa * r - ca * w);
    }
    for (let s = 0; s < segs; s++) {
      const q = base + s * 2;
      idx.push(q, q + 1, q + 3, q, q + 3, q + 2);
    }
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  crown.setIndex(idx);
  crown.computeVertexNormals();
  return { trunk, crown };
}

function buildPalms(scene) {
  const { trunk, crown } = palmGeometries();
  const n = layout.palms.length;
  const tMesh = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x9c7a54, roughness: 1 }), n);
  const cMesh = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const tint = new THREE.Color();
  layout.palms.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.399) % (Math.PI * 2));
    s.setScalar(p.s);
    m.compose(v.set(p.x, 0.2, p.z), q, s);
    tMesh.setMatrixAt(i, m); cMesh.setMatrixAt(i, m);
    cMesh.setColorAt(i, tint.setHSL(0.27 + (i % 7) * 0.012, 0.5, 0.32 + (i % 5) * 0.03));
  });
  shadowy(tMesh); shadowy(cMesh, true, false);
  scene.add(tMesh, cMesh);
}

function buildStreetLights(scene) {
  const g = new THREE.BoxGeometry(0.18, 7, 0.18); g.translate(0, 3.5, 0);
  const arm = new THREE.BoxGeometry(0.12, 0.12, 2.4); arm.translate(0, 6.9, 1.1);
  const lamp = new THREE.BoxGeometry(0.5, 0.18, 0.8); lamp.translate(0, 6.8, 2.2);
  const n = layout.lights.length;
  const mat = new THREE.MeshStandardMaterial({ color: 0x3b3f45, roughness: 0.5, metalness: 0.5 });
  const poles = new THREE.InstancedMesh(g, mat, n), arms = new THREE.InstancedMesh(arm, mat, n);
  const lamps = new THREE.InstancedMesh(lamp, new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd27a, emissiveIntensity: 0.6 }), n);
  const m = new THREE.Matrix4();
  layout.lights.forEach((l, i) => {
    m.makeRotationY(l.rot).setPosition(l.x, 0.2, l.z);
    poles.setMatrixAt(i, m); arms.setMatrixAt(i, m); lamps.setMatrixAt(i, m);
  });
  poles.castShadow = true;
  scene.add(poles, arms, lamps);
}

function buildSigns(scene) {
  for (const b of layout.billboards) {
    const [name, sub, fg, bg] = b.brand;
    const t = TX.signTexture(name, { bg, fg, glow: false, sub, font: 'bold 70px Impact, Trebuchet MS, sans-serif' });
    const grp = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide }));
    board.position.y = 4.6;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(14.4, 4, 0.3), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    frame.position.set(0, 4.6, -0.2);
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), frame.material);
    leg1.position.set(-4, 1.5, -0.2);
    const leg2 = leg1.clone(); leg2.position.x = 4;
    grp.add(board, frame, leg1, leg2);
    grp.position.set(b.x, b.y, b.z); grp.rotation.y = b.rot;
    grp.traverse((o) => { o.castShadow = true; });
    scene.add(grp);
  }
  for (const s of layout.neon) {
    const t = TX.signTexture(s.text, { bg: 'rgba(10,6,20,0.85)', fg: s.color, font: 'bold 76px Brush Script MT, Trebuchet MS, cursive' });
    const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, transparent: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
    m.position.set(s.x, s.y, s.z); m.rotation.y = s.rot;
    scene.add(m);
  }
}

function buildBeachProps(scene) {
  const n = layout.umbrellas.length;
  const cone = new THREE.ConeGeometry(1.6, 0.7, 10); cone.translate(0, 2.6, 0);
  const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5); pole.translate(0, 1.3, 0);
  const towel = new THREE.BoxGeometry(1, 0.03, 2); towel.translate(1.4, 0.02, 0.5);
  const tops = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
  const poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0xeeeeee }), n);
  const towels = new THREE.InstancedMesh(towel, new THREE.MeshStandardMaterial({ roughness: 1 }), n);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  layout.umbrellas.forEach((u, i) => {
    m.makeRotationY(i * 1.7).setPosition(u.x, 0.12, u.z);
    tops.setMatrixAt(i, m); poles.setMatrixAt(i, m); towels.setMatrixAt(i, m);
    tops.setColorAt(i, c.set(u.color)); towels.setColorAt(i, c.set(u.color).offsetHSL(0.5, 0, 0));
  });
  tops.castShadow = true;
  scene.add(tops, poles, towels);

  for (const p of layout.props) {
    if (p.type === 'lifeguard') {
      const g = new THREE.Group();
      const hut = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0xff9f1c }));
      hut.position.y = 3;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0x2ec4b6 }));
      roof.position.y = 4.6; roof.rotation.y = Math.PI / 4;
      g.add(hut, roof);
      for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        leg.position.set(x, 1, z); g.add(leg);
      }
      g.position.set(p.x, 0.12, p.z);
      g.traverse((o) => { o.castShadow = true; });
      scene.add(g);
    } else if (p.type === 'pier') {
      const mb = new MeshBuilder();
      mb.box(p.x, 1.2, p.z - p.w / 2, p.x + p.len, 1.6, p.z + p.w / 2, col(0xa47148), { tile: [2, 2] });
      for (let x = p.x + 4; x < p.x + p.len; x += 8) for (const s of [-1, 1]) {
        mb.box(x - 0.25, -3, p.z + s * (p.w / 2 - 0.4) - 0.25, x + 0.25, 1.2, p.z + s * (p.w / 2 - 0.4) + 0.25, col(0x6b4a2f));
        mb.box(x - 0.08, 1.6, p.z + s * (p.w / 2 - 0.1) - 0.08, x + 0.08, 2.6, p.z + s * (p.w / 2 - 0.1) + 0.08, col(0xf1f1f1));
      }
      mb.box(p.x + p.len - 12, 1.6, p.z - 3, p.x + p.len - 2, 5, p.z + 3, col(0xffffff), { tile: [3, 3] });
      scene.add(shadowy(new THREE.Mesh(mb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }))));
    } else if (p.type === 'fountain') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 0.8, 20), new THREE.MeshStandardMaterial({ color: 0xf2efe8 }));
      base.position.set(p.x, 0.6, p.z);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0x4fc3dc, roughness: 0.1 }));
      water.position.set(p.x, 0.95, p.z);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.4, 10), base.material);
      spout.position.set(p.x, 1.6, p.z);
      scene.add(base, water, spout);
    }
  }
}
