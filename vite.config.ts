import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { fetchRaised, raisedHtml } from './scripts/raised';
import { deckNoscript } from './scripts/deck-noscript';
import { heroSource, heroHtml } from './scripts/hero';
import { CARDS } from './src/carousel/cards';

export default defineConfig(async ({ command }) => {
  // dev server and RAISED_OFFLINE builds skip the network (CI PR builds set it)
  const raised = await fetchRaised(
    ['alienclaw', 'chimera', ...CARDS.map(c => c.name)],
    command === 'serve' || !!process.env.RAISED_OFFLINE,
  );
  const hero = heroSource();
  return {
    base: '/',
    define: { __RAISED__: JSON.stringify(raised), __HERO__: JSON.stringify(hero) },
    plugins: [glsl(), raisedHtml(raised), deckNoscript(), heroHtml(hero)],
    build: {
      outDir: 'dist',
      assetsInlineLimit: 0
    }
  };
});
