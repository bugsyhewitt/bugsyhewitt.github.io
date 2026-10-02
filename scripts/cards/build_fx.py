#!/usr/bin/env python3
"""Variant-cover assets for the Necromancer Suite deck (round 4).

For every card in public/cards/<name>-680.jpg this writes, to public/cards/fx/:
  <name>-foil.webp   200w white-on-transparent mask: where the cover would be foil-stamped
                     (masthead lettering, the green ectoplasm glow, red outlines up top).
                     The glare it shapes is soft, so 200w is plenty (~10 KB vs ~21 KB at 340w).
The newsprint proofs for dimmed neighbours are NOT assets: src/carousel/proof.ts screens the
already-loaded cover in the browser (same algorithm as proof() here, which only feeds the
QA sheet) — halftone dots don't compress, and 20 proofs would have cost ~0.6 MB.

Re-run after a cover changes:  python3 scripts/cards/build_fx.py [--qa OUT.jpg] [names...]
Per-card tuning lives in scripts/cards/fx.json (thresholds, exclusion boxes in 0-1 fractions).
Needs numpy + Pillow (WebP support).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / 'public' / 'cards'
OUT = CARDS / 'fx'
CONF = json.loads((Path(__file__).parent / 'fx.json').read_text())

INK = (22, 20, 18)          # --ink
PAPER = (122, 117, 106)     # aged newsprint: recedes on the void, still reads as paper


def clamp01(a):
    return np.clip(a, 0.0, 1.0)


def foil_mask(rgb: np.ndarray, cfg: dict) -> np.ndarray:
    """0..1 mask of foil-worthy pixels."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h, w = r.shape
    y = np.linspace(0, 1, h)[:, None]
    hi = np.maximum(np.maximum(r, g), b)
    lo = np.minimum(np.minimum(r, g), b)
    sat = np.where(hi > 0, (hi - lo) / np.maximum(hi, 1e-6), 0)
    light = (hi + lo) / 2

    # green ectoplasm: green clearly above red/blue, and bright
    green = clamp01((g - np.maximum(r, b) - cfg['green_t']) * 8) * clamp01((g - cfg['green_gate']) * 5)
    # mastheads live in the top band: red-outlined letters and pale silver letters
    band = (y < cfg['band']).astype(float)
    red = clamp01((r - np.maximum(g, b) - cfg['red_t']) * 6) * band
    silver = clamp01((light - cfg['silver_l']) * 6) * clamp01((cfg['silver_s'] - sat) * 8) * band

    m = np.maximum(green, np.maximum(red, silver))

    # never foil the cream frame around the art
    inset = cfg['frame']
    m[: int(h * inset), :] = 0
    m[-int(h * inset):, :] = 0
    m[:, : int(w * inset)] = 0
    m[:, -int(w * inset):] = 0
    # hand exclusions (rubble, signage, caption box ...)
    for x0, y0, x1, y1 in cfg.get('exclude', []):
        m[int(y0 * h): int(y1 * h), int(x0 * w): int(x1 * w)] = 0
    return m


def finish_mask(m: np.ndarray, width: int) -> Image.Image:
    img = Image.fromarray((m * 255).astype(np.uint8), 'L')
    img = img.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))   # close pinholes
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    rgba = Image.new('RGBA', img.size, (255, 255, 255, 0))
    rgba.putalpha(img)
    return rgba


def proof(gray: np.ndarray, width: int, period: float = 5.0) -> Image.Image:
    """One-ink 45-degree AM halftone. Rendered at 2x then downsampled for clean dots."""
    up = 2
    src = Image.fromarray((gray * 255).astype(np.uint8), 'L')
    W = width * up
    H = round(src.height * W / src.width)
    g = np.asarray(src.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    a = math.radians(45)
    u = (xx * math.cos(a) + yy * math.sin(a)) / (period * up)
    v = (-xx * math.sin(a) + yy * math.cos(a)) / (period * up)
    screen = 0.5 + 0.25 * (np.cos(2 * math.pi * u) + np.cos(2 * math.pi * v))
    ink = ((1 - g) > screen).astype(np.float32)          # darker -> bigger dots
    paper = np.array(PAPER, np.float32)
    inkc = np.array(INK, np.float32)
    out = paper * (1 - ink[..., None]) + inkc * ink[..., None]
    img = Image.fromarray(out.astype(np.uint8), 'RGB')
    return img.resize((width, round(H / up)), Image.LANCZOS)


def build(name: str) -> dict:
    cfg = {**CONF['default'], **CONF.get('cards', {}).get(name, {})}
    src = Image.open(CARDS / f'{name}-680.jpg').convert('RGB')
    rgb = np.asarray(src, dtype=np.float32) / 255
    m = foil_mask(rgb, cfg)
    OUT.mkdir(exist_ok=True)
    foil = finish_mask(m, 200)
    foil_path = OUT / f'{name}-foil.webp'
    foil.save(foil_path, 'WEBP', quality=60, method=6)
    return {'name': name, 'coverage': round(float((m > 0.5).mean()) * 100, 1),
            'foil_kb': round(foil_path.stat().st_size / 1024, 1)}


def qa_sheet(names, path: Path) -> None:
    tiles = []
    for n in names:
        cover = Image.open(CARDS / f'{n}-340.jpg').convert('RGB')
        foil = Image.open(OUT / f'{n}-foil.webp').convert('RGBA').resize(cover.size)
        lit = cover.copy()
        tint = Image.new('RGB', cover.size, (255, 40, 200))       # loud magenta: easy to spot misses
        lit.paste(tint, (0, 0), foil.split()[3])
        gray = np.asarray(cover.convert('L'), dtype=np.float32) / 255
        pr = proof(gray, cover.width, 4.0)
        tile = Image.new('RGB', (cover.width * 3 + 8, cover.height + 22), (17, 17, 17))
        for i, im in enumerate((cover, lit, pr)):
            tile.paste(im, (i * (cover.width + 4), 22))
        ImageDraw.Draw(tile).text((4, 4), n, fill=(233, 230, 221))
        tiles.append(tile)
    cols = 2
    tw, th = tiles[0].size
    rows = math.ceil(len(tiles) / cols)
    sheet = Image.new('RGB', (tw * cols, th * rows), (0, 0, 0))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * tw, (i // cols) * th))
    sheet.save(path, 'JPEG', quality=80)


if __name__ == '__main__':
    args = sys.argv[1:]
    qa = None
    if '--qa' in args:
        i = args.index('--qa')
        qa = Path(args[i + 1])
        del args[i:i + 2]
    names = args or CONF['names']
    for row in (build(n) for n in names):
        print(row)
    if qa:
        qa_sheet(names, qa)
        print('qa sheet:', qa)
