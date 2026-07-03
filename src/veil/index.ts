// Soft volumetric fog + sparse rising embers behind the dark intro/contact bands.
// Fog renders on a low-res offscreen buffer scaled up (cheap blur); embers are
// tiny recycled particles. Each canvas pauses its rAF while offscreen.

const DPR_CAP = 1.5;
const EMBER_COUNT = 24;
const FOG_SCALE = 6;

interface Ember {
  x: number; y: number; vy: number; amp: number; freq: number;
  phase: number; size: number; alpha: number; warm: boolean;
}

function makeEmber(w: number, h: number, atBottom: boolean): Ember {
  return {
    x: Math.random() * w,
    y: atBottom ? h + Math.random() * 20 : Math.random() * h,
    vy: 10 + Math.random() * 16,
    amp: 6 + Math.random() * 14,
    freq: 0.3 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
    size: 1 + Math.random(),
    alpha: 0.15 + Math.random() * 0.35,
    warm: Math.random() < 0.5,
  };
}

// Blob drift between --void and desaturated green tones (Bugsy's call), alpha ≤ 0.10.
const BLOBS = [
  { sx: 0.20, sy: 0.11, px: 0.0, py: 1.7, r: 0.55, rgb: '96,128,104', a: 0.07 },
  { sx: 0.13, sy: 0.17, px: 2.1, py: 0.6, r: 0.65, rgb: '52,84,64', a: 0.10 },
  { sx: 0.09, sy: 0.14, px: 4.0, py: 3.2, r: 0.50, rgb: '118,138,96', a: 0.05 },
  { sx: 0.16, sy: 0.08, px: 5.3, py: 4.4, r: 0.70, rgb: '20,34,26', a: 0.10 },
];

function attach(section: HTMLElement): void {
  const canvas = document.createElement('canvas');
  canvas.className = 'veil';
  canvas.setAttribute('aria-hidden', 'true');
  section.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const fog = document.createElement('canvas');
  const fctx = fog.getContext('2d');
  if (!fctx) return;

  let w = 0, h = 0, dpr = 1;
  function resize(): void {
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    w = section.clientWidth; h = section.clientHeight;
    canvas.width = Math.max(2, Math.round(w * dpr));
    canvas.height = Math.max(2, Math.round(h * dpr));
    fog.width = Math.max(2, Math.round(w / FOG_SCALE));
    fog.height = Math.max(2, Math.round(h / FOG_SCALE));
  }
  resize();
  new ResizeObserver(resize).observe(section);

  const embers: Ember[] = Array.from({ length: EMBER_COUNT }, () => makeEmber(w, h, false));

  let last = 0;
  function frame(t: number): void {
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016;
    last = t;
    const ts = t / 1000;

    fctx!.clearRect(0, 0, fog.width, fog.height);
    BLOBS.forEach(b => {
      const bx = fog.width * (0.5 + 0.38 * Math.sin(ts * b.sx + b.px));
      const by = fog.height * (0.5 + 0.34 * Math.sin(ts * b.sy + b.py));
      const br = Math.max(fog.width, fog.height) * b.r;
      const g = fctx!.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, `rgba(${b.rgb},${b.a})`);
      g.addColorStop(1, 'rgba(9,9,10,0)');
      fctx!.fillStyle = g;
      fctx!.fillRect(0, 0, fog.width, fog.height);
    });

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, w, h);
    ctx!.drawImage(fog, 0, 0, w, h);

    for (let i = 0; i < embers.length; i++) {
      let p = embers[i];
      p.y -= p.vy * dt;
      if (p.y < -6) { embers[i] = p = makeEmber(w, h, true); }
      const x = p.x + Math.sin(ts * p.freq * Math.PI * 2 + p.phase) * p.amp;
      const flicker = 0.6 + 0.4 * Math.sin(ts * 7 + p.phase * 3);
      ctx!.globalAlpha = Math.min(0.5, p.alpha * flicker);
      ctx!.fillStyle = p.warm ? '#7a4a1a' : '#9c3636';
      ctx!.fillRect(x, p.y, p.size, p.size);
    }
    ctx!.globalAlpha = 1;
  }

  let rafId = 0, running = false;
  function loop(t: number): void { frame(t); rafId = requestAnimationFrame(loop); }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting && !running) { running = true; last = 0; rafId = requestAnimationFrame(loop); }
      else if (!en.isIntersecting && running) { running = false; cancelAnimationFrame(rafId); }
    });
  });
  io.observe(section);
}

export function initVeil(): void {
  // Hidden entirely under reduced motion (packet-sanctioned call — calmest option).
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll<HTMLElement>('.intro, .contact').forEach(attach);
}
