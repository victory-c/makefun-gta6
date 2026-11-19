// Keyboard and mouse input with pointer lock for the camera.
const down = new Set();
const pressed = new Set();
export const mouse = { dx: 0, dy: 0, left: false, leftPressed: false, right: false, locked: false, wheel: 0 };

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
    if (e.button === 2) mouse.right = true;
    if (!mouse.locked && canvas.requestPointerLock) canvas.requestPointerLock();
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
  addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); });
  document.addEventListener('pointerlockchange', () => { mouse.locked = document.pointerLockElement === canvas; });
}

export const key = (code) => down.has(code);
export const hit = (code) => pressed.has(code);
export function axis(neg, pos) {
  return (pos.some(key) ? 1 : 0) - (neg.some(key) ? 1 : 0);
}

// Called at the end of every frame.
export function endFrame() {
  pressed.clear();
  mouse.dx = 0; mouse.dy = 0; mouse.leftPressed = false; mouse.wheel = 0;
}

// Screenshot scenes press keys programmatically.
export function simulateKey(code, on) {
  if (on) down.add(code); else down.delete(code);
}
