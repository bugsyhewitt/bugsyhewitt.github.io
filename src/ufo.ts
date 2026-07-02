// AlienClaw's ride — a visitor, not a resident. New random airspace every load,
// bounded by the zone's rendered box so CSS breakpoints stay the single source.
export function initUfo(): void {
  const ufo = document.getElementById('ufo');
  const zone = ufo?.parentElement;
  if (!ufo || !zone) return;
  const bobHeadroom = 10; // ufo-bob lifts the craft ~9px
  const maxLeft = Math.max(0, zone.clientWidth - ufo.offsetWidth);
  const maxTop = Math.max(bobHeadroom, zone.clientHeight - ufo.offsetHeight);
  ufo.style.left = `${Math.round(Math.random() * maxLeft)}px`;
  ufo.style.top = `${Math.round(bobHeadroom + Math.random() * (maxTop - bobHeadroom))}px`;
}
