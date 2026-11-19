// Runs one mission at a time: intro dialogue, staged objectives with markers and timers,
// pass/fail screens, rewards, and the start markers for story and side jobs.
import { G } from '../core/state.js';
import { layout } from '../world/cityLayout.js';
import { addMarker, clearMarkers, insideMarker, getMarker, moveMarker, removeMarker } from './markers.js';
import { hud } from '../ui/hud.js';
import { sfx } from '../core/audio.js';
import { STORY } from './storyMissions.js';
import { SIDE_JOBS } from './sideJobs.js';
import { saveGame } from '../core/save.js';

export function activeMission() { return G.mission; }

export function startMission(def) {
  clearMarkers('start:');
  G.mission = { def, idx: -1, stage: null, t: 0, data: {} };
  hud.big(def.title.toUpperCase(), def.side ? 'side job' : `mission ${STORY.indexOf(def) + 1} of ${STORY.length}`, '#ffd23f', 2.6);
  (def.intro ?? []).forEach(([who, line], i) => hud.say(who, line, 3.6, i * 3.7));
  def.begin?.(G.mission.data);
  nextStage();
}

function nextStage() {
  const m = G.mission;
  clearMarkers('m:');
  m.idx++;
  if (m.idx >= m.def.stages.length) return passMission();
  const st = m.def.stages[m.idx](m.data);
  m.stage = st; m.t = 0;
  st.start?.();
  if (st.marker) addMarker('m:goal', st.marker.x, st.marker.z, { color: st.marker.color ?? 0xffd23f, radius: st.marker.radius ?? 2.6, label: st.marker.label ?? '', icon: 'goal' });
  hud.objective(st.text);
  if (!st.keepTimer) m.deadline = st.timer ?? null;
}

function passMission() {
  const m = G.mission;
  const def = m.def;
  G.money += def.reward;
  if (!def.side) { G.storyStep = Math.max(G.storyStep, STORY.indexOf(def) + 1); G.stats.missions++; }
  def.cleanup?.(m.data, true);
  hud.big('MISSION PASSED', `+$${def.reward.toLocaleString()}`, '#ffd23f', 4);
  (def.outro ?? []).forEach(([who, line], i) => hud.say(who, line, 3.8, 1.5 + i * 3.9));
  sfx.pass();
  hud.objective('');
  G.mission = null;
  clearMarkers('m:');
  saveGame();
  G.onMissionPassed?.(def);
}

export function failMission(reason) {
  const m = G.mission;
  if (!m) return;
  m.def.cleanup?.(m.data, false);
  hud.big('MISSION FAILED', reason, '#ff4f4f', 4);
  sfx.fail();
  hud.objective('');
  G.mission = null;
  clearMarkers('m:');
}

// Glowing start markers for the next story mission and every side job.
function refreshStarts() {
  const want = new Set();
  const next = STORY[G.storyStep];
  if (next) want.add('start:' + next.id);
  for (const j of SIDE_JOBS) if (!j.locked?.()) want.add('start:' + j.id);
  for (const id of want) {
    if (!getMarker(id)) {
      const def = next && id === 'start:' + next.id ? next : SIDE_JOBS.find((j) => 'start:' + j.id === id);
      const poi = layout.pois[def.giver];
      addMarker(id, poi.x, poi.z, { color: def.side ? 0x57e389 : 0xffd23f, radius: 1.8, label: def.title, icon: def.side ? 'side' : 'story' });
    }
  }
}

export function updateMissions(dt) {
  const m = G.mission;
  if (!m) {
    refreshStarts();
    const next = STORY[G.storyStep];
    if (next && insideMarker('start:' + next.id) && !G.player.dead) {
      if (G.wanted > 0) hud.prompt('Lose the cops before starting a mission');
      else return startMission(next);
    }
    for (const j of SIDE_JOBS) {
      if (!j.locked?.() && insideMarker('start:' + j.id) && !G.player.dead) {
        const why = j.canStart?.();
        if (why) hud.prompt(why);
        else if (G.wanted > 0) hud.prompt('Lose the cops before starting a job');
        else return startMission(j);
      }
    }
    return;
  }
  m.t += dt;
  if (m.deadline != null) {
    m.deadline -= dt;
    hud.timer(m.deadline);
    if (m.deadline <= 0) { hud.timer(null); return failMission("You ran out of time."); }
  } else hud.timer(null);
  const r = m.stage.update?.(dt, m.data);
  if (r === 'done') { sfx.checkpoint(); nextStage(); }
  else if (typeof r === 'string' && r.startsWith('fail:')) failMission(r.slice(5));
  if (m.stage?.marker && G.mission === m) {
    const mk = m.stage.marker;
    if (mk.follow) { const f = mk.follow(); moveMarker('m:goal', f.x, f.z); }
  }
}

export function onPlayerDown() {
  if (G.mission) failMission(G.player.dead ? 'You got wasted.' : 'You got busted.');
}
