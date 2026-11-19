// HUD overlay: money, wanted stars, health/armour, weapon, speedometer, objective, dialogue,
// toasts, big mission banners, shop list and the minimap / big map.
import { G } from '../core/state.js';
import { WEAPONS, RULES } from '../config.js';
import { districtAt } from '../world/cityLayout.js';
import { drawMinimap, drawBigMap } from './minimap.js';

const $ = (id) => document.getElementById(id);
let shownMoney = 0;
const lines = [];         // queued dialogue { who, text, start, end }
let toastT = 0, bigT = 0, promptText = '', promptSet = false, shopEl = null;

export const hud = {
  say(who, text, secs = 3.5, delay = 0) { lines.push({ who, text, start: G.time + delay, end: G.time + delay + secs }); },
  toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); toastT = 3; },
  big(title, sub = '', color = '#ffd23f', secs = 3) {
    const b = $('bigText');
    b.innerHTML = `<div class="t" style="color:${color}">${title}</div><div class="s">${sub}</div>`;
    b.classList.add('show'); bigT = secs;
  },
  objective(text) { $('objective').textContent = text; $('objective').classList.toggle('show', !!text); },
  timer(secs) {
    const t = $('missionTimer');
    if (secs == null) { t.textContent = ''; return; }
    const s = Math.max(0, Math.ceil(secs));
    t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    t.classList.toggle('urgent', s <= 10);
  },
  prompt(text) { promptText = text; promptSet = true; },
  shop(title, items) {
    if (!shopEl) { shopEl = document.createElement('div'); shopEl.id = 'shop'; $('hud').appendChild(shopEl); }
    if (!title) { shopEl.style.display = 'none'; return; }
    shopEl.style.display = 'block';
    shopEl.innerHTML = `<h3>${title}</h3>${items.map((s) => `<div>${s}</div>`).join('')}<small>press the number to buy</small>`;
  },
  show(on) { $('hud').classList.toggle('hidden', !on); },
};

export function updateHud(dt, yaw) {
  const p = G.player;
  shownMoney += (G.money - shownMoney) * Math.min(1, dt * 6);
  if (Math.abs(G.money - shownMoney) < 1) shownMoney = G.money;
  $('money').textContent = '$' + Math.round(shownMoney).toLocaleString('en-US').padStart(1, '0');
  const hour = Math.floor(G.clock), min = Math.floor((G.clock % 1) * 60);
  $('clock').textContent = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  // wanted stars, flashing while the cops have lost sight of you
  const flash = G.wanted > 0 && !G.copsSee && Math.floor(G.time * 3) % 2 === 0;
  let stars = '';
  for (let i = 1; i <= RULES.maxWanted; i++) stars += `<span class="${i <= G.wanted ? (flash ? 'on dim' : 'on') : ''}">★</span>`;
  $('stars').innerHTML = stars;
  const w = WEAPONS[G.weaponIndex];
  $('weaponName').textContent = w.name;
  $('ammo').textContent = w.id === 'fists' ? '' : String(G.weapons[w.id]);
  $('hpBar').firstElementChild.style.width = `${Math.max(0, p.health)}%`;
  $('armorBar').firstElementChild.style.width = `${G.armor}%`;
  $('district').textContent = districtAt(p.x, p.z);
  const sp = $('speedo');
  if (p.inCar) {
    sp.classList.remove('hidden');
    $('speedVal').textContent = Math.round(Math.abs(p.inCar.speed) * 2.237);
    const hp = p.inCar.health / p.inCar.spec.hp;
    $('carName').innerHTML = `${p.inCar.spec.name}<i style="width:${Math.max(0, hp) * 100}%;background:${hp > 0.5 ? '#57e389' : hp > 0.25 ? '#ffd23f' : '#ff4f4f'}"></i>`;
  } else sp.classList.add('hidden');
  $('crosshair').classList.toggle('show', !!(p.aiming || (p.inCar && G.weaponIndex > 0)));
  // dialogue
  const now = G.time;
  const cur = lines.find((l) => l.start <= now && l.end > now);
  const sub = $('subtitle');
  if (cur) { sub.innerHTML = `<b>${cur.who}:</b> ${cur.text}`; sub.classList.add('show'); } else sub.classList.remove('show');
  while (lines.length && lines[0].end < now) lines.shift();
  toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show');
  bigT -= dt; if (bigT <= 0) $('bigText').classList.remove('show');
  const pr = $('prompt');
  if (promptSet) { pr.textContent = promptText; pr.classList.add('show'); } else pr.classList.remove('show');
  promptSet = false;
  $('hud').classList.toggle('hurt', (G.hurtFlash ?? 0) > 0);
  G.hurtFlash = Math.max(0, (G.hurtFlash ?? 0) - dt);
  drawMinimap($('minimap'), yaw);
  if (G.mode === 'map') drawBigMap($('bigMapCanvas'));
}

export function clearDialogue() { lines.length = 0; }
