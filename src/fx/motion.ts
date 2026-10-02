// The house motion: one curve for the whole site, and three durations instead of
// ad-hoc numbers. CSS --ease is cubic-bezier(.16,1,.3,1) — easings.net's easeOutExpo,
// which GSAP ships as expo.out — so a GSAP tween and a CSS transition settle alike
// (a fast lift, a long quiet settle) without CustomEase in the bundle.

/** Same curve as `--ease` in index.html. */
export const RITE = 'expo.out';

export const DUR = { short: 0.35, base: 0.7, long: 1.1 } as const;
