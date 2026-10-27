#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["Pillow>=10.1,<13"]
# ///
"""Make a labeled, downsampled PNG contact sheet without changing source images."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


def positive_int(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "images", nargs="+", type=Path, help="input images in tile order"
    )
    parser.add_argument("--output", required=True, type=Path, help="output PNG path")
    parser.add_argument("--columns", type=positive_int, default=3)
    parser.add_argument(
        "--tile",
        nargs=2,
        type=positive_int,
        default=(384, 256),
        metavar=("WIDTH", "HEIGHT"),
        help="maximum image area per tile",
    )
    parser.add_argument(
        "--label", action="append", help="repeat once per input; defaults to filenames"
    )
    parser.add_argument(
        "--overwrite", action="store_true", help="replace an existing output sheet"
    )
    args = parser.parse_args()
    sources = [path.expanduser().resolve() for path in args.images]
    output = args.output.expanduser().resolve()
    if output in sources:
        parser.error("output must not replace a source image")
    if output.exists() and any(
        source.exists() and output.samefile(source) for source in sources
    ):
        parser.error("output refers to the same file as a source image")
    if output.suffix.lower() != ".png":
        parser.error("output must have a .png extension")
    if args.label is not None and len(args.label) != len(sources):
        parser.error("provide exactly one --label per input, or omit all labels")
    if output.exists() and not args.overwrite:
        parser.error("output exists; choose a new path or explicitly pass --overwrite")
    labels = args.label if args.label is not None else [path.stem for path in sources]
    columns = min(args.columns, len(sources))
    rows = (len(sources) + columns - 1) // columns
    tile_width, tile_height = args.tile
    margin, label_height = 12, 32
    size = (
        columns * (tile_width + margin) + margin,
        rows * (tile_height + label_height + margin) + margin,
    )
    if size[0] * size[1] > 40_000_000:
        parser.error(
            "sheet exceeds 40 million pixels; use smaller tiles or split the inputs"
        )
    sheet = Image.new("RGB", size, "#252525")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 16)
    except OSError:
        font = ImageFont.load_default(size=16)
    receipt = []
    for index, (source, label) in enumerate(zip(sources, labels)):
        try:
            with Image.open(source) as opened:
                image = ImageOps.exif_transpose(opened).convert("RGBA")
                original_size = image.size
                image.thumbnail((tile_width, tile_height), Image.Resampling.LANCZOS)
        except (OSError, ValueError, Image.DecompressionBombError) as error:
            parser.error(f"cannot read {source}: {error}")
        column, row = index % columns, index // columns
        x = margin + column * (tile_width + margin)
        y = margin + row * (tile_height + label_height + margin)
        sheet.paste(
            image,
            (
                x + (tile_width - image.width) // 2,
                y + (tile_height - image.height) // 2,
            ),
            image,
        )
        caption = " ".join(label.split())
        if draw.textlength(caption, font=font) > tile_width:
            while caption and draw.textlength(caption + "...", font=font) > tile_width:
                caption = caption[:-1]
            caption += "..."
        draw.text((x, y + tile_height + 6), caption, font=font, fill="white")
        receipt.append(
            {
                "tile": index + 1,
                "label": label,
                "source": str(source),
                "source_size": original_size,
                "thumbnail_size": image.size,
            }
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with output.open("wb" if args.overwrite else "xb") as stream:
            sheet.save(stream, format="PNG")
    except OSError as error:
        parser.error(f"cannot write {output}: {error}")
    print(
        json.dumps(
            {"output": str(output), "size": size, "columns": columns, "tiles": receipt},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
