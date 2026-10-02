import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let made = 0;
class FakeContext {
  state = 'running'; currentTime = 1; sampleRate = 8000; destination = {};
  constructor() { made++; }
  resume() { return Promise.resolve(); }
  createBuffer() { return { getChannelData: () => new Float32Array(10) }; }
  createBufferSource() { return { connect: (n: unknown) => n, start() {}, stop() {}, buffer: null }; }
  createBiquadFilter() { const n = { frequency: { value: 0 }, Q: { value: 0 }, type: '', connect: (x: unknown) => x }; return n; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }; }
  createOscillator() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x, start() {}, stop() {} }; }
}

const fresh = async () => { vi.resetModules(); return import('./sound'); };
const button = () => {
  document.body.innerHTML = '<button id="soundToggle" aria-pressed="false" hidden>x</button>';
  return document.getElementById('soundToggle') as HTMLButtonElement;
};

describe('opt-in sound', () => {
  beforeEach(() => { made = 0; localStorage.clear(); vi.stubGlobal('AudioContext', FakeContext); });
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('is muted by default and shows its toggle', async () => {
    const s = await fresh();
    const btn = button();
    s.initSound(btn);
    expect(btn.hidden).toBe(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(s.soundOn()).toBe(false);
    s.tick(); s.keystroke(); s.thump();          // all silent, nothing created
    expect(made).toBe(0);
  });

  it('turns on with a tap, remembers it, and only then makes an audio context', async () => {
    const s = await fresh();
    const btn = button();
    s.initSound(btn);
    btn.click();
    expect(s.soundOn()).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('bh-sound')).toBe('1');
    expect(made).toBe(1);
    expect(() => { s.tick(200); s.keystroke(); s.thump(); }).not.toThrow();
  });

  it('a remembered "on" still waits for a gesture before any audio exists', async () => {
    localStorage.setItem('bh-sound', '1');
    const s = await fresh();
    s.initSound(button());
    expect(s.soundOn()).toBe(true);
    expect(made).toBe(0);                        // page load alone: nothing can play
    window.dispatchEvent(new Event('pointerdown'));
    expect(made).toBe(1);
  });
});
