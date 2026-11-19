// Golden-hour sky dome, sun with a shadow map that follows the player, and the animated ocean.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(0.55, 0.9, 0.38).normalize();
const HORIZON = new THREE.Color(0xffb38a);
const ZENITH = new THREE.Color(0x3a6fb5);

let sun, water, sky;

export function buildSky(scene, renderer) {
  scene.fog = new THREE.Fog(0xf3b99a, 160, 720);
  scene.background = HORIZON.clone();

  const hemi = new THREE.HemisphereLight(0xe4ecff, 0xa08868, 0.7);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffe2bf, 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = -95; s.right = 95; s.top = 95; s.bottom = -95; s.near = 1; s.far = 500;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: SUN_DIR }, horizon: { value: HORIZON }, zenith: { value: ZENITH } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 sunDir; uniform vec3 horizon; uniform vec3 zenith; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 c = mix(horizon, zenith, pow(max(h,0.0), 0.55));
          c = mix(c, vec3(1.0,0.55,0.45), smoothstep(0.12,-0.05,h)*0.5);
          float sd = max(dot(normalize(vDir), sunDir), 0.0);
          c += vec3(1.0,0.6,0.3) * pow(sd, 12.0) * 0.55;
          c += vec3(1.0,0.9,0.7) * smoothstep(0.9975, 0.999, sd) * 2.0;
          // a few flat pink cloud bands
          float band = sin(vDir.x*9.0 + vDir.z*4.0) * 0.5 + 0.5;
          float cl = smoothstep(0.55,0.95,band) * smoothstep(0.03,0.12,h) * smoothstep(0.32,0.14,h);
          c = mix(c, vec3(1.0,0.72,0.75), cl*0.45);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // image-based lighting from the same sky: reflections on glass towers, car paint and water
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = sky.clone();
    envScene.add(envSky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1300, 24), new THREE.MeshBasicMaterial({ color: 0x8a7a68 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -60;
    envScene.add(ground);
    scene.environment = pmrem.fromScene(envScene, 0.03, 0.1, 3000).texture;
    scene.environmentIntensity = 0.85;
    pmrem.dispose();
  }

  water = new THREE.Mesh(
    new THREE.PlaneGeometry(3600, 3600, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, sunDir: { value: SUN_DIR }, fogColor: { value: scene.fog.color }, fogNear: { value: 200 }, fogFar: { value: 1300 } },
      vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        uniform float time; uniform vec3 sunDir; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying vec3 vWorld;
        void main(){
          vec2 p = vWorld.xz;
          float w = sin(p.x*0.09 + time*1.1) + sin(p.y*0.13 - time*0.9) + sin((p.x+p.y)*0.21 + time*1.7)*0.5;
          vec3 n = normalize(vec3(cos(p.x*0.09+time*1.1)*0.09, 1.0, cos(p.y*0.13-time*0.9)*0.12));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
          vec3 deep = vec3(0.01,0.16,0.30), shallow = vec3(0.03,0.42,0.50);
          vec3 c = mix(deep, shallow, 0.35 + 0.1*w);
          c = mix(c, vec3(0.55,0.62,0.85), fres*0.35);
          vec3 r = reflect(-viewDir, n);
          c += vec3(1.0,0.75,0.45) * pow(max(dot(r, sunDir),0.0), 90.0) * 1.6;
          float d = length(cameraPosition - vWorld);
          c = mix(c, fogColor, smoothstep(fogNear, fogFar, d));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.7;
  scene.add(water);
}

export function updateSky(dt, focus, camera) {
  water.material.uniforms.time.value += dt;
  sky.position.copy(camera.position);
  // keep the shadow frustum centred on whatever the camera follows, snapped to texels to avoid shimmer
  const snap = 190 / 2048;
  const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
  sun.target.position.set(fx, 0, fz);
  sun.position.set(fx + SUN_DIR.x * 200, SUN_DIR.y * 200, fz + SUN_DIR.z * 200);
}
