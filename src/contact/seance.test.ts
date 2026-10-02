import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const summonCard = vi.fn(() => true);
vi.mock('../carousel', () => ({ summonCard: (n: string) => summonCard(n) }));

import { respond, initSeanceCommands } from './seance';
import { CARDS } from '../carousel/cards';

describe('respond — the séance answers', () => {
  it('help lists the commands', () => {
    expect(respond('help').lines).toEqual(['help · whoami · ls relics · summon <relic> · cat dossier · clear']);
  });
  it('whoami, case and spacing forgiven', () => {
    expect(respond('  WhoAmI ').lines[0]).toMatch(/^bugsy hewitt\. offensive security researcher/);
  });
  it('ls relics names all twenty cards', () => {
    const [line] = respond('ls relics').lines;
    expect(line.split(/\s+/)).toEqual(CARDS.map(c => c.name));
    expect(respond('ls').lines).toEqual(respond('ls relics').lines);
  });
  it('summon raises a known relic and turns the deck once printed', () => {
    const r = respond('summon Reaper');
    expect(r.lines).toEqual(['raising reaper…']);
    r.then!();
    expect(summonCard).toHaveBeenCalledWith('reaper');
  });
  it('summon refuses what is not in the ground', () => {
    expect(respond('summon lich').lines).toEqual(['nothing by that name in the ground. try ls relics']);
    expect(respond('summon').lines).toEqual(['nothing by that name in the ground. try ls relics']);
  });
  it('cat dossier prints the subject file', () => {
    expect(respond('cat dossier').lines).toHaveLength(4);
    expect(respond('cat dossier').lines[0]).toBe('subject ....... bugsy hewitt');
  });
  it('anything else gets the in-voice refusal, echoing what was said', () => {
    expect(respond('sudo shutdown now').lines).toEqual(["the dead don't answer to 'sudo shutdown now'. try help"]);
    expect(respond('help me').lines).toEqual(["the dead don't answer to 'help me'. try help"]);
  });
  it('blank input is silent; clear clears', () => {
    expect(respond('   ').lines).toEqual([]);
    expect(respond('clear').clear).toBe(true);
  });
});

describe('initSeanceCommands — the prompt', () => {
  let body: HTMLElement;
  const submit = (text: string) => {
    const input = document.getElementById('seanceCmd') as HTMLInputElement;
    input.value = text;
    input.form!.dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const out = () => [...document.querySelectorAll('.seance__out .sline')].map(e => e.textContent);

  beforeEach(() => {
    document.body.innerHTML = `<div id="seanceBody"><div class="sline" data-line data-last>[ four channels open ]</div></div>`;
    body = document.getElementById('seanceBody')!;
  });
  afterEach(() => { document.body.innerHTML = ''; summonCard.mockClear(); });

  it('adds the hint and a hidden prompt after the manifest, opened on demand', () => {
    const s = initSeanceCommands(body, document.createElement('span'), true);
    expect(body.children[1].textContent).toBe('[ type help ]');
    expect(body.children[1].hasAttribute('data-line')).toBe(true);    // prints with the manifest
    const prompt = body.querySelector<HTMLFormElement>('.seance__prompt')!;
    expect(prompt.hidden).toBe(true);
    expect(s.open()).toBe(prompt);
    expect(prompt.hidden).toBe(false);
  });

  it('echoes the command and prints the reply as text, never markup', () => {
    initSeanceCommands(body, document.createElement('span'), true).open();
    submit('<img src=x onerror=alert(1)>');
    expect(out()).toEqual([
      'necromancer@v3x ~ % <img src=x onerror=alert(1)>',
      "the dead don't answer to '<img src=x onerror=alert(1)>'. try help",
    ]);
    expect(document.querySelector('.seance__out img')).toBeNull();
  });

  it('summon turns the deck; clear empties the output', () => {
    initSeanceCommands(body, document.createElement('span'), true).open();
    submit('summon wraith');
    expect(summonCard).toHaveBeenCalledWith('wraith');
    submit('clear');
    expect(out()).toEqual([]);
  });

  it('↑ recalls the last command', () => {
    initSeanceCommands(body, document.createElement('span'), true).open();
    submit('whoami');
    const input = document.getElementById('seanceCmd') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
    expect(input.value).toBe('whoami');
  });
});
