"""Generates the dochigarden logo SVGs in this folder (and /favicon.svg).

The mark: a hedgehog (dochi) — a half-circle body, one eye, eight spines set
just off the body — watching a sprout (garden) grow in front of it.

    python3 brand/build.py            # SVGs only
    python3 brand/build.py --export   # also PNG / JPG / WebP into brand/export/
                                      # and /apple-touch-icon.png
                                      # (brew install librsvg webp; sips ships with macOS)
"""
import math
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
INK, LEAF, PAPER, LEAF_LIGHT = "#34382C", "#5E7A52", "#F4EFE3", "#9DB58C"
DARK = "#23271E"                                # JPG backdrop for the dark mark


def n(v):
    return f"{round(v, 2):g}"


def mark(sw=3.2, eye=2.6):
    """Hedgehog + sprout paths in a 108×46 box. Returns (hedgehog, sprout)."""
    cx, cy, r = 42, 43, 26                      # body centre sits on the ground line
    spines = []
    for i in range(8):                          # 194°…334°, every 20°
        a = math.radians(194 + 20 * i)
        x0, y0 = cx + 30 * math.cos(a), cy + 30 * math.sin(a)
        x1, y1 = cx + 40 * math.cos(a), cy + 40 * math.sin(a)
        spines.append(f"M{n(x0)} {n(y0)}L{n(x1)} {n(y1)}")
    hog = (f'<path d="M{cx - r} {cy}A{r} {r} 0 0 1 {cx + r} {cy}Z{"".join(spines)}" '
           f'fill="none" stroke-width="{sw}"/>'
           f'<circle cx="{cx + 13}" cy="{cy - 11}" r="{eye}" stroke="none"/>')
    sx, s = 97, 1.6                             # sprout base on the same ground line
    q = lambda a, b: f"{n(sx + (a - 12) * s)} {n(cy + (b - 21) * s)}"
    sprout = (f'<path d="M{q(12, 21)}L{q(12, 10)}'
              f'M{q(12, 13)}C{q(12, 10)} {q(14, 8)} {q(17, 8)}C{q(17, 11)} {q(15, 13)} {q(12, 13)}Z'
              f'M{q(12, 15)}C{q(12, 12)} {q(10, 10)} {q(7, 10)}C{q(7, 13)} {q(9, 15)} {q(12, 15)}Z" '
              f'fill="none" stroke-width="{sw}"/>')
    return hog, sprout


def favicon_hog():
    cx, cy, r = 8.3, 12, 4.6
    spines = ""
    for i in range(8):
        a = math.radians(200 + 130 * i / 7)
        spines += (f"M{n(cx + 6.3 * math.cos(a))} {n(cy + 6.3 * math.sin(a))}"
                   f"L{n(cx + 8 * math.cos(a))} {n(cy + 8 * math.sin(a))}")
    return (f'<path d="M{n(cx - r)} {cy}A{r} {r} 0 0 1 {n(cx + r)} {cy}Z{spines}" '
            f'fill="none" stroke-width="1.5"/>'
            f'<circle cx="{n(cx + 1.7)}" cy="{n(cy - 1.5)}" r="0.9" stroke="none"/>')


def svg(view, body, title="dochigarden"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" '
            f'stroke-linecap="round" stroke-linejoin="round"><title>{title}</title>{body}</svg>\n')


def colored(hog_c, sprout_c, **kw):
    hog, sprout = mark(**kw)
    return f'<g fill="{hog_c}" stroke="{hog_c}">{hog}</g><g stroke="{sprout_c}">{sprout}</g>'


VIEW = "0 0 108 46"
files = {
    HERE / "dochigarden-mark.svg": svg(VIEW, colored(INK, LEAF)),
    HERE / "dochigarden-mark-dark.svg": svg(VIEW, colored(PAPER, LEAF_LIGHT)),
    HERE / "dochigarden-mark-ink.svg": svg(VIEW, colored(INK, INK)),
    # square, paper background: avatars, social profiles
    HERE / "dochigarden-avatar.svg": svg("0 0 120 120",
        f'<rect width="120" height="120" fill="{PAPER}"/>'
        f'<g transform="translate(6 39)">{colored(INK, LEAF)}</g>'),
    # square, paper background, safe under a circular crop (Discord, Slack):
    # the mark is shrunk to sit inside the circle and stroked heavier for 48px
    HERE / "dochigarden-icon-round.svg": svg("0 0 120 120",
        f'<rect width="120" height="120" fill="{PAPER}"/>'
        f'<g transform="translate(16.8 41.6) scale(0.8)">{colored(INK, LEAF, sw=4.6, eye=3.4)}</g>'),
    # home-screen icon: heavier strokes so it survives 180px and below
    HERE / "apple-touch-icon.svg": svg("0 0 120 120",
        f'<rect width="120" height="120" fill="{PAPER}"/>'
        f'<g transform="translate(6 37)">{colored(INK, LEAF, sw=4.4, eye=3.4)}</g>'),
    # browser tab: the hedgehog alone, redrawn on a 16px grid, follows the tab's theme
    HERE.parent / "favicon.svg": svg("0 0 16 16",
        '<style>.h{fill:%s;stroke:%s}@media (prefers-color-scheme:dark){.h{fill:%s;stroke:%s}}</style>'
        % (INK, INK, PAPER, PAPER) + f'<g class="h">{favicon_hog()}</g>'),
}
for path, text in files.items():
    path.write_text(text)
    print("wrote", path.relative_to(HERE.parent))

# name → (width in px, JPG background; None when the SVG already has one)
EXPORTS = {
    "dochigarden-mark": (2048, PAPER),
    "dochigarden-mark-dark": (2048, DARK),
    "dochigarden-mark-ink": (2048, "#FFFFFF"),
    "dochigarden-avatar": (1024, None),
    "dochigarden-icon-round": (1024, None),
}


def run(*cmd):
    subprocess.run(cmd, check=True, capture_output=True)


if "--export" in sys.argv:
    out = HERE / "export"
    out.mkdir(exist_ok=True)
    for name, (width, jpg_bg) in EXPORTS.items():
        src = str(HERE / f"{name}.svg")
        png, jpg, webp = (out / f"{name}.{ext}" for ext in ("png", "jpg", "webp"))
        run("rsvg-convert", "-w", str(width), src, "-o", str(png))
        run("cwebp", "-quiet", "-lossless", str(png), "-o", str(webp))
        with tempfile.NamedTemporaryFile(suffix=".png") as flat:
            run("rsvg-convert", "-w", str(width), *(["-b", jpg_bg] if jpg_bg else []), src, "-o", flat.name)
            run("sips", "-s", "format", "jpeg", "-s", "formatOptions", "92", flat.name, "--out", str(jpg))
        for f in (png, jpg, webp):
            print("wrote", f.relative_to(HERE.parent))
    run("rsvg-convert", "-w", "180", str(HERE / "apple-touch-icon.svg"), "-o", str(HERE.parent / "apple-touch-icon.png"))
    print("wrote apple-touch-icon.png")
