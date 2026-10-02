import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeTermCursor, onceInView, printLines } from './terminal';

describe('makeTermCursor', () => {
  it('returns a <span> with class term-cursor and aria-hidden="true"', () => {
    const el = makeTermCursor();
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toBe('term-cursor');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('returns a fresh element each call — not a shared singleton', () => {
    const a = makeTermCursor();
    const b = makeTermCursor();
    expect(a).not.toBe(b);
  });
});

describe('onceInView', () => {
  let ioCallback: IntersectionObserverCallback;
  let disconnected = false;

  afterEach(() => {
    vi.restoreAllMocks();
    disconnected = false;
  });

  function stubIO() {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) { ioCallback = cb; }
        observe(_: Element) {}
        disconnect() { disconnected = true; }
      },
    );
  }

  function fire(isIntersecting: boolean) {
    ioCallback(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  }

  it('fires the callback exactly once even when called multiple times', () => {
    stubIO();
    const el = document.createElement('div');
    const cb = vi.fn();
    onceInView(el, cb);

    fire(true);
    fire(true);
    fire(true);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('disconnects the observer after the first intersection', () => {
    stubIO();
    const el = document.createElement('div');
    onceInView(el, vi.fn());

    fire(true);

    expect(disconnected).toBe(true);
  });

  it('does not fire the callback when the entry is not intersecting', () => {
    stubIO();
    const el = document.createElement('div');
    const cb = vi.fn();
    onceInView(el, cb);

    fire(false);

    expect(cb).not.toHaveBeenCalled();
  });

  it('fires after a non-intersecting entry followed by an intersecting one', () => {
    stubIO();
    const el = document.createElement('div');
    const cb = vi.fn();
    onceInView(el, cb);

    fire(false);
    fire(true);

    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('printLines', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('prints in order, trailing the cursor, and parks it on done()', () => {
    vi.useFakeTimers();
    const items = [0, 1, 2].map(() => document.createElement('div'));
    const park = document.createElement('div');
    const cursor = makeTermCursor();
    const seen: number[] = [];
    printLines(items, cursor, { delay: () => 100, done: () => park, beforePrint: el => seen.push(items.indexOf(el)) });

    expect(items[0].classList.contains('printed')).toBe(true);   // first line is immediate
    expect(items[1].classList.contains('printed')).toBe(false);
    expect(cursor.parentElement).toBe(items[0]);
    vi.advanceTimersByTime(100);
    expect(items[1].classList.contains('printed')).toBe(true);
    expect(cursor.parentElement).toBe(items[1]);
    vi.advanceTimersByTime(200);
    expect(items.every(el => el.classList.contains('printed'))).toBe(true);
    expect(cursor.parentElement).toBe(park);
    expect(seen).toEqual([0, 1, 2]);
  });

  it('waits delay(el) after each line', () => {
    vi.useFakeTimers();
    const items = [0, 1].map(() => document.createElement('div'));
    printLines(items, makeTermCursor(), { delay: el => (el === items[0] ? 500 : 0), done: () => items[1] });
    vi.advanceTimersByTime(499);
    expect(items[1].classList.contains('printed')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(items[1].classList.contains('printed')).toBe(true);
  });
});
