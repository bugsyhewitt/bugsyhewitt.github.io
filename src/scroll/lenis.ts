import Lenis from 'lenis';

export function initLenis(): Lenis | null {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const lenis = new Lenis({
    duration: 1.05,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // touch stays native (default) — better on mobile
  });

  // Lenis runs on native scroll, so the hero's window.scrollY scrub keeps working.
  // Hand off CSS smooth-scroll to Lenis to avoid double-easing on anchors.
  document.documentElement.style.scrollBehavior = 'auto';

  function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  // Nav anchors → Lenis scrollTo. The fixed-nav clearance comes from the page's
  // scroll-padding-top (90px), which Lenis already honors — measured: an extra
  // offset:-90 here double-counts and lands sections 180px down.
  document.querySelectorAll<HTMLAnchorElement>('.nav__links a, .nav__mark').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement);
    });
  });

  return lenis;
}
