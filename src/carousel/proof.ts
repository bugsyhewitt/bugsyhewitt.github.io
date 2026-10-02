// Newsprint proofs for the dimmed cards: each cover screened to one ink at 45°,
// like a press proof pulled before the colour plates go on. Made in the browser
// from the image that's already loaded — halftone dots don't compress, so shipping
// twenty proofs as files would have cost ~0.6 MB. Same algorithm as proof() in
// scripts/cards/build_fx.py (which only feeds the QA sheet).

const INK = [22, 20, 18];        // --ink
const PAPER = [122, 117, 106];   // aged newsprint: recedes on the void, still reads as paper
const PITCH = 3.4;               // screen pitch, CSS px
const SOFT = 0.07;               // anti-aliasing band around each dot edge

const screens = new Map<string, Float32Array>();

/** The 45° dot screen for a canvas size (same for every card, so it's cached). */
function screenFor(w: number, h: number, pitch: number): Float32Array {
  const key = `${w}x${h}@${pitch}`;
  let s = screens.get(key);
  if (s) return s;
  s = new Float32Array(w * h);
  const k = (2 * Math.PI) / pitch, c = Math.SQRT1_2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + y) * c, v = (y - x) * c;
      s[y * w + x] = 0.5 + 0.25 * (Math.cos(k * u) + Math.cos(k * v));
    }
  }
  screens.set(key, s);
  return s;
}

/** A proof canvas for a loaded cover at the card's CSS width, or null if canvas is unavailable. */
export function makeProof(img: HTMLImageElement, cssWidth: number,
  dpr = Math.min(window.devicePixelRatio || 1, 1.5)): HTMLCanvasElement | null {
  if (!img.naturalWidth || !cssWidth) return null;
  const w = Math.round(cssWidth * dpr);
  const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const frame = ctx.getImageData(0, 0, w, h);
  const px = frame.data;
  const s = screenFor(w, h, PITCH * dpr);
  for (let i = 0, p = 0; i < s.length; i++, p += 4) {
    const dark = 1 - (0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2]) / 255;
    const t = Math.min(1, Math.max(0, (dark - s[i] + SOFT) / (2 * SOFT)));   // darker -> bigger dot
    px[p] = PAPER[0] + (INK[0] - PAPER[0]) * t;
    px[p + 1] = PAPER[1] + (INK[1] - PAPER[1]) * t;
    px[p + 2] = PAPER[2] + (INK[2] - PAPER[2]) * t;
  }
  ctx.putImageData(frame, 0, 0);
  canvas.className = 'carousel__proof';
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}
