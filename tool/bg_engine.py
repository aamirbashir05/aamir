"""
AlTariq Photoroom Pro — Background / cutout engine.

Quality-first design:
  * The AI cutout is always computed and stored at the ORIGINAL resolution.
  * Previews are downscaled copies only — the real pixels are never degraded.
  * Optional alpha-matting refines soft edges (hair, fur) for clean, Photoroom-grade
    borders without jagged pixels.
  * PNG export is lossless.

Heavy imports (rembg / numpy) live inside functions so the module imports cheaply
and PyInstaller stays happy.
"""

import base64
import io
import os

from PIL import Image

# The bundled offline model. Kept as one constant so it is trivial to swap
# (e.g. to "birefnet-general-lite" for even sharper edges — see README).
MODEL_NAME = os.environ.get("ALTARIQ_MODEL", "isnet-general-use")

_SESSION = None


def _get_session():
    """Create (once) and cache the rembg inference session."""
    global _SESSION
    if _SESSION is None:
        from rembg import new_session

        _SESSION = new_session(MODEL_NAME)
    return _SESSION


def warm_up():
    """Force model load so the first real cutout is fast. Safe to call in a thread."""
    try:
        _get_session()
        return True
    except Exception as exc:  # pragma: no cover - defensive
        print("warm_up failed:", exc)
        return False


# --------------------------------------------------------------------------- #
# Core cutout
# --------------------------------------------------------------------------- #
def remove_background(img, hd_edges=True):
    """Return an RGBA cutout at the SAME resolution as `img`.

    hd_edges -> use alpha matting for refined, non-jagged edges.
    """
    from rembg import remove

    img = img.convert("RGBA")
    kwargs = {"session": _get_session(), "post_process_mask": True}
    if hd_edges:
        kwargs.update(
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
        )
    out = remove(img, **kwargs)
    return out.convert("RGBA")


# --------------------------------------------------------------------------- #
# Backgrounds & composition
# --------------------------------------------------------------------------- #
def _hex_to_rgba(value, alpha=255):
    value = (value or "#ffffff").lstrip("#")
    if len(value) == 3:
        value = "".join(c * 2 for c in value)
    r, g, b = int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)
    return (r, g, b, alpha)


def _cover_resize(img, w, h):
    """Scale `img` to fully cover a w x h box, centre-cropped (like CSS cover)."""
    img = img.convert("RGBA")
    scale = max(w / img.width, h / img.height)
    nw, nh = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    return img.crop((left, top, left + w, top + h))


def _make_background(bg, w, h):
    kind = (bg or {}).get("type", "transparent")
    if kind == "color":
        return Image.new("RGBA", (w, h), _hex_to_rgba(bg.get("value", "#ffffff")))
    if kind == "gradient":
        return _linear_gradient(w, h, bg.get("from", "#f8da98"), bg.get("to", "#c9851f"))
    if kind == "image" and bg.get("value") and os.path.exists(bg["value"]):
        return _cover_resize(Image.open(bg["value"]), w, h)
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def _linear_gradient(w, h, c_from, c_to):
    top = _hex_to_rgba(c_from)
    bot = _hex_to_rgba(c_to)
    base = Image.new("RGBA", (w, h))
    px = base.load()
    for y in range(h):
        t = y / max(1, h - 1)
        row = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(4))
        for x in range(w):
            px[x, y] = row
    return base


def render(cutout, bg=None, canvas=None, margin=0.08):
    """Compose the cutout over a background.

    canvas=None            -> keep original size, background behind the subject.
    canvas={'w','h'}       -> studio layout: subject scaled & centred with margin
                              (used by size presets, e.g. 1000x1000 marketplace).
    """
    cut = cutout.convert("RGBA")

    if not canvas:
        base = _make_background(bg, cut.width, cut.height)
        base.alpha_composite(cut)
        return base

    w, h = int(canvas["w"]), int(canvas["h"])
    base = _make_background(bg, w, h)

    bbox = cut.getbbox() or (0, 0, cut.width, cut.height)
    subject = cut.crop(bbox)
    max_w = int(w * (1 - 2 * margin))
    max_h = int(h * (1 - 2 * margin))
    scale = min(max_w / subject.width, max_h / subject.height)
    nw, nh = max(1, int(subject.width * scale)), max(1, int(subject.height * scale))
    subject = subject.resize((nw, nh), Image.LANCZOS)
    base.alpha_composite(subject, ((w - nw) // 2, (h - nh) // 2))
    return base


# --------------------------------------------------------------------------- #
# Export & preview helpers
# --------------------------------------------------------------------------- #
def flatten(img, background="#ffffff"):
    """Flatten transparency onto a solid colour (for JPEG export)."""
    img = img.convert("RGBA")
    base = Image.new("RGBA", img.size, _hex_to_rgba(background))
    base.alpha_composite(img)
    return base.convert("RGB")


def save_image(img, path, fmt="PNG", jpg_bg="#ffffff", quality=95):
    fmt = fmt.upper()
    ext = ".png" if fmt == "PNG" else ".jpg"
    if not path.lower().endswith(ext):
        path = os.path.splitext(path)[0] + ext
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    if fmt == "PNG":
        img.convert("RGBA").save(path, "PNG")  # lossless, keeps alpha
    else:
        flatten(img, jpg_bg).save(path, "JPEG", quality=quality, subsampling=0)
    return path


def to_data_url(img, fmt="PNG", max_side=None):
    """Encode a PIL image as a data: URL. `max_side` downscales the PREVIEW only."""
    im = img
    if max_side and max(img.size) > max_side:
        im = img.copy()
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = io.BytesIO()
    if fmt.upper() == "JPEG":
        flatten(im).save(buf, "JPEG", quality=90)
        mime = "image/jpeg"
    else:
        im.convert("RGBA").save(buf, "PNG")
        mime = "image/png"
    return "data:%s;base64,%s" % (mime, base64.b64encode(buf.getvalue()).decode("ascii"))


def load_image(path):
    img = Image.open(path)
    # Respect EXIF orientation so phone photos aren't rotated wrongly.
    try:
        from PIL import ImageOps

        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    return img.convert("RGBA")
