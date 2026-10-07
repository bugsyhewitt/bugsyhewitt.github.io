// Duotone proofs for the dimmed cards: each cover remapped to ink→paper
// tones at 45° — like a pulled proof before the colour plates go on.
// Made in the browser from the image that's already loaded; no extra assets.

const INK = [22, 20, 18];        // --ink
const PAPER = [122, 117, 106];   // aged newsprint: recedes on the void, still reads as paper

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
  for (let p = 0; p < px.length; p += 4) {
    const t = 1 - (0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2]) / 255; // darker → more ink
    px[p]     = PAPER[0] + (INK[0] - PAPER[0]) * t;
    px[p + 1] = PAPER[1] + (INK[1] - PAPER[1]) * t;
    px[p + 2] = PAPER[2] + (INK[2] - PAPER[2]) * t;
  }
  ctx.putImageData(frame, 0, 0);
  canvas.className = 'carousel__proof';
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}
