# /// script
# requires-python = ">=3.10"
# dependencies = ["resvg-py>=0.2", "pillow>=10"]
# ///
"""Build every brand v2 file from brand/icons/instrumenta-icons.js.

    uv run brand/scripts/build-brand.py          (from the Instrumenta repository root)

Writes, for each product:
  brand/icons/svg/<id>.svg, <id>-24.svg, <id>-16.svg   static, tuned per size
  brand/icons/svg/<id>-animated.svg                    moves on its own (READMEs, the web)
  brand/icons/png/<id>-<size>.png                      16 to 512, each from its size's tier
  brand/icons/ico/<id>.ico                             16 to 256, for Windows
  brand/artwork/<id>-app-art.png                       1024 launcher tile art, with clear space
                                                       (every product but Instrumenta)
and for Instrumenta brand/instrumenta-mark.png (512) and packaging/icon.png (1024).
brand/tokens.json comes from the same colours, so the palette and the icons cannot drift apart.

The output is deterministic: the same library gives the same files. Never edit them by hand.
"""

from __future__ import annotations

import io
import json
import struct
import subprocess
from pathlib import Path

import resvg_py
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ICONS = ROOT / "brand" / "icons"
LIBRARY = ICONS / "instrumenta-icons.js"
PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
ART_VIEWBOX = "-5 -5 58 58"   # clear space around tile art and the installer icon
MARK_VIEWBOX = "-3 -3 54 54"

NODE = r"""
const icons = require(process.argv[1]);
const css = require('fs').readFileSync(process.argv[2], 'utf8');
const out = {};
for (const { id } of icons.PRODUCTS) {
  const r = (o) => icons.render(id, { standalone: true, ...o });
  out[id] = {
    svg: r({}), svg24: r({ tier: 'medium' }), svg16: r({ tier: 'small' }),
    animated: r({ embedCss: css.replace(/\s+/g, ' '), className: 'ii-play' }),
    sizes: Object.fromEntries([16, 24, 32, 48, 64, 128, 256, 512].map((n) => [n, r({ size: n })])),
    art: r({ size: 1024, viewBox: '%s' }),
    mark: r({ size: 512, viewBox: '%s' }),
  };
}
const c = (id) => icons.colours(id);
const tokens = { family: {
  ink: '#0D0C0A', surface: '#141210', surfaceRaised: '#1D1A17', line: '#352F29',
  text: '#F2EDE6', textMuted: '#A39A90', brass: c('instrumenta').accent, status: c('imago').accent,
} };
for (const { id } of icons.PRODUCTS.slice(1)) {
  const k = c(id);
  tokens[id] = { accent: k.accent, secondary: k.light, deep: k.deep, ink: k.ink, surface: icons.oklchToHex(0.24, 0.045, icons.PRODUCTS.find((p) => p.id === id).hue) };
}
process.stdout.write(JSON.stringify({ icons: out, tokens }));
""" % (ART_VIEWBOX, MARK_VIEWBOX)


def rasterise(svg: str, size: int) -> Image.Image:
    data = resvg_py.svg_to_bytes(svg_string=svg, width=size, height=size)
    image = Image.open(io.BytesIO(bytes(data))).convert("RGBA")
    if image.size != (size, size):
        raise SystemExit(f"rasterised to {image.size}, expected {size}")
    return image


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def write_ico(path: Path, images: dict[int, Image.Image]) -> None:
    """An ICO whose entries are PNG-compressed, one per size, each rendered at that size."""
    blobs = [(size, png_bytes(images[size])) for size in sorted(images)]
    header = struct.pack("<HHH", 0, 1, len(blobs))
    offset = 6 + 16 * len(blobs)
    directory, payload = b"", b""
    for size, blob in blobs:
        edge = 0 if size >= 256 else size
        directory += struct.pack("<BBBBHHII", edge, edge, 0, 0, 1, 32, len(blob), offset)
        payload += blob
        offset += len(blob)
    path.write_bytes(header + directory + payload)


def check_transparent_edges(image: Image.Image, label: str) -> None:
    width, height = image.size
    alpha = image.getchannel("A")
    edge = [alpha.getpixel((x, 0)) for x in range(width)] + [alpha.getpixel((x, height - 1)) for x in range(width)]
    edge += [alpha.getpixel((0, y)) for y in range(height)] + [alpha.getpixel((width - 1, y)) for y in range(height)]
    if max(edge) > 0:
        raise SystemExit(f"{label}: artwork touches the canvas edge; it needs clear space")


def main() -> None:
    raw = subprocess.run(
        ["node", "-e", NODE, str(LIBRARY), str(ICONS / "instrumenta-icons.css")],
        check=True, capture_output=True, text=True,
    ).stdout
    built = json.loads(raw)
    rendered = built["icons"]
    (ROOT / "brand" / "tokens.json").write_text(json.dumps(built["tokens"], indent=2) + "\n", encoding="utf-8")
    for folder in ("svg", "png", "ico"):
        (ICONS / folder).mkdir(parents=True, exist_ok=True)

    for product, files in rendered.items():
        (ICONS / "svg" / f"{product}.svg").write_text(files["svg"] + "\n", encoding="utf-8")
        (ICONS / "svg" / f"{product}-24.svg").write_text(files["svg24"] + "\n", encoding="utf-8")
        (ICONS / "svg" / f"{product}-16.svg").write_text(files["svg16"] + "\n", encoding="utf-8")
        (ICONS / "svg" / f"{product}-animated.svg").write_text(files["animated"] + "\n", encoding="utf-8")

        images = {}
        for size in PNG_SIZES:
            images[size] = rasterise(files["sizes"][str(size)], size)
            (ICONS / "png" / f"{product}-{size}.png").write_bytes(png_bytes(images[size]))
        write_ico(ICONS / "ico" / f"{product}.ico", {size: images[size] for size in ICO_SIZES})

        art = rasterise(files["art"], 1024)
        check_transparent_edges(art, product)
        if product != "instrumenta":  # the launcher is not a catalogue product; its art is the mark
            (ROOT / "brand" / "artwork" / f"{product}-app-art.png").write_bytes(png_bytes(art))
        else:
            mark = rasterise(files["mark"], 512)
            check_transparent_edges(mark, "instrumenta mark")
            (ROOT / "brand" / "instrumenta-mark.png").write_bytes(png_bytes(mark))
            (ROOT / "packaging" / "icon.png").write_bytes(png_bytes(art))

    print(f"Built {len(rendered)} icon families into {ICONS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
