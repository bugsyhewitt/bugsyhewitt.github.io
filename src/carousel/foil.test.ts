import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initFoil, initTilt } from './foil';

const move = (el: EventTarget, x: number, y: number) =>
  el.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: x, clientY: y }));
const prop = (el: HTMLElement, p: string) => el.style.getPropertyValue(p);

describe('initFoil — monochrome sheen on the front card only', () => {
  let wheel: HTMLElement, front: HTMLElement, dim: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="carousel">
        <div class="carousel__item is-dim"><a class="carousel__card" id="dim"></a></div>
        <div class="carousel__item is-front"><a class="carousel__card" id="front"></a></div>
      </div>`;
    wheel = document.getElementById('carousel')!;
    front = document.getElementById('front')!;
    dim = document.getElementById('dim')!;
    front.getBoundingClientRect = () => ({ left: 100, top: 100, width: 200, height: 300 } as DOMRect);
    // synchronous frame; returns 0 like an already-consumed id so the next move schedules again
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
    initFoil(wheel);
  });
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('follows the pointer across the front card', () => {
    move(wheel, 280, 130);                 // 90% across, 10% down
    expect(prop(front, '--mx')).toBe('90.0%');
    expect(prop(front, '--my')).toBe('10.0%');
    expect(prop(front, '--ry')).toBe('4.00deg');
    expect(prop(front, '--rx')).toBe('3.20deg');
    expect(Number(prop(front, '--foil'))).toBeGreaterThan(0.6);   // flares near the corner
  });

  it('is faint at the centre and never touches the dimmed cards', () => {
    move(wheel, 200, 250);
    expect(prop(front, '--foil')).toBe('0.30');
    expect(prop(dim, '--foil')).toBe('');
  });

  it('goes dark when the pointer leaves the card or starts a drag', () => {
    move(wheel, 200, 250);
    move(wheel, 50, 50);                   // off the card, still over the wheel
    expect(prop(front, '--foil')).toBe('');
    move(wheel, 200, 250);
    wheel.dispatchEvent(new Event('pointerdown'));
    expect(prop(front, '--foil')).toBe('');
    move(wheel, 210, 250);                 // held: no sheen mid-drag
    expect(prop(front, '--foil')).toBe('');
  });
});

describe('initTilt — the gyroscope moves the light on phones', () => {
  let wheel: HTMLElement, front: HTMLElement;
  const tilt = (beta: number, gamma: number) =>
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma }));

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="carousel"><div class="carousel__item is-front"><a class="carousel__card" id="front"></a></div></div>
      <button id="deckTilt" hidden></button>`;
    wheel = document.getElementById('carousel')!;
    front = document.getElementById('front')!;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
  });
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('the first reading is neutral; tilting right and toward you moves the light', () => {
    initTilt(wheel, document.getElementById('deckTilt') as HTMLButtonElement);
    tilt(40, 0);                                    // how the phone is held: centre
    expect(prop(front, '--mx')).toBe('50.0%');
    tilt(40, 16);                                   // full tilt right
    expect(parseFloat(prop(front, '--mx'))).toBeGreaterThan(95);
    expect(parseFloat(prop(front, '--ry'))).toBeGreaterThan(4);
  });

  it('on iOS it waits for a tap that grants motion access', async () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const));
    vi.stubGlobal('DeviceOrientationEvent', { requestPermission });
    const btn = document.getElementById('deckTilt') as HTMLButtonElement;
    initTilt(wheel, btn);
    expect(btn.hidden).toBe(false);
    tilt(40, 16);
    expect(prop(front, '--mx')).toBe('');           // nothing before permission
    btn.click();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(requestPermission).toHaveBeenCalled();
    expect(btn.hidden).toBe(true);
    tilt(40, 0); tilt(40, 16);
    expect(parseFloat(prop(front, '--mx'))).toBeGreaterThan(95);
  });
});
