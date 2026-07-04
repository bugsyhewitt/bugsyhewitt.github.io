import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Pinned horizontal scroll: the section pins and the discipline panels slide
// sideways as you scroll. Desktop + full-motion only — mobile and reduced-motion
// keep the stacked flow (CSS media `(max-width:767px),(prefers-reduced-motion:reduce)`).
// Progress is clamped so the last panel lands flush by 90% of the pin and HOLDS
// for the final stretch (a plain scrub trails the scroll and releases the pin
// ~60px before panel 3 is flush). quickTo supplies the eased follow.
export function initSpecialities(): void {
  const pin = document.getElementById('specsPin');
  const track = document.getElementById('specsTrack');
  const bar = document.getElementById('specsProgress');
  if (!pin || !track) return;

  const panels = track.children.length;            // 3
  pin.style.setProperty('--n', String(panels));    // single source for the CSS track/panel/bar widths
  const target = -100 * (panels - 1) / panels;     // -66.67 → panel 3 flush
  const LAND_AT = 0.9;                              // land the last panel by 90% of the pin

  // Desktop AND full-motion: the CSS media above stacks in every other case.
  ScrollTrigger.matchMedia({
    '(min-width: 768px) and (prefers-reduced-motion: no-preference)': () => {
      const xTo = gsap.quickTo(track, 'xPercent', { duration: 0.5, ease: 'power3.out' });
      const st = ScrollTrigger.create({
        trigger: pin,
        start: 'top top',
        end: () => '+=' + track.scrollWidth,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate: self => {
          xTo(target * Math.min(1, self.progress / LAND_AT));
          // scaleX is compositor-only (no per-frame layout); base width is 1/n
          if (bar) bar.style.transform = 'scaleX(' + (1 + (panels - 1) * self.progress) + ')';
        },
        onRefreshInit: () => gsap.set(track, { xPercent: 0 }),
      });
      return () => { st.kill(); gsap.set(track, { xPercent: 0 }); if (bar) bar.style.transform = ''; };
    },
  });

  // Pin math depends on final layout — recompute once fonts/images settle.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
