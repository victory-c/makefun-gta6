// Title screen and pause menu.
import { G } from '../core/state.js';
import { hasSave, wipeSave, loadGame } from '../core/save.js';

const $ = (id) => document.getElementById(id);

function buttons(items) {
  const box = $('menuItems');
  box.innerHTML = '';
  for (const [label, fn] of items) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = (e) => { e.stopPropagation(); fn(); };
    box.appendChild(b);
  }
}

export function showTitle(onStart) {
  G.mode = 'menu';
  $('menu').classList.remove('hidden');
  const items = [];
  if (hasSave()) items.push(['CONTINUE', () => { loadGame(); onStart(); }]);
  items.push([hasSave() ? 'NEW STORY' : 'START', () => { wipeSave(); onStart(); }]);
  buttons(items);
}

export function showPause(onResume, onQuit) {
  G.mode = 'paused';
  $('menu').classList.remove('hidden');
  buttons([['RESUME', onResume], ['TITLE SCREEN', onQuit]]);
}

export function hideMenu() {
  $('menu').classList.add('hidden');
}
