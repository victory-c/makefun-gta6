// All sound is synthesised with WebAudio: engine, sirens, guns, crashes, UI chimes and a car radio loop.
import { G } from './state.js';

let ctx = null, master, engineOsc, engineGain, engineFilter, sirenOsc, sirenGain, radioGain;
let radioTimer = 0, radioStep = 0;

export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  try { ctx = new AudioContext(); } catch { return; }
  master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
  engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 400;
  engineGain = ctx.createGain(); engineGain.gain.value = 0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(master); engineOsc.start();
  sirenOsc = ctx.createOscillator(); sirenOsc.type = 'square';
  sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
  const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1800;
  sirenOsc.connect(sf).connect(sirenGain).connect(master); sirenOsc.start();
  radioGain = ctx.createGain(); radioGain.gain.value = 0; radioGain.connect(master);
}

function noise(dur, vol, freq = 1200, type = 'lowpass') {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(master); src.start();
}

function tone(freq, dur, vol = 0.2, type = 'sine', when = 0, dest = master) {
  if (!ctx) return;
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain();
  const t0 = ctx.currentTime + when;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}

const near = (src) => {
  const p = G.player;
  if (!src || !p) return 1;
  const d = Math.hypot(src.x - p.x, src.z - p.z);
  return Math.max(0, 1 - d / 120);
};

export const sfx = {
  gun(kind, src) { const v = near(src); if (v > 0) noise(kind === 'shotgun' ? 0.35 : 0.15, 0.9 * v, kind === 'smg' ? 2500 : 1600); },
  punch() { noise(0.08, 0.5, 600); },
  crash(power, src) { const v = near(src); if (v > 0) noise(0.3, power * 0.8 * v, 700); },
  explosion(src) { const v = near(src); if (v > 0) { noise(1.4, 1.2 * v, 300); noise(0.4, 0.7 * v, 1200); } },
  horn() { tone(392, 0.35, 0.12, 'square'); tone(494, 0.35, 0.1, 'square'); },
  pickup() { tone(880, 0.12, 0.15); tone(1320, 0.2, 0.15, 'sine', 0.08); },
  cash() { [1046, 1318, 1568].forEach((f, i) => tone(f, 0.25, 0.12, 'triangle', i * 0.07)); },
  pass() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.4, 0.14, 'square', i * 0.13)); },
  fail() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 0.15, 'sawtooth', i * 0.18)); },
  checkpoint() { tone(1175, 0.15, 0.15, 'triangle'); },
  star() { tone(660, 0.12, 0.12, 'square'); tone(440, 0.2, 0.1, 'square', 0.1); },
};

// Simple synthwave loop for Radio Palmera (WAVE 104.2) when the player is in a car.
const BASS = [41, 41, 53, 41, 39, 39, 51, 39, 36, 36, 48, 36, 38, 38, 50, 43];
const LEAD = [65, 0, 68, 70, 0, 72, 70, 0, 63, 0, 65, 67, 0, 70, 67, 0];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function updateAudio(dt, { engineRpm = 0, inCar = false, sirenLevel = 0, radio = true }) {
  if (!ctx) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(45 + engineRpm * 140, t, 0.05);
  engineFilter.frequency.setTargetAtTime(300 + engineRpm * 1200, t, 0.05);
  engineGain.gain.setTargetAtTime(inCar ? 0.07 + engineRpm * 0.06 : 0, t, 0.1);
  const wail = 700 + Math.sin(G.time * 5) * 250;
  sirenOsc.frequency.setTargetAtTime(wail, t, 0.02);
  sirenGain.gain.setTargetAtTime(sirenLevel * 0.05, t, 0.1);
  radioGain.gain.setTargetAtTime(inCar && radio ? 0.5 : 0, t, 0.3);
  if (inCar && radio) {
    radioTimer -= dt;
    if (radioTimer <= 0) {
      radioTimer += 0.16;
      const s = radioStep++ % 16;
      tone(midi(BASS[s]), 0.15, 0.16, 'sawtooth', 0, radioGain);
      if (LEAD[s]) tone(midi(LEAD[s]), 0.3, 0.05, 'square', 0, radioGain);
      if (s % 4 === 0) tone(60, 0.18, 0.4, 'sine', 0, radioGain);
      if (s % 4 === 2 && ctx) noise(0.05, 0.12, 6000, 'highpass');
    }
  }
}
