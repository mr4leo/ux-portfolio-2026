"""Convert Figma 2x PNG exports in exports/<slug>/ into the page's WebP assets.

    python3 case-studies/use-exports.py thrive

Transparent margins are trimmed. Writes <slug>-r/<name>.webp (2x) and -1x.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = Path(__file__).resolve().parent

EXPORTS = {
    "learn-vml": {
        "hero-frame": "Learn VML Platform Thumbnail.png",
        "before": "Original Homepage Screenshot.png",
        "after": "Revised Homepage Screenshot.png",
        "closer-look": "Revised Homepage Component Breakdown.png",
        "audit-screens": "Annotated Legacy Homepage.png",
        "audit-notes": "Expanded Audit Sticky Notes Panel.png",
        "board-latam": "LATAM Mockup and Detail.png",
        "board-apac": "APAC Mockup and Detail.png",
        "limits": ("Measured Blocks and Brand Tokens.png", None, 0),  # keep its baked-in shadow
        "toolkit": "Content Governance Training Image.png",
        # Brand band is composited separately: rotated gallery over the green texture
        "iter-1": "Early Homepage Design Iteration.png",
        "iter-2": "Inclusion, Equity and Belonging Page Iteration.png",
        "iter-3": "Careers Page Design Iteration.png",
        "iter-4": "Careers Page Design Iteration 4.png",
        "mobile": "Learn VML Mobile Device Presentation.png",
        "hero-mock": "Elevated Leaderboard Hero Presentation.png",
        "nav": ("Learn VML Navigation Dropdown Showcase.png", None, 8),  # translucent dropdowns
    },
    "thrive": {
        "hero-frame": "Thrive Hero Thumbnail.png",
        "before": "Original Thrive Home Screen.png",
        "after": "Redesigned Thrive Dashboard.png",
        "flows": ("AI Summary Submission Review.png", None, 8),  # translucent box
        "test-notes": "Audit - Image.png",
        "brand": "Brand Exploration Showcase.png",
        "wheel": "Thrive Cycle 1.png",
        "prototype": "Valerie's Brand Proposition (Self-Reflection) - Container.png",
        "video-old": "THRIVE App (2023) Screenshots for Demo or App Walkthrough 3.png",
        "video-new": "Video Thumbnail Photo.png",
        "topbar-old": "Thrive Orig.png",
        "topbar-new": "Header.png",
        "tabs": "MY SELF Side menu.png",
        "table": "Table.png",
        "feedback": "Feedback Req.png",  # overlaps the table
        "test-board": "Outter Stickies.png",
        "award-worklife": ("Work Life - Employee Growth 2025.png", 180),
        "award-worklife-finalist": ("Work Life - Gamification 2028.png", 180),
        "award-business": ("Business Culture - Personal Development.png", 180),
        "award-engage": ("Engage Awards - Use of Tech.png", 180),
    },
}


def _span(filled, min_run=6):
    """First and last index of the content, ignoring thin runs (stray
    divider lines caught in the export)."""
    runs, start = [], None
    for i, on in enumerate(list(filled) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if i - start >= min_run:
                runs.append((start, i))
            start = None
    return runs[0][0], runs[-1][1]


def trim(img, alpha=200):
    # Solid artwork only: soft baked-in shadows are dropped, the page adds
    # one consistent shadow in CSS
    a = np.asarray(img.getchannel("A")) > alpha
    y0, y1 = _span(a.mean(axis=1) > 0.02)
    x0, x1 = _span(a.mean(axis=0) > 0.02)
    return img.crop((x0, y0, x1, y1))


def main(slug):
    out = HERE / f"{slug}-r"
    for name, src in EXPORTS[slug].items():
        # (file, max width, alpha threshold for trimming)
        src, max_w, alpha = (*src, None, 200)[:3] if isinstance(src, tuple) else (src, None, 200)
        alpha = 200 if alpha is None else alpha
        img = trim(Image.open(HERE / "exports" / slug / src).convert("RGBA"), alpha)
        if max_w and img.width > max_w:  # small icons: no need for full size
            img = img.resize((max_w, round(img.height * max_w / img.width)), Image.LANCZOS)
        img = img.crop((0, 0, img.width // 2 * 2, img.height // 2 * 2))
        opaque = img.getchannel("A").getextrema()[0] == 255
        if opaque:
            img = img.convert("RGB")
        img.save(out / f"{name}.webp", quality=84, method=6)
        img.resize((img.width // 2, img.height // 2), Image.LANCZOS).save(out / f"{name}-1x.webp", quality=84, method=6)
        print(f"{name}: {img.width // 2}x{img.height // 2} {'opaque' if opaque else 'transparent'}")


if __name__ == "__main__":
    main(sys.argv[1])
