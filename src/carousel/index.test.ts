import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gsap } from 'gsap';
import { initCarousel } from './index';

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
// where the most recent wheel tween is headed
const target = () => {
  const tweens = gsap.getTweensOf(items());
  return tweens.length ? (tweens[tweens.length - 1].vars.rotation as number) : null;
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
    expect(target()).toBeNull();
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
    expect(target()).toBeNull();
  });

  it('only the first card is a tab stop before the wheel has settled', () => {
    initCarousel();
    const tabbable = [...document.querySelectorAll<HTMLElement>('.carousel__card')].filter(a => a.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });

  it('initCarousel is a no-op when #carousel is missing', () => {
    document.body.innerHTML = '';
    expect(() => initCarousel()).not.toThrow();
  });
});
