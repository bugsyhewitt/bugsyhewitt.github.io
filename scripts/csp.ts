// A Content-Security-Policy <meta>, written at build so the one inline script's
// hash can never drift from the script itself. Build only: the dev server injects
// its own inline HMR code.
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

const INLINE_JS = /<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g;

export function cspFor(html: string): string {
  const hashes = [...html.matchAll(INLINE_JS)]
    .map(m => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",   // the page's own <style> and JS-set inline styles
    "img-src 'self' data:",               // CSS cursors and grain are data: SVGs
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: html => html.replace(
        /(<meta charset="UTF-8" \/>)/,
        `$1\n<meta http-equiv="Content-Security-Policy" content="${cspFor(html)}" />`,
      ),
    },
  };
}
