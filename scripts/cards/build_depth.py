#!/usr/bin/env python3
"""Depth maps for the Real-light front card (round 4).

  python3 scripts/cards/build_depth.py [names...]

1. Relative depth from Depth Anything V2 *Small* (Apache-2.0 — the larger variants are
   CC-BY-NC, never use them), CPU is fine (~1 s/card). Raw maps are cached in
   ~/.cache/bugsy-cards-depth/raw/<name>.png so re-runs only post-process.
   Needs: torch + transformers (only when a raw map is missing).
2. Post-process to public/cards/fx/<name>-depth.webp, 340w, near = white:
   - dilate + blur so silhouettes don't smear,
   - everything that is lettering or paper sits exactly on the focal plane (128) so it never
     moves under parallax: masthead band, caption box, and the cream frame on all sides,
   - the art between is remapped so its median is 128 and its range ~[40, 230].
   Cards listed in fx.json "depth_flat" ship a flat 128 map (depth was unusable).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / 'public' / 'cards'
OUT = CARDS / 'fx'
CONF = json.loads((Path(__file__).parent / 'fx.json').read_text())
CACHE = Path.home() / '.cache' / 'bugsy-cards-depth' / 'raw'
MODEL = 'depth-anything/Depth-Anything-V2-Small-hf'

TOP, BOTTOM, FEATHER = 0.25, 0.14, 0.04      # masthead band, caption band, blend width (of height)


def raw_depth(name: str) -> np.ndarray:
    path = CACHE / f'{name}.png'
    if not path.exists():
        from transformers import pipeline   # heavy: only when needed
        CACHE.mkdir(parents=True, exist_ok=True)
        pipe = raw_depth.pipe = getattr(raw_depth, 'pipe', None) or pipeline('depth-estimation', model=MODEL, device='cpu')
        img = Image.open(CARDS / f'{name}-680.jpg').convert('RGB')
        d = np.squeeze(np.asarray(pipe(img)['predicted_depth'], dtype=np.float32))
        d = np.asarray(Image.fromarray(d).resize(img.size, Image.BICUBIC))
        d = (d - d.min()) / max(float(d.max() - d.min()), 1e-6)
        Image.fromarray((d * 255).round().astype(np.uint8), 'L').save(path)
    return np.asarray(Image.open(path).convert('L'), dtype=np.float32) / 255


def pinned_weight(h: int, w: int, frame: float) -> np.ndarray:
    """1 where the art may move, 0 on lettering/paper, feathered in between."""
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    f = FEATHER
    top = np.clip((y - TOP) / f, 0, 1)
    bot = np.clip((1 - BOTTOM - y) / f, 0, 1)
    left = np.clip((x - frame) / (f * h / w), 0, 1)
    right = np.clip((1 - frame - x) / (f * h / w), 0, 1)
    return top * bot * left * right


def build(name: str) -> dict:
    cfg = {**CONF['default'], **CONF.get('cards', {}).get(name, {})}
    OUT.mkdir(exist_ok=True)
    out = OUT / f'{name}-depth.webp'
    if name in CONF.get('depth_flat', []):
        flat = Image.new('L', (340, 507), 128)
        flat.convert('RGB').save(out, 'WEBP', quality=80, method=6)
        return {'name': name, 'flat': True, 'kb': round(out.stat().st_size / 1024, 1)}
    d = raw_depth(name)
    h, w = d.shape
    img = Image.fromarray((d * 255).astype(np.uint8), 'L')
    img = img.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3))
    d = np.asarray(img, dtype=np.float32) / 255
    wgt = pinned_weight(h, w, cfg['frame'])
    art = d[wgt > 0.99]
    med = float(np.median(art)) if art.size else 0.5
    lo, hi = np.percentile(art, 2), np.percentile(art, 98)
    scale = min(102 / max(med - lo, 1e-6), 102 / max(hi - med, 1e-6)) / 255   # ~[26..230] around 128
    v = 128 + (d - med) * scale * 255
    v = np.clip(v, 40, 230)
    v = 128 + (v - 128) * wgt                 # pin lettering + paper to the focal plane
    small = Image.fromarray(v.round().astype(np.uint8), 'L').resize((340, round(h * 340 / w)), Image.LANCZOS)
    small.convert('RGB').save(out, 'WEBP', quality=80, method=6)
    return {'name': name, 'median': round(med, 3), 'kb': round(out.stat().st_size / 1024, 1)}


if __name__ == '__main__':
    for row in (build(n) for n in (sys.argv[1:] or CONF['names'])):
        print(row)
