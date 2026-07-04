import { magnetize } from '../fx/magnet';

// The pointer itself is a zero-lag CSS skeleton-hand cursor (index.html); this
// module only magnetizes small interactive targets toward it. Not carousel cards
// — magnetism would fight the wheel drag.
const MAGNET_SEL = '.nav__links a, .inspect, .nav__mark';

export function initCursor(): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll<HTMLElement>(MAGNET_SEL).forEach(el => magnetize(el));
}
