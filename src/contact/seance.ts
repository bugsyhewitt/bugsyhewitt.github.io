// The séance takes commands. After the channel manifest prints, a prompt opens
// under it: help · whoami · ls relics · summon <relic> · cat dossier · clear.
// `summon` turns the deck to that card. Typed input only ever reaches the page
// through textContent. Agents calling the WebMCP tools (src/webmcp) leave a
// notice here too, via stir().
import { CARDS } from '../carousel/cards';
import { summonCard } from '../carousel';
import { printLines } from '../fx/terminal';
import { keystroke, thump } from '../fx/sound';

const PS = 'necromancer@localhost ~ %';
const KEEP = 60;   // lines of scrollback

// whoami and the dossier, shared with the agent tools
export const WHOAMI = 'bugsy hewitt. offensive security researcher and bug bounty hunter. builds autonomous hunting tools.';
export const DOSSIER: [string, string][] = [
  ['subject', 'bugsy hewitt'],
  ['practice', 'web, web3 and api targets, by hand and with agents'],
  ['platforms', 'hackerone, immunefi'],
  ['paper copy', 'print this page'],
];

// Set by initSeanceCommands; lets the agent tools speak in the séance.
let stirLine: ((text: string) => void) | null = null;

/** Leave an agent's notice in the séance. Held until the prompt opens. */
export function stir(text: string): void {
  stirLine?.(text);
}

export interface Reply {
  lines: string[];
  clear?: boolean;
  then?: () => void;   // runs once the reply has printed
}

const unknown = (input: string): Reply => ({ lines: [`the dead don't answer to '${input}'. try help`] });
const noSuchRelic: Reply = { lines: ['nothing by that name in the ground. try ls relics'] };

export function respond(input: string): Reply {
  const said = input.trim().replace(/\s+/g, ' ');
  const [cmd = '', ...rest] = said.toLowerCase().split(' ');
  const arg = rest.join(' ');
  switch (cmd) {
    case '':
      return { lines: [] };
    case 'help':
      return arg ? unknown(said) : { lines: ['help · whoami · ls relics · summon <relic> · cat dossier · clear'] };
    case 'whoami':
      return arg ? unknown(said) : { lines: [WHOAMI] };
    case 'ls':
      return arg === '' || arg === 'relics' ? { lines: [CARDS.map(c => c.name).join('  ')] } : unknown(said);
    case 'summon': {
      const card = CARDS.find(c => c.name === arg);
      if (!card) return noSuchRelic;
      return { lines: [`raising ${card.name}…`], then: () => { thump(); summonCard(card.name); } };
    }
    case 'cat':
      return arg === 'dossier'
        ? { lines: DOSSIER.map(([k, v]) => `${k} ${'.'.repeat(14 - k.length)} ${v}`) }
        : unknown(said);
    case 'clear':
      return arg ? unknown(said) : { lines: [], clear: true };
    default:
      return unknown(said);
  }
}

export interface Seance {
  /** Reveal the prompt; returns it so the terminal cursor can park there. */
  open(): HTMLElement;
}

export function initSeanceCommands(body: HTMLElement, cursor: HTMLElement, reduce: boolean): Seance {
  const after = body.querySelector<HTMLElement>('[data-last]') || body.lastElementChild;

  const hint = document.createElement('div');
  hint.className = 'sline sline--dim';
  hint.setAttribute('data-line', '');
  hint.textContent = '[ type help ]';

  const out = document.createElement('div');
  out.className = 'seance__out';
  out.setAttribute('aria-live', 'polite');

  const prompt = document.createElement('form');
  prompt.className = 'seance__prompt';
  prompt.hidden = true;
  prompt.innerHTML =
    `<label class="sr-only" for="seanceCmd">Séance command. Type help for the list.</label>` +
    `<span class="seance__ps" aria-hidden="true">${PS}</span>` +
    `<input class="seance__input" id="seanceCmd" type="text" autocomplete="off" autocapitalize="off" ` +
    `autocorrect="off" spellcheck="false" enterkeyhint="go" maxlength="80">`;
  const input = prompt.querySelector<HTMLInputElement>('input')!;

  after?.after(hint, out, prompt);

  // the block cursor trails the text, so the input is exactly as wide as what's typed
  const fit = (): void => { input.style.width = `${input.value.length}ch`; };
  input.addEventListener('input', fit);
  input.addEventListener('keydown', e => { if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') keystroke(); });
  prompt.addEventListener('click', () => input.focus());
  // iOS zooms the page into any input under 16px, and the terminal type is 11.5px on a
  // phone. maximum-scale stops that focus zoom; iOS ignores it for pinch-zoom, so the page
  // stays zoomable. iOS only (-webkit-touch-callout): elsewhere it would block pinch-zoom.
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport && CSS.supports?.('-webkit-touch-callout', 'none') && !/maximum-scale/.test(viewport.content)) {
    viewport.content += ', maximum-scale=1';
  }

  const history: string[] = [];
  let back = 0;
  input.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!history.length) return;
    e.preventDefault();
    back = Math.max(0, Math.min(history.length, back + (e.key === 'ArrowUp' ? 1 : -1)));
    input.value = back ? history[history.length - back] : '';
    fit();
  });

  const line = (text: string): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'sline';
    el.textContent = text;
    return el;
  };
  const trim = (): void => { while (out.childElementCount > KEEP) out.firstElementChild!.remove(); };

  // agent notices print one at a time, never over a reply that is still printing
  const pending: string[] = [];
  let opened = false, printing = 0;
  const flush = (): void => {
    if (!opened || printing || !pending.length) return;
    const el = line(`~ a presence stirs… ${pending.shift()}`);   // ~ not ⟡: the mono subsets lack U+27E1
    out.append(el);
    trim();
    if (reduce) { el.classList.add('printed'); flush(); return; }
    printing++;
    printLines([el], cursor, {
      delay: () => 40,
      done: () => { printing--; window.setTimeout(flush); return prompt; },
    });
  };
  stirLine = text => {
    pending.push(text);
    if (pending.length > KEEP) pending.shift();
    flush();
  };

  prompt.addEventListener('submit', e => {
    e.preventDefault();
    const said = input.value;
    input.value = ''; fit(); back = 0;
    if (said.trim()) history.push(said.trim());
    const reply = respond(said);
    if (reply.clear) { out.replaceChildren(); return; }
    const lines = [`${PS} ${said}`, ...reply.lines].map(line);
    lines[0].classList.add('sline--echo');
    out.append(...lines);
    trim();
    if (reduce) { lines.forEach(el => el.classList.add('printed')); reply.then?.(); return; }
    printing++;
    printLines(lines, cursor, {
      delay: () => 40,
      done: () => { printing--; reply.then?.(); window.setTimeout(flush); return prompt; },
    });
  });

  return {
    open() { prompt.hidden = false; opened = true; flush(); return prompt; },
  };
}
