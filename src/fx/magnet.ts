import { gsap } from 'gsap';

// Magnetize an element toward the cursor on hover via one live quickTo tween
// (no per-move allocation), easing back to rest on leave.
export function magnetize(el: HTMLElement, max = 6, factor = 0.35): void {
  const clamp = (v: number) => Math.max(-max, Math.min(max, v * factor));
  let xTo: ((v: number) => void) | null = null;
  let yTo: ((v: number) => void) | null = null;
  el.addEventListener('mouseenter', () => {
    xTo = gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power2.out' });
    yTo = gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power2.out' });
  });
  el.addEventListener('mousemove', e => {
    if (!xTo || !yTo) return;
    const r = el.getBoundingClientRect();
    xTo(clamp(e.clientX - (r.left + r.width / 2)));
    yTo(clamp(e.clientY - (r.top + r.height / 2)));
  });
  el.addEventListener('mouseleave', () => {
    xTo = yTo = null;
    // clearProps hands transform control back to CSS afterwards
    gsap.to(el, { x: 0, y: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform' });
  });
}
