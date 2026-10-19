"""Assemble PNG frames from record-demo.mjs into a GIF.

Usage: python scripts/frames-to-gif.py <framesDir> <out.gif> [width]
"""
import json
import sys
from pathlib import Path

from PIL import Image

src = Path(sys.argv[1])
out = Path(sys.argv[2])
width = int(sys.argv[3]) if len(sys.argv) > 3 else 720
frames = sorted(src.glob("f*.png"))
times = json.loads((src / "times.json").read_text())

imgs = []
for f in frames:
    im = Image.open(f).convert("RGB")
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.NEAREST)
    imgs.append(im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))

durations = [max(60, times[i + 1] - times[i]) for i in range(len(times) - 1)] + [1500]
out.parent.mkdir(parents=True, exist_ok=True)
imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=durations[: len(imgs)], loop=0, optimize=True, disposal=1)
print(f"{out}: {len(imgs)} frames, {out.stat().st_size / 1e6:.1f} MB")
