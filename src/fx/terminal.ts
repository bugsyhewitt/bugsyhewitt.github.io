// Shared bits for the terminal print-in effects (loadout + séance).

// Fire cb once, the first time el nears the viewport, then stop observing.
export function onceInView(el: Element, cb: () => void, rootMargin = '200px'): void {
  let played = false;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && !played) { played = true; io.disconnect(); cb(); }
    });
  }, { rootMargin });
  io.observe(el);
}

// A blinking block cursor that trails the terminal output.
export function makeTermCursor(): HTMLElement {
  const c = document.createElement('span');
  c.className = 'term-cursor';
  c.setAttribute('aria-hidden', 'true');
  return c;
}

interface PrintOpts {
  delay: (el: HTMLElement) => number;
  done: () => HTMLElement;
  beforePrint?: (el: HTMLElement) => void;
}

// Print items one-by-one, moving cursor to each newly printed line.
// delay(el) → ms to wait after el; done() → element to park cursor on finish.
export function printLines(items: HTMLElement[], cursor: HTMLElement, opts: PrintOpts): void {
  let i = 0;
  (function next(): void {
    if (i >= items.length) { opts.done().appendChild(cursor); return; }
    const el = items[i];
    opts.beforePrint?.(el);
    el.classList.add('printed');
    el.appendChild(cursor);
    i++;
    window.setTimeout(next, opts.delay(el));
  })();
}
