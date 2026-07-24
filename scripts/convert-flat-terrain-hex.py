#!/usr/bin/env python3
"""Convert flat (top-down) hex terrain PNGs into Hex World's tile layout.

Incoming art is often a square with a pointy-top hex drawn inside and
transparent padding around it. The renderer expects the isometric hex-prism
convention used by `drawHexTileTexture` / `drawHexTileOverlay` in
`src/render/tileTextures.ts`:

  - Output size: 256×384 (width × height)
  - Bottom 256×256: hex footprint, opaque edge-to-edge under the footprint mask
  - Top 128px: optional upward bleed (peaks / treetops); leave empty for flat art

Dropping a raw flat hex into `public/profiles/*/assets/terrain/` causes visible
gaps between tiles. Run this script before shipping replacements (ROADMAP #P12).

Examples:
  python3 scripts/convert-flat-terrain-hex.py path/to/water.png \\
    -o public/profiles/default/assets/terrain/water.png

  python3 scripts/convert-flat-terrain-hex.py ./new-terrain/*.png \\
    -o public/profiles/default/assets/terrain/
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print("Requires Pillow and numpy: pip install pillow numpy", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MASK = Path(__file__).resolve().parent / "terrain-hex-footprint-mask.png"
FOOTPRINT = 256
CANVAS_H = 384
OVERLAY_H = CANVAS_H - FOOTPRINT
OPAQUE_ALPHA = 128


def convert_flat_hex(src: Image.Image, mask_alpha: np.ndarray) -> Image.Image:
    src = src.convert("RGBA")
    arr = np.array(src)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha >= OPAQUE_ALPHA)
    if len(xs) == 0:
        raise ValueError("source has no opaque pixels (alpha >= 128)")

    content = src.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    filled = content.resize((FOOTPRINT, FOOTPRINT), Image.Resampling.LANCZOS)
    out_fp = np.array(filled)

    mask_opaque = mask_alpha >= OPAQUE_ALPHA
    src_opaque = out_fp[:, :, 3] >= OPAQUE_ALPHA
    if src_opaque.any():
        mean_rgb = out_fp[src_opaque][:, :3].mean(axis=0).astype(np.uint8)
    else:
        mean_rgb = np.array([80, 80, 80], dtype=np.uint8)

    # Cover the isometric silhouette: use mask alpha, fill holes left by the
    # flat hex's transparent corners with the texture's average colour.
    need_fill = mask_opaque & ~src_opaque
    out_fp[need_fill, 0] = mean_rgb[0]
    out_fp[need_fill, 1] = mean_rgb[1]
    out_fp[need_fill, 2] = mean_rgb[2]
    out_fp[:, :, 3] = mask_alpha

    canvas = Image.new("RGBA", (FOOTPRINT, CANVAS_H), (0, 0, 0, 0))
    canvas.paste(Image.fromarray(out_fp, "RGBA"), (0, OVERLAY_H))
    return canvas


def load_mask_alpha(mask_path: Path) -> np.ndarray:
    mask = Image.open(mask_path).convert("RGBA")
    if mask.size != (FOOTPRINT, FOOTPRINT):
        raise ValueError(f"mask must be {FOOTPRINT}×{FOOTPRINT}, got {mask.size[0]}×{mask.size[1]}")
    return np.array(mask.split()[-1])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", nargs="+", type=Path, help="Flat hex PNG(s) to convert")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        required=True,
        help="Output PNG path, or a directory when converting multiple inputs",
    )
    parser.add_argument(
        "--mask",
        type=Path,
        default=DEFAULT_MASK,
        help=f"256×256 RGBA footprint mask (default: {DEFAULT_MASK.relative_to(ROOT)})",
    )
    args = parser.parse_args()

    mask_alpha = load_mask_alpha(args.mask)
    inputs = args.inputs
    out = args.output

    if len(inputs) > 1 or out.is_dir() or str(out).endswith("/"):
        out.mkdir(parents=True, exist_ok=True)
        for src_path in inputs:
            dest = out / src_path.name
            convert_flat_hex(Image.open(src_path), mask_alpha).save(dest, "PNG")
            print(f"wrote {dest}")
        return 0

    out.parent.mkdir(parents=True, exist_ok=True)
    convert_flat_hex(Image.open(inputs[0]), mask_alpha).save(out, "PNG")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
