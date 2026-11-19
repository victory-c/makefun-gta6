// Third-person camera: free orbit on foot, over-the-shoulder when aiming, speed-aware chase cam in cars.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { mouse } from '../core/input.js';
import { rayBuildings } from '../world/cityLayout.js';
import { clamp, angleDiff } from '../core/rng.js';

export const cam = { yaw: 0, pitch: 0.18, dist: 6, idle: 0, fov: 62, pos: new THREE.Vector3(), look: new THREE.Vector3() };
const aim = new THREE.Vector3();
G.aimDir = aim;

export function snapCamera() {
  const p = G.player;
  const t = p.inCar ?? p;
  cam.yaw = t.h ?? cam.yaw;
  updateCamera(1, true);
}

export function updateCamera(dt, snap = false) {
  const p = G.player, camera = G.camera;
  const sens = 0.0026;
  if (mouse.dx || mouse.dy) cam.idle = 0; else cam.idle += dt;
  cam.yaw -= mouse.dx * sens;
  cam.pitch = clamp(cam.pitch + mouse.dy * sens, -0.35, 1.1);
  let target, dist, height, side = 0;
  if (p.inCar) {
    const v = p.inCar;
    const moveYaw = Math.abs(v.speed) > 1 ? (v.speed > 0 ? v.h : v.h) : v.h;
    if (cam.idle > 1.0 || snap) cam.yaw += angleDiff(cam.yaw, moveYaw) * Math.min(1, dt * (snap ? 99 : 3.2));
    if (cam.idle > 1.0) cam.pitch += (0.2 - cam.pitch) * Math.min(1, dt * 2);
    const sp = Math.abs(v.speed);
    dist = v.spec.len * 1.25 + 4.5 + sp * 0.06;
    height = v.spec.h + 1.6;
    target = new THREE.Vector3(v.x, v.y + v.spec.h * 0.8, v.z);
    cam.fov += ((62 + Math.min(18, sp * 0.35)) - cam.fov) * Math.min(1, dt * 3);
  } else {
    const aiming = p.aiming;
    dist = aiming ? 3.2 : 5.4;
    side = aiming ? 0.9 : 0;
    height = 1.9;
    target = new THREE.Vector3(p.x, p.y + 1.55, p.z);
    cam.fov += ((aiming ? 52 : 62) - cam.fov) * Math.min(1, dt * 6);
  }
  if (G.deathCam) { dist = 9; height = 6; }
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  const rx = -fz, rz = fx;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  // pull in so walls never block the view
  const wall = rayBuildings(target.x, target.z, -fx, -fz, dist + 0.6, target.y + sp * dist);
  if (wall < Infinity) dist = Math.max(1.6, wall - 0.6);
  const want = new THREE.Vector3(target.x - fx * dist * cp + rx * side, target.y + height * 0.35 + sp * dist, target.z - fz * dist * cp + rz * side);
  want.y = Math.max(want.y, 0.6);
  if (snap) cam.pos.copy(want); else cam.pos.lerp(want, Math.min(1, dt * (p.inCar ? 10 : 14)));
  const look = new THREE.Vector3(target.x + rx * side + fx * 2, target.y + 0.3, target.z + rz * side + fz * 2);
  cam.look.copy(look);
  camera.position.copy(cam.pos);
  if (G.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.4;
    G.shake = Math.max(0, G.shake - dt * 2.5);
  }
  camera.lookAt(look);
  if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  // aim direction: the camera's forward
  camera.getWorldDirection(aim);
}
