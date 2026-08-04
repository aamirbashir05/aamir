"""
AlTariq Photoroom Pro
=====================
Offline AI background remover & product-photo studio for Al Tariq Printers.

A native desktop window (pywebview) with a branded HTML/CSS UI. All AI work runs
locally through `bg_engine` (rembg). No account, no internet, no per-image fees.
"""

import os
import sys
import threading
import traceback


def resource_path(rel):
    """Path to a bundled resource, both in dev and inside a PyInstaller exe."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)


# Point rembg at the model bundled inside the exe BEFORE it is imported anywhere.
os.environ.setdefault("U2NET_HOME", resource_path("models"))

import webview  # noqa: E402  (after env setup)

import bg_engine  # noqa: E402


APP_NAME = "AlTariq Photoroom Pro"

# Output size presets (name -> canvas). None canvas = keep original resolution.
SIZE_PRESETS = [
    {"id": "original", "label": "Original (best quality)", "canvas": None},
    {"id": "sq1000", "label": "Marketplace 1000 × 1000", "canvas": {"w": 1000, "h": 1000}},
    {"id": "sq2000", "label": "Marketplace HD 2000 × 2000", "canvas": {"w": 2000, "h": 2000}},
    {"id": "ig_post", "label": "Instagram Post 1080 × 1080", "canvas": {"w": 1080, "h": 1080}},
    {"id": "ig_story", "label": "Instagram Story 1080 × 1920", "canvas": {"w": 1080, "h": 1920}},
    {"id": "a4", "label": "A4 Print 300dpi (2480 × 3508)", "canvas": {"w": 2480, "h": 3508}},
    {"id": "bcard", "label": "Business Card 300dpi (1050 × 600)", "canvas": {"w": 1050, "h": 600}},
]
_PRESET_BY_ID = {p["id"]: p for p in SIZE_PRESETS}

IMAGE_FILTER = (
    "Image files (*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.tif;*.tiff)",
    "All files (*.*)",
)


class Api:
    """Bridge exposed to JavaScript as `window.pywebview.api`."""

    def __init__(self):
        self.items = {}          # uid -> {"name","path","original"(PIL),"cutout"(PIL|None)}
        self._counter = 0
        self.export_dir = os.path.join(
            os.path.expanduser("~"), "Pictures", "AlTariq Photoroom Pro"
        )

    # ---- meta ---------------------------------------------------------- #
    def meta(self):
        return {
            "app": APP_NAME,
            "model": bg_engine.MODEL_NAME,
            "presets": SIZE_PRESETS,
            "export_dir": self.export_dir,
        }

    # ---- import images ------------------------------------------------- #
    def add_images(self):
        paths = window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=True, file_types=IMAGE_FILTER
        )
        return self._ingest(paths)

    def _ingest(self, paths):
        added = []
        for path in paths or []:
            try:
                img = bg_engine.load_image(path)
            except Exception as exc:
                print("load failed", path, exc)
                continue
            self._counter += 1
            uid = "img%d" % self._counter
            self.items[uid] = {
                "name": os.path.basename(path),
                "path": path,
                "original": img,
                "cutout": None,
            }
            added.append(
                {
                    "uid": uid,
                    "name": os.path.basename(path),
                    "w": img.width,
                    "h": img.height,
                    "thumb": bg_engine.to_data_url(img, "JPEG", max_side=260),
                }
            )
        return {"ok": True, "items": added}

    # ---- cutout -------------------------------------------------------- #
    def remove_background(self, uid, hd_edges=True):
        item = self.items.get(uid)
        if not item:
            return {"ok": False, "error": "not found"}
        try:
            item["cutout"] = bg_engine.remove_background(item["original"], hd_edges=hd_edges)
            return {"ok": True, "preview": self._preview(uid, {"type": "transparent"})}
        except Exception as exc:
            traceback.print_exc()
            return {"ok": False, "error": str(exc)}

    def _preview(self, uid, bg):
        item = self.items[uid]
        cut = item["cutout"]
        if cut is None:
            return bg_engine.to_data_url(item["original"], "PNG", max_side=1200)
        composed = bg_engine.render(cut, bg=bg, canvas=None)
        return bg_engine.to_data_url(composed, "PNG", max_side=1200)

    def preview(self, uid, bg):
        item = self.items.get(uid)
        if not item:
            return {"ok": False, "error": "not found"}
        return {"ok": True, "preview": self._preview(uid, bg or {"type": "transparent"})}

    def original_preview(self, uid):
        item = self.items.get(uid)
        if not item:
            return {"ok": False, "error": "not found"}
        return {"ok": True, "preview": bg_engine.to_data_url(item["original"], "JPEG", max_side=1200)}

    # ---- pickers ------------------------------------------------------- #
    def pick_background_image(self):
        paths = window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False, file_types=IMAGE_FILTER
        )
        if not paths:
            return {"ok": False}
        return {
            "ok": True,
            "path": paths[0],
            "thumb": bg_engine.to_data_url(bg_engine.load_image(paths[0]), "JPEG", max_side=120),
        }

    def choose_export_dir(self):
        paths = window.create_file_dialog(webview.FOLDER_DIALOG)
        if paths:
            self.export_dir = paths[0]
        return {"ok": True, "export_dir": self.export_dir}

    # ---- export -------------------------------------------------------- #
    def export(self, uids, opts):
        opts = opts or {}
        fmt = opts.get("format", "png")
        bg = opts.get("bg", {"type": "transparent"})
        preset = _PRESET_BY_ID.get(opts.get("preset", "original"), SIZE_PRESETS[0])
        jpg_bg = opts.get("jpg_bg", "#ffffff")
        out_dir = self.export_dir
        os.makedirs(out_dir, exist_ok=True)

        saved = []
        for uid in uids or []:
            item = self.items.get(uid)
            if not item or item["cutout"] is None:
                continue
            composed = bg_engine.render(item["cutout"], bg=bg, canvas=preset["canvas"])
            stem = os.path.splitext(item["name"])[0]
            out_path = os.path.join(out_dir, "%s_altariq" % stem)
            try:
                saved.append(bg_engine.save_image(composed, out_path, fmt=fmt, jpg_bg=jpg_bg))
            except Exception as exc:
                traceback.print_exc()
                return {"ok": False, "error": str(exc)}
        return {"ok": True, "count": len(saved), "dir": out_dir}

    def open_export_dir(self):
        os.makedirs(self.export_dir, exist_ok=True)
        try:
            if sys.platform.startswith("win"):
                os.startfile(self.export_dir)  # noqa: E1101 (windows only)
            elif sys.platform == "darwin":
                os.system('open "%s"' % self.export_dir)
            else:
                os.system('xdg-open "%s"' % self.export_dir)
        except Exception:
            pass
        return {"ok": True}

    def remove_item(self, uid):
        self.items.pop(uid, None)
        return {"ok": True}


def _warm(api):
    bg_engine.warm_up()
    try:
        window.evaluate_js("window.__modelReady && window.__modelReady()")
    except Exception:
        pass


def main():
    global window
    api = Api()
    window = webview.create_window(
        APP_NAME,
        url=resource_path(os.path.join("ui", "index.html")),
        js_api=api,
        width=1240,
        height=820,
        min_size=(980, 640),
        background_color="#0b0c10",
        text_select=False,
    )
    threading.Thread(target=_warm, args=(api,), daemon=True).start()
    webview.start(debug=bool(os.environ.get("ALTARIQ_DEBUG")))


if __name__ == "__main__":
    main()
