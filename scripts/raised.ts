// Build-time "last raised" data: when each repo was last pushed.
// Never throws — any network/API failure falls back to this site's own last
// commit date, so a build never depends on GitHub being reachable.
import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';

export interface Raised {
  latest: string;                  // newest date across the site and every repo (YYYY-MM-DD)
  repos: Record<string, string>;   // repo name -> last push (YYYY-MM-DD); missing on failure
}

const OWNER = 'bugsyhewitt';

function siteDate(): string {
  try { return execSync('git log -1 --format=%cs', { encoding: 'utf8' }).trim(); }
  catch { return new Date().toISOString().slice(0, 10); }
}

export async function fetchRaised(repos: string[], offline: boolean): Promise<Raised> {
  const site = siteDate();
  if (offline) return { latest: site, repos: {} };
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': `${OWNER}.github.io build`,
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const found = await Promise.all(repos.map(async (name): Promise<[string, string] | null> => {
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${name}`,
        { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const { pushed_at } = await res.json() as { pushed_at?: string };
      return pushed_at ? [name, pushed_at.slice(0, 10)] : null;
    } catch { return null; }
  }));
  const dates = Object.fromEntries(found.filter((e): e is [string, string] => e !== null));
  const latest = [site, ...Object.values(dates)].sort().at(-1)!;
  return { latest, repos: dates };
}

// Bakes the dates into index.html so they read without JS:
//   %RAISED%               -> newest date
//   <!--raised:repo-name--> -> <span class="raised" data-raised="…">raised …</span> (nothing if unknown)
export function raisedHtml(raised: Raised): Plugin {
  return {
    name: 'raised-html',
    transformIndexHtml: html => html
      .replaceAll('%RAISED%', raised.latest)
      .replace(/<!--raised:([\w.-]+)-->/g, (_, name: string) => {
        const d = raised.repos[name];
        return d ? `<span class="raised" data-raised="${d}">raised ${d}</span>` : '';
      }),
  };
}
