"""Turn each case-study PDF into a fast web page of WebP slices.

Run after replacing a PDF in case-studies/:
    python3 case-studies/build.py

For each PDF it writes <slug>.html and <slug>/NN-1440.webp + NN-2880.webp.
Needs macOS (Swift renders the PDF) and Pillow.
"""

import html
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
DOCS = {
    "learn-vml": "Learn.vml",
    "open-everydai": "Open Everydai",
    "thrive": "Thrive",
}
# Looping videos (silent until tapped) laid over a spot in the PDF: (file, x, y, width, height)
# in PDF points (the 1440pt-wide Figma frame). Re-measure if the layout moves.
VIDEOS = {
    "open-everydai": ("open-everydai-sizzle.mp4", 574, 454.5, 812, 454),
}
WIDTH = 2880  # 2x the 1440px Figma frame; phones get the 1440px copies
SLICE = 2400  # px per slice at 2x, so lower slices can load lazily
QUALITY = 82

TEMPLATE = (HERE / "template.html").read_text()


def build(slug, name):
    out = HERE / slug
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            ["swift", str(HERE / "render-pdf.swift"), str(HERE / f"{slug}.pdf"), tmp, str(WIDTH), str(SLICE)],
            check=True,
        )
        imgs = []
        for i, png in enumerate(sorted(Path(tmp).glob("*.png"))):
            big = Image.open(png).convert("RGB")
            small = big.resize((big.width // 2, big.height // 2), Image.LANCZOS)
            n = png.stem
            big.save(out / f"{n}-2880.webp", quality=QUALITY, method=6)
            small.save(out / f"{n}-1440.webp", quality=QUALITY, method=6)
            imgs.append(
                f'<img src="{slug}/{n}-1440.webp" '
                f'srcset="{slug}/{n}-1440.webp 1440w, {slug}/{n}-2880.webp 2880w" '
                f'sizes="(min-width: 1440px) 1440px, 100vw" '
                f'width="{small.width}" height="{small.height}" alt=""'
                # First slices fill a phone screen: load now; the rest on scroll
                + (' fetchpriority="high"' if i == 0 else '' if i < 3 else ' loading="lazy" decoding="async"')
                + " />"
            )
        text = (Path(tmp) / "text.txt").read_text()
        page_height = sum(Image.open(p).height for p in Path(tmp).glob("*.png")) / (WIDTH / 1440)

    video = ""
    if slug in VIDEOS:
        file, x, y, w, h = VIDEOS[slug]
        pct = lambda v, total: f"{v / total * 100:.4f}%"
        video = (
            f'<button type="button" class="viewer-video" style="left: {pct(x, 1440)}; '
            f'top: {pct(y, page_height)}; width: {pct(w, 1440)}; height: {pct(h, page_height)};">'
            f'<video src="{file}" autoplay muted loop playsinline preload="auto"></video>'
            f'<span class="viewer-video__badge" aria-hidden="true"></span></button>'
        )

    paragraphs = "\n".join(
        f"      <p>{html.escape(line.strip())}</p>" for line in text.splitlines() if line.strip()
    )
    page = (
        TEMPLATE.replace("{{name}}", name)
        .replace("{{slug}}", slug)
        .replace("{{images}}", "\n      ".join(imgs))
        .replace("{{video}}", video)
        .replace("{{text}}", paragraphs)
    )
    (HERE / f"{slug}.html").write_text(page)
    size = sum(f.stat().st_size for f in out.glob("*-1440.webp")) / 1e6
    print(f"{slug}: {len(imgs)} slices, {size:.1f} MB at 1440px")


if __name__ == "__main__":
    for slug, name in DOCS.items():
        build(slug, name)
