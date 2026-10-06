import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';
import { RITE } from '../fx/motion';

gsap.registerPlugin(ScrollTrigger);

// Pinned horizontal scroll: the discipline panels slide sideways as you scroll.
// Desktop + full-motion only — mobile and reduced-motion keep the stacked flow
// (CSS media `(max-width:767px),(prefers-reduced-motion:reduce)`). Two pinned layouts:
//  - title stage (wide AND tall, and only if it measurably fits under the nav): the
//    whole section is one screen and pins, so the title stays while the band slides;
//  - band (every other desktop): the band alone pins, a screen tall.
// Progress is clamped so the last panel lands flush by 90% of the pin and HOLDS
// for the final stretch (a plain scrub trails the scroll and releases the pin
// ~60px before panel 3 is flush). quickTo supplies the eased follow.
const STAGE = '(min-width: 1100px) and (min-height: 740px) and (prefers-reduced-motion: no-preference)';
const BAND = '(min-width: 768px) and (prefers-reduced-motion: no-preference)';
// Which pinned layout roomy desktops get. 'stage' is the compact title stage: the panels say
// what they have in one screen. 'expanded' is the earlier layout, every discipline a full
// screen with room to grow — switch to it when the panels have more to say.
const LAYOUT: 'stage' | 'expanded' = 'stage';
const stageWanted = (): boolean => LAYOUT === 'stage' && window.matchMedia(STAGE).matches;

export function initSpecialities(lenis: Lenis | null = null): void {
  const section = document.getElementById('specialities');
  const pin = document.getElementById('specsPin');
  const track = document.getElementById('specsTrack');
  const bar = document.getElementById('specsProgress');
  if (!section || !pin || !track) return;

  // Lenis moves the page in its own rAF: without this ScrollTrigger hears of it a frame
  // late, and a pinned title visibly hops as it locks
  lenis?.on('scroll', ScrollTrigger.update);

  const panels = track.children.length;            // 3
  pin.style.setProperty('--n', String(panels));    // single source for the CSS track/panel/bar widths
  // Pin just under the fixed nav (CSS reads --nav-h for the stage's and the band's height),
  // so nothing slides beneath the nav and no dead band sits under the pin.
  const nav = document.getElementById('nav');
  const navH = (): number => (nav ? nav.offsetHeight : 0);
  const syncNavH = (): void => section.style.setProperty('--nav-h', navH() + 'px');
  syncNavH();
  const target = -100 * (panels - 1) / panels;     // -66.67 → panel 3 flush
  const LAND_AT = 0.9;                              // land the last panel by 90% of the pin

  // One media condition only. When a gsap.matchMedia condition flips, ScrollTrigger's forced
  // refresh scrolls the page to the top and doesn't restore it (measured: main does it too at
  // 768px). Stage vs band is decided inside, and the resize handler below rebuilds between them.
  let mm = gsap.matchMedia();
  let mode: 'stage' | 'band' | null = null;
  let active: ScrollTrigger | null = null;
  const progressNow = (): number | null => (active && active.isActive ? active.progress : null);
  const rebuild = (at = progressNow()): void => {
    // removing the pin's spacer shortens the page for a moment and the browser clamps the
    // scroll: put it back after. Mid-pin, come back to the same point of the slide instead.
    const y = window.scrollY;
    mm.revert(); mm = gsap.matchMedia(); setup();
    window.scrollTo(0, at !== null && active ? active.start + at * (active.end - active.start) : y);
  };
  const setup = (): void => {
    mm.add(BAND, () => {
      const roomy = stageWanted();
      // the stage only if the whole section fits under the nav; otherwise the band
      if (roomy) section.classList.add('is-stage');
      const stage = roomy && section.offsetHeight <= window.innerHeight - navH() + 1;
      if (!stage) section.classList.remove('is-stage');
      const el = stage ? section : pin;
      mode = stage ? 'stage' : 'band';

      const xTo = gsap.quickTo(track, 'xPercent', { duration: 0.5, ease: RITE });
      const st = active = ScrollTrigger.create({
        trigger: el,
        pin: el,
        start: () => 'top top+=' + navH(),
        end: () => '+=' + track.scrollWidth / 2,   // half a screen of scroll per panel: brisk, not scroll-jacked
        scrub: true,
        invalidateOnRefresh: true,
        anticipatePin: stage ? 0 : 1,               // a velocity pre-pin would make the title jump
        onUpdate: self => {
          xTo(target * Math.min(1, self.progress / LAND_AT));
          // scaleX is compositor-only (no per-frame layout); base width is 1/n
          if (bar) bar.style.transform = 'scaleX(' + (1 + (panels - 1) * self.progress) + ')';
        },
        onRefreshInit: () => { syncNavH(); gsap.set(track, { xPercent: 0 }); },
      });
      return () => {
        st.kill();
        mode = null;
        active = null;
        section.classList.remove('is-stage');
        gsap.set(track, { xPercent: 0 });
        if (bar) bar.style.transform = '';
      };
    });
  };
  setup();

  // Stage or band depends on the window, and whether the stage fits on its height: after a
  // resize that could change either, rebuild from an unpinned layout and measure again.
  let resized = 0;
  let heldAt: number | null | undefined;   // slide progress when the resize began
  window.addEventListener('resize', () => {
    // read it now: ScrollTrigger re-measures (and moves the page) before the timer fires
    if (heldAt === undefined) heldAt = progressNow();
    window.clearTimeout(resized);
    resized = window.setTimeout(() => {
      const at = heldAt ?? null;
      heldAt = undefined;
      if (stageWanted() || mode === 'stage') rebuild(at);
    }, 250);
  });

  // Pin math depends on final layout — recompute once fonts/images settle (and, where the
  // stage is possible, measure its fit again in the real face).
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => (stageWanted() ? rebuild() : ScrollTrigger.refresh()));
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
