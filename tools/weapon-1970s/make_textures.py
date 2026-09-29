"""Generate the tileable material textures used by the 1970s weapon set.

python3 tools/weapon-1970s/make_textures.py

All maps are procedural (numpy FFT-filtered noise); no photographs or third-party
images. Albedo maps are sRGB JPEGs; *-orm maps store glTF occlusion/roughness/metal
in R/G/B; *-normal maps are tangent-space OpenGL normals.
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/source/weapons-1970s/textures"
OUT.mkdir(parents=True, exist_ok=True)
N = 512
rng = np.random.default_rng(1970)


def noise(scale_u, scale_v=None, seed=None, n=N):
    """Periodic gaussian-filtered noise normalised to 0..1. scale is correlation length in texels."""
    scale_v = scale_u if scale_v is None else scale_v
    r = np.random.default_rng(seed) if seed is not None else rng
    white = r.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.fftfreq(n)[None, :]
    kernel = np.exp(-((fx * scale_u) ** 2 + (fy * scale_v) ** 2) * 2 * np.pi ** 2)
    out = np.real(np.fft.ifft2(np.fft.fft2(white) * kernel))
    out -= out.min()
    return out / max(out.max(), 1e-9)


def fbm(base, octaves=4, seed=0, aniso=1.0):
    total = np.zeros((N, N))
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        total += amp * noise(base / 2 ** o * aniso, base / 2 ** o, seed=seed + o)
        norm += amp
        amp *= 0.5
    return total / norm


def srgb(img):
    return np.clip(img, 0, 1)


def save_rgb(name, rgb, quality=88):
    arr = (srgb(rgb) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(arr, "RGB").save(OUT / name, quality=quality, optimize=True)


def orm(name, rough, metal, ao=None):
    ao = np.ones_like(rough) if ao is None else ao
    metal = np.full_like(rough, metal) if np.isscalar(metal) else metal
    save_rgb(name, np.dstack([ao, rough, metal]), quality=92)


def mix(a, b, t):
    t = t[..., None] if np.ndim(t) == 2 else t
    return np.asarray(a) * (1 - t) + np.asarray(b) * t


def scratches(count, length, seed, n=N):
    """Thin anti-aliased random scratch lines, periodic."""
    r = np.random.default_rng(seed)
    img = np.zeros((n, n))
    for _ in range(count):
        x0, y0 = r.uniform(0, n, 2)
        ang = r.normal(0.2, 0.5)
        ln = r.uniform(length * 0.3, length)
        steps = int(ln * 2)
        t = np.linspace(0, ln, steps)
        xs = (x0 + np.cos(ang) * t).astype(int) % n
        ys = (y0 + np.sin(ang) * t).astype(int) % n
        img[ys, xs] = np.maximum(img[ys, xs], r.uniform(0.3, 1.0))
    # soften
    f = np.fft.fft2(img)
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.fftfreq(n)[None, :]
    img = np.real(np.fft.ifft2(f * np.exp(-(fx ** 2 + fy ** 2) * 2 * np.pi ** 2 * 0.6)))
    return np.clip(img / max(img.max(), 1e-9), 0, 1)


def wood(name, dark, light, ring_freq, seed, figure=1.0):
    """Grain runs along U (the gun's length). Rings/fibres vary along V."""
    v = np.linspace(0, 1, N, endpoint=False)[:, None] * np.ones((1, N))
    warp = fbm(140, 4, seed, aniso=3.5) - 0.5
    fine = noise(60, 4, seed + 7) - 0.5
    rings = np.sin((v * ring_freq + warp * 4.5 * figure + fine * 0.35) * 2 * np.pi)
    late = np.clip((rings - 0.55) / 0.45, 0, 1) ** 1.3          # thin dark late-wood lines
    fibres = noise(70, 0.9, seed + 11)                            # long thin fibres along U
    fibres = np.clip((fibres - 0.5) * 2.2 + 0.5, 0, 1)
    pores = (noise(2.5, 0.7, seed + 12) > 0.82).astype(float) * 0.6  # open pores
    blotch = fbm(160, 3, seed + 20)
    t = 0.34 * late + 0.3 * fibres + 0.3 * (blotch - 0.2)
    col = mix(light, dark, np.clip(t, 0, 1))
    col *= (1 - 0.18 * pores)[..., None]
    save_rgb(name + ".jpg", col)
    rough = 0.38 + 0.18 * late + 0.1 * pores + 0.06 * fibres
    orm(name + "-orm.jpg", np.clip(rough, 0, 1), 0.0)


def metal(name, base, edge, rough_lo, rough_hi, metallic, seed, scratch=160, blotch_amt=0.25):
    b = fbm(110, 4, seed)
    s = scratches(scratch, 60, seed + 3)
    speck = noise(1.5, 1.5, seed + 5)
    t = np.clip(0.32 * s + blotch_amt * (b - 0.5) + 0.3 + 0.08 * (speck - 0.5), 0, 1) - 0.3
    col = mix(base, edge, np.clip(t, 0, 1))
    save_rgb(name + ".jpg", col)
    rough = rough_lo + (rough_hi - rough_lo) * np.clip(0.6 * b + 0.3 * speck - 0.5 * s + 0.2, 0, 1)
    orm(name + "-orm.jpg", np.clip(rough, 0.05, 1), metallic)


def plastic(name, base, alt, rough_lo, rough_hi, seed, swirl=1.0):
    m = fbm(60, 4, seed, aniso=2.0)
    swirl_t = (np.sin(m * 18 * swirl) * 0.5 + 0.5) ** 3
    col = mix(base, alt, np.clip(0.6 * swirl_t + 0.25 * m, 0, 1))
    save_rgb(name + ".jpg", col)
    orm(name + "-orm.jpg", rough_lo + (rough_hi - rough_lo) * noise(8, 8, seed + 1), 0.0)


def normal_from_height(h, strength):
    gy, gx = np.gradient(h)
    nx, ny = -gx * strength, gy * strength
    nz = np.ones_like(h)
    l = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    return np.dstack([nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, nz / l * 0.5 + 0.5])


def checkering(name, base_dark, cells=32):
    """Diamond checkering height -> normal map; albedo darkens in the grooves."""
    y, x = np.mgrid[0:N, 0:N] / N * cells
    a = np.abs(((x + y) % 1) - 0.5) * 2
    b = np.abs(((x - y) % 1) - 0.5) * 2
    h = np.minimum(a, b)                       # 0 in grooves, 1 at pyramid peaks
    h = np.clip(h * 1.4, 0, 1)
    nm = normal_from_height(h, 9.0)
    Image.fromarray((nm * 255 + 0.5).astype(np.uint8), "RGB").save(OUT / (name + "-normal.png"), optimize=True)
    return h


def main():
    # Woods (colours are sRGB albedo)
    wood("walnut", dark=(0.1, 0.048, 0.026), light=(0.3, 0.155, 0.08), ring_freq=17, seed=10)
    wood("walnut-dark", dark=(0.05, 0.025, 0.015), light=(0.2, 0.1, 0.05), ring_freq=23, seed=30)
    wood("hickory", dark=(0.4, 0.26, 0.15), light=(0.7, 0.54, 0.36), ring_freq=14, seed=50, figure=0.6)
    # Metals
    metal("blued", base=(0.05, 0.058, 0.075), edge=(0.34, 0.36, 0.38), rough_lo=0.22, rough_hi=0.42, metallic=1.0, seed=101)
    metal("nickel", base=(0.56, 0.54, 0.5), edge=(0.4, 0.38, 0.35), rough_lo=0.2, rough_hi=0.38, metallic=1.0, seed=111, blotch_amt=0.35)
    metal("parkerized", base=(0.105, 0.11, 0.1), edge=(0.25, 0.25, 0.23), rough_lo=0.58, rough_hi=0.78, metallic=0.85, seed=121, scratch=90)
    metal("blackened", base=(0.035, 0.035, 0.035), edge=(0.2, 0.2, 0.19), rough_lo=0.42, rough_hi=0.62, metallic=0.9, seed=131)
    metal("brass", base=(0.66, 0.46, 0.2), edge=(0.38, 0.27, 0.12), rough_lo=0.22, rough_hi=0.46, metallic=1.0, seed=141, blotch_amt=0.45)
    metal("silver", base=(0.86, 0.85, 0.82), edge=(0.6, 0.59, 0.56), rough_lo=0.1, rough_hi=0.24, metallic=1.0, seed=151, scratch=60)
    metal("gunmetal", base=(0.16, 0.165, 0.17), edge=(0.38, 0.38, 0.37), rough_lo=0.34, rough_hi=0.52, metallic=1.0, seed=161)
    metal("forged", base=(0.045, 0.045, 0.048), edge=(0.42, 0.42, 0.42), rough_lo=0.45, rough_hi=0.7, metallic=0.9, seed=171, scratch=260)
    # Paints and plastics
    metal("red-paint", base=(0.5, 0.045, 0.03), edge=(0.34, 0.08, 0.05), rough_lo=0.35, rough_hi=0.55, metallic=0.0, seed=181, scratch=40)
    metal("olive-paint", base=(0.2, 0.21, 0.13), edge=(0.13, 0.13, 0.09), rough_lo=0.55, rough_hi=0.75, metallic=0.0, seed=191, scratch=70)
    metal("yellow-label", base=(0.85, 0.66, 0.12), edge=(0.55, 0.43, 0.16), rough_lo=0.5, rough_hi=0.7, metallic=0.0, seed=195, scratch=50)
    plastic("bakelite", base=(0.035, 0.018, 0.011), alt=(0.11, 0.05, 0.022), rough_lo=0.28, rough_hi=0.4, seed=201)
    plastic("pearl", base=(0.62, 0.6, 0.55), alt=(0.78, 0.76, 0.72), rough_lo=0.12, rough_hi=0.22, seed=211, swirl=2.0)
    plastic("ivory", base=(0.83, 0.77, 0.63), alt=(0.72, 0.64, 0.5), rough_lo=0.3, rough_hi=0.45, seed=221, swirl=0.5)
    plastic("rubber-oxblood", base=(0.2, 0.035, 0.03), alt=(0.13, 0.025, 0.02), rough_lo=0.75, rough_hi=0.9, seed=231, swirl=0.3)
    plastic("leather-oxblood", base=(0.25, 0.06, 0.04), alt=(0.14, 0.035, 0.025), rough_lo=0.55, rough_hi=0.75, seed=241, swirl=0.7)
    checkering("checker", (0.1, 0.05, 0.02))
    print("textures ->", OUT)


if __name__ == "__main__":
    main()
