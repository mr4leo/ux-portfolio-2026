"""Crop mockups out of a case study's 2x Figma PNG for its responsive page.

    python3 case-studies/crop-assets.py learn-vml

Boxes are in Figma points (1440 wide). With tight=True the box is shrunk to
the content, ignoring the flat page background (and the faint drop shadow).
Writes <slug>-r/<name>.webp (2x) and <name>-1x.webp.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = Path(__file__).resolve().parent

CROPS = {
    # Single-image layers come from Figma exports instead (use-exports.py)
    "thrive": {
        "confetti": ((65, 6325, 650, 6670), True),
        "onboarding-poster": ((790, 8655, 1370, 8995), True),
        "quote-mark": ((785, 9230, 860, 9320), True),
    },
}


def tighten(img, thresh=40, density=0.04):
    a = np.asarray(img).astype(int)
    # background = most common colour along the border
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    diff = np.abs(a - bg).max(axis=2) > thresh
    rows = np.where(diff.mean(axis=1) > density)[0]
    cols = np.where(diff.mean(axis=0) > density)[0]
    return img.crop((cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)), (cols[0], rows[0])


def main(slug):
    full = Image.open(HERE / f"{slug}.png").convert("RGB")
    out = HERE / f"{slug}-r"
    out.mkdir(exist_ok=True)
    for name, ((x0, y0, x1, y1), tight) in CROPS[slug].items():
        img = full.crop((x0 * 2, y0 * 2, x1 * 2, y1 * 2))
        off = (0, 0)
        if tight:
            img, off = tighten(img)
        # even pixel sizes so the 1x copy is exact
        img = img.crop((0, 0, img.width // 2 * 2, img.height // 2 * 2))
        img.save(out / f"{name}.webp", quality=82, method=6)
        img.resize((img.width // 2, img.height // 2), Image.LANCZOS).save(out / f"{name}-1x.webp", quality=82, method=6)
        print(f"{name}: {img.width // 2}x{img.height // 2} at ({x0 + off[0] / 2:.0f}, {y0 + off[1] / 2:.0f})")


if __name__ == "__main__":
    main(sys.argv[1])
