#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COPA Chicago — Case Video + Document Downloader
===============================================

Ek ya kai case links do -> har case ki SAARI videos (BWC 1, BWC 2, ...) AUR
uske PDF documents, apne apne folder me, ek-ek kar ke download ho jaate hain.

- Windows / Mac / Linux: chalao to professional window (GUI) khulti hai.
    links (har line par ek) paste karo -> "Download All".
    Pause / Resume / Stop buttons bhi.
- Android (Termux) / command line:
    python copa_downloader.py "<link1>" "<link2>" ...
    python copa_downloader.py --from-file links.txt

Andar `yt-dlp` use hota hai (Vimeo videos ko sahi tarah grab karne ke liye).
"""

import os
import re
import sys
import html
import time
import shutil
import argparse
import threading
import subprocess
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

COPA_HOME = "https://www.chicagocopa.org/"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

VIMEO_RE = re.compile(
    r"(?:player\.)?vimeo\.com/(?:video/)?(\d{6,12})"
    r"(?:(?:/|\?h=|&h=|%2Fh%3D)([0-9a-fA-F]{6,20}))?"
)
PDF_HREF_RE = re.compile(r'''(?:href|src|data-[\w-]+)\s*=\s*["']([^"']+\.pdf[^"']*)["']''', re.I)
PDF_BARE_RE = re.compile(r'''https?://[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?''', re.I)


# --------------------------------------------------------------------------
# Control (stop / pause / resume + callbacks)
# --------------------------------------------------------------------------

class StopRequested(Exception):
    pass


class PauseRequested(Exception):
    pass


PAUSED = object()   # sentinel: yeh video pause hui, resume par dobara try


class Control:
    """Download ko stop/pause/resume karne ka control + dashboard stats."""

    def __init__(self, on_stats=None):
        self.stop = False
        self.paused = False
        self._ev = threading.Event()
        self._ev.set()
        self.on_stats = on_stats   # fn(stats_dict)
        self.cur = {
            "kind": "", "idx": 0, "total": 0, "title": "",
            "frac": 0.0, "speed": "", "eta": "", "msg": "",
        }

    def request_stop(self):
        self.stop = True
        self._ev.set()

    def request_pause(self):
        self.paused = True
        self._ev.clear()

    def request_resume(self):
        self.paused = False
        self._ev.set()

    def checkpoint(self):
        if self.stop:
            raise StopRequested()
        if self.paused:
            raise PauseRequested()

    def wait_resume(self):
        self._ev.wait()

    def _emit(self):
        if self.on_stats:
            self.on_stats(dict(self.cur))

    def set_item(self, kind, idx, total, title, msg=""):
        self.cur.update(kind=kind, idx=idx, total=total, title=title,
                        frac=0.0, speed="", eta="", msg=msg)
        self._emit()

    def prog(self, frac, speed="", eta=""):
        self.cur.update(frac=frac, speed=speed, eta=eta)
        self._emit()

    def message(self, msg, kind=None):
        if kind is not None:
            self.cur["kind"] = kind
        self.cur["msg"] = msg
        self._emit()


# --------------------------------------------------------------------------
# Page fetch + extraction
# --------------------------------------------------------------------------

def fetch_html(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(url, headers=BROWSER_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    charset = "utf-8"
    m = re.search(r"charset=([\w-]+)", resp.headers.get("Content-Type", ""))
    if m:
        charset = m.group(1)
    return raw.decode(charset, errors="replace")


def extract_vimeo_videos(page_html: str):
    found, seen = [], set()
    text = html.unescape(page_html)
    for m in VIMEO_RE.finditer(text):
        vid, vhash = m.group(1), m.group(2)
        if vid in seen:
            continue
        seen.add(vid)
        url = f"https://vimeo.com/{vid}/{vhash}" if vhash else f"https://vimeo.com/{vid}"
        found.append({"id": vid, "hash": vhash, "url": url})
    return found


def extract_pdfs(page_html: str, base_url: str):
    urls, seen = [], set()
    for m in PDF_HREF_RE.finditer(page_html):
        full = urllib.parse.urljoin(base_url, html.unescape(m.group(1)))
        if full not in seen:
            seen.add(full)
            urls.append(full)
    for m in PDF_BARE_RE.finditer(page_html):
        full = html.unescape(m.group(0))
        if full not in seen:
            seen.add(full)
            urls.append(full)
    return urls


def extract_case_title(page_html: str) -> str:
    for pat in (
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
        r"<title[^>]*>(.*?)</title>",
        r"<h1[^>]*>(.*?)</h1>",
    ):
        m = re.search(pat, page_html, re.I | re.S)
        if m:
            t = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
            t = re.split(r"\s[|\-–]\s", t)[0].strip()
            if t:
                return t
    return "COPA Case"


def sanitize(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*\n\r\t]+', " ", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    return name[:120] or "COPA"


def collect_case(url: str, log=print):
    """Return (title, [videos], [pdf_urls])."""
    url = url.strip()
    if not url:
        raise ValueError("Koi link nahi diya.")

    if ("vimeo.com" in url) and ("chicagocopa" not in url):
        direct = extract_vimeo_videos(url)
        if direct:
            return "COPA Video", direct, []

    log(f"Page khol raha hoon: {url}")
    page = fetch_html(url)
    videos = extract_vimeo_videos(page)
    pdfs = extract_pdfs(page, url)
    title = extract_case_title(page)
    log(f"Case: {title}")
    log(f"Videos: {len(videos)}   PDF: {len(pdfs)}")
    return title, videos, pdfs


# --------------------------------------------------------------------------
# yt-dlp
# --------------------------------------------------------------------------

def _pip_install(pkgs, log):
    subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", *pkgs], check=True)
    import importlib
    importlib.invalidate_caches()


IS_ANDROID = ("ANDROID_ARGUMENT" in os.environ) or ("ANDROID_ROOT" in os.environ
                                                    and "com.termux" not in sys.prefix)


def ensure_ytdlp(log=print) -> bool:
    frozen = getattr(sys, "frozen", False)
    can_pip = not frozen and not IS_ANDROID   # exe/APK me pip nahi chalta
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        if not can_pip:
            log("yt-dlp is build me nahi hai.")
            return False
        log("yt-dlp install ho raha hai (pip)...")
        try:
            _pip_install(["yt-dlp"], log)
            import yt_dlp  # noqa: F401
        except Exception as e:
            log(f"yt-dlp install nahi ho saka: {e}")
            return False
    try:
        import curl_cffi  # noqa: F401
    except ImportError:
        if can_pip:
            log("curl_cffi install ho raha hai (Vimeo ke liye)...")
            try:
                _pip_install(["curl_cffi"], log)
            except Exception as e:
                log(f"⚠ curl_cffi install nahi hua: {e}")
    return True


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def aria2c_path():
    """
    aria2c (multi-connection downloader) ka rasta — exe me bundle hota hai,
    warna PATH par (Termux: pkg install aria2). Isse single/progressive files
    bhi 16 connections se (IDM jaisi) tez download hoti hain.
    """
    if getattr(sys, "frozen", False):
        base = getattr(sys, "_MEIPASS", "")
        for name in ("aria2c.exe", "aria2c"):
            p = os.path.join(base, name)
            if os.path.exists(p):
                return p
    return shutil.which("aria2c")


def impersonate_target():
    try:
        import curl_cffi  # noqa: F401
    except Exception:
        return None
    try:
        import yt_dlp
        with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True}) as y:
            avail = list(y._get_available_impersonate_targets())
        if avail:
            return avail[0][0]
    except Exception:
        pass
    return None


def player_url(video) -> str:
    vid, vhash = video["id"], video.get("hash")
    if vhash:
        return f"https://player.vimeo.com/video/{vid}?h={vhash}"
    return f"https://player.vimeo.com/video/{vid}"


def download_one(video, index, folder: Path, log, control, imp_target):
    """Ek video download. Return True/False ya PAUSED sentinel."""
    import yt_dlp

    out_tmpl = str(folder / f"{index:02d} - %(title)s.%(ext)s")
    dl_url = player_url(video)

    class _Logger:
        def debug(self, msg):
            if isinstance(msg, str) and msg.startswith("[download]") and "%" not in msg:
                log(msg)
        def info(self, msg):
            log(msg)
        def warning(self, msg):
            if "impersonat" in str(msg).lower():
                return   # benign, chhupa do
            log("⚠ " + str(msg))
        def error(self, msg):
            log("✘ " + str(msg))

    last = {"pct": ""}

    def hook(d):
        control.checkpoint()
        st = d.get("status")
        if st == "downloading":
            done = d.get("downloaded_bytes") or 0
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            frac = (done / total) if total else 0.0
            spd = (d.get("_speed_str") or "").strip()
            eta = (d.get("_eta_str") or "").strip()
            control.prog(frac, spd, eta)
            pct = (d.get("_percent_str") or "").strip()
            if pct and pct != last["pct"]:
                last["pct"] = pct
                log(f"   {pct}   {spd}   ETA {eta}")
        elif st == "finished":
            control.prog(1.0)
            log("   file tayyar kar raha hoon…")

    opts = {
        "outtmpl": out_tmpl,
        "http_headers": {"Referer": COPA_HOME},
        "noplaylist": True,
        "logger": _Logger(),
        "progress_hooks": [hook],
        "quiet": True,
        "no_warnings": False,
        "retries": 10,
        "fragment_retries": 10,
        "extractor_retries": 5,
        "continuedl": True,
        # SPEED: HLS/DASH ke kai fragments ek saath (IDM jaisi multi-connection)
        "concurrent_fragment_downloads": 16,
    }
    if imp_target is not None:
        opts["impersonate"] = imp_target

    # SPEED (progressive/single files): aria2c se 16-connection (IDM jaisi).
    # HLS/DASH pehle se concurrent_fragment_downloads=16 se tez hai (native).
    ar = aria2c_path()
    if ar:
        opts["external_downloader"] = {"http": ar, "https": ar, "ftp": ar}
        opts["external_downloader_args"] = {
            "aria2c": [
                "--max-connection-per-server=16",
                "--split=16",
                "--min-split-size=1M",
                "--max-concurrent-downloads=16",
                "--file-allocation=none",
                "--continue=true",
                "--console-log-level=warn",
                "--summary-interval=0",
            ]
        }

    if has_ffmpeg():
        opts["format"] = "bestvideo*+bestaudio/best"
        opts["merge_output_format"] = "mp4"
    else:
        opts["format"] = "best[ext=mp4]/best"

    log(f"\n▶ [{index}] {video['url']}")
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([dl_url])
        log("✔ ho gayi")
        return True
    except PauseRequested:
        return PAUSED
    except StopRequested:
        raise
    except Exception as e:
        log(f"✘ fail: {e}")
        return False


def download_pdf(url, folder: Path, log, control):
    control.checkpoint()
    raw = urllib.parse.unquote(url.split("?")[0].rstrip("/").split("/")[-1])
    name = sanitize(raw) or "document"
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    dest = folder / name
    if dest.exists() and dest.stat().st_size > 0:
        log(f"   (pehle se) {name}")
        return True
    try:
        req = urllib.request.Request(url, headers=BROWSER_HEADERS)
        with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
            shutil.copyfileobj(r, f)
        log(f"   ✔ PDF: {name}")
        return True
    except Exception as e:
        log(f"   ✘ PDF fail ({name}): {e}")
        return False


# --------------------------------------------------------------------------
# Flow: ek case / bulk
# --------------------------------------------------------------------------

def download_case(url, out_root: Path, log, control, imp_target, case_label=""):
    title, videos, pdfs = collect_case(url, log=log)
    if not videos and not pdfs:
        log("⚠ Is link par koi video/PDF nahi mili. (Link case-page ka hai?)")
        return 0, 0

    folder = out_root / sanitize(title)
    folder.mkdir(parents=True, exist_ok=True)
    log(f"📁 Folder: {folder}")

    ok = 0
    total = len(videos) + len(pdfs)

    disp = (case_label + title).strip(" •")

    # ---- videos ----
    for i, v in enumerate(videos, start=1):
        control.set_item("video", i, len(videos), disp)
        while True:
            res = download_one(v, i, folder, log, control, imp_target)
            if res is PAUSED:
                log("⏸ Paused — 'Resume' dabayein.")
                control.message("⏸ Paused")
                control.wait_resume()
                if control.stop:
                    return ok, total
                control.set_item("video", i, len(videos), disp)
                continue    # wahi video dobara (adhi file resume hogi)
            break
        if res:
            ok += 1

    # ---- PDFs ----
    if pdfs:
        log(f"\n📄 {len(pdfs)} PDF document…")
        for j, p in enumerate(pdfs, start=1):
            control.set_item("pdf", j, len(pdfs), disp)
            try:
                if download_pdf(p, folder, log, control):
                    ok += 1
            except PauseRequested:
                control.message("⏸ Paused")
                control.wait_resume()
                if control.stop:
                    return ok, total

    log(f"— Case done: {ok}/{total} — {folder}\n")
    return ok, total


def parse_links(text: str):
    links = []
    for line in text.replace(",", "\n").splitlines():
        s = line.strip()
        if s and ("http" in s or "vimeo.com" in s):
            links.append(s)
    return links


def run_bulk(urls, out_root: Path, log=print, control=None):
    if control is None:
        control = Control()
    if not ensure_ytdlp(log):
        log("\n❌ yt-dlp nahi mila. Install karein: pip install yt-dlp")
        control.set_item("done", 0, 0, "", msg="❌ yt-dlp nahi mila")
        return

    urls = [u for u in urls if u.strip()]
    if not urls:
        log("Koi link nahi diya.")
        return

    log(f"Kul {len(urls)} case link(s).\n")
    imp = impersonate_target()
    if imp is not None:
        log(f"(impersonation on: {imp})")

    total_ok = total_all = done_cases = 0
    try:
        for n, url in enumerate(urls, start=1):
            if control.stop:
                break
            label = f"Case {n}/{len(urls)}  •  " if len(urls) > 1 else ""
            log(f"============ CASE {n}/{len(urls)} ============")
            try:
                ok, allv = download_case(url, out_root, log, control, imp, label)
                total_ok += ok
                total_all += allv
                done_cases += 1
            except StopRequested:
                log("⏹ Roka gaya.")
                break
            except Exception as e:
                log(f"✘ Is case me error: {e}\n")
    finally:
        log("\n================ MUKAMMAL ================")
        log(f"✅ {done_cases}/{len(urls)} case, {total_ok}/{total_all} files download.")
        log(f"📁 {out_root}")
        log("=========================================")
        control.set_item("done", 0, 0, "",
                         msg=f"✅ Done — {total_ok}/{total_all} files download hui")


# --------------------------------------------------------------------------
# GUI — professional, COPA blue, 3D-ish
# --------------------------------------------------------------------------

# COPA-ish palette
C_BG      = "#EAF1F9"
C_CARD    = "#FFFFFF"
C_PRIMARY = "#0A4EA3"
C_PRIM_DK = "#063A7A"
C_ACCENT  = "#2D82D6"
C_TEXT    = "#152A45"
C_MUTED   = "#5B6B85"
C_SUCCESS = "#1E9E5A"
C_DANGER  = "#C0392B"
C_AMBER   = "#E08A1E"
C_LOGBG   = "#0E1B2E"
C_LOGFG   = "#CFE0F5"


def _hex(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def _to_hex(t):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(v)))) for v in t)


def _lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def _mix(c, other, pct):
    return _to_hex(_lerp(_hex(c), _hex(other), pct / 100.0))


def _lighten(c, pct):
    return _mix(c, "#FFFFFF", pct)


def _darken(c, pct):
    return _mix(c, "#000000", pct)


def _round_pts(x1, y1, x2, y2, r):
    return [
        x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r,
        x2, y2 - r, x2, y2, x2 - r, y2, x1 + r, y2,
        x1, y2, x1, y2 - r, x1, y1 + r, x1, y1,
    ]


def _make_widgets(tk):
    """GUI widget classes lazily banao (taake tkinter na hone par bhi CLI chale)."""

    class RoundButton(tk.Canvas):
        """3D-ish rounded button (Canvas) with hover/press/disabled states."""

        def __init__(self, parent, text, command=None, w=180, h=48,
                     base=C_PRIMARY, fg="white", icon="", bg=C_CARD,
                     font=("Segoe UI", 11, "bold"), radius=14):
            super().__init__(parent, width=w, height=h, bg=bg, highlightthickness=0, bd=0)
            self.command = command
            self.w, self.h, self.r = w, h, radius
            self.base, self.fg, self.font = base, fg, font
            self.text = (icon + "  " + text).strip() if icon else text
            self.enabled = True
            self.hover = False
            self.pressed = False
            self._draw()
            self.bind("<Enter>", self._enter)
            self.bind("<Leave>", self._leave)
            self.bind("<Button-1>", self._press)
            self.bind("<ButtonRelease-1>", self._release)

        def set_enabled(self, on):
            self.enabled = on
            self.pressed = False
            self.hover = False
            self._draw()

        def _face_color(self):
            if not self.enabled:
                return "#AEB9CA"
            if self.pressed:
                return _darken(self.base, 12)
            if self.hover:
                return _lighten(self.base, 8)
            return self.base

        def _draw(self):
            self.delete("all")
            w, h, r = self.w, self.h, self.r
            lip = "#96A2B6" if not self.enabled else _darken(self.base, 28)
            drop = 4
            press = 3 if self.pressed else 0
            self.create_polygon(_round_pts(2, 2 + drop, w - 2, h - 2, r),
                                smooth=True, fill=lip, outline="")
            face = self._face_color()
            top = _lighten(face, 16 if self.enabled else 4)
            self.create_polygon(_round_pts(2, 2 + press, w - 2, h - 2 - drop + press, r),
                                smooth=True, fill=face, outline="")
            self.create_polygon(_round_pts(6, 5 + press, w - 6, (h - drop) // 2 + press, r - 3),
                                smooth=True, fill=top, outline="")
            self.create_text(w // 2, (h - drop) // 2 + 1 + press, text=self.text,
                             fill=self.fg if self.enabled else "#F0F3F8", font=self.font)

        def _enter(self, _):
            if self.enabled:
                self.hover = True
                self.config(cursor="hand2")
                self._draw()

        def _leave(self, _):
            self.hover = False
            self.config(cursor="")
            self._draw()

        def _press(self, _):
            if self.enabled:
                self.pressed = True
                self._draw()

        def _release(self, _):
            if self.enabled and self.pressed:
                self.pressed = False
                self._draw()
                if self.command:
                    self.command()

    class GradientHeader(tk.Canvas):
        def __init__(self, parent, title, subtitle, h=96):
            super().__init__(parent, height=h, bg=C_PRIMARY, highlightthickness=0, bd=0)
            self.title, self.subtitle, self.h = title, subtitle, h
            self.bind("<Configure>", lambda e: self._draw(e.width))

        def _draw(self, w):
            self.delete("all")
            a, b = _hex(C_PRIM_DK), _hex(C_ACCENT)
            step = max(2, w // 220)
            for x in range(0, w, step):
                self.create_line(x, 0, x, self.h, width=step,
                                fill=_to_hex(_lerp(a, b, x / max(w - 1, 1))))
            cx, cy, rr = 40, self.h // 2, 24
            self.create_oval(cx - rr, cy - rr, cx + rr, cy + rr,
                            fill=_lighten(C_PRIM_DK, 6), outline="#FFFFFF", width=2)
            self.create_text(cx, cy, text="▶", fill="#FFFFFF", font=("Segoe UI", 20, "bold"))
            self.create_text(80, cy - 14, text=self.title, anchor="w",
                            fill="#FFFFFF", font=("Segoe UI Semibold", 18, "bold"))
            self.create_text(82, cy + 16, text=self.subtitle, anchor="w",
                            fill="#DCEBFB", font=("Segoe UI", 10))
            self.create_line(0, self.h - 3, w, self.h - 3, fill=_darken(C_PRIM_DK, 20), width=3)

    return RoundButton, GradientHeader


def default_out_dir() -> Path:
    return Path.home() / "Downloads" / "COPA"


def launch_gui():
    import tkinter as tk
    from tkinter import ttk, filedialog, scrolledtext

    RoundButton, GradientHeader = _make_widgets(tk)

    root = tk.Tk()
    root.title("COPA Video Downloader")
    root.geometry("860x680")
    root.minsize(720, 560)
    root.configure(bg=C_BG)

    # ttk progressbar style (COPA blue)
    style = ttk.Style(root)
    try:
        style.theme_use("clam")
    except Exception:
        pass
    style.configure("COPA.Horizontal.TProgressbar", troughcolor="#D3E0F0",
                    background=C_ACCENT, thickness=16, borderwidth=0)

    ctrl = {"obj": None, "running": False}

    # ---------- header ----------
    header = GradientHeader(root, "COPA Video Downloader",
                            "Chicago  •  Case videos + PDF documents")
    header.pack(fill="x", side="top")

    body = tk.Frame(root, bg=C_BG)
    body.pack(fill="both", expand=True, padx=16, pady=12)

    def card(parent):
        shadow = tk.Frame(parent, bg="#C4D2E6")
        inner = tk.Frame(shadow, bg=C_CARD)
        inner.pack(fill="both", expand=True, padx=0, pady=0)
        return shadow, inner

    # ---------- input card ----------
    sh1, c1 = card(body)
    sh1.pack(fill="x", pady=(0, 12))
    tk.Label(c1, text="Case link(s) — har line par EK link (bulk chalega)",
             bg=C_CARD, fg=C_TEXT, font=("Segoe UI Semibold", 11, "bold")).pack(anchor="w", padx=14, pady=(12, 4))

    url_box = tk.Text(c1, height=5, font=("Consolas", 10), wrap="none",
                      bg="#F6F9FD", fg=C_TEXT, relief="flat",
                      highlightthickness=1, highlightbackground="#C8D6EA",
                      insertbackground=C_PRIMARY)
    url_box.pack(fill="x", padx=14, pady=(0, 8))

    row = tk.Frame(c1, bg=C_CARD)
    row.pack(fill="x", padx=14, pady=(0, 12))

    out_var = tk.StringVar(value=str(default_out_dir()))

    def load_txt():
        f = filedialog.askopenfilename(title="Links wali .txt file",
                                       filetypes=[("Text", "*.txt"), ("All", "*.*")])
        if f:
            try:
                data = Path(f).read_text(encoding="utf-8", errors="replace")
                pre = "\n" if url_box.get("1.0", "end").strip() else ""
                url_box.insert("end", pre + data)
            except Exception as e:
                log(f"File nahi khuli: {e}")

    def choose_dir():
        d = filedialog.askdirectory(initialdir=str(Path.home()))
        if d:
            out_var.set(d)

    RoundButton(row, "Links .txt", command=load_txt, icon="📄", w=120, h=38,
                base=C_ACCENT, font=("Segoe UI", 10, "bold")).pack(side="left")
    tk.Label(row, text="  Save folder:", bg=C_CARD, fg=C_MUTED,
             font=("Segoe UI", 10)).pack(side="left")
    out_entry = tk.Entry(row, textvariable=out_var, font=("Segoe UI", 10),
                         bg="#F6F9FD", fg=C_TEXT, relief="flat",
                         highlightthickness=1, highlightbackground="#C8D6EA")
    out_entry.pack(side="left", fill="x", expand=True, padx=8, ipady=4)
    RoundButton(row, "Change", command=choose_dir, w=90, h=38,
                base="#7C8AA3", font=("Segoe UI", 10, "bold")).pack(side="left")

    # ---------- action buttons ----------
    act = tk.Frame(body, bg=C_BG)
    act.pack(fill="x", pady=(0, 10))

    dl_btn = RoundButton(act, "Download All", icon="⬇", w=210, h=52,
                         base=C_PRIMARY, bg=C_BG, font=("Segoe UI", 13, "bold"))
    dl_btn.pack(side="left")
    pause_btn = RoundButton(act, "Pause", icon="⏸", w=120, h=52,
                            base=C_AMBER, bg=C_BG, font=("Segoe UI", 11, "bold"))
    pause_btn.pack(side="left", padx=(10, 0))
    resume_btn = RoundButton(act, "Resume", icon="▶", w=120, h=52,
                             base=C_SUCCESS, bg=C_BG, font=("Segoe UI", 11, "bold"))
    resume_btn.pack(side="left", padx=(10, 0))
    stop_btn = RoundButton(act, "Stop", icon="■", w=110, h=52,
                           base=C_DANGER, bg=C_BG, font=("Segoe UI", 11, "bold"))
    stop_btn.pack(side="left", padx=(10, 0))

    # ---------- DASHBOARD (clean) ----------
    sh2, c2 = card(body)
    sh2.pack(fill="x", pady=(0, 12))
    dash = tk.Frame(c2, bg=C_CARD)
    dash.pack(fill="x", padx=18, pady=14)

    toprow = tk.Frame(dash, bg=C_CARD)
    toprow.pack(fill="x")
    big_var = tk.StringVar(value="Tayyar")
    pct_var = tk.StringVar(value="")
    tk.Label(toprow, textvariable=big_var, bg=C_CARD, fg=C_PRIMARY,
             font=("Segoe UI Semibold", 20, "bold"), anchor="w").pack(side="left")
    tk.Label(toprow, textvariable=pct_var, bg=C_CARD, fg=C_ACCENT,
             font=("Segoe UI", 24, "bold"), anchor="e").pack(side="right")

    title_var = tk.StringVar(value="Case ka link paste karke 'Download All' dabayein.")
    tk.Label(dash, textvariable=title_var, bg=C_CARD, fg=C_MUTED,
             font=("Segoe UI", 10), anchor="w").pack(fill="x", pady=(2, 10))

    pbar = ttk.Progressbar(dash, style="COPA.Horizontal.TProgressbar",
                           mode="determinate", maximum=100)
    pbar.pack(fill="x")
    meta_var = tk.StringVar(value="")
    tk.Label(dash, textvariable=meta_var, bg=C_CARD, fg=C_MUTED, anchor="w",
             font=("Consolas", 9)).pack(fill="x", pady=(6, 0))

    # ---------- LIVE box (chhota) ----------
    sh3, c3 = card(body)
    sh3.pack(fill="both", expand=True)
    livehdr = tk.Frame(c3, bg=C_CARD)
    livehdr.pack(fill="x", padx=10, pady=(8, 0))
    tk.Label(livehdr, text="●", bg=C_CARD, fg=C_DANGER,
             font=("Segoe UI", 10, "bold")).pack(side="left")
    tk.Label(livehdr, text=" LIVE", bg=C_CARD, fg=C_TEXT,
             font=("Segoe UI Semibold", 9, "bold")).pack(side="left")
    tk.Label(livehdr, text="  — technical activity", bg=C_CARD, fg=C_MUTED,
             font=("Segoe UI", 8)).pack(side="left")
    log_box = scrolledtext.ScrolledText(c3, font=("Consolas", 8), height=7,
                                        bg=C_LOGBG, fg=C_LOGFG, relief="flat",
                                        insertbackground=C_LOGFG, borderwidth=0)
    log_box.pack(fill="both", expand=True, padx=8, pady=8)
    log_box.configure(state="disabled")

    # ---------- callbacks (thread-safe via root.after) ----------
    def log(msg=""):
        def _a():
            log_box.configure(state="normal")
            log_box.insert("end", str(msg) + "\n")
            log_box.see("end")
            log_box.configure(state="disabled")
        root.after(0, _a)

    KIND_LABEL = {"video": "Video", "pdf": "PDF"}

    def on_stats(d):
        def _a():
            kind = d.get("kind", "")
            total = d.get("total", 0)
            idx = d.get("idx", 0)
            frac = d.get("frac", 0.0)
            msg = d.get("msg", "") or ""
            if msg.startswith("⏸"):
                big_var.set("⏸ Paused")
                return
            if kind == "done" or total == 0:
                big_var.set(msg or "Tayyar")
                pct_var.set("")
                pbar["value"] = 0
                meta_var.set("")
                title_var.set("")
                return
            big_var.set(f"{KIND_LABEL.get(kind, 'Item')}  {idx} / {total}")
            title_var.set(d.get("title", ""))
            pct_var.set(f"{frac*100:.0f}%")
            pbar["value"] = max(0, min(100, frac * 100))
            spd, eta = d.get("speed", ""), d.get("eta", "")
            meta_var.set(f"{spd}     ETA {eta}" if spd else "")
        root.after(0, _a)

    # ---------- button wiring ----------
    def set_running(on):
        ctrl["running"] = on
        dl_btn.set_enabled(not on)
        pause_btn.set_enabled(on)
        resume_btn.set_enabled(False)
        stop_btn.set_enabled(on)

    def worker(urls, out_root):
        try:
            run_bulk(urls, out_root, log=log, control=ctrl["obj"])
        except Exception as e:
            log(f"\n❌ Error: {e}")
        finally:
            root.after(0, lambda: set_running(False))

    def start():
        if ctrl["running"]:
            return
        urls = parse_links(url_box.get("1.0", "end"))
        if not urls:
            log("Pehle case ka link/links paste karein (har line par ek).")
            return
        log_box.configure(state="normal")
        log_box.delete("1.0", "end")
        log_box.configure(state="disabled")
        pbar["value"] = 0
        big_var.set("Shuru ho raha hai…")
        pct_var.set("")
        title_var.set("")
        meta_var.set("")
        ctrl["obj"] = Control(on_stats=on_stats)
        set_running(True)
        threading.Thread(target=worker, args=(urls, Path(out_var.get())),
                         daemon=True).start()

    def do_pause():
        if ctrl["obj"] and ctrl["running"]:
            ctrl["obj"].request_pause()
            pause_btn.set_enabled(False)
            resume_btn.set_enabled(True)
            big_var.set("⏸ Pause ho raha hai…")

    def do_resume():
        if ctrl["obj"] and ctrl["running"]:
            ctrl["obj"].request_resume()
            pause_btn.set_enabled(True)
            resume_btn.set_enabled(False)
            big_var.set("▶ Resume…")

    def do_stop():
        if ctrl["obj"]:
            ctrl["obj"].request_stop()
            ctrl["obj"].request_resume()   # agar paused tha to chhoot jaye
            big_var.set("⏹ Rok raha hoon…")

    dl_btn.command = start
    pause_btn.command = do_pause
    resume_btn.command = do_resume
    stop_btn.command = do_stop
    set_running(False)

    log("👋 COPA Downloader tayyar hai.")
    log("• Case ke link(s) upar paste karein (har line par EK).")
    log("• 'Download All' dabayein — videos + PDF, case ke folder me save hongi.")
    log("• Pause/Resume: jahan roka wahin se aage; Stop: sab band.\n")

    root.mainloop()


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="COPA Chicago case(s) ki videos + PDF download karo."
    )
    parser.add_argument("urls", nargs="*", help="Ek ya kai case/Vimeo links")
    parser.add_argument("-o", "--out", default=str(default_out_dir()),
                        help="Kahan save karna hai (folder)")
    parser.add_argument("--from-file", help="Links wali text file")
    parser.add_argument("--gui", action="store_true", help="Window (GUI) kholo")
    args = parser.parse_args()

    urls = list(args.urls)
    if args.from_file:
        try:
            urls += parse_links(Path(args.from_file).read_text(encoding="utf-8",
                                                               errors="replace"))
        except Exception as e:
            print(f"File nahi khuli: {e}")
            return

    if args.gui or not urls:
        try:
            launch_gui()
        except Exception as e:
            print(f"GUI nahi khul saka ({e}).")
            print('Command line se: python copa_downloader.py "<link1>" "<link2>"')
        return

    run_bulk(urls, Path(args.out), log=print)


if __name__ == "__main__":
    main()
