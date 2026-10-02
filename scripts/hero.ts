// The hero ships as WebP (198 KB vs the 709 KB JPEG) — but only while that WebP
// was made from the current hero.jpg. hero.jpg gets replaced by hand (GitHub
// web upload), so a stale WebP would show old art: the build compares hashes
// and falls back to the JPEG until the WebP is regenerated.
//   regenerate: magick public/hero.jpg -quality 82 -define webp:method=6 public/hero.webp
//               sha256sum public/hero.jpg | cut -d' ' -f1 > scripts/hero-webp.sha256
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

export function heroSource(): string {
  try {
    const made = readFileSync('scripts/hero-webp.sha256', 'utf8').trim();
    const now = createHash('sha256').update(readFileSync('public/hero.jpg')).digest('hex');
    if (made === now && existsSync('public/hero.webp')) return '/hero.webp';
    console.warn('[hero] public/hero.jpg changed since hero.webp was made: serving the JPEG (see scripts/hero.ts)');
  } catch { /* missing lock or image: plain JPEG */ }
  return '/hero.jpg';
}

/** Writes the chosen hero URL into index.html wherever it says %HERO%. */
export function heroHtml(src: string): Plugin {
  return {
    name: 'hero-html',
    // 'pre': Vite's own HTML pass URI-decodes href="%HERO%" and would choke on it
    transformIndexHtml: { order: 'pre', handler: html => html.replaceAll('%HERO%', src) },
  };
}
