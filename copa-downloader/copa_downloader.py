#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COPA Chicago — Case Video Downloader
====================================

Ek ya kai case links do -> har case ki SAARI videos (BWC 1, BWC 2, ...) apne
apne folder me, ek-ek kar ke, download ho jaati hain.

- Windows / Mac / Linux par: chalao to ek chhoti window (GUI) khulti hai.
    links (har line par ek) paste karo -> "Download All" dabao.
- Android (Termux) / command line se:
    python copa_downloader.py "<link1>" "<link2>" ...
    python copa_downloader.py --from-file links.txt

Yeh tool andar-hi-andar `yt-dlp` use karta hai (Vimeo videos ko sahi tarah
grab karne ke liye). IDM in videos ko grab nahi karta, isliye yt-dlp zaroori hai.
"""

import os
import re
import sys
import html
import shutil
import argparse
import subprocess
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

# vimeo.com/1189886906   |   player.vimeo.com/video/1189886906
# optional unlisted hash: vimeo.com/1189886906/abcdef1234  or  ?h=abcdef1234
VIMEO_RE = re.compile(
    r"(?:player\.)?vimeo\.com/(?:video/)?(\d{6,12})"
    r"(?:(?:/|\?h=|&h=|%2Fh%3D)([0-9a-fA-F]{6,20}))?"
)


# --------------------------------------------------------------------------
# Core: page fetch + video extraction
# --------------------------------------------------------------------------

def fetch_html(url: str, timeout: int = 30) -> str:
    """Case page ka HTML laao (browser jaise headers ke saath, warna 403)."""
    req = urllib.request.Request(url, headers=BROWSER_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    charset = "utf-8"
    ctype = resp.headers.get("Content-Type", "")
    m = re.search(r"charset=([\w-]+)", ctype)
    if m:
        charset = m.group(1)
    return raw.decode(charset, errors="replace")


def extract_vimeo_videos(page_html: str):
    """
    HTML me se saari Vimeo videos nikaalo.
    Return: list of dicts {id, hash, url}  (page order me, bina duplicate).
    """
    found = []
    seen = set()
    # HTML entities (&#38; etc.) ko normal karo taake links tootein nahi
    text = html.unescape(page_html)
    for m in VIMEO_RE.finditer(text):
        vid = m.group(1)
        vhash = m.group(2)
        if vid in seen:
            continue
        seen.add(vid)
        if vhash:
            url = f"https://vimeo.com/{vid}/{vhash}"
        else:
            url = f"https://vimeo.com/{vid}"
        found.append({"id": vid, "hash": vhash, "url": url})
    return found


def extract_case_title(page_html: str) -> str:
    """Case ka naam (folder ke liye) — page title / og:title se."""
    for pat in (
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
        r"<title[^>]*>(.*?)</title>",
        r"<h1[^>]*>(.*?)</h1>",
    ):
        m = re.search(pat, page_html, re.I | re.S)
        if m:
            t = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
            # site ka naam wagera hata do
            t = re.split(r"\s[|\-–]\s", t)[0].strip()
            if t:
                return t
    return "COPA Case"


def sanitize(name: str) -> str:
    """Folder / file ke naam se galat characters hata do."""
    name = re.sub(r'[<>:"/\\|?*\n\r\t]+', " ", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    return name[:120] or "COPA"


def collect_case(url: str, log=print):
    """
    Ek COPA case URL do -> (case_title, [videos]).
    Agar seedha Vimeo ka link diya ho to usi ko akela video maan lo.
    """
    url = url.strip()
    if not url:
        raise ValueError("Koi link nahi diya.")

    # Seedha Vimeo link?
    if ("vimeo.com" in url) and ("chicagocopa" not in url):
        direct = extract_vimeo_videos(url)
        if direct:
            return "COPA Video", direct

    log(f"Page khol raha hoon: {url}")
    page = fetch_html(url)
    videos = extract_vimeo_videos(page)
    title = extract_case_title(page)
    log(f"Case: {title}")
    log(f"Mili videos: {len(videos)}")
    return title, videos


# --------------------------------------------------------------------------
# yt-dlp (Python API se — taake .exe me bhi bina python ke chale)
# --------------------------------------------------------------------------

def ensure_ytdlp(log=print) -> bool:
    """yt_dlp import ho sake ye pakka karo (na ho to pip se install karo)."""
    try:
        import yt_dlp  # noqa: F401
        return True
    except ImportError:
        pass
    if getattr(sys, "frozen", False):
        log("yt-dlp is build me nahi hai.")
        return False
    log("yt-dlp install ho raha hai (pip)... thoda intezaar...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"],
            check=True,
        )
        import importlib
        importlib.invalidate_caches()
        import yt_dlp  # noqa: F401
        return True
    except Exception as e:
        log(f"yt-dlp install nahi ho saka: {e}")
        return False


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def download_one(video, index, folder: Path, log=print, stop_flag=None) -> bool:
    """Ek video download karo folder me (yt_dlp Python API se)."""
    import yt_dlp

    out_tmpl = str(folder / f"{index:02d} - %(title)s.%(ext)s")

    class _Logger:
        def debug(self, msg):
            if isinstance(msg, str) and msg.startswith("[download]"):
                # progress lines hook se aati hain, yahan skip
                if "%" not in msg:
                    log(msg)
        def info(self, msg):
            log(msg)
        def warning(self, msg):
            log("⚠ " + str(msg))
        def error(self, msg):
            log("✘ " + str(msg))

    last = {"pct": ""}

    def hook(d):
        if stop_flag is not None and stop_flag():
            raise KeyboardInterrupt("user stop")
        if d.get("status") == "downloading":
            pct = (d.get("_percent_str") or "").strip()
            if pct and pct != last["pct"]:
                last["pct"] = pct
                spd = (d.get("_speed_str") or "").strip()
                eta = (d.get("_eta_str") or "").strip()
                log(f"   {pct}   {spd}   ETA {eta}")
        elif d.get("status") == "finished":
            log("   file mil gayi, tayyar kar raha hoon…")

    opts = {
        "outtmpl": out_tmpl,
        "http_headers": {"Referer": COPA_HOME},
        "noplaylist": True,
        "logger": _Logger(),
        "progress_hooks": [hook],
        "quiet": True,
        "no_warnings": False,
        "retries": 5,
        "fragment_retries": 5,
        "continuedl": True,
    }
    if has_ffmpeg():
        opts["format"] = "bestvideo*+bestaudio/best"
        opts["merge_output_format"] = "mp4"
    else:
        opts["format"] = "best[ext=mp4]/best"

    log(f"\n▶ [{index}] {video['url']}")
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([video["url"]])
        log("✔ ho gayi")
        return True
    except KeyboardInterrupt:
        log("⏹ roka gaya.")
        raise
    except Exception as e:
        log(f"✘ fail: {e}")
        return False


# --------------------------------------------------------------------------
# Flow: ek case  /  bulk (kai cases)
# --------------------------------------------------------------------------

def download_case(url: str, out_root: Path, log=print, stop_flag=None):
    """Ek case: kholo -> folder banao -> saari videos download karo."""
    title, videos = collect_case(url, log=log)
    if not videos:
        log(
            "⚠ Is link par koi Vimeo video nahi mili.\n"
            "   - Link sahi case-page ka hai? (jis par video tiles dikhti hain)\n"
            "   - Ya seedha us video ka Vimeo link (vimeo.com/....) paste karke dekhein."
        )
        return 0, 0

    folder = out_root / sanitize(title)
    folder.mkdir(parents=True, exist_ok=True)
    log(f"📁 Folder: {folder}")
    log(f"Kul {len(videos)} videos…\n")

    ok = 0
    for i, v in enumerate(videos, start=1):
        if stop_flag is not None and stop_flag():
            break
        if download_one(v, i, folder, log=log, stop_flag=stop_flag):
            ok += 1
    log(f"— Case done: {ok}/{len(videos)} — {folder}\n")
    return ok, len(videos)


def parse_links(text: str):
    """Multi-line text me se saaf links ki list nikaalo."""
    links = []
    for line in text.replace(",", "\n").splitlines():
        s = line.strip()
        if s and ("http" in s or "vimeo.com" in s):
            links.append(s)
    return links


def run_bulk(urls, out_root: Path, log=print, stop_flag=None):
    """Kai cases ek ke baad ek."""
    if not ensure_ytdlp(log):
        log("\n❌ yt-dlp nahi mila. Install karein: pip install yt-dlp")
        return

    urls = [u for u in urls if u.strip()]
    if not urls:
        log("Koi link nahi diya.")
        return

    log(f"Kul {len(urls)} case link(s) mile.\n")
    total_ok = total_all = 0
    done_cases = 0
    try:
        for n, url in enumerate(urls, start=1):
            if stop_flag is not None and stop_flag():
                log("⏹ Roka gaya.")
                break
            log(f"============ CASE {n}/{len(urls)} ============")
            try:
                ok, allv = download_case(url, out_root, log=log, stop_flag=stop_flag)
                total_ok += ok
                total_all += allv
                done_cases += 1
            except KeyboardInterrupt:
                log("⏹ Roka gaya.")
                break
            except Exception as e:
                log(f"✘ Is case me error: {e}\n")
    finally:
        log("\n================ MUKAMMAL ================")
        log(f"✅ {done_cases}/{len(urls)} case, {total_ok}/{total_all} videos download hui.")
        log(f"📁 {out_root}")
        log("=========================================")


# --------------------------------------------------------------------------
# GUI (window) — Windows/Mac/Linux
# --------------------------------------------------------------------------

def default_out_dir() -> Path:
    return Path.home() / "Downloads" / "COPA"


def launch_gui():
    import threading
    import tkinter as tk
    from tkinter import filedialog, scrolledtext

    stop = {"flag": False}

    root = tk.Tk()
    root.title("COPA Video Downloader")
    root.geometry("760x600")
    root.minsize(620, 480)

    pad = {"padx": 10, "pady": 6}

    top = tk.Frame(root)
    top.pack(fill="x", **pad)

    tk.Label(top, text="Case link(s) — har line par EK link (bulk chalega):",
             font=("Segoe UI", 10, "bold")).pack(anchor="w")
    url_box = tk.Text(top, height=6, font=("Consolas", 10), wrap="none")
    url_box.pack(fill="x", pady=(2, 6))
    url_box.focus()

    def load_txt():
        f = filedialog.askopenfilename(
            title="Links wali .txt file chunein",
            filetypes=[("Text files", "*.txt"), ("All", "*.*")],
        )
        if f:
            try:
                data = Path(f).read_text(encoding="utf-8", errors="replace")
                url_box.insert("end", ("\n" if url_box.get("1.0", "end").strip() else "") + data)
            except Exception as e:
                log(f"File nahi khuli: {e}")

    row = tk.Frame(top)
    row.pack(fill="x")
    tk.Button(row, text="📄 Links .txt se lo", command=load_txt).pack(side="left")
    tk.Label(row, text="   Save folder:").pack(side="left")
    out_var = tk.StringVar(value=str(default_out_dir()))
    out_entry = tk.Entry(row, textvariable=out_var)
    out_entry.pack(side="left", fill="x", expand=True, padx=6)

    def choose_dir():
        d = filedialog.askdirectory(initialdir=str(Path.home()))
        if d:
            out_var.set(d)

    tk.Button(row, text="Change…", command=choose_dir).pack(side="left")

    btn_row = tk.Frame(root)
    btn_row.pack(fill="x", **pad)
    dl_btn = tk.Button(btn_row, text="⬇  Download All",
                       font=("Segoe UI", 12, "bold"),
                       bg="#1f6feb", fg="white", height=2)
    dl_btn.pack(side="left", fill="x", expand=True)
    stop_btn = tk.Button(btn_row, text="■ Stop", state="disabled")
    stop_btn.pack(side="left", padx=(8, 0))

    log_box = scrolledtext.ScrolledText(root, font=("Consolas", 9), height=16)
    log_box.pack(fill="both", expand=True, **pad)
    log_box.configure(state="disabled")

    def log(msg=""):
        def _append():
            log_box.configure(state="normal")
            log_box.insert("end", str(msg) + "\n")
            log_box.see("end")
            log_box.configure(state="disabled")
        root.after(0, _append)

    def worker(urls, out_root):
        try:
            run_bulk(urls, out_root, log=log, stop_flag=lambda: stop["flag"])
        except Exception as e:
            log(f"\n❌ Error: {e}")
        finally:
            root.after(0, done)

    def done():
        dl_btn.configure(state="normal")
        stop_btn.configure(state="disabled")

    def start():
        urls = parse_links(url_box.get("1.0", "end"))
        if not urls:
            log("Pehle upar case ka link/links paste karein (har line par ek).")
            return
        stop["flag"] = False
        dl_btn.configure(state="disabled")
        stop_btn.configure(state="normal")
        log_box.configure(state="normal")
        log_box.delete("1.0", "end")
        log_box.configure(state="disabled")
        threading.Thread(target=worker, args=(urls, Path(out_var.get())),
                         daemon=True).start()

    def do_stop():
        stop["flag"] = True
        log("Rok raha hoon… (chalti video poori hone do)")

    dl_btn.configure(command=start)
    stop_btn.configure(command=do_stop)

    log("Case ke link(s) upar paste karein (har line par EK), phir 'Download All'.")
    log("Har case ki videos, uske apne folder me, tarteeb se save hongi.\n")
    root.mainloop()


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="COPA Chicago case(s) ki saari videos download karo."
    )
    parser.add_argument("urls", nargs="*", help="Ek ya kai case/Vimeo links")
    parser.add_argument("-o", "--out", default=str(default_out_dir()),
                        help="Kahan save karna hai (folder)")
    parser.add_argument("--from-file", help="Links wali text file (har line par ek)")
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

    # koi link nahi, ya --gui -> window kholo
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
