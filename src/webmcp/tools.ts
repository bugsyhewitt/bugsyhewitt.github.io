// WebMCP tools: what an AI agent in the visitor's browser may ask the grimoire.
// All four only read what the page already shows. Each call leaves a notice in
// the séance, and a notice names a matched relic at most, never the agent's input.
import { CARDS, repoUrl } from '../carousel/cards';
import { raisedOn } from '../raised';
import { WHOAMI, DOSSIER } from '../contact/seance';

// The slice of WebMCP used here (developer.chrome.com/docs/ai/webmcp).
export interface ModelContextTool {
  name: string;          // ≤30 chars
  title?: string;
  description: string;   // ≤500 chars; answers ≤1.5K
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean };
  execute(args: Record<string, unknown>, client?: { signal?: AbortSignal }): unknown;
}

export interface ModelContext {
  // Chrome 149 returns nothing; the current spec returns a promise
  registerTool(tool: ModelContextTool, opts?: { signal?: AbortSignal }): Promise<void> | void;
}

// The spec now hangs it off document; Chrome 149 (the origin trial's first
// release) still has it on navigator.
declare global {
  interface Document { modelContext?: ModelContext }
  interface Navigator { modelContext?: ModelContext }
}

export interface Channel { channel: string; value: string; url?: string }

/** The contact rows as the séance prints them. Read before any click relabels discord. */
export function readChannels(root: ParentNode = document): Channel[] {
  return Array.from(root.querySelectorAll<HTMLElement>('#seanceBody .chan')).map(el => {
    const ch: Channel = {
      channel: el.querySelector('.chan__k')?.textContent || '',
      value: el.querySelector('.chan__v')?.textContent || '',
    };
    const href = el.getAttribute('href');
    if (href) ch.url = href;
    return ch;
  });
}

const NO_INPUT = { type: 'object', properties: {} };
const READ_ONLY = { readOnlyHint: true };

export function buildTools(channels: Channel[], notify: (text: string) => void): ModelContextTool[] {
  return [
    {
      name: 'list_relics',
      title: 'List the relics',
      description: 'List the twenty tools in Bugsy Hewitt\'s Necromancer Suite: abandoned open-source ' +
        'security tools, each raised again as a new repo. Returns every relic\'s name and the original ' +
        'tool it resurrects. Call summon_relic for one relic\'s details.',
      inputSchema: NO_INPUT,
      annotations: READ_ONLY,
      execute() {
        notify('[agent] counted the relics');
        return { relics: CARDS.map(c => ({ name: c.name, raises: c.raises })) };
      },
    },
    {
      name: 'summon_relic',
      title: 'Summon a relic',
      description: 'Details for one Necromancer Suite tool by name, for example "reaper": the original ' +
        'tool it resurrects, what it does, its GitHub repo and when it was last pushed. list_relics gives ' +
        'every name.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Relic name, for example reaper' } },
        required: ['name'],
      },
      annotations: READ_ONLY,
      execute({ name } = {}) {
        const card = typeof name === 'string' ? CARDS.find(c => c.name === name.trim().toLowerCase()) : undefined;
        if (!card) {
          notify('[agent] dug where nothing lies');
          return { error: 'nothing by that name in the ground', hint: 'call list_relics for the twenty names' };
        }
        notify(`[agent] summoned ${card.name}`);
        return { name: card.name, raises: card.raises, tagline: card.tagline, repo: repoUrl(card), lastRaised: raisedOn(card.name) };
      },
    },
    {
      name: 'get_dossier',
      title: 'Read the dossier',
      description: 'Who keeps this site: Bugsy Hewitt, offensive security researcher and bug bounty hunter. ' +
        'Returns a short profile with practice areas and the platforms he hunts on.',
      inputSchema: NO_INPUT,
      annotations: READ_ONLY,
      execute() {
        notify('[agent] read the dossier');
        return { whoami: WHOAMI, ...Object.fromEntries(DOSSIER) };
      },
    },
    {
      name: 'contact_channels',
      title: 'Contact channels',
      description: 'How to reach Bugsy Hewitt, as listed in the séance on this page: GitHub, email, ' +
        'Discord handle and Instagram.',
      inputSchema: NO_INPUT,
      annotations: READ_ONLY,
      execute() {
        notify('[agent] asked for the channels');
        return { channels };
      },
    },
  ];
}
