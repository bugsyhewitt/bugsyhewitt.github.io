// Foil "variant cover" sheen on the front card: the covers are comic books, so
// the front one catches light like a foil variant — a monochrome glare that
// follows the pointer plus a slight tilt. Bone/ash only, never rainbow.
// Fine pointers with full motion only (the caller gates it). Written from
// scratch; the technique is after simeydotme's poke-holo, no code taken.
export function initFoil(wheel: HTMLElement): void {
  let card: HTMLElement | null = null;
  let raf = 0, x = 0, y = 0, held = false;

  const front = (): HTMLElement | null =>
    wheel.querySelector<HTMLElement>('.carousel__item:not(.is-dim) .carousel__card');

  function rest(c: HTMLElement | null): void {
    if (!c) return;
    for (const p of ['--foil', '--rx', '--ry']) c.style.removeProperty(p);
  }

  function paint(): void {
    raf = 0;
    const c = front();
    if (c !== card) { rest(card); card = c; }      // the wheel turned under the pointer
    if (!c || held) return;
    const r = c.getBoundingClientRect();
    const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
    if (!(px >= 0 && px <= 1 && py >= 0 && py <= 1)) { rest(c); return; }
    c.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    c.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    c.style.setProperty('--rx', `${((0.5 - py) * 8).toFixed(2)}deg`);   // ≤4° each way
    c.style.setProperty('--ry', `${((px - 0.5) * 10).toFixed(2)}deg`);  // ≤5°
    // foil flares toward the edges, where real foil catches the light
    c.style.setProperty('--foil', (0.3 + Math.hypot(px - 0.5, py - 0.5) * 0.9).toFixed(2));
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
