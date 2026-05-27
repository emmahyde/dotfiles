"""Sector visual-diff utilities for mcp-server-code-execution-mode sandboxes.

Mirrors the TS visual.ts module with extra power: opencv template matching,
multi-anchor search, and structured diff that returns a tiny dict instead of
shoving full PNGs into the model's context.

Typical usage inside a sandbox script:

    from sector_visual import shot, diff, region, anchor

    a = shot()                          # full frame, cached
    apply_change()                      # e.g. sector.eval("...")
    b = shot()
    print(diff(a, b, widget="RadarHud")) # {"changed_pct": 4.2, "bbox": ...}

    crop = region("CmdBar")             # bytes of just the cmd bar widget
    hit  = anchor("asteroid_outline")   # template-matched crop or None
"""

from __future__ import annotations

import hashlib
import io
import json
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

# Resolve repo root from this file's location.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_PORT_FILE = Path.home() / ".sector" / "debug-port"
_ANCHOR_DIR = _REPO_ROOT / ".claude" / "anchors"

_LAST_SHOT: Optional[bytes] = None
_LAST_TAKEN_AT: float = 0.0


def _bridge_url() -> str:
    if not _PORT_FILE.exists():
        raise RuntimeError(
            f"Sector debug bridge not running ({_PORT_FILE} missing). "
            "Launch the game in Debug mode first."
        )
    port = int(_PORT_FILE.read_text().strip())
    return f"http://localhost:{port}"


def _http_get(path: str) -> bytes:
    with urllib.request.urlopen(_bridge_url() + path, timeout=10) as r:
        return r.read()


def _http_get_json(path: str) -> dict:
    return json.loads(_http_get(path).decode("utf-8"))


# ── Public API ───────────────────────────────────────────────────────────────


@dataclass
class Rect:
    x: int
    y: int
    w: int
    h: int

    @classmethod
    def from_dict(cls, d: dict) -> "Rect":
        return cls(
            x=int(d.get("X", d.get("x", 0))),
            y=int(d.get("Y", d.get("y", 0))),
            w=int(d.get("Width", d.get("w", 0))),
            h=int(d.get("Height", d.get("h", 0))),
        )

    def expand(self, pad: int) -> "Rect":
        return Rect(self.x - pad, self.y - pad, self.w + pad * 2, self.h + pad * 2)

    def to_tuple(self) -> Tuple[int, int, int, int]:
        return (self.x, self.y, self.x + self.w, self.y + self.h)


def shot(cache: bool = True) -> bytes:
    """Capture a full PNG frame. Caches by default for diff()."""
    global _LAST_SHOT, _LAST_TAKEN_AT
    bytes_ = _http_get("/screenshot")
    if cache:
        _LAST_SHOT = bytes_
        _LAST_TAKEN_AT = time.time()
    return bytes_


def last_shot() -> Optional[bytes]:
    return _LAST_SHOT


def widget_bounds(name: str) -> Optional[Rect]:
    """Resolve a HUD element name to its LastDrawnBounds rect via /hud."""
    import urllib.parse
    data = _http_get_json(f"/hud?filter={urllib.parse.quote(name)}&format=json")
    elements = data.get("elements") or data.get("rows") or []
    if not elements:
        return None
    lc = name.lower()
    exact = next((e for e in elements if str(e.get("TypeName", "")).lower() == lc), None)
    hit = exact or elements[0]
    bounds = hit.get("LastDrawnBounds") or hit.get("bounds")
    if not bounds:
        return None
    return Rect.from_dict(bounds)


def crop(png: bytes, rect: Rect) -> bytes:
    """Crop a PNG buffer to a rectangle. Clamps to image bounds."""
    from PIL import Image
    img = Image.open(io.BytesIO(png))
    W, H = img.size
    x = max(0, min(rect.x, W))
    y = max(0, min(rect.y, H))
    w = max(1, min(rect.w, W - x))
    h = max(1, min(rect.h, H - y))
    out = io.BytesIO()
    img.crop((x, y, x + w, y + h)).save(out, format="PNG")
    return out.getvalue()


def region(name_or_rect, pad: int = 16) -> bytes:
    """Capture and crop in one call. Pass a widget name or a Rect."""
    png = shot()
    if isinstance(name_or_rect, str):
        b = widget_bounds(name_or_rect)
        if b is None:
            raise LookupError(f"No HUD element matched {name_or_rect!r}")
        return crop(png, b.expand(pad))
    if isinstance(name_or_rect, Rect):
        return crop(png, name_or_rect)
    if isinstance(name_or_rect, (tuple, list)) and len(name_or_rect) == 4:
        return crop(png, Rect(*map(int, name_or_rect)))
    raise TypeError(f"Expected str/Rect/tuple, got {type(name_or_rect).__name__}")


def phash(png: bytes) -> int:
    """64-bit dHash. Compare with hamming()."""
    import numpy as np
    from PIL import Image
    img = Image.open(io.BytesIO(png)).convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    arr = np.array(img, dtype=np.int32)  # shape (8, 9)
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | (1 if int(arr[y, x]) > int(arr[y, x + 1]) else 0)
    return bits


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def md5(png: bytes) -> str:
    return hashlib.md5(png).hexdigest()


def diff(
    a: bytes,
    b: bytes,
    widget: Optional[str] = None,
    rect: Optional[Rect] = None,
    threshold: int = 30,
) -> dict:
    """Compare two frames; return a small structured summary, not pixel data.

    Either restrict to a widget by name, an explicit rect, or compare full frames.
    """
    if widget:
        wb = widget_bounds(widget)
        if wb is None:
            raise LookupError(f"Widget {widget!r} not found")
        a = crop(a, wb)
        b = crop(b, wb)
        scope = f"widget={widget}"
    elif rect:
        a = crop(a, rect)
        b = crop(b, rect)
        scope = f"rect={rect}"
    else:
        scope = "full-frame"

    import numpy as np
    from PIL import Image

    A = np.array(Image.open(io.BytesIO(a)).convert("RGB"))
    B = np.array(Image.open(io.BytesIO(b)).convert("RGB"))
    H, W = min(A.shape[0], B.shape[0]), min(A.shape[1], B.shape[1])
    A = A[:H, :W]
    B = B[:H, :W]

    delta = np.abs(A.astype(int) - B.astype(int)).sum(axis=2) > threshold
    changed = int(delta.sum())
    total = H * W
    bbox = None
    if changed > 0:
        ys, xs = np.where(delta)
        bbox = {"x": int(xs.min()), "y": int(ys.min()),
                "w": int(xs.max() - xs.min() + 1),
                "h": int(ys.max() - ys.min() + 1)}

    return {
        "scope": scope,
        "size": {"w": W, "h": H},
        "changed_pct": round(100 * changed / total, 2),
        "changed_pixels": changed,
        "total_pixels": total,
        "bbox": bbox,
        "phash_distance": hamming(phash(a), phash(b)),
        "md5_a": md5(a)[:12],
        "md5_b": md5(b)[:12],
    }


def anchor(
    name: str,
    png: Optional[bytes] = None,
    pad: int = 32,
    confidence: float = 0.7,
) -> Optional[bytes]:
    """Locate a template image in the frame and return a cropped region.

    Templates live in .claude/anchors/<name>.png. Returns None if no match
    above `confidence`. Uses opencv normalised cross-correlation.
    """
    try:
        import cv2
        import numpy as np
    except ImportError as e:
        raise RuntimeError("opencv-python required for anchor matching: pip install opencv-python-headless") from e

    tpl_path = _ANCHOR_DIR / (name if name.endswith((".png", ".jpg")) else f"{name}.png")
    if not tpl_path.exists():
        available = [p.name for p in _ANCHOR_DIR.glob("*.png")]
        raise FileNotFoundError(
            f"Anchor template missing: {tpl_path}\nAvailable: {available}"
        )

    frame_bytes = png if png is not None else shot()
    frame = cv2.imdecode(np.frombuffer(frame_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
    tpl = cv2.imread(str(tpl_path), cv2.IMREAD_GRAYSCALE)
    if frame is None or tpl is None:
        return None

    res = cv2.matchTemplate(frame, tpl, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(res)
    if max_val < confidence:
        return None

    x, y = max_loc
    h, w = tpl.shape
    rect = Rect(max(0, x - pad), max(0, y - pad), w + pad * 2, h + pad * 2)
    return crop(frame_bytes, rect)


def anchors_available() -> list[str]:
    if not _ANCHOR_DIR.exists():
        return []
    return [p.stem for p in _ANCHOR_DIR.glob("*.png")]


# ── Convenience: two-frame harness ───────────────────────────────────────────


def two_frame(mutate, *, widget: Optional[str] = None, threshold: int = 30) -> dict:
    """Capture, run a callable, capture again, return structured diff.

    Example:
        two_frame(lambda: sector.eval("Camera.Zoom = 2f"), widget="MiniMap")
    """
    a = shot()
    mutate()
    b = shot()
    return diff(a, b, widget=widget, threshold=threshold)
