import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildTools, readChannels, type Channel } from './tools';
import { CARDS } from '../carousel/cards';
import { WHOAMI } from '../contact/seance';

const CHANNELS: Channel[] = [
  { channel: 'github', value: '/bugsyhewitt', url: 'https://github.com/bugsyhewitt' },
  { channel: 'discord', value: 'bugsy5899' },
];

const setup = () => {
  const said: string[] = [];
  const tools = buildTools(CHANNELS, text => said.push(text));
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    tools.find(t => t.name === name)!.execute(args);
  return { tools, said, call };
};

describe('webmcp tools — what an agent may ask the grimoire', () => {
  it('offers four tools, all read-only', () => {
    const { tools } = setup();
    expect(tools.map(t => t.name)).toEqual(['list_relics', 'summon_relic', 'get_dossier', 'contact_channels']);
    tools.forEach(t => expect(t.annotations?.readOnlyHint).toBe(true));
  });

  it('stays inside the browser limits: names ≤30, descriptions ≤500', () => {
    setup().tools.forEach(t => {
      expect(t.name.length).toBeLessThanOrEqual(30);
      expect(t.description.length).toBeLessThanOrEqual(500);
    });
  });

  it('every answer fits the 1.5K output limit', async () => {
    const { call } = setup();
    for (const [name, args] of [['list_relics'], ['summon_relic', { name: 'credential-digger' }],
      ['summon_relic', { name: 'tombstone' }], ['get_dossier'], ['contact_channels']] as const) {
      expect(JSON.stringify(await call(name, args)).length).toBeLessThanOrEqual(1500);
    }
  });

  it('list_relics names all twenty, in deck order', async () => {
    const { call, said } = setup();
    const r = await call('list_relics') as { relics: { name: string; raises: string }[] };
    expect(r.relics.map(c => c.name)).toEqual(CARDS.map(c => c.name));
    expect(r.relics[0]).toEqual({ name: 'autopsy', raises: 'BinAbsInspector' });
    expect(said).toEqual(['[agent] counted the relics']);
  });

  it('summon_relic forgives case and spacing', async () => {
    const { call, said } = setup();
    expect(await call('summon_relic', { name: '  Reaper ' })).toMatchObject({
      name: 'reaper',
      raises: 'race-the-web',
      tagline: CARDS.find(c => c.name === 'reaper')!.tagline,
      repo: 'https://github.com/bugsyhewitt/reaper',
    });
    expect(said).toEqual(['[agent] summoned reaper']);
  });

  it('summon_relic refuses what is not in the ground, without repeating it', async () => {
    const { call, said } = setup();
    const r = await call('summon_relic', { name: '<img src=x onerror=alert(1)>' });
    expect(r).toHaveProperty('error');
    expect(JSON.stringify(r)).not.toContain('onerror');
    expect(said).toEqual(['[agent] dug where nothing lies']);
  });

  it('summon_relic without a usable name refuses the same way', async () => {
    const { call, said } = setup();
    expect(await call('summon_relic', {})).toHaveProperty('error');
    expect(await call('summon_relic', { name: 42 })).toHaveProperty('error');
    expect(said).toEqual(['[agent] dug where nothing lies', '[agent] dug where nothing lies']);
  });

  it('get_dossier reads the séance\'s own dossier', async () => {
    const { call, said } = setup();
    expect(await call('get_dossier')).toMatchObject({
      whoami: WHOAMI,
      subject: 'bugsy hewitt',
      platforms: 'hackerone, immunefi',
    });
    expect(said).toEqual(['[agent] read the dossier']);
  });

  it('contact_channels hands back the channels it was built with', async () => {
    const { call, said } = setup();
    expect(await call('contact_channels')).toEqual({ channels: CHANNELS });
    expect(said).toEqual(['[agent] asked for the channels']);
  });
});

describe('readChannels — the séance markup is the single source', () => {
  it('reads the four channel rows from index.html, discord without a url', () => {
    const page = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
    expect(readChannels(page)).toEqual([
      { channel: 'github', value: '/bugsyhewitt', url: 'https://github.com/bugsyhewitt' },
      { channel: 'email', value: 'bugsyhewitt@gmail.com', url: 'mailto:bugsyhewitt@gmail.com' },
      { channel: 'discord', value: 'bugsy5899' },
      { channel: 'instagram', value: '@bugsyhewitt', url: 'https://instagram.com/bugsyhewitt' },
    ]);
  });
});
