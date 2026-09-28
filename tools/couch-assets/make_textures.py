"""Create original, seamless PBR leather and walnut maps for the casino couch.

No source photographs or downloaded textures are used. All noise is generated on
a periodic domain; the tangent normals use wrapped finite differences. A leather
tile represents approximately 0.5 m. Use normal-map strength 0.65 in Blender.

The base-color maps are sRGB. The normal and roughness maps are linear data.
Roughness is repeated in RGB so either Blender's red channel or glTF's green
channel sees the same values. Metallic remains zero in the leather material.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "assets" / "source" / "couch"


def periodic_noise(rng: np.random.Generator, size: int, radius: float) -> np.ndarray:
    """Gaussian-filtered noise on a torus, normalized to unit deviation."""
    field = rng.standard_normal((size, size))
    freq = np.fft.fftfreq(size)
    radial = freq[:, None] ** 2 + freq[None, :] ** 2
    filtered = np.fft.ifft2(
        np.fft.fft2(field) * np.exp(-2.0 * np.pi**2 * radius**2 * radial)
    ).real
    return filtered / max(float(filtered.std()), 1e-8)


def leather_grain(rng: np.random.Generator, size: int) -> np.ndarray:
    """Warped, softly rounded pebbles from periodic jittered Voronoi cells."""
    cells = 102
    yy, xx = np.mgrid[:size, :size].astype(np.float64)
    # Warp the sampling coordinates without breaking the periodic boundary.
    xx = xx / size * cells + periodic_noise(rng, size, 18) * 0.29
    yy = yy / size * cells + periodic_noise(rng, size, 18) * 0.29
    ix, iy = np.floor(xx).astype(int), np.floor(yy).astype(int)
    jx, jy = rng.uniform(0.12, 0.88, (2, cells, cells))
    first = np.full((size, size), np.inf)
    second = np.full((size, size), np.inf)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx, ny = ix + dx, iy + dy
            sx = nx + jx[ny % cells, nx % cells]
            sy = ny + jy[ny % cells, nx % cells]
            distance = np.sqrt((xx - sx) ** 2 + (yy - sy) ** 2)
            second = np.minimum(second, np.maximum(first, distance))
            first = np.minimum(first, distance)
    boundary_distance = second - first
    # Broad, supple lobes separated by fine recessed creases, not cracked paint.
    return 1.0 - np.exp(-np.maximum(boundary_distance, 0) * 8.0)


def save_rgb(path: Path, values: np.ndarray) -> None:
    Image.fromarray(np.rint(np.clip(values, 0, 255)).astype(np.uint8)).save(
        path, optimize=True
    )


def make_leather(out: Path) -> None:
    size = 1024
    rng = np.random.default_rng(920271)
    grain = leather_grain(rng, size)
    cloud = periodic_noise(rng, size, 74)
    mottling = periodic_noise(rng, size, 12)
    fine = periodic_noise(rng, size, 0.62)
    pores = np.maximum(periodic_noise(rng, size, 0.8) - 1.45, 0.0)
    # Color centers on #602329, a restrained oxblood under neutral illumination.
    variation = cloud * 2.7 + mottling * 1.2 + (grain - grain.mean()) * 3.8
    color = np.array([96.0, 35.0, 41.0])[None, None, :]
    color = color + variation[:, :, None] * np.array([1.0, 0.48, 0.52])
    color = color - pores[:, :, None] * np.array([1.3, 0.6, 0.65])
    color = color + fine[:, :, None] * 0.32
    save_rgb(out / "couch-leather-color.png", color)

    # Small supple relief. Broad tufting, piping and button recesses are geometry.
    height = grain * 0.085 + fine * 0.004 - pores * 0.014
    derivative_x = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
    derivative_y = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
    normals = np.stack(
        (-derivative_x * 4.5, derivative_y * 4.5, np.ones_like(height)), axis=-1
    )
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    save_rgb(out / "couch-leather-normal.png", (normals * 0.5 + 0.5) * 255)

    # Satin leather with slightly duller crease valleys and worn pebble crowns.
    roughness = 0.45 + cloud * 0.015 + mottling * 0.012 - (grain - grain.mean()) * 0.05
    roughness = np.clip(roughness + pores * 0.009, 0.35, 0.57)
    save_rgb(out / "couch-leather-roughness.png", np.repeat(roughness[:, :, None], 3, axis=2) * 255)


def make_walnut(out: Path) -> None:
    size = 512
    rng = np.random.default_rng(920272)
    yy, xx = np.mgrid[:size, :size].astype(np.float64) / size
    # Integer spatial frequencies and periodic warps keep every channel tileable.
    warp = 0.012 * np.sin(xx * np.pi * 2) + 0.004 * np.sin(xx * np.pi * 6)
    warp += periodic_noise(rng, size, 25) * 0.003
    flow = yy + warp
    grain = np.sin(flow * np.pi * 2 * 43)
    grain += 0.35 * np.sin(flow * np.pi * 2 * 89)
    grain += 0.5 * np.sin(flow * np.pi * 2 * 13)
    grain += periodic_noise(rng, size, 2) * 0.15
    streaks = np.maximum(np.sin(flow * np.pi * 2 * 67) - 0.82, 0) * 11
    variation = grain * 4.3 + periodic_noise(rng, size, 53) * 2.6 - streaks
    color = np.array([68.0, 35.0, 23.0])[None, None, :]
    color = color + variation[:, :, None] * np.array([1.0, 0.65, 0.39])
    save_rgb(out / "couch-walnut-color.png", color)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    make_leather(out)
    make_walnut(out)
    print(f"Created four deterministic seamless couch material maps in {out}")


if __name__ == "__main__":
    main()
