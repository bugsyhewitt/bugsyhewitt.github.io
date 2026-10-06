import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gsap } from 'gsap';
const initLight = vi.fn();
vi.mock('./light', () => ({ initLight: (...a: unknown[]) => initLight(...a) }));

import { initCarousel, summonCard } from './index';
import { CARDS } from './cards';

// Minimal DOM required by initCarousel: #carousel (wheel) + #carouselItems.
function buildDom() {
  document.body.innerHTML = `
    <div id="carousel"><div id="carouselItems"></div></div>
  `;
}

function stubMatchMedia({ reduce = false, fine = false } = {}) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduce : q.includes('hover') ? fine : false,
    media: q,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

function keyOn(target: EventTarget, key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

const wheel = () => document.getElementById('carousel')!;
const items = () => document.getElementById('carouselItems')!;
// where the wheel is headed: a running tween's target, else where it already sits
// (under reduced motion key turns are instant, so there is no tween to read)
const target = () => {
  const tweens = gsap.getTweensOf(items());
  return tweens.length
    ? (tweens[tweens.length - 1].vars.rotation as number)
    : ((gsap.getProperty(items(), 'rotation') as number) || 0);
};
// lay the cards out where the entrance timeline leaves them (card i at i·18°, back half negative)
const settle = () => document.querySelectorAll<HTMLElement>('.carousel__item').forEach((el, i) => {
  gsap.set(el, { rotation: i > 10 ? -18 * (20 - i) : 18 * i });
});

describe('initCarousel — keyboard (BUG-NEW-141, WCAG 2.1.1), scoped to the wheel', () => {
  beforeEach(() => {
    buildDom();
    stubMatchMedia({ reduce: true, fine: false });
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    gsap.killTweensOf(items());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('arrow keys elsewhere on the page are left alone', () => {
    initCarousel();
    const e = keyOn(window, 'ArrowRight');
    expect(e.defaultPrevented).toBe(false);
    expect(target()).toBe(0);
  });

  it('→ on the wheel turns one card toward the next (negative turn) and claims the key', () => {
    initCarousel();
    const e = keyOn(wheel(), 'ArrowRight');
    expect(e.defaultPrevented).toBe(true);
    expect(target()).toBe(-18);
  });

  it('← on the wheel turns one card back', () => {
    initCarousel();
    keyOn(wheel(), 'ArrowLeft');
    expect(target()).toBe(18);
  });

  it('rapid presses chain off the running target instead of the mid-tween angle', () => {
    initCarousel();
    keyOn(wheel(), 'ArrowRight');
    keyOn(wheel(), 'ArrowRight');
    keyOn(wheel(), 'ArrowRight');
    expect(target()).toBe(-54);
  });

  it('keys pressed on a card inside the wheel bubble to the handler', () => {
    initCarousel();
    const card = document.querySelector<HTMLElement>('.carousel__card')!;
    const e = keyOn(card, 'ArrowLeft');
    expect(e.defaultPrevented).toBe(true);
    expect(target()).toBe(18);
  });

  it('End turns the short way to the last card, Home back to the first', () => {
    initCarousel();
    settle();
    keyOn(wheel(), 'End');
    expect(target()).toBe(18);
    keyOn(wheel(), 'Home');
    expect(target()).toBe(0);
  });

  it('other keys pass through untouched', () => {
    initCarousel();
    const e = keyOn(wheel(), 'a');
    expect(e.defaultPrevented).toBe(false);
    expect(target()).toBe(0);
  });

  it('only the first card is a tab stop before the wheel has settled', () => {
    initCarousel();
    const tabbable = [...document.querySelectorAll<HTMLElement>('.carousel__card')].filter(a => a.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });

  it('each card carries its cover text as alt, not the bare slug', () => {
    initCarousel();
    const alts = [...document.querySelectorAll<HTMLImageElement>('.carousel__img')].map(i => i.alt);
    expect(alts).toHaveLength(CARDS.length);
    expect(alts.find(a => a.startsWith('Reaper'))).toBe(
      "Reaper, resurrects race-the-web: Single-packet race-condition engine for the bugs scanners can't see.");
  });

  it('initCarousel is a no-op when #carousel is missing', () => {
    document.body.innerHTML = '';
    expect(() => initCarousel()).not.toThrow();
  });
});

describe('initCarousel — the card reading (caption, announcements, deep links)', () => {
  // The deck's entrance plays when it scrolls into view; fire that immediately.
  class SeenAtOnce {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) { this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as never); }
    unobserve() {}
    disconnect() {}
  }
  const readingDom = () => {
    document.body.innerHTML = `
      <div id="carousel" tabindex="0"><div id="carouselItems"></div></div>
      <p id="carouselCaption"><span class="cc__meta"></span><span class="cc__line"></span></p>
      <p id="carouselLive"></p>`;
  };
  const meta = () => document.querySelector('.cc__meta')!.textContent;
  const line = () => document.querySelector('.cc__line')!.textContent;
  const live = () => document.getElementById('carouselLive')!.textContent;

  beforeEach(() => {
    readingDom();
    stubMatchMedia({ reduce: true });
    vi.stubGlobal('IntersectionObserver', SeenAtOnce);
    history.replaceState(null, '', '/');
  });
  afterEach(() => {
    gsap.killTweensOf(items());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    history.replaceState(null, '', '/');
  });

  it('captions the front card with its number, name, lineage and tagline', () => {
    initCarousel();
    expect(meta()).toBe('01 / 20 · Autopsy · resurrects BinAbsInspector');
    expect(line()).toBe(CARDS[0].tagline);
  });

  it('announces and deep-links only when a user turn settles', () => {
    initCarousel();
    expect(live()).toBe('');                       // assembling is not announced
    keyOn(wheel(), 'ArrowRight');
    expect(meta()).toContain('02 / 20 · Covenant');
    expect(live()).toBe(`Covenant, card 2 of 20. Resurrects SCMKit. ${CARDS[1].tagline}`);
    expect(location.hash).toBe('#card=covenant');
  });

  it('opens on the card named in the URL', () => {
    history.replaceState(null, '', '/#card=reaper');
    initCarousel();
    expect(meta()).toContain('16 / 20 · Reaper · resurrects race-the-web');
  });

  it('a deep link skips the fly-in even with motion on: the wheel heads straight for the card', () => {
    stubMatchMedia({ reduce: false });
    history.replaceState(null, '', '/#card=reaper');
    initCarousel();
    // entrance jumped to its end synchronously; card 16 (index 15) sits at -90°, so the wheel turns +90
    expect(target()).toBe(90);
    expect(meta()).not.toBe('');
  });

  it('summonCard turns to a card by name, and refuses unknown names', () => {
    const scrollTo = vi.fn();
    initCarousel({ scrollTo });
    expect(summonCard('Wraith ')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith(wheel());
    expect(meta()).toContain('20 / 20 · Wraith');
    expect(document.activeElement).toBe(wheel());   // the next key turns the deck, not the page
    expect(summonCard('lich')).toBe(false);
  });
});

describe('initCarousel — the real-light gate', () => {
  class SeenAtOnce {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) { this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as never); }
    unobserve() {}
    disconnect() {}
  }
  beforeEach(() => {
    buildDom();
    vi.stubGlobal('IntersectionObserver', SeenAtOnce);
    initLight.mockClear();
  });
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });
  const settleImports = () => new Promise(r => setTimeout(r, 0));

  it('loads on a desktop pointer with full motion, once the deck is up', async () => {
    stubMatchMedia({ reduce: false, fine: true });
    history.replaceState(null, '', '/#card=reaper');   // skips the fly-in, so the deck is up at once
    initCarousel();
    history.replaceState(null, '', '/');
    await settleImports();
    expect(initLight).toHaveBeenCalledTimes(1);
  });
  it('never loads on touch', async () => {
    stubMatchMedia({ reduce: false, fine: false });
    initCarousel();
    await settleImports();
    expect(initLight).not.toHaveBeenCalled();
  });
  it('never loads under reduced motion', async () => {
    stubMatchMedia({ reduce: true, fine: true });
    initCarousel();
    await settleImports();
    expect(initLight).not.toHaveBeenCalled();
  });
});
