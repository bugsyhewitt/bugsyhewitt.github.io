// Opt-in sound, synthesised with Web Audio (no files): a dry tick as a card crosses the
// front of the deck, soft keystrokes in the séance, a low thump on `summon`. Muted by
// default; the choice is remembered. The AudioContext is only ever created inside a
// user gesture (the enable tap, or the first tap/keypress after a remembered "on"),
// so nothing can autoplay — a deep link that turns the deck on load stays silent.

const KEY = 'bh-sound';
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let on = false;
let lastTick = 0;
const watchers = new Set<() => void>();

export const soundOn = (): boolean => on;

function wake(): void {
  if (!on) return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setSound(next: boolean): void {
  on = next;
  try { localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* private mode: just not remembered */ }
  wake();   // called from the toggle's click: a gesture, so the context may start
  watchers.forEach(w => w());
}

/** Restore the remembered choice and wire the toggle (revealed only when this runs). */
export function initSound(toggle: HTMLButtonElement | null): void {
  try { on = localStorage.getItem(KEY) === '1'; } catch { on = false; }
  window.addEventListener('pointerdown', wake, { once: true });
  window.addEventListener('keydown', wake, { once: true });
  if (!toggle) return;
  const paint = (): void => {
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? '♪ sound on' : '♪ sound off';
  };
  watchers.add(paint);
  paint();
  toggle.hidden = false;
  toggle.addEventListener('click', () => setSound(!on));
}

const live = (): AudioContext | null => (on && ctx && ctx.state === 'running' ? ctx : null);

/** A short filtered noise burst: the body of every click. */
function burst(c: AudioContext, seconds: number, freq: number, q: number, gain: number): void {
  if (!noise) {
    noise = c.createBuffer(1, Math.round(c.sampleRate * 0.06), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = q;
  const amp = c.createGain();
  const t = c.currentTime;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.002);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  src.connect(band).connect(amp).connect(c.destination);
  src.start(t);
  src.stop(t + seconds + 0.01);
}

/** A card crossing the front. Quieter the faster the wheel spins; at most one per 45ms. */
export function tick(speed = 0): void {
  const c = live();
  if (!c || c.currentTime - lastTick < 0.045) return;
  lastTick = c.currentTime;
  burst(c, 0.03, 2600, 7, 0.1 / (1 + Math.abs(speed) / 400));
}

/** A key pressed in the séance. */
export function keystroke(): void {
  const c = live();
  if (c) burst(c, 0.02, 1500, 2.5, 0.05);
}

/** The deck answering `summon`: a low thump. */
export function thump(): void {
  const c = live();
  if (!c) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  const t = c.currentTime;
  osc.frequency.setValueAtTime(92, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.28);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.34);
}
