# PROJECT OVERVIEW — bugsyhewitt.github.io Vite migration

This folder contains everything needed to convert your single-file portfolio site into a Vite + TypeScript project that supports the Codrops grid-deformation-effect on the hero. The work is split into two independent packets — each meant to be handed to its own Claude Code session.

## What's in this folder

- `PACKET-A-vite-scaffold.md` → first Claude Code session
- `PACKET-B-distortion-effect.md` → second Claude Code session, after A is verified working
- `index.html` → clean baseline of your current site (broken WebGL leftovers removed)
- `index.html.with-broken-distortion` → the previous version, kept for reference only — don't deploy
- `hero.jpg`, `sigils.jpg`, `logo.png` → site assets (deploy with the project)
- `hero.png`, `hero-dark.png` → **README assets only** (these belong in the separate `bugsyhewitt` profile repo, NOT here)
- `README.md` → your profile README (also belongs in the `bugsyhewitt` repo, not this site repo)

## Why two packets

Each Claude Code session works best with a single bounded job. Packet A is a mechanical migration with zero new features — low-risk, easy to verify. Packet B is the actual effect drop-in — needs a working scaffold to land on. If you tried to do both in one session, a confused agent could touch unrelated things and break the static site.

## Recommended order

1. **First Claude Code session — Packet A**
   - Hand it `PACKET-A-vite-scaffold.md` and `index.html` (and the three image files).
   - Verify locally: `npm install && npm run dev`, site looks identical to the current live one.
   - Push to GitHub. Verify live site at bugsyhewitt.github.io still looks identical.
   - **Only proceed once this is solid.** If Packet A is broken, Packet B has nothing to land on.

2. **Second Claude Code session — Packet B**
   - Hand it `PACKET-B-distortion-effect.md` and the working Vite project from step 1.
   - This packet has heavier specs because the Codrops integration has real failure modes.
   - Verify locally first, then push.

## What the user needs to do once before any of this

When you push to GitHub for the first time after Packet A lands, you'll need to enable Actions-based deployment:

1. Go to `https://github.com/bugsyhewitt/bugsyhewitt.github.io/settings/pages`
2. Under "Build and deployment" → "Source", select **"GitHub Actions"** (not "Deploy from a branch")
3. Save. From this point on, every push to `main` auto-builds and deploys.

This is a one-time setting. Packet A's deploy.yml workflow handles everything after.

## What's NOT in scope here

- The README in the `bugsyhewitt` profile repo (separate repo, no changes needed)
- The SWAP placeholders in the Grimoire section (real repo links, project blurbs) — these are content edits, fine to do in-line anytime
- Any new visual changes to the site beyond the distortion

## If something goes wrong

If after Packet A the site looks different than current production:
- Compare with the current live site at bugsyhewitt.github.io
- The migration goal is **pixel-identical** — any drift is a bug in the migration
- Don't proceed to Packet B until this is fixed

If after Packet B the effect doesn't show or shows broken:
- The acceptance criteria require working in dev AND production
- Check the J0SUKE repo source directly — don't have the agent re-implement from a description
- The whole point of using GPGPU + their actual shaders is that the math is hard to get right by improvisation

## Honest note from prior sessions

I (the assistant who scoped this) tried to implement this effect inline six times in the single-file version and each version was broken in a different way. The reason isn't that the effect is impossible — it's that GPGPU fluid simulation cannot be hand-improvised from memory and shoehorned into a `<script>` tag. The actual J0SUKE code works because it's structured properly: shaders in separate files, compute pass separate from render pass, real Three.js patterns. The Vite migration unlocks all of that.

So: trust the packets. Don't let the agent take shortcuts.
