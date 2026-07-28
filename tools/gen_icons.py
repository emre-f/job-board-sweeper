#!/usr/bin/env python3
"""Generate the extension icons (a white funnel on indigo) as PNGs.

Pure standard library - no Pillow needed. Run from the repo root:

    python3 tools/gen_icons.py
"""

import os
import struct
import zlib

BG = (240, 180, 41)  # amber #f0b429 (brand accent)
FG = (17, 24, 39)  # near-black funnel for contrast on amber
SIZES = [16, 32, 48, 128]
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")


def write_png(path, size, pixels):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

    raw = b"".join(
        b"\x00" + b"".join(struct.pack("BBB", *px) for px in row) for row in pixels
    )
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)


def funnel_half_width(fy):
    """Half-width of the funnel (as a fraction of icon size) at height fy."""
    if 0.18 <= fy < 0.48:
        t = (fy - 0.18) / 0.30
        return 0.32 * (1 - t) + 0.08 * t  # wide mouth tapering in
    if 0.48 <= fy < 0.82:
        return 0.08  # narrow stem
    return None


def make_icon(size):
    cx = size / 2
    pixels = []
    for y in range(size):
        row = []
        hw = funnel_half_width(y / size)
        for x in range(size):
            if hw is not None and abs(x + 0.5 - cx) <= hw * size:
                row.append(FG)
            else:
                row.append(BG)
        pixels.append(row)
    return pixels


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        path = os.path.join(OUT_DIR, f"icon{size}.png")
        write_png(path, size, make_icon(size))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
