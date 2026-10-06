import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { cspFor } from './csp';

const sha = (s: string) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

describe('cspFor', () => {
  it('allows exactly the inline scripts the page ships, by hash', () => {
    const inline = "document.documentElement.className='js'";
    const html = `<head><script>${inline}</script><script type="module" src="/assets/x.js"></script>
      <script type="application/ld+json">{"@type":"Person"}</script></head>`;
    const csp = cspFor(html);
    expect(csp).toContain(`script-src 'self' ${sha(inline)}`);
    expect(csp).not.toContain(sha('{"@type":"Person"}'));   // data blocks don't execute
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("object-src 'none'");
  });
  it("is just 'self' when nothing is inline", () => {
    expect(cspFor('<script src="/a.js"></script>')).toContain("script-src 'self';");
  });
});
