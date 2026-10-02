import { describe, it, expect } from 'vitest';
import { gsap } from 'gsap';
import { RITE, DUR } from './motion';

describe('house motion', () => {
  it('is one curve matching CSS --ease cubic-bezier(.16,1,.3,1) (easeOutExpo)', () => {
    const ease = gsap.parseEase(RITE);
    expect(ease(0)).toBeCloseTo(0, 3);
    expect(ease(1)).toBeCloseTo(1, 3);
    expect(ease(0.5)).toBeGreaterThan(0.9);   // a fast lift, a long quiet settle
  });
  it('has three durations', () => {
    expect(DUR.short).toBeLessThan(DUR.base);
    expect(DUR.base).toBeLessThan(DUR.long);
  });
});
