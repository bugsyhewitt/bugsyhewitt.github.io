// AlienClaw's ride — parked over its tab. Random spot along the row each load,
// bounded by the row's rendered width so CSS breakpoints stay the single source.
export function initUfo(): void {
  const ufo = document.getElementById('ufo');
  const row = ufo?.parentElement;
  if (!ufo || !row) return;
  const sway = 20; // ufo-drift swings the craft ~18px sideways
  const max = Math.max(sway, row.clientWidth - ufo.offsetWidth - sway);
  ufo.style.left = `${Math.round(sway + Math.random() * (max - sway))}px`;
}
