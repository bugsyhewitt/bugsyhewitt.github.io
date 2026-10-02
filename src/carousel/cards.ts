// The Necromancer Suite: twenty abandoned open-source tools, each raised as a
// card. `raises` and `tagline` are transcribed from the printed covers in
// public/cards/ — the art is the source of truth; keep these in step with it.

export interface Card {
  name: string;     // slug: card image basename + github.com/bugsyhewitt/<name>
  raises: string;   // the original tool the card resurrects (as printed: "RESURRECTS …")
  tagline: string;  // the caption box at the foot of the cover
}

export const CARDS: Card[] = [
  { name: 'autopsy', raises: 'BinAbsInspector', tagline: 'Whole-program binary CWE analysis with angr-backed taint tracking.' },
  { name: 'covenant', raises: 'SCMKit', tagline: 'SCM recon and token validation across GitHub, GitLab, Bitbucket.' },
  { name: 'doppelganger', raises: 'smuggler.py', tagline: 'Headless HTTP desync scanner for modern request smuggling.' },
  { name: 'embalmer', raises: 'firmeye', tagline: 'Firmware pipeline: extract, scan for credentials, hand off for analysis.' },
  { name: 'enshroud', raises: 'GraphQLmap', tagline: 'GraphQL attack-surface scanner: introspection, depth DoS, alias batching.' },
  { name: 'exhumed', raises: 'Panoptic', tagline: 'Local File Inclusion exploitation against a live file-path database.' },
  { name: 'ferryman', raises: 'OFX', tagline: 'OFX financial-file scanner for fintech parser confusion and PII.' },
  { name: 'graverobber', raises: 'subjack', tagline: 'Subdomain-takeover hunter for dangling CNAME, NS, and SPF records.' },
  { name: 'hellhound', raises: 'IoTSeeker', tagline: 'IoT default-credential scanner for cameras, routers, and forgotten devices.' },
  { name: 'mangle', raises: 'H26Forge', tagline: 'H.265 codec fuzzer mutating HEVC bitstreams against decoders.' },
  { name: 'omen', raises: 'MAIAN', tagline: 'Trace-vulnerability scanner for greedy, suicidal, and reentrant contracts.' },
  { name: 'oracle', raises: 'mythril', tagline: 'Symbolic-execution analyzer for EVM bytecode vulnerabilities.' },
  { name: 'ossuary', raises: 'xunfeng', tagline: 'SQLite-backed network asset inventory for solo bug hunters.' },
  { name: 'ouija', raises: 'LLMFuzzer', tagline: 'LLM endpoint fuzzer for the OWASP LLM Top 10.' },
  { name: 'possession', raises: 'hodor', tagline: 'Replays your request as other users to break broken authorization.' },
  { name: 'reaper', raises: 'race-the-web', tagline: 'Single-packet race-condition engine for the bugs scanners can\'t see.' },
  { name: 'seance', raises: 'shhgit', tagline: 'Watches the public commit stream for leaked keys and secrets.' },
  { name: 'tombstone', raises: 'credential-digger', tagline: 'Credential extraction with hard scope enforcement and HackerOne reports.' },
  { name: 'unearth', raises: 'cloudflare-enum', tagline: 'Finds the true origin IP hidden behind any CDN.' },
  { name: 'wraith', raises: 'SSRFmap', tagline: 'SSRF fuzzer that steals cloud metadata and pivots inward.' },
];

export const repoUrl = (c: Card): string => `https://github.com/bugsyhewitt/${c.name}`;
export const title = (c: Card): string => c.name.charAt(0).toUpperCase() + c.name.slice(1);
