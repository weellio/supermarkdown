"""Draw windows/supermarkdown.ico: the M-arrow mark from the favicon, all Windows sizes.

    python scripts/make_icon.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 1024  # draw big, scale down for clean edges
K = S / 32  # the favicon is drawn on a 32-unit grid

M = [(6, 22), (6, 10), (9, 10), (12, 14), (15, 10), (18, 10), (18, 22), (15, 22), (15, 15), (12, 19), (9, 15), (9, 22)]
ARROW = [(23, 22), (19, 17), (22, 17), (22, 10), (24, 10), (24, 17), (27, 17)]

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((0, 0, S - 1, S - 1), radius=int(7 * K), fill=(37, 99, 235, 255))
for shape in (M, ARROW):
    d.polygon([(x * K, y * K) for x, y in shape], fill=(255, 255, 255, 255))

out = ROOT / "windows" / "supermarkdown.ico"
img.save(out, sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64), (128, 128), (256, 256)])
print(out, out.stat().st_size, "bytes")
