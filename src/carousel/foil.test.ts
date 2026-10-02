import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initFoil } from './foil';

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
