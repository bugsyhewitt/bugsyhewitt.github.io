import { gsap } from 'gsap';

// The pointer itself is now a zero-lag CSS skeleton-hand cursor (index.html);
// this module only magnetizes small interactive targets toward it.
// No carousel cards here — magnetism fights the wheel drag.
const MAGNET_SEL = '.nav__links a, .inspect, .social__arrow, .nav__mark';
const MAGNET_MAX = 6;

export function initCursor(): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const mag = (v: number) => Math.max(-MAGNET_MAX, Math.min(MAGNET_MAX, v * 0.35));
  document.querySelectorAll<HTMLElement>(MAGNET_SEL).forEach(el => {
    // quickTo re-targets one live tween instead of allocating a Tween per
    // mousemove; recreated on entry because the leave-reset kills its tween.
    let xTo: ((v: number) => void) | null = null;
    let yTo: ((v: number) => void) | null = null;
    el.addEventListener('mouseenter', () => {
      xTo = gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power2.out' });
      yTo = gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power2.out' });
    });
    el.addEventListener('mousemove', e => {
      if (!xTo || !yTo) return;
      const r = el.getBoundingClientRect();
      xTo(mag(e.clientX - (r.left + r.width / 2)));
      yTo(mag(e.clientY - (r.top + r.height / 2)));
    });
    el.addEventListener('mouseleave', () => {
      xTo = yTo = null;
      // clearProps hands transform control back to CSS hover rules afterwards
      gsap.to(el, { x: 0, y: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform' });
    });
  });
}
