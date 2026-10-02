// Section headings rise into place line by line from behind a mask as they come into
// view — the one typographic entrance on the site. SplitText (3.13+) keeps them
// readable to screen readers (aria-label on the heading, the split pieces hidden).
// Reduced motion and no-JS: they're simply there.
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { RITE, DUR } from './motion';
import { onceInView } from './terminal';

gsap.registerPlugin(SplitText);

export function initHeadings(): void {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('.heading[data-rise]'));
  if (!headings.length) return;
  // split once the display face is in, or the line breaks are measured in the fallback
  document.fonts.ready.then(() => {
    headings.forEach(h => {
      const split = SplitText.create(h, { type: 'lines', mask: 'lines' });
      gsap.set(split.lines, { yPercent: 110 });
      onceInView(h, () => {
        gsap.to(split.lines, { yPercent: 0, duration: DUR.long, ease: RITE, stagger: 0.08 });
      }, '0px 0px -12% 0px');
    });
  });
}
