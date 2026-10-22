"""Trims, splits and compresses the generated city sprites into public/city/*.webp + manifest.json.

Usage: python3 scripts/process-city-assets.py   (from the project root)
"""
import json
import os
from PIL import Image

RAW = "public/city/raw"
OUT = "public/city"
MAX = {"building": 768, "prop": 384, "char": 512}
manifest = {}


def trim(img):
    # Drop the faint alpha halo before measuring the box, so trimming is tight.
    alpha = img.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    box = alpha.getbbox()
    return img.crop(box) if box else img


def save(img, name, kind):
    img = trim(img)
    limit = MAX[kind]
    scale = min(1.0, limit / max(img.size))
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    img.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=88, method=6)
    manifest[name] = {"w": img.width, "h": img.height}


for file in sorted(os.listdir(RAW)):
    if not file.endswith(".png"):
        continue
    name = file[:-4]
    img = Image.open(os.path.join(RAW, file)).convert("RGBA")
    if name.startswith("c") and name[1:].isdigit():
        half = img.width // 2
        save(img.crop((0, 0, half, img.height)), f"{name}-front", "char")
        save(img.crop((half, 0, img.width, img.height)), f"{name}-back", "char")
    elif name in ("sakura", "tree", "vending", "bench", "fountain"):
        save(img, name, "prop")
    else:
        save(img, name, "building")

with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=1)
print(len(manifest), "sprites")
