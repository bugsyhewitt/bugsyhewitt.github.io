import { onceInView, makeTermCursor, printLines } from '../fx/terminal';

// Loadout "compile-in": on scroll-in the columns stream like a build log — each
// header prints, then its items follow one by one, a blood cursor trailing the
// last line, resting on a final prompt when done. One-shot, lazy-mounted.
export function initLoadout(): void {
  const root = document.querySelector<HTMLElement>('.loadout');
  if (!root) return;
  root.classList.add('is-terminal');

  const cursor = makeTermCursor();
  const cols = root.querySelectorAll<HTMLElement>('.tcol');

  const rest = document.createElement('div');
  rest.className = 'term-rest';
  rest.setAttribute('aria-hidden', 'true');
  rest.innerHTML = `<span class="p">></span> loadout compiled &mdash; ${cols.length} modules `;
  root.insertAdjacentElement('afterend', rest);

  // print order: each column's header, then that column's items
  const units: HTMLElement[] = [];
  cols.forEach(col => {
    const head = col.querySelector<HTMLElement>('.tcol__head');
    if (head) units.push(head);
    col.querySelectorAll<HTMLElement>('li').forEach(li => units.push(li));
  });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    units.forEach(el => el.classList.add('printed'));
    rest.appendChild(cursor);
    return;
  }

  units.forEach(el => el.classList.add('pending'));
  onceInView(root, () => printLines(units, cursor, {
    delay: el => el.classList.contains('tcol__head') ? 130 : 55,
    done: () => rest,
    beforePrint: el => el.classList.remove('pending'),
  }));
}
