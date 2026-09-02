import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeTermCursor, onceInView } from './terminal';

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
