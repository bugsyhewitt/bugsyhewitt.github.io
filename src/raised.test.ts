import { describe, it, expect } from 'vitest';
import { isAlive, markAlive } from './raised';

const NOW = Date.parse('2026-10-02T12:00:00Z');

describe('raised — blood marks only live work', () => {
  it('a push inside 30 days is alive', () => {
    expect(isAlive('2026-09-03', NOW)).toBe(true);
  });
  it('a push older than 30 days is not', () => {
    expect(isAlive('2026-08-01', NOW)).toBe(false);
  });
  it('an unknown date is never alive', () => {
    expect(isAlive(undefined, NOW)).toBe(false);
    expect(isAlive('', NOW)).toBe(false);
  });
  it('markAlive toggles .is-alive on server-rendered dates', () => {
    document.body.innerHTML = `<span data-raised="2999-01-01"></span><span data-raised="2001-01-01"></span>`;
    markAlive();
    const [fresh, stale] = document.querySelectorAll('span');
    expect(fresh.classList.contains('is-alive')).toBe(true);
    expect(stale.classList.contains('is-alive')).toBe(false);
  });
});
