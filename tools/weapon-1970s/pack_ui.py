"""Trim the Blender HUD renders and pack them as WebP for the game.

python3 tools/weapon-1970s/pack_ui.py   (after render_ui.py)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "outputs/weapon-ui"
DST = ROOT / "public/ui/weapons"
DST.mkdir(parents=True, exist_ok=True)
total = 0
for png in sorted(SRC.glob("*.png")):
    im = Image.open(png).convert("RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 6 else 0).getbbox()
    if box:
        pad = 6
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
        im = im.crop(box)
    if png.stem.endswith("-side"):
        im.thumbnail((480, 200), Image.LANCZOS)
    else:
        im.thumbnail((640, 380), Image.LANCZOS)
    out = DST / f"{png.stem}.webp"
    im.save(out, "WEBP", quality=88, method=6)
    total += out.stat().st_size
print("packed", len(list(DST.glob("*.webp"))), "files,", total, "bytes")
