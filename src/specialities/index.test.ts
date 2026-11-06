import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The specialities band is a pinned horizontal scroll. Crossing the band's breakpoint
// (768px) makes ScrollTrigger drop the pin on the spot: the spacer goes, the page gets
// shorter and the browser clamps the scroll to the top. The module has to put the visitor
// back where they were — before this test, crossing the breakpoint threw the page to the
// top and never recovered.
//
// The order of events in the browser (measured with Playwright against the real build):
//   1. the visitor scrolls to 4687
//   2. the window narrows past 768px: the browser resizes
//   3. ScrollTrigger's refresh re-measures the shorter page and scrolls it to 0
//   4. ScrollTrigger fires its 'refresh' event
//   5. the module puts the visitor back at 4687
// So the module's own resize handler sees the offset ALREADY clamped — it has to remember
// the offset from before the clamp, which is what this test pins down.
//
// jsdom has no layout and no ScrollTrigger, so the pin is stood in for: the matchMedia
// condition, the pin's spacer, the scroll clamp and ScrollTrigger's refresh are all
// simulated here.
describe('initSpecialities — the scroll survives a resize across the band breakpoint', () => {
  let width: number;
  let scrolled: number;
  let scrollCalls: number[];
  let refreshListeners: Array<() => void>;

  const BAND_MIN = 768;
  const inBand = (): boolean => width >= BAND_MIN;

  beforeEach(() => {
    vi.useFakeTimers();
    width = 1440;
    scrolled = 5798;
    scrollCalls = [];
    refreshListeners = [];
    document.body.innerHTML = `
      <div id="specialities" class="section"><div id="specsPin"><div id="specsTrack"></div></div></div>
      <div id="nav"></div>`;

    // the band's own matchMedia: the pin exists only while the band does
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('min-width: 768px') ? inBand() : q.includes('min-width: 1100px') ? width >= 1100 : false,
      media: q,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(),
      onchange: null, dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList);

    // the scroll position
    Object.defineProperty(window, 'scrollY', { get: () => scrolled, configurable: true });
    window.scrollTo = vi.fn((_x: number, y: number) => {
      scrollCalls.push(y);
      scrolled = y;
    }) as unknown as typeof window.scrollTo;

    // gsap is stubbed: the module only needs matchMedia/revert and the trigger lifecycle
    vi.doMock('gsap', () => ({
      gsap: {
        registerPlugin: vi.fn(),
        matchMedia: () => ({ add: vi.fn(), revert: vi.fn() }),
        set: vi.fn(), to: vi.fn(), quickTo: vi.fn(() => vi.fn()),
        utils: { toArray: () => [] },
      },
      ScrollTrigger: {
        create: vi.fn(() => ({ kill: vi.fn(), isActive: false, start: 0, end: 0, progress: 0 })),
        update: vi.fn(), refresh: vi.fn(),
        addEventListener: vi.fn((type: string, cb: () => void) => {
          if (type === 'refresh') refreshListeners.push(cb);
        }),
        removeEventListener: vi.fn(),
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock('gsap');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('restores the scroll offset the visitor had when the breakpoint moved', async () => {
    const { initSpecialities } = await import('./index');
    initSpecialities(null);

    // the page is scrolled deep into the band
    expect(scrolled).toBe(5798);

    // the window narrows past the band's breakpoint
    width = 700;

    // ScrollTrigger's refresh re-measures the shorter page and clamps the scroll to the top.
    // This happens inside ScrollTrigger, before the module's resize handler runs.
    scrolled = 0;
    window.dispatchEvent(new Event('resize'));

    // the module's own handler has already put the visitor back
    expect(scrolled).toBe(5798);

    // and ScrollTrigger's refresh (which fires after the handler) does not throw them out again
    for (const cb of refreshListeners) cb();
    expect(scrolled).toBe(5798);
  });

  it('keeps the offset when the refresh lands after the resize handler', async () => {
    const { initSpecialities } = await import('./index');
    initSpecialities(null);
    expect(scrolled).toBe(5798);

    // the browser clamps the scroll to the top on its own, before any handler sees it
    width = 700;
    scrolled = 0;

    // ScrollTrigger's refresh fires first (it is what clamps the page), then the module's
    // handler runs and the visitor is put back.
    for (const cb of refreshListeners) cb();
    window.dispatchEvent(new Event('resize'));

    expect(scrolled).toBe(5798);
  });
});
