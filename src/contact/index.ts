import { magnetize } from '../fx/magnet';
import { onceInView, makeTermCursor } from '../fx/terminal';

// Séance terminal: on scroll-in the channel manifest prints line by line, a
// blood cursor resting at the end. Channel rows are real links; discord copies
// its handle. Links magnetize toward the cursor on desktop hover. Lazy, once.
export function initContact(): void {
  const term = document.getElementById('seance');
  const body = document.getElementById('seanceBody');
  if (!term || !body) return;

  const lines = Array.from(body.querySelectorAll<HTMLElement>('[data-line]'));
  const last = body.querySelector<HTMLElement>('[data-last]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const cursor = makeTermCursor();

  // discord channel copies its handle (the visible span is the single source)
  const discord = body.querySelector<HTMLElement>('#discordCopy');
  if (discord) {
    const val = discord.querySelector<HTMLElement>('.chan__v');
    const orig = val ? (val.textContent || '') : '';
    let t = 0;

    // hidden live region so screen readers hear copy confirmation
    const live = document.createElement('span');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
    document.body.appendChild(live);

    discord.addEventListener('click', e => {
      e.preventDefault();
      try { navigator.clipboard.writeText(orig).catch(() => {}); } catch {}
      if (val) {
        val.textContent = 'copied ✓';
        window.clearTimeout(t);
        t = window.setTimeout(() => { val.textContent = orig; }, 1600);
      }
      live.textContent = '';
      window.requestAnimationFrame(() => { live.textContent = 'Discord handle copied to clipboard'; });
      window.setTimeout(() => { live.textContent = ''; }, 2000);
    });
  }

  // magnetic channel links (desktop hover only)
  if (fine && !reduce) {
    body.querySelectorAll<HTMLElement>('.chan').forEach(link => magnetize(link, 8, 0.3));
  }

  if (reduce) { (last || lines[lines.length - 1])?.appendChild(cursor); return; }

  term.classList.add('is-live');
  onceInView(term, run);

  function run(): void {
    let i = 0;
    (function next(): void {
      if (i >= lines.length) { (last || lines[lines.length - 1]).appendChild(cursor); return; }
      const el = lines[i];
      el.classList.add('printed');
      el.appendChild(cursor);
      i++;
      window.setTimeout(next, el.hasAttribute('data-last') ? 260 : 150);
    })();
  }
}
