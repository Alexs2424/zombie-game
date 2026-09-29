#!/usr/bin/env python3
"""Original seamless zombie surface maps. Deterministic, no third-party assets.

Python 3 + numpy + Pillow. Run from anywhere to recreate the project's maps.
All synthesis, filtering and finite differences wrap on a torus.
Normal maps use OpenGL (+Y), tangent space, and should be read as Non-Color.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SIZE = 512
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/textures/zombies'
DOCS = ROOT / 'docs/zombie-assets'
OUT.mkdir(parents=True, exist_ok=True)
DOCS.mkdir(parents=True, exist_ok=True)
SEED = 271828
rng = np.random.default_rng(SEED)
yy, xx = np.mgrid[:SIZE, :SIZE].astype(np.float32)
fx = np.fft.fftfreq(SIZE)[None, :]
fy = np.fft.fftfreq(SIZE)[:, None]


def blur(a, sigma):
    kernel = np.exp(-2 * np.pi**2 * sigma**2 * (fx**2 + fy**2))
    return np.fft.ifft2(np.fft.fft2(a) * kernel).real


def noise(sigma):
    a = blur(rng.normal(size=(SIZE, SIZE)), sigma)
    return np.clip(a / (a.std() * 3), -1, 1)


def dots(count, radius, amplitude=1.0, vary=.45):
    a = np.zeros((SIZE, SIZE))
    for _ in range(count):
        cx, cy = rng.uniform(0, SIZE, 2)
        r = radius * rng.uniform(1 - vary, 1 + vary)
        reach = int(np.ceil(3 * r))
        xs = np.arange(int(cx) - reach, int(cx) + reach + 1)
        ys = np.arange(int(cy) - reach, int(cy) + reach + 1)
        dx, dy = np.meshgrid(xs - cx, ys - cy)
        patch = np.exp(-(dx * dx + dy * dy) / (2 * r * r))
        patch *= amplitude * rng.uniform(.5, 1)
        a[np.ix_(ys % SIZE, xs % SIZE)] += patch
    return a


def veins():
    """Thin branching subcutaneous marks, never painted as loud dark lines."""
    a = np.zeros((SIZE, SIZE))
    def branch(x, y, angle, length, strength, recurse):
        for n in range(length):
            angle += rng.normal(0, .075)
            x += np.cos(angle) * 1.8
            y += np.sin(angle) * 1.8
            a[int(y) % SIZE, int(x) % SIZE] += strength
            if recurse and n in (length // 3, length * 2 // 3):
                branch(x, y, angle + rng.choice([-1, 1]) * .55,
                       max(8, length // 3), strength * .45, False)
    for _ in range(8):
        branch(*rng.uniform(0, SIZE, 2), rng.uniform(0, 2*np.pi),
               int(rng.integers(32, 90)), rng.uniform(.6, 1), True)
    return np.clip(blur(a, .85), 0, 1)


def gray(a):
    return np.repeat(np.clip(a, 0, 1)[..., None], 3, axis=2)


def save_color(name, a):
    Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + .5), 'RGB').save(OUT / name)


def save_rough(name, a):
    Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + .5), 'L').save(OUT / name)


def save_normal(name, height, strength):
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * .5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * .5
    n = np.stack((-dx * strength, dy * strength, np.ones_like(height)), axis=-1)
    n /= np.linalg.norm(n, axis=-1)[..., None]
    save_color(name, n * .5 + .5)


# Skin: broad parchment-like mottling, tiny pores and fine faded veins. Color
# remains neutral and pale so pre-existing skin palettes retain their identity.
coarse = noise(27)
medium = noise(7)
fine = noise(.55)
pores = dots(2400, .47, 1)
vein = veins()
freckle = dots(170, 1.9, .4)
skin = .867 + .14 * coarse + .05 * medium + .012 * fine
skin -= .024 * pores + .08 * vein + .11 * freckle
skin_rgb = gray(skin)
skin_rgb[..., 0] += .006 * medium
skin_rgb[..., 2] -= .009 * coarse + .008 * vein
save_color('skin-color.png', skin_rgb)
save_rough('skin-roughness.png', .79 + .035 * medium + .027 * fine + .024 * pores)
save_normal('skin-normal.png', .026 * fine + .034 * noise(1.3) - .085 * pores, 2.4)

# Fabric: genuine periodic two-over/two-under twill weave. Irregular yarn widths
# and sparse worn fibres keep the textile subtle at gameplay distance.
period = 8
col = np.floor(xx / period)
row = np.floor(yy / period)
warp_top = ((col - row) % 4 < 2).astype(float)
warp = np.cos(2 * np.pi * xx / period) * .5 + .5
weft = np.cos(2 * np.pi * yy / period) * .5 + .5
threads = warp * warp_top + weft * (1 - warp_top)
yarn_noise = noise(.75)
wear = noise(18)
fuzz = dots(1500, .44, .55)
cloth_height = .09 * threads + .010 * yarn_noise + .013 * fuzz
cloth = .88 + .030 * (threads - .5) + .09 * wear + .012 * yarn_noise + .012 * fuzz
save_color('cloth-color.png', gray(cloth))
save_rough('cloth-roughness.png', .925 + .025 * wear + .018 * yarn_noise)
save_normal('cloth-normal.png', cloth_height, 3.2)

# Leather: periodic Voronoi-like fine grain with softened creases, occasional
# scuff islands and quieter large-scale weathering. Neutral for boots/belts.
grain_count = 25
spacing = SIZE / grain_count
coords = []
for j in range(grain_count):
    for i in range(grain_count):
        coords.append(((i + rng.uniform(.1, .9)) * spacing,
                       (j + rng.uniform(.1, .9)) * spacing))
best = np.full((SIZE, SIZE), np.inf)
second = best.copy()
for cx, cy in coords:
    dx = np.minimum(np.abs(xx - cx), SIZE - np.abs(xx - cx))
    dy = np.minimum(np.abs(yy - cy), SIZE - np.abs(yy - cy))
    dist = dx * dx + dy * dy
    mask = dist < best
    second = np.where(mask, best, np.minimum(second, dist))
    best = np.minimum(best, dist)
edge_distance = np.sqrt(second) - np.sqrt(best)
crease = np.exp(-edge_distance / 1.5)
crease = blur(crease, .65)
leather_fine = noise(.65)
scuff = np.clip(noise(12) - .25, 0, 1)
leather_height = -.09 * crease + .014 * leather_fine + .011 * noise(3)
leather = .858 - .025 * crease + .024 * noise(23) + .05 * scuff + .008 * leather_fine
save_color('leather-color.png', gray(leather))
save_rough('leather-roughness.png', .66 + .08 * scuff + .05 * crease + .025 * leather_fine)
save_normal('leather-normal.png', leather_height, 3.0)

# Inspect both map content and 2x2 repeat for color maps.
sheet = Image.new('RGB', (1600, 1090), '#141a1d')
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 21)
    small = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 15)
    title = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 29)
except OSError:
    font = small = title = ImageFont.load_default()
draw.text((30, 22), 'ZOMBIE SURFACE STUDIES  /  Original seamless materials', fill='#dbe3df', font=title)
draw.text((30, 64), '512 px · neutral tint multipliers · restrained decay · OpenGL normals · deterministic generation', fill='#9eaead', font=small)
headers = ['COLOR / sRGB', 'ROUGHNESS / Linear', 'NORMAL / Linear', '2 × 2 COLOR REPEAT']
for x, h in zip((30, 350, 670, 990), headers):
    draw.text((x, 105), h, fill='#a8bbb3', font=small)
for row, material in enumerate(('skin', 'cloth', 'leather')):
    y = 140 + row * 305
    for col, channel in enumerate(('color', 'roughness', 'normal')):
        im = Image.open(OUT / f'{material}-{channel}.png').convert('RGB')
        sheet.paste(im.resize((272, 272)), (30 + col * 320, y))
    im = Image.open(OUT / f'{material}-color.png').convert('RGB').resize((136, 136))
    for i in range(2):
        for j in range(2):
            sheet.paste(im, (990 + i * 136, y + j * 136))
    draw.text((1285, y + 25), material.upper(), fill='#dce3df', font=font)
    desc = {'skin': ['Parchment mottling', 'Quiet branching veins', 'Fine pore relief'],
            'cloth': ['Diagonal twill weave', 'Small worn fibres', 'Matte roughness'],
            'leather': ['Soft polygonal grain', 'Scattered light scuffs', 'Worn boot / belt finish']}[material]
    for i, s in enumerate(desc):
        draw.text((1285, y + 70 + i * 26), s, fill='#9eaead', font=small)
sheet.save(DOCS / 'surface-preview.png')

metadata = {'size': SIZE, 'seed': SEED, 'normal_convention': 'OpenGL +Y',
            'authoring': 'Original procedural synthesis; no external image assets.',
            'maps': {}}
for mat in ('skin', 'cloth', 'leather'):
    metadata['maps'][mat] = {s: f'{mat}-{s}.png' for s in ('color', 'roughness', 'normal')}
(DOCS / 'texture-manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(f'Generated 9 material maps and preview in {OUT}')
