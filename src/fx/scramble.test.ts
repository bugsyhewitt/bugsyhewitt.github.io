import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scrambleTo } from './scramble';

describe('scrambleTo', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('span');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles el.textContent to finalText after all frames tick', () => {
    scrambleTo(el, 'HELLO', { frames: 5 });
    vi.advanceTimersByTime(40 * 5);
    expect(el.textContent).toBe('HELLO');
  });

  it('output length equals finalText.length at every intermediate frame', () => {
    const text = 'TESTING';
    scrambleTo(el, text, { frames: 8 });
    for (let i = 1; i <= 7; i++) {
      vi.advanceTimersByTime(40);
      expect(el.textContent?.length).toBe(text.length);
    }
  });

  it('preserves space characters at their exact positions during every intermediate frame', () => {
    // The reveal condition treats ' ' as always-pass-through regardless of reveal index.
    const text = 'A B C';
    scrambleTo(el, text, { frames: 10 });
    for (let i = 1; i <= 9; i++) {
      vi.advanceTimersByTime(40);
      const out = el.textContent ?? '';
      expect(out[1]).toBe(' ');
      expect(out[3]).toBe(' ');
    }
  });

  it('revealed prefix matches finalText exactly at each frame', () => {
    // At frame F of N the first Math.floor((F/N)*len) chars must be the real chars.
    const text = 'ABCDEFGHIJ';
    scrambleTo(el, text, { frames: 10 });
    for (let f = 1; f <= 9; f++) {
      vi.advanceTimersByTime(40);
      const out = el.textContent ?? '';
      const reveal = Math.floor((f / 10) * text.length);
      expect(out.slice(0, reveal)).toBe(text.slice(0, reveal));
    }
  });

  it('re-entering mid-scramble cancels the first interval and settles on the new text', () => {
    scrambleTo(el, 'FIRST', { frames: 10 });
    vi.advanceTimersByTime(40 * 3);
    scrambleTo(el, 'SECOND', { frames: 5 });
    vi.advanceTimersByTime(40 * 5);
    expect(el.textContent).toBe('SECOND');
    // Advance well past where FIRST would have finished — must not overwrite SECOND.
    vi.advanceTimersByTime(40 * 20);
    expect(el.textContent).toBe('SECOND');
  });

  it('accepts a custom glyph set and only draws from it during scramble', () => {
    // With a single-character glyph set every scrambled char must be that char.
    const text = 'ABCDE';
    scrambleTo(el, text, { frames: 10, glyphs: 'X' });
    vi.advanceTimersByTime(40); // one tick: some chars still scrambled
    const out = el.textContent ?? '';
    for (let i = 0; i < out.length; i++) {
      const ch = out[i];
      // Each char is either the revealed real char or the only glyph 'X'
      expect(ch === text[i] || ch === 'X').toBe(true);
    }
  });
});
