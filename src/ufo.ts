// AlienClaw's ride — a visitor, not a resident. New random airspace every load,
// bounded by the zone's rendered box so CSS breakpoints stay the single source.
export function initUfo(): void {
  const ufo = document.getElementById('ufo');
  const zone = ufo?.parentElement;
  if (!ufo || !zone) return;
  const sway = 20;        // ufo-drift swings the craft ~18px sideways
  const bobHeadroom = 12; // ...and lifts it ~10px
  const maxLeft = Math.max(sway, zone.clientWidth - ufo.offsetWidth - sway);
  const maxTop = Math.max(bobHeadroom, zone.clientHeight - ufo.offsetHeight);
  ufo.style.left = `${Math.round(sway + Math.random() * (maxLeft - sway))}px`;
  ufo.style.top = `${Math.round(bobHeadroom + Math.random() * (maxTop - bobHeadroom))}px`;
}
