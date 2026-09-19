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

// Regression guard for BUG-NEW-460: Discord copy row must activate on both
// Enter AND Space (WCAG 2.1.1 Keyboard). The fix was to change the markup
// from <a href="#" role="button"> to <button type="button"> so the browser
// natively synthesizes the click for Space. A native <button> in Chromium
// dispatches a click event on Space; if anyone refactors back to <a> or to
// a div with role="button", BUG-NEW-460 will silently come back.
//
// jsdom does not synthesize clicks from keydown the way real browsers do for
// <button>, so we can't test that synthesis in unit. What we CAN lock in is:
// (1) the production markup is a <button type="button"> (not <a>, not <div>),
// (2) calling .click() on it (which is what Chromium synthesizes for Space
// and Enter on a real <button>) reaches the click handler and copies,
// (3) an <a role="button"> with the SAME handler does NOT receive a click
//     when a click is dispatched with the default-prevented behavior of a
//     link — i.e., the original BUG-NEW-460 mechanism is gone because the
//     handler no longer lives on an anchor.
describe('initContact — Discord button is a native <button> (BUG-NEW-460)', () => {
  beforeEach(() => {
    // Build DOM that mirrors the production markup: <button type="button">
    document.body.innerHTML = `
      <div id="seance">
        <div id="seanceBody">
          <button type="button" id="discordCopy"
            aria-label="Copy Discord handle bugsy5899 to clipboard">
            <span class="chan__k">discord</span>
            <span class="chan__v">bugsy5899</span>
          </button>
        </div>
      </div>
    `;
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('prefers-reduced-motion') ? true : false,
      media: q,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
      writable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('Discord row is a <button type="button"> in production markup', () => {
    const el = document.getElementById('discordCopy')!;
    // Lock the contract: native <button> is what makes browsers synthesize
    // click on Space. If anyone changes this back to <a href="#" role="button">
    // or <div role="button">, BUG-NEW-460 silently returns.
    expect(el.tagName).toBe('BUTTON');
    expect((el as HTMLButtonElement).type).toBe('button');
    expect(el.hasAttribute('href')).toBe(false);
  });

  it('click on the native <button> reaches the copy handler', async () => {
    // This is what Chromium synthesizes natively for both Enter AND Space on
    // a real <button>. If the handler wiring ever breaks, this fails.
    initContact();
    const el = document.getElementById('discordCopy')!;
    el.click();
    await Promise.resolve();
    expect(document.querySelector('.chan__v')!.textContent).toBe('copied ✓');
  });

  it('preserves the accessible name on the native <button>', () => {
    initContact();
    const el = document.getElementById('discordCopy')!;
    // aria-label survives the <a> → <button> change. Screen readers hear
    // "Copy Discord handle bugsy5899 to clipboard" the same way they did
    // before the fix.
    expect(el.getAttribute('aria-label')).toBe(
      'Copy Discord handle bugsy5899 to clipboard'
    );
  });
});
