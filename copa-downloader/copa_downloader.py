#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COPA Chicago — Case Video Downloader
====================================

Ek case ka link do -> us case ki SAARI videos (BWC 1, BWC 2, ...) ek hi
folder me, ek-ek kar ke, download ho jaati hain.

- Windows / Mac / Linux par: chalao to ek chhoti window (GUI) khulti hai.
    link paste karo -> "Download All" dabao.
- Android (Termux) / bina window ke: command line se
    python copa_downloader.py "<case-ka-link>"

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
    direct = extract_vimeo_videos(url)
    if direct and ("vimeo.com" in url) and ("chicagocopa" not in url):
        return "COPA Video", direct

    log(f"Page khol raha hoon: {url}")
    page = fetch_html(url)
    videos = extract_vimeo_videos(page)
    title = extract_case_title(page)
    log(f"Case: {title}")
    log(f"Mili videos: {len(videos)}")
    return title, videos


# --------------------------------------------------------------------------
# yt-dlp helpers
# --------------------------------------------------------------------------

def ytdlp_base_cmd():
    """yt-dlp ko chalane ka tareeqa dhoondo (PATH ya python -m yt_dlp)."""
    exe = shutil.which("yt-dlp")
    if exe:
        return [exe]
    return [sys.executable, "-m", "yt_dlp"]


def ytdlp_installed() -> bool:
    try:
        subprocess.run(
            ytdlp_base_cmd() + ["--version"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


def ensure_ytdlp(log=print) -> bool:
    if ytdlp_installed():
        return True
    log("yt-dlp install ho raha hai (pip)...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"],
            check=True,
        )
        return ytdlp_installed()
    except Exception as e:
        log(f"yt-dlp install nahi ho saka: {e}")
        return False


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def download_one(video, index, folder: Path, log=print, stop_flag=None) -> bool:
    """Ek video download karo folder me. Return True agar kaamyab."""
    out_tmpl = str(folder / f"{index:02d} - %(title)s.%(ext)s")
    cmd = ytdlp_base_cmd() + [
        "--no-playlist",
        "--referer", COPA_HOME,          # COPA embeds ke liye zaroori ho sakta hai
        "--no-mtime",
        "--newline",
        "--progress",
        "-o", out_tmpl,
    ]
    # ffmpeg ho to best quality (video+audio merge); warna single-file best
    if has_ffmpeg():
        cmd += ["-f", "bestvideo*+bestaudio/best", "--merge-output-format", "mp4"]
    else:
        cmd += ["-f", "best[ext=mp4]/best"]
    cmd.append(video["url"])

    log(f"\n▶ [{index}] {video['url']}")
    try:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1,
        )
        for line in proc.stdout:
            if stop_flag is not None and stop_flag():
                proc.terminate()
                log("Roka gaya.")
                return False
            line = line.rstrip()
            if line:
                log(line)
        proc.wait()
        ok = proc.returncode == 0
        log("✔ ho gayi" if ok else f"✘ fail (code {proc.returncode})")
        return ok
    except Exception as e:
        log(f"✘ error: {e}")
        return False


def run_download(url: str, out_root: Path, log=print, stop_flag=None):
    """Poora flow: case kholo -> folder banao -> saari videos download karo."""
    if not ensure_ytdlp(log):
        log("\n❌ yt-dlp nahi mila. Pehle install karein: pip install yt-dlp")
        return

    title, videos = collect_case(url, log=log)
    if not videos:
        log(
            "\n⚠ Is page par koi Vimeo video nahi mili.\n"
            "   - Link sahi case-page ka hai? (jis par video tiles dikhti hain)\n"
            "   - Ya seedha us video ka Vimeo link (vimeo.com/....) paste karke dekhein.\n"
            "   - Agar phir bhi na mile to mujhe bata dein, main tool update kar dunga."
        )
        return

    folder = out_root / sanitize(title)
    folder.mkdir(parents=True, exist_ok=True)
    log(f"\n📁 Folder: {folder}")
    log(f"Kul {len(videos)} videos download hongi...\n")

    ok = 0
    for i, v in enumerate(videos, start=1):
        if stop_flag is not None and stop_flag():
            log("Roka gaya.")
            break
        if download_one(v, i, folder, log=log, stop_flag=stop_flag):
            ok += 1

    log(f"\n===============================")
    log(f"✅ {ok}/{len(videos)} videos download ho gayin.")
    log(f"📁 {folder}")
    log(f"===============================")
    return folder


# --------------------------------------------------------------------------
# GUI (window) — Windows/Mac/Linux
# --------------------------------------------------------------------------

def default_out_dir() -> Path:
    d = Path.home() / "Downloads" / "COPA"
    return d


def launch_gui():
    import threading
    import tkinter as tk
    from tkinter import ttk, filedialog, scrolledtext

    stop = {"flag": False}

    root = tk.Tk()
    root.title("COPA Video Downloader")
    root.geometry("720x520")
    root.minsize(600, 420)

    pad = {"padx": 10, "pady": 6}

    top = tk.Frame(root)
    top.pack(fill="x", **pad)

    tk.Label(top, text="Case ka link (chicagocopa.org):",
             font=("Segoe UI", 10, "bold")).pack(anchor="w")
    url_var = tk.StringVar()
    url_entry = tk.Entry(top, textvariable=url_var, font=("Segoe UI", 11))
    url_entry.pack(fill="x", pady=(2, 6))
    url_entry.focus()

    row = tk.Frame(top)
    row.pack(fill="x")
    tk.Label(row, text="Save folder:").pack(side="left")
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

    def worker():
        try:
            run_download(url_var.get(), Path(out_var.get()),
                         log=log, stop_flag=lambda: stop["flag"])
        except Exception as e:
            log(f"\n❌ Error: {e}")
        finally:
            root.after(0, done)

    def done():
        dl_btn.configure(state="normal")
        stop_btn.configure(state="disabled")

    def start():
        if not url_var.get().strip():
            log("Pehle case ka link paste karein.")
            return
        stop["flag"] = False
        dl_btn.configure(state="disabled")
        stop_btn.configure(state="normal")
        log_box.configure(state="normal")
        log_box.delete("1.0", "end")
        log_box.configure(state="disabled")
        threading.Thread(target=worker, daemon=True).start()

    def do_stop():
        stop["flag"] = True
        log("Rok raha hoon… (chalti download poori hone do)")

    dl_btn.configure(command=start)
    stop_btn.configure(command=do_stop)
    url_entry.bind("<Return>", lambda e: start())

    log("Case ka link upar paste karein aur 'Download All' dabayein.")
    log("Videos aap ke computer ke folder me, case ke naam se, save hongi.\n")
    root.mainloop()


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="COPA Chicago case ki saari videos download karo."
    )
    parser.add_argument("url", nargs="?", help="Case ya Vimeo ka link")
    parser.add_argument("-o", "--out", default=str(default_out_dir()),
                        help="Kahan save karna hai (folder)")
    parser.add_argument("--gui", action="store_true", help="Window (GUI) kholo")
    args = parser.parse_args()

    # koi link nahi diya, ya --gui -> window kholo
    if args.gui or not args.url:
        try:
            launch_gui()
        except Exception as e:
            print(f"GUI nahi khul saka ({e}).")
            print("Command line se chalayein: python copa_downloader.py \"<link>\"")
        return

    run_download(args.url, Path(args.out), log=print)


if __name__ == "__main__":
    main()
