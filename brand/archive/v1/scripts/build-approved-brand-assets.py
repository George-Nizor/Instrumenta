#!/usr/bin/env python3
"""Build the approved Instrumenta suite logos into production-ready assets.

The selected ImageGen concepts are retained untouched under ``brand/concepts``. This
script removes border-connected backdrop residue, preserves the approved artwork,
normalises output sizes, and publishes identical marks to the launcher and sibling apps.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


LAUNCHER = Path(__file__).resolve().parents[1]
WORKSPACE = LAUNCHER.parent

SOURCES = {
    "instrumenta": LAUNCHER
    / "brand/concepts/gateway-round-2026-08-21/02-opening-threshold.png",
    # Fabula carries the mark first approved for Motus, which is discontinued. The concept
    # keeps its original file name because it is the unchanged generated source.
    "fabula": LAUNCHER / "brand/concepts/product-first-2026-08-21/motus.png",
    "imago": LAUNCHER / "brand/concepts/product-first-2026-08-21/imago.png",
    "ludere": LAUNCHER / "brand/concepts/product-first-2026-08-21/ludere.png",
    "discere": LAUNCHER / "brand/concepts/product-first-2026-08-21/discere.png",
    "luna": LAUNCHER / "brand/concepts/product-first-2026-08-21/luna.png",
}

PNG_TARGETS = {
    "instrumenta": [
        (LAUNCHER / "brand/instrumenta-mark.png", 512),
        (LAUNCHER / "packaging/icon.png", 1024),
    ],
    # Only the launcher copy. Fabula's own repository owns the marks it ships.
    "fabula": [
        (LAUNCHER / "brand/artwork/fabula-app-art.png", 1024),
    ],
    "imago": [
        (LAUNCHER / "brand/artwork/imago-app-art.png", 1024),
        (WORKSPACE / "Imago/public/imago-mark.png", 512),
        (WORKSPACE / "Imago/public/favicon.png", 256),
    ],
    "ludere": [
        (LAUNCHER / "brand/artwork/ludere-app-art.png", 1024),
        (WORKSPACE / "Ludere/public/ludere-mark.png", 512),
        (WORKSPACE / "Ludere/public/ludere-app-art.png", 1024),
    ],
    "discere": [
        (LAUNCHER / "brand/artwork/discere-app-art.png", 1024),
        (WORKSPACE / "Discere/apps/web/public/discere-mark.png", 512),
        (WORKSPACE / "Discere/apps/web/public/favicon.png", 256),
    ],
    "luna": [
        (LAUNCHER / "brand/artwork/luna-app-art.png", 1024),
        (WORKSPACE / "Luna/assets/luna-icon-source.png", 1024),
        (WORKSPACE / "Luna/assets/luna-icon.png", 512),
        (WORKSPACE / "Luna/app/static/luna-icon.png", 256),
    ],
}


def _border_connected(mask: np.ndarray) -> np.ndarray:
    """Return mask pixels connected to an image border using eight neighbours."""

    height, width = mask.shape
    connected = np.zeros_like(mask, dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        if mask[0, x]:
            queue.append((0, x))
        if mask[height - 1, x]:
            queue.append((height - 1, x))
    for y in range(height):
        if mask[y, 0]:
            queue.append((y, 0))
        if mask[y, width - 1]:
            queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        if connected[y, x] or not mask[y, x]:
            continue
        connected[y, x] = True
        for next_y in range(max(0, y - 1), min(height, y + 2)):
            for next_x in range(max(0, x - 1), min(width, x + 2)):
                if not connected[next_y, next_x] and mask[next_y, next_x]:
                    queue.append((next_y, next_x))
    return connected


def clean_transparency(source: Path) -> Image.Image:
    """Remove only exterior dark residue while retaining internal material shading."""

    image = Image.open(source).convert("RGBA")
    pixels = np.array(image)
    rgb = pixels[:, :, :3].astype(np.int16)
    alpha = pixels[:, :, 3]
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    chroma = maximum - minimum

    # Image-generation output can retain a faint, partly opaque charcoal plate even
    # when the intended background is transparent. Only border-connected near-black
    # pixels and effectively invisible antialias noise are classified as backdrop.
    candidate = (alpha <= 3) | ((maximum <= 58) & (chroma <= 30) & (alpha < 246))
    exterior = _border_connected(candidate)
    pixels[exterior, 3] = 0
    pixels[pixels[:, :, 3] <= 2, 3] = 0
    # Approved emblems have generous clear space, so the canvas perimeter is always
    # backdrop. Hard-clearing two pixels prevents resampling from reviving corner haze.
    pixels[:2, :, 3] = 0
    pixels[-2:, :, 3] = 0
    pixels[:, :2, 3] = 0
    pixels[:, -2:, 3] = 0
    pixels[pixels[:, :, 3] == 0, :3] = 0

    cleaned = Image.fromarray(pixels, mode="RGBA")
    cleaned_alpha = np.array(cleaned.getchannel("A"))
    if any(
        int(edge.max()) != 0
        for edge in (
            cleaned_alpha[0, :],
            cleaned_alpha[-1, :],
            cleaned_alpha[:, 0],
            cleaned_alpha[:, -1],
        )
    ):
        raise RuntimeError(f"Backdrop residue still reaches an edge: {source}")
    return cleaned


def save_png(master: Image.Image, target: Path, size: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    output = master.resize((size, size), Image.Resampling.LANCZOS)
    pixels = np.array(output)
    pixels[0, :, 3] = pixels[-1, :, 3] = 0
    pixels[:, 0, 3] = pixels[:, -1, 3] = 0
    pixels[pixels[:, :, 3] == 0, :3] = 0
    Image.fromarray(pixels, mode="RGBA").save(target, format="PNG", optimize=True)


def save_ico(master: Image.Image, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    source = master.resize((256, 256), Image.Resampling.LANCZOS)
    source.save(
        target,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def validate_png(target: Path, expected_size: int) -> None:
    image = Image.open(target)
    if image.mode != "RGBA" or image.size != (expected_size, expected_size):
        raise RuntimeError(f"Unexpected production PNG format: {target} ({image.mode}, {image.size})")
    alpha = np.array(image.getchannel("A"))
    if int(alpha.max()) == 0:
        raise RuntimeError(f"Production PNG contains no visible logo: {target}")
    if any(int(edge.max()) != 0 for edge in (alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1])):
        raise RuntimeError(f"Production PNG is not transparent at every edge: {target}")


def main() -> None:
    masters: dict[str, Image.Image] = {}
    for product, source in SOURCES.items():
        if not source.is_file():
            raise FileNotFoundError(f"Missing approved source for {product}: {source}")
        masters[product] = clean_transparency(source)

    for product, targets in PNG_TARGETS.items():
        for target, size in targets:
            save_png(masters[product], target, size)
            validate_png(target, size)
            print(f"{product:12} {size:4} px  {target.relative_to(WORKSPACE)}")

    save_ico(masters["luna"], WORKSPACE / "Luna/assets/luna-icon.ico")
    print("native icons       Luna/assets/luna-icon.ico")


if __name__ == "__main__":
    main()
