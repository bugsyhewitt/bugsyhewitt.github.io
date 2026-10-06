// Foil "variant cover" sheen on the front card: the covers are comic books, so
// the front one catches light like a foil variant — a monochrome glare (and, through
// the card's spot-foil mask, a glint on what would be stamped) plus a slight tilt.
// Bone/ash only, never rainbow. Desktop: the pointer is the light. Phones: the
// gyroscope is. Both need full motion (the caller gates). Written from scratch; the
// technique is after simeydotme's poke-holo, no code taken.

const frontCard = (wheel: HTMLElement): HTMLElement | null =>
  wheel.querySelector<HTMLElement>('.carousel__item.is-front .carousel__card');

function rest(c: HTMLElement | null): void {
  if (!c) return;
  for (const p of ['--foil', '--rx', '--ry']) c.style.removeProperty(p);
}

/** Light the card as if seen from (px, py), each 0..1 across the card. */
function light(c: HTMLElement, px: number, py: number): void {
  c.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
  c.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
  c.style.setProperty('--rx', `${((0.5 - py) * 8).toFixed(2)}deg`);   // ≤4° each way
  c.style.setProperty('--ry', `${((px - 0.5) * 10).toFixed(2)}deg`);  // ≤5°
  // foil flares toward the edges, where real foil catches the light
  c.style.setProperty('--foil', (0.3 + Math.hypot(px - 0.5, py - 0.5) * 0.9).toFixed(2));
}

export function initFoil(wheel: HTMLElement): void {
  let card: HTMLElement | null = null;
  let raf = 0, x = 0, y = 0, held = false;

  function paint(): void {
    raf = 0;
    const c = frontCard(wheel);
    if (c !== card) { rest(card); card = c; }      // the wheel turned under the pointer
    if (!c || held) return;
    const r = c.getBoundingClientRect();
    const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
    if (!(px >= 0 && px <= 1 && py >= 0 && py <= 1)) { rest(c); return; }
    light(c, px, py);
  }

  wheel.addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (!raf) raf = requestAnimationFrame(paint);
  });
  wheel.addEventListener('pointerleave', () => rest(card));
  // a drag is a turn of the wheel, not a look at the card
  wheel.addEventListener('pointerdown', () => { held = true; rest(card); });
  window.addEventListener('pointerup', () => { held = false; });
}

type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Phones: tilting the phone moves the light. iOS only delivers orientation after a
 * tap grants it, so there `control` is revealed and does the asking; elsewhere the
 * events simply arrive. The neutral angle drifts slowly to however the phone is held.
 */
export function initTilt(wheel: HTMLElement, control: HTMLButtonElement | null): void {
  let card: HTMLElement | null = null;
  let raf = 0, beta = 0, gamma = 0;
  let base: [number, number] | null = null;
  const RANGE = 16;   // degrees of tilt from neutral to the card's edge

  function paint(): void {
    raf = 0;
    const c = frontCard(wheel);
    if (c !== card) { rest(card); card = c; }
    if (!c) return;
    if (!base) base = [beta, gamma];
    base = [base[0] + (beta - base[0]) * 0.02, base[1] + (gamma - base[1]) * 0.02];   // slow re-centre
    const db = Math.max(-RANGE, Math.min(RANGE, beta - base[0]));
    const dg = Math.max(-RANGE, Math.min(RANGE, gamma - base[1]));
    light(c, 0.5 + dg / (2 * RANGE), 0.5 + db / (2 * RANGE));
  }

  function onTilt(e: DeviceOrientationEvent): void {
    if (e.beta == null || e.gamma == null) return;
    beta = e.beta; gamma = e.gamma;
    if (!raf) raf = requestAnimationFrame(paint);
  }
  const start = (): void => window.addEventListener('deviceorientation', onTilt);

  const D = (window as unknown as { DeviceOrientationEvent?: MotionPermission }).DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    if (!control) return;
    control.hidden = false;
    control.addEventListener('click', () => {
      D.requestPermission!()
        .then(state => { if (state === 'granted') start(); })
        .catch(() => { /* denied or unavailable: the card just stays still */ })
        .finally(() => { control.hidden = true; });
    });
  } else {
    start();
  }
}
