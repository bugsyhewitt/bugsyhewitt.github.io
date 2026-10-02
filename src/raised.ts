// "Last raised": repo push dates baked in at build (scripts/raised.ts).
// Blood marks only work pushed in the last 30 days — judged at view time, so a
// missed rebuild lets the mark lapse instead of lying.
declare const __RAISED__: { latest: string; repos: Record<string, string> } | undefined;

const DATA = typeof __RAISED__ === 'undefined' ? { latest: '', repos: {} } : __RAISED__;
const ALIVE_MS = 30 * 864e5;

export const raisedOn = (repo: string): string | undefined => DATA.repos[repo];
export const isAlive = (date: string | undefined, now = Date.now()): boolean =>
  !!date && now - Date.parse(date) < ALIVE_MS;

/** Mark every server-rendered [data-raised] date that is still alive. */
export function markAlive(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-raised]').forEach(el =>
    el.classList.toggle('is-alive', isAlive(el.dataset.raised)));
}
