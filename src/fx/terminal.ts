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
