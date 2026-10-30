import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../contact/seance', () => ({ stir: vi.fn(), WHOAMI: '', DOSSIER: [] }));

import { initWebMCP } from './index';

type Reg = { name: string; signal?: AbortSignal };
const browserWith = (register: (r: Reg) => void | Promise<void>): Reg[] => {
  const seen: Reg[] = [];
  (document as any).modelContext = {
    registerTool: async (tool: { name: string }, opts?: { signal?: AbortSignal }) => {
      const r = { name: tool.name, signal: opts?.signal };
      seen.push(r);
      await register(r);
    },
  };
  return seen;
};

describe('initWebMCP — handing the tools to the browser', () => {
  afterEach(() => {
    delete (document as any).modelContext;
    delete (navigator as any).modelContext;
    vi.restoreAllMocks();
  });

  it('finds the older navigator.modelContext, whose registerTool returns nothing (Chrome 149)', async () => {
    const names: string[] = [];
    (navigator as any).modelContext = { registerTool: (tool: { name: string }) => { names.push(tool.name); } };
    await initWebMCP();
    expect(names).toEqual(['list_relics', 'summon_relic', 'get_dossier', 'contact_channels']);
  });

  it('a synchronous refusal still withdraws the rest', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const signals: AbortSignal[] = [];
    (navigator as any).modelContext = {
      registerTool: (tool: { name: string }, opts: { signal: AbortSignal }) => {
        signals.push(opts.signal);
        if (tool.name === 'summon_relic') throw new TypeError('bad schema');
      },
    };
    await initWebMCP();
    expect(signals[0].aborted).toBe(true);
  });

  it('does nothing where the browser has no WebMCP', async () => {
    await expect(initWebMCP()).resolves.toBeUndefined();
  });

  it('registers all four tools under one signal', async () => {
    const seen = browserWith(() => {});
    await initWebMCP();
    expect(seen.map(r => r.name)).toEqual(['list_relics', 'summon_relic', 'get_dossier', 'contact_channels']);
    expect(new Set(seen.map(r => r.signal)).size).toBe(1);
    expect(seen[0].signal?.aborted).toBe(false);
  });

  it('withdraws every tool if the browser refuses one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const seen = browserWith(r => {
      if (r.name === 'get_dossier') throw new DOMException('duplicate tool name', 'InvalidStateError');
    });
    await initWebMCP();
    expect(seen[0].signal?.aborted).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });
});
