import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initContact } from './index';

// Minimal DOM required by initContact: #seance, #seanceBody, #discordCopy .chan__v
function buildDom(origText = 'bugsy#1234') {
  document.body.innerHTML = `
    <div id="seance">
      <div id="seanceBody">
        <div id="discordCopy" role="button" tabindex="0">
          <span class="chan__v">${origText}</span>
        </div>
      </div>
    </div>
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

function click() {
  document.getElementById('discordCopy')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function val() {
  return document.querySelector<HTMLElement>('.chan__v')!;
}

function setClipboard(impl: (() => any) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: impl ? { writeText: vi.fn(impl) } : undefined,
    configurable: true,
    writable: true,
  });
}

describe('initContact — discord clipboard copy', () => {
  beforeEach(() => {
    buildDom();
    // reduce=true avoids animation setup (no IntersectionObserver needed).
    // fine=false avoids magnetize (gsap quickTo on real DOM).
    stubMatchMedia({ reduce: true, fine: false });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows "copied ✓" when clipboard write resolves', async () => {
    setClipboard(() => Promise.resolve());
    initContact();
    click();
    await Promise.resolve(); // flush the resolved .then(onSuccess)
    expect(val().textContent).toBe('copied ✓');
  });

  it('shows "copy failed" when clipboard write rejects', async () => {
    setClipboard(() => Promise.reject(new Error('denied')));
    initContact();
    click();
    await Promise.resolve(); // flush the rejected .then(_, onFail)
    expect(val().textContent).toBe('copy failed');
  });

  it('shows "copy failed" immediately when writeText throws synchronously', () => {
    setClipboard(() => { throw new Error('insecure context'); });
    initContact();
    click();
    expect(val().textContent).toBe('copy failed');
  });

  it('shows "copy failed" when navigator.clipboard is undefined', () => {
    setClipboard(undefined);
    initContact();
    click();
    expect(val().textContent).toBe('copy failed');
  });

  it('shows "copy failed" when writeText returns a non-thenable', () => {
    setClipboard(() => undefined); // returns undefined, not a Promise
    initContact();
    click();
    expect(val().textContent).toBe('copy failed');
  });

  it('resets val text to original 1600 ms after a successful copy', async () => {
    setClipboard(() => Promise.resolve());
    initContact();
    click();
    await Promise.resolve();
    expect(val().textContent).toBe('copied ✓');
    vi.advanceTimersByTime(1600);
    expect(val().textContent).toBe('bugsy#1234');
  });

  it('resets val text to original 2400 ms after a failed copy', async () => {
    setClipboard(() => Promise.reject(new Error()));
    initContact();
    click();
    await Promise.resolve();
    expect(val().textContent).toBe('copy failed');
    vi.advanceTimersByTime(2400);
    expect(val().textContent).toBe('bugsy#1234');
  });

  it('second click clears the first reset timer — text stays changed until second timer fires', async () => {
    setClipboard(() => Promise.resolve());
    initContact();

    // First click — starts a 1600 ms reset timer.
    click();
    await Promise.resolve();
    expect(val().textContent).toBe('copied ✓');

    // Advance partway through the first timer.
    vi.advanceTimersByTime(800);

    // Second click — clears first timer and starts a fresh 1600 ms one.
    click();
    await Promise.resolve();
    expect(val().textContent).toBe('copied ✓');

    // 800 ms past the first deadline: if the first timer weren't cleared, text
    // would have reset already. It shouldn't.
    vi.advanceTimersByTime(800);
    expect(val().textContent).toBe('copied ✓');

    // Complete the second timer.
    vi.advanceTimersByTime(800);
    expect(val().textContent).toBe('bugsy#1234');
  });
});
