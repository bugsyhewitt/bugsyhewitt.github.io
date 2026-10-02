// Without scripts the deck can't be built, so the build writes the twenty
// cards into index.html as a plain <noscript> list (same data as the wheel).
import type { Plugin } from 'vite';
import { CARDS, repoUrl, title } from '../src/carousel/cards';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function deckNoscript(): Plugin {
  const items = CARDS.map(c =>
    `<li><a href="${repoUrl(c)}">${esc(title(c))}</a>, resurrects ${esc(c.raises)}: ${esc(c.tagline)}</li>`).join('');
  return {
    name: 'deck-noscript',
    transformIndexHtml: html =>
      html.replace('<!--deck-noscript-->', `<noscript><ul class="deck-list">${items}</ul></noscript>`),
  };
}
