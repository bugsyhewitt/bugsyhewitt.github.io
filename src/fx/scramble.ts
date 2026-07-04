// Scramble-to-text, reusing the manifesto's glyph aesthetic.
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ#%&/<>*+=$!?23456789';

interface ScrambleOpts { frames?: number; glyphs?: string; }

const timers = new WeakMap<HTMLElement, number>();

export function scrambleTo(el: HTMLElement, finalText: string, opts: ScrambleOpts = {}): void {
  const frames = opts.frames ?? 10;
  const glyphs = opts.glyphs ?? GLYPHS;
  const prev = timers.get(el);
  if (prev !== undefined) window.clearInterval(prev); // re-enter mid-scramble restarts cleanly
  let frame = 0;
  const iv = window.setInterval(() => {
    frame++;
    const reveal = Math.floor((frame / frames) * finalText.length);
    let out = '';
    for (let i = 0; i < finalText.length; i++) {
      const ch = finalText.charAt(i);
      out += (ch === ' ' || i < reveal) ? ch : glyphs.charAt(Math.floor(Math.random() * glyphs.length));
    }
    el.textContent = out;
    if (frame >= frames) { el.textContent = finalText; window.clearInterval(iv); timers.delete(el); }
  }, 40);
  timers.set(el, iv);
}

export function initScrambleHovers(): void {
  document.querySelectorAll<HTMLElement>('.nav__links a').forEach(el => {
    const original = el.textContent || ''; // cached once — scrambleTo always settles on this
    el.addEventListener('mouseenter', () => scrambleTo(el, original));
  });
}
