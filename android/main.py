# -*- coding: utf-8 -*-
"""
COPA Downloader — Android (Kivy) app.
Wahi core logic (copa_downloader.py) — bs mobile UI.
Build: buildozer se APK banti hai (dekho .github/workflows/build-android-apk.yml).
"""

import os
import threading

# ---- SSL certs (Android par HTTPS ke liye) ----
try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("SSL_CERT_DIR", os.path.dirname(certifi.where()))
except Exception:
    pass

from kivy.app import App
from kivy.clock import Clock, mainthread
from kivy.core.window import Window
from kivy.metrics import dp
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.progressbar import ProgressBar
from kivy.uix.scrollview import ScrollView
from kivy.uix.textinput import TextInput
from kivy.graphics import Color, Rectangle

import copa_downloader as core

# COPA colours
PRIMARY = (10 / 255, 78 / 255, 163 / 255, 1)
PRIM_DK = (6 / 255, 58 / 255, 122 / 255, 1)
ACCENT = (45 / 255, 130 / 255, 214 / 255, 1)
AMBER = (224 / 255, 138 / 255, 30 / 255, 1)
GREEN = (30 / 255, 158 / 255, 90 / 255, 1)
RED = (192 / 255, 57 / 255, 43 / 255, 1)
BG = (0.92, 0.95, 0.98, 1)
CARD = (1, 1, 1, 1)
DARK = (0.05, 0.10, 0.18, 1)


def android_download_dir():
    """Videos kahan save hon — pehle public Download, warna app folder."""
    # 1) public /sdcard/Download/COPA (agar likhne ki ijazat ho)
    try:
        from android.storage import primary_external_storage_path
        base = primary_external_storage_path()
        d = os.path.join(base, "Download", "COPA")
        os.makedirs(d, exist_ok=True)
        # test write
        t = os.path.join(d, ".w")
        open(t, "w").close()
        os.remove(t)
        return d
    except Exception:
        pass
    # 2) app-specific external dir (hamesha likhne yogya)
    try:
        from android.storage import app_storage_path
        d = os.path.join(app_storage_path(), "COPA")
        os.makedirs(d, exist_ok=True)
        return d
    except Exception:
        pass
    d = os.path.join(os.path.expanduser("~"), "COPA")
    os.makedirs(d, exist_ok=True)
    return d


def request_perms():
    try:
        from android.permissions import request_permissions, Permission
        request_permissions([
            Permission.INTERNET,
            Permission.WRITE_EXTERNAL_STORAGE,
            Permission.READ_EXTERNAL_STORAGE,
            Permission.WAKE_LOCK,
        ])
    except Exception:
        pass


# ---- Wake lock: app background me jaye ya screen band ho, phir bhi download chale ----
_WAKELOCK = {"obj": None}


def acquire_wakelock():
    if _WAKELOCK["obj"] is not None:
        return
    try:
        from jnius import autoclass
        PythonActivity = autoclass("org.kivy.android.PythonActivity")
        Context = autoclass("android.content.Context")
        PowerManager = autoclass("android.os.PowerManager")
        activity = PythonActivity.mActivity
        pm = activity.getSystemService(Context.POWER_SERVICE)
        wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "COPA::download")
        wl.setReferenceCounted(False)
        wl.acquire()
        _WAKELOCK["obj"] = wl
    except Exception:
        _WAKELOCK["obj"] = None


def release_wakelock():
    try:
        if _WAKELOCK["obj"] is not None:
            _WAKELOCK["obj"].release()
    except Exception:
        pass
    _WAKELOCK["obj"] = None


class Card(BoxLayout):
    def __init__(self, color=CARD, **kw):
        super().__init__(**kw)
        self.padding = dp(10)
        self.spacing = dp(6)
        with self.canvas.before:
            self._c = Color(*color)
            self._r = Rectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._sync, size=self._sync)

    def _sync(self, *_):
        self._r.pos = self.pos
        self._r.size = self.size


class RootUI(BoxLayout):
    def __init__(self, **kw):
        super().__init__(orientation="vertical", **kw)
        Window.clearcolor = BG
        self.ctrl = None
        self.running = False
        self.out_dir = android_download_dir()

        # ---- header ----
        header = Card(color=PRIMARY, size_hint_y=None, height=dp(64))
        header.add_widget(Label(text="[b]COPA Video Downloader[/b]", markup=True,
                                color=(1, 1, 1, 1), font_size="20sp", halign="left",
                                valign="middle"))
        self.add_widget(header)

        # ---- links input ----
        in_card = Card(orientation="vertical", size_hint_y=None, height=dp(150))
        in_card.add_widget(Label(text="Case link(s) — har line par EK link",
                                 color=(0.1, 0.16, 0.27, 1), font_size="13sp",
                                 size_hint_y=None, height=dp(20), halign="left"))
        self.links = TextInput(hint_text="https://www.chicagocopa.org/case/....",
                               font_size="13sp", background_color=(0.96, 0.98, 1, 1))
        in_card.add_widget(self.links)
        self.add_widget(in_card)

        # ---- buttons ----
        btns = BoxLayout(size_hint_y=None, height=dp(52), spacing=dp(6),
                         padding=[dp(6), 0])
        self.b_dl = self._btn("Download", PRIMARY, self.start)
        self.b_pause = self._btn("Pause", AMBER, self.pause)
        self.b_resume = self._btn("Resume", GREEN, self.resume)
        self.b_stop = self._btn("Stop", RED, self.stop)
        for b in (self.b_dl, self.b_pause, self.b_resume, self.b_stop):
            btns.add_widget(b)
        self.add_widget(btns)
        self._set_running(False)

        # ---- dashboard ----
        dash = Card(orientation="vertical", size_hint_y=None, height=dp(110))
        top = BoxLayout(size_hint_y=None, height=dp(34))
        self.big = Label(text="Tayyar", markup=True, color=PRIMARY,
                         font_size="20sp", halign="left", valign="middle")
        self.pct = Label(text="", color=ACCENT, font_size="22sp",
                         halign="right", valign="middle")
        top.add_widget(self.big)
        top.add_widget(self.pct)
        dash.add_widget(top)
        self.subtitle = Label(text="Link paste karke Download dabayein.",
                              color=(0.36, 0.42, 0.52, 1), font_size="12sp",
                              size_hint_y=None, height=dp(18), halign="left")
        dash.add_widget(self.subtitle)
        self.pbar = ProgressBar(max=100, value=0, size_hint_y=None, height=dp(16))
        dash.add_widget(self.pbar)
        self.meta = Label(text="", color=(0.36, 0.42, 0.52, 1), font_size="11sp",
                          size_hint_y=None, height=dp(18), halign="left")
        dash.add_widget(self.meta)
        self.add_widget(dash)

        # ---- live log ----
        live = Card(orientation="vertical", color=DARK)
        live.add_widget(Label(text="[color=ff5555]●[/color] LIVE", markup=True,
                              color=(1, 1, 1, 1), font_size="11sp",
                              size_hint_y=None, height=dp(18), halign="left"))
        self.scroll = ScrollView()
        self.logl = Label(text="", color=(0.81, 0.88, 0.96, 1), font_size="10sp",
                          size_hint_y=None, halign="left", valign="top", markup=False)
        self.logl.bind(width=lambda *a: self.logl.setter("text_size")(
            self.logl, (self.logl.width, None)))
        self.logl.bind(texture_size=lambda *a: self.logl.setter("height")(
            self.logl, self.logl.texture_size[1]))
        self.scroll.add_widget(self.logl)
        live.add_widget(self.scroll)
        self.add_widget(live)

        self._align_labels()
        self.log(f"Save folder: {self.out_dir}")
        self.log("Link paste karo, Download dabao.")

    def _align_labels(self):
        for lbl in (self.big, self.subtitle, self.meta):
            lbl.bind(size=lambda inst, *_: inst.setter("text_size")(inst, inst.size))

    def _btn(self, text, color, cb):
        b = Button(text=text, background_normal="", background_color=color,
                   color=(1, 1, 1, 1), font_size="13sp", bold=True)
        b.bind(on_release=lambda *_: cb())
        return b

    # ---- logging / stats (main thread) ----
    @mainthread
    def log(self, msg=""):
        self.logl.text += (str(msg) + "\n")
        Clock.schedule_once(lambda *_: setattr(self.scroll, "scroll_y", 0), 0)

    @mainthread
    def on_stats(self, d):
        kind = d.get("kind", "")
        total = d.get("total", 0)
        idx = d.get("idx", 0)
        frac = d.get("frac", 0.0)
        msg = d.get("msg", "") or ""
        if msg.startswith("⏸"):
            self.big.text = "⏸ Paused"
            return
        if kind == "done" or total == 0:
            self.big.text = msg or "Tayyar"
            self.pct.text = ""
            self.pbar.value = 0
            self.meta.text = ""
            self.subtitle.text = ""
            return
        label = {"video": "Video", "pdf": "PDF"}.get(kind, "Item")
        self.big.text = f"{label}  {idx} / {total}"
        self.subtitle.text = d.get("title", "")
        self.pct.text = f"{frac * 100:.0f}%"
        self.pbar.value = max(0, min(100, frac * 100))
        spd, eta = d.get("speed", ""), d.get("eta", "")
        self.meta.text = f"{spd}   ETA {eta}" if spd else ""

    # ---- controls ----
    @mainthread
    def _set_running(self, on):
        self.running = on
        self.b_dl.disabled = on
        self.b_pause.disabled = not on
        self.b_resume.disabled = True
        self.b_stop.disabled = not on

    def start(self):
        if self.running:
            return
        urls = core.parse_links(self.links.text)
        if not urls:
            self.log("Pehle link paste karein.")
            return
        self.logl.text = ""
        self.pbar.value = 0
        self.big.text = "Shuru…"
        self.ctrl = core.Control(on_stats=self.on_stats)
        self._set_running(True)
        acquire_wakelock()   # background/screen-off me bhi download chale
        threading.Thread(target=self._worker, args=(urls,), daemon=True).start()

    def _worker(self, urls):
        try:
            core.run_bulk(urls, self.out_dir, log=self.log, control=self.ctrl)
        except Exception as e:
            self.log(f"Error: {e}")
        finally:
            release_wakelock()
            self._set_running(False)

    def pause(self):
        if self.ctrl and self.running:
            self.ctrl.request_pause()
            self.b_pause.disabled = True
            self.b_resume.disabled = False
            self.big.text = "⏸ Pause…"

    def resume(self):
        if self.ctrl and self.running:
            self.ctrl.request_resume()
            self.b_pause.disabled = False
            self.b_resume.disabled = True

    def stop(self):
        if self.ctrl:
            self.ctrl.request_stop()
            self.ctrl.request_resume()
            self.big.text = "⏹ Rok raha hoon…"


class COPAApp(App):
    def build(self):
        self.title = "COPA Downloader"
        request_perms()
        return RootUI()


if __name__ == "__main__":
    COPAApp().run()
