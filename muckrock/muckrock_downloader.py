#!/usr/bin/env python3
"""
MuckRock Case Downloader
Downloads every video file and document file attached to MuckRock FOIA
request pages, one folder per case, from pasted case links.

GUI:  python muckrock_downloader.py --gui
CLI:  python muckrock_downloader.py <url1> <url2> ... -o "D:\MuckRock"
      python muckrock_downloader.py --from-file links.txt -o "D:\MuckRock"
"""

import os
import re
import sys
import time
import queue
import threading
import argparse
import urllib.request
import urllib.error
from pathlib import Path
from urllib.parse import urlparse, unquote

try:
    from curl_cffi import requests as cffi_requests
    HAVE_CURL_CFFI = True
except Exception:
    HAVE_CURL_CFFI = False

# ----------------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------------

MUCKROCK_HOME = "https://www.muckrock.com/"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": MUCKROCK_HOME,
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
}

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".wmv", ".mkv", ".webm", ".m4v"}
DOC_EXTS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt", ".rtf",
            ".pptx", ".ppt", ".zip"}

FILE_HREF_RE = re.compile(
    r'href\s*=\s*["\']([^"\']+?\.(?:mp4|mov|avi|wmv|mkv|webm|m4v|pdf|docx|doc|xlsx|xls|csv|txt|rtf|pptx|ppt|zip))(?:\?[^"\']*)?["\']',
    re.IGNORECASE,
)

TITLE_RE_LIST = [
    re.compile(r'<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']+)["\']', re.IGNORECASE),
    re.compile(r'<title>([^<]+)</title>', re.IGNORECASE),
    re.compile(r'<h1[^>]*>([^<]+)</h1>', re.IGNORECASE),
]


def default_out_dir():
    return Path.home() / "Downloads" / "MuckRock"


# ----------------------------------------------------------------------------
# CONTROL (stop / pause / resume state machine, shared with GUI)
# ----------------------------------------------------------------------------

class Control:
    def __init__(self):
        self._stop = threading.Event()
        self._pause = threading.Event()
        self.on_stats = None

    def stop(self):
        self._stop.set()
        self._pause.clear()

    def pause(self):
        self._pause.set()

    def resume(self):
        self._pause.clear()

    def is_stopped(self):
        return self._stop.is_set()

    def wait_if_paused(self):
        while self._pause.is_set() and not self._stop.is_set():
            time.sleep(0.2)

    def reset(self):
        self._stop.clear()
        self._pause.clear()

    def stats(self, **kw):
        if self.on_stats:
            try:
                self.on_stats(kw)
            except Exception:
                pass


# ----------------------------------------------------------------------------
# HELPERS
# ----------------------------------------------------------------------------

def sanitize(name, max_len=120):
    name = (name or "").strip()
    name = re.sub(r'[\\/:*?"<>|]', "_", name)
    name = re.sub(r'\s+', ' ', name).strip()
    if not name:
        name = "case"
    if len(name) > max_len:
        name = name[:max_len].rstrip()
    return name


def parse_links(text):
    raw = re.split(r'[\n,]+', text or "")
    urls = []
    for line in raw:
        line = line.strip()
        if line and "http" in line:
            urls.append(line)
    return urls


def fetch_html(url, timeout=30):
    if HAVE_CURL_CFFI:
        resp = cffi_requests.get(url, headers=BROWSER_HEADERS, timeout=timeout,
                                  impersonate="chrome124")
        resp.raise_for_status()
        return resp.text
    req = urllib.request.Request(url, headers=BROWSER_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        charset = resp.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def extract_case_title(page_html):
    for pat in TITLE_RE_LIST:
        m = pat.search(page_html)
        if m:
            title = m.group(1).strip()
            title = re.split(r'\s*[\u2022•|\-–]\s*MuckRock\b', title, flags=re.IGNORECASE)[0].strip()
            title = re.split(r'\s*\|\s*', title)[0].strip()
            if title:
                return title
    return "MuckRock Case"


def extract_files(page_html, base_url):
    found = []
    seen = set()
    for m in FILE_HREF_RE.finditer(page_html):
        href = m.group(1)
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            parsed = urlparse(base_url)
            href = f"{parsed.scheme}://{parsed.netloc}{href}"
        elif not href.startswith("http"):
            continue
        if href in seen:
            continue
        seen.add(href)
        ext = Path(urlparse(href).path).suffix.lower()
        if ext in VIDEO_EXTS:
            kind = "video"
        elif ext in DOC_EXTS:
            kind = "document"
        else:
            continue
        found.append((href, kind))
    return found


def collect_case(url, log=None):
    if log:
        log(f"Case page khol rahe hain: {url}")
    html = fetch_html(url)
    title = extract_case_title(html)
    files = extract_files(html, url)
    videos = [f for f in files if f[1] == "video"]
    docs = [f for f in files if f[1] == "document"]
    if log:
        log(f"  Title: {title}")
        log(f"  Mile: {len(videos)} video file(s), {len(docs)} document file(s)")
    return title, videos, docs


# ----------------------------------------------------------------------------
# DOWNLOAD
# ----------------------------------------------------------------------------

def _human(n):
    if n is None:
        return "?"
    n = float(n)
    for unit in ["B", "KB", "MB", "GB"]:
        if n < 1024:
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def _unique_path(folder, filename):
    p = folder / filename
    if not p.exists():
        return p
    stem, ext = p.stem, p.suffix
    i = 2
    while True:
        cand = folder / f"{stem} ({i}){ext}"
        if not cand.exists():
            return cand
        i += 1


def download_file(url, folder, index, kind, log, control):
    if control.is_stopped():
        return False
    control.wait_if_paused()

    raw_name = unquote(Path(urlparse(url).path).name) or f"file_{index}"
    raw_name = sanitize(raw_name, max_len=150)
    filename = f"{index:02d} - {raw_name}"
    dest = _unique_path(folder, filename)
    tmp_path = dest.with_suffix(dest.suffix + ".part")

    downloaded = 0
    start = time.time()
    last_report = [start]

    def _report(total):
        now = time.time()
        if now - last_report[0] > 0.3:
            elapsed = max(now - start, 0.001)
            speed = downloaded / elapsed
            frac = (downloaded / total) if total else None
            eta = ((total - downloaded) / speed) if (total and speed > 0) else None
            control.stats(file=dest.name, kind=kind, frac=frac,
                          downloaded=downloaded, total=total, speed=speed, eta=eta)
            last_report[0] = now

    try:
        if HAVE_CURL_CFFI:
            resp = cffi_requests.get(url, headers=BROWSER_HEADERS, timeout=60,
                                      impersonate="chrome124", stream=True)
            resp.raise_for_status()
            total = resp.headers.get("Content-Length")
            total = int(total) if total and str(total).isdigit() else None
            with open(tmp_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=1024 * 256):
                    if not chunk:
                        continue
                    if control.is_stopped():
                        f.close()
                        try:
                            tmp_path.unlink(missing_ok=True)
                        except Exception:
                            pass
                        return False
                    control.wait_if_paused()
                    f.write(chunk)
                    downloaded += len(chunk)
                    _report(total)
        else:
            req = urllib.request.Request(url, headers=BROWSER_HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                total = resp.headers.get("Content-Length")
                total = int(total) if total and total.isdigit() else None
                with open(tmp_path, "wb") as f:
                    while True:
                        if control.is_stopped():
                            f.close()
                            try:
                                tmp_path.unlink(missing_ok=True)
                            except Exception:
                                pass
                            return False
                        control.wait_if_paused()
                        chunk = resp.read(1024 * 256)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        _report(total)

        tmp_path.rename(dest)
        if log:
            log(f"  OK: {dest.name} ({_human(downloaded)})")
        return True
    except urllib.error.HTTPError as e:
        if log:
            log(f"  X {kind} download fail ({filename}): HTTP Error {e.code}: {e.reason}")
        return False
    except Exception as e:
        if log:
            log(f"  X {kind} download fail ({filename}): {e}")
        return False


# ----------------------------------------------------------------------------
# PER-CASE / BULK ORCHESTRATION
# ----------------------------------------------------------------------------

def download_case(url, out_root, log, control, case_label=""):
    try:
        title, videos, docs = collect_case(url, log=log)
    except Exception as e:
        if log:
            log(f"X Is case me error (page load): {e}")
        return False, 0, 0

    folder_name = sanitize(title) if title else sanitize(urlparse(url).path.strip("/").split("/")[-1])
    folder = Path(out_root) / folder_name
    folder.mkdir(parents=True, exist_ok=True)

    ok_count = 0
    total = len(videos) + len(docs)

    if total == 0:
        if log:
            log("  (Koi video ya document file nahi mili is case pe)")
        return True, 0, 0

    idx = 1
    for href, kind in videos + docs:
        if control.is_stopped():
            break
        control.wait_if_paused()
        control.stats(case=case_label or title, current_file=idx, total_files=total)
        ok = download_file(href, folder, idx, kind, log, control)
        if ok:
            ok_count += 1
        idx += 1

    return True, ok_count, total


def run_bulk(urls, out_root, log, control):
    control.reset()
    out_root = Path(out_root)
    out_root.mkdir(parents=True, exist_ok=True)

    grand_ok = 0
    grand_total = 0
    case_results = []

    for i, url in enumerate(urls, start=1):
        if control.is_stopped():
            log(f"\nRoka gaya (stopped) case {i}/{len(urls)} se pehle.")
            break
        label = f"Case {i}/{len(urls)}"
        log(f"\n[{label}] {url}")
        ok, done, total = download_case(url, out_root, log, control, case_label=label)
        case_results.append((url, done, total))
        grand_ok += done
        grand_total += total

    log("\n================ MUKAMMAL ================")
    log(f"Total cases process hue: {len(case_results)}/{len(urls)}")
    log(f"Total files download hui: {grand_ok}/{grand_total}")
    log(f"Save location: {out_root}")
    log("============================================")
    control.stats(done=True)
    return case_results


# ----------------------------------------------------------------------------
# GUI
# ----------------------------------------------------------------------------

import tkinter as tk
from tkinter import filedialog, scrolledtext

C_PRIMARY = "#8C1F28"
C_PRIMARY_DARK = "#5E1219"
C_ACCENT = "#F2B705"
C_BG = "#F5F5F3"
C_CARD = "#FFFFFF"
C_TEXT = "#222222"
C_MUTED = "#6B6B6B"
C_LOG_BG = "#1B1B1B"
C_LOG_TEXT = "#D8D8D8"


class RoundButton(tk.Canvas):
    def __init__(self, master, text, command=None, bg=C_PRIMARY, fg="white",
                 width=160, height=40, radius=10, font=("Segoe UI", 10, "bold"),
                 disabled_bg="#B7B7B7", **kw):
        super().__init__(master, width=width, height=height, bg=master["bg"],
                          highlightthickness=0, **kw)
        self.command = command
        self.bg = bg
        self.disabled_bg = disabled_bg
        self.fg = fg
        self.font = font
        self.text = text
        self.radius = radius
        self.width = width
        self.height = height
        self.enabled = True
        self._draw(bg)
        self.bind("<Button-1>", self._on_click)
        self.bind("<Enter>", lambda e: self._draw(C_PRIMARY_DARK) if self.enabled else None)
        self.bind("<Leave>", lambda e: self._draw(self.bg) if self.enabled else None)

    def _draw(self, color):
        self.delete("all")
        r = self.radius
        w, h = self.width, self.height
        fill = color if self.enabled else self.disabled_bg
        self._round_rect(1, 1, w - 1, h - 1, r, fill=fill, outline=fill)
        self.create_text(w / 2, h / 2, text=self.text, fill=self.fg, font=self.font)

    def _round_rect(self, x1, y1, x2, y2, r, **kw):
        points = [
            x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r, x2, y2 - r, x2, y2,
            x2 - r, y2, x1 + r, y2, x1, y2, x1, y2 - r, x1, y1 + r, x1, y1,
        ]
        return self.create_polygon(points, smooth=True, **kw)

    def _on_click(self, e):
        if self.enabled and self.command:
            self.command()

    def set_enabled(self, enabled):
        self.enabled = enabled
        self._draw(self.bg if enabled else self.disabled_bg)

    def set_text(self, text):
        self.text = text
        self._draw(self.bg if self.enabled else self.disabled_bg)


class GradientHeader(tk.Canvas):
    def __init__(self, master, title, subtitle, width=800, height=90, **kw):
        super().__init__(master, width=width, height=height, highlightthickness=0, **kw)
        self.width = width
        self.height = height
        self._draw_gradient(C_PRIMARY, C_PRIMARY_DARK)
        self.create_text(24, 30, anchor="w", text=title,
                          font=("Segoe UI", 18, "bold"), fill="white")
        self.create_text(24, 60, anchor="w", text=subtitle,
                          font=("Segoe UI", 10), fill="#F0DADC")

    def _draw_gradient(self, c1, c2):
        steps = self.width
        r1, g1, b1 = self.winfo_rgb(c1)
        r2, g2, b2 = self.winfo_rgb(c2)
        for i in range(steps):
            nr = int(r1 + (r2 - r1) * i / steps) >> 8
            ng = int(g1 + (g2 - g1) * i / steps) >> 8
            nb = int(b1 + (b2 - b1) * i / steps) >> 8
            self.create_line(i, 0, i, self.height, fill=f"#{nr:02x}{ng:02x}{nb:02x}")


class App:
    def __init__(self, root):
        self.root = root
        self.control = Control()
        self.control.on_stats = self._queue_stats
        self.q = queue.Queue()
        self.worker = None

        root.title("MuckRock Case Downloader")
        root.configure(bg=C_BG)
        root.geometry("820x740")
        root.minsize(780, 680)

        header = GradientHeader(root, "MuckRock Case Downloader",
                                 "FOIA requests -> Videos + document files, ek case ka ek folder",
                                 width=820, height=90)
        header.pack(fill="x")

        body = tk.Frame(root, bg=C_BG)
        body.pack(fill="both", expand=True, padx=16, pady=12)

        tk.Label(body, text="MuckRock case links (ek line mein ek link):",
                 bg=C_BG, fg=C_TEXT, font=("Segoe UI", 10, "bold")).pack(anchor="w")

        self.txt_links = scrolledtext.ScrolledText(body, height=8, font=("Consolas", 10), wrap="word")
        self.txt_links.pack(fill="x", pady=(4, 8))

        btn_row = tk.Frame(body, bg=C_BG)
        btn_row.pack(fill="x", pady=(0, 10))
        RoundButton(btn_row, "Load Links.txt", command=self.load_links_file,
                    bg="#555555", width=150, height=34).pack(side="left", padx=(0, 8))
        RoundButton(btn_row, "Clear", command=lambda: self.txt_links.delete("1.0", "end"),
                    bg="#555555", width=100, height=34).pack(side="left")

        folder_row = tk.Frame(body, bg=C_BG)
        folder_row.pack(fill="x", pady=(0, 10))
        tk.Label(folder_row, text="Save folder:", bg=C_BG, fg=C_TEXT,
                 font=("Segoe UI", 10, "bold")).pack(side="left")
        self.out_dir_var = tk.StringVar(value=str(default_out_dir()))
        tk.Entry(folder_row, textvariable=self.out_dir_var, font=("Segoe UI", 9)).pack(
            side="left", fill="x", expand=True, padx=8)
        RoundButton(folder_row, "Browse", command=self.browse_folder,
                    bg="#555555", width=100, height=30).pack(side="left")

        ctrl_row = tk.Frame(body, bg=C_BG)
        ctrl_row.pack(fill="x", pady=(4, 10))
        self.btn_start = RoundButton(ctrl_row, "Download All", command=self.start_download,
                                      bg=C_PRIMARY, width=150, height=40)
        self.btn_start.pack(side="left", padx=(0, 8))
        self.btn_pause = RoundButton(ctrl_row, "Pause", command=self.pause_download,
                                      bg="#B7860B", width=110, height=40)
        self.btn_pause.pack(side="left", padx=(0, 8))
        self.btn_resume = RoundButton(ctrl_row, "Resume", command=self.resume_download,
                                       bg="#2E7D32", width=110, height=40)
        self.btn_resume.pack(side="left", padx=(0, 8))
        self.btn_stop = RoundButton(ctrl_row, "Stop", command=self.stop_download,
                                     bg="#8C1F28", width=110, height=40)
        self.btn_stop.pack(side="left")
        self.btn_pause.set_enabled(False)
        self.btn_resume.set_enabled(False)
        self.btn_stop.set_enabled(False)

        dash = tk.Frame(body, bg=C_CARD, highlightbackground="#DDDDDD", highlightthickness=1)
        dash.pack(fill="x", pady=(0, 10))
        self.lbl_current = tk.Label(dash, text="Ready.", bg=C_CARD, fg=C_TEXT,
                                     font=("Segoe UI", 10, "bold"), anchor="w")
        self.lbl_current.pack(fill="x", padx=10, pady=(8, 2))

        self.pbar_canvas = tk.Canvas(dash, height=16, bg="#E8E8E8", highlightthickness=0)
        self.pbar_canvas.pack(fill="x", padx=10, pady=(0, 6))
        self.pbar_fill = self.pbar_canvas.create_rectangle(0, 0, 0, 16, fill=C_ACCENT, width=0)

        self.lbl_stats = tk.Label(dash, text="", bg=C_CARD, fg=C_MUTED,
                                   font=("Segoe UI", 9), anchor="w")
        self.lbl_stats.pack(fill="x", padx=10, pady=(0, 8))

        tk.Label(body, text="LIVE log:", bg=C_BG, fg=C_TEXT,
                 font=("Segoe UI", 10, "bold")).pack(anchor="w")
        self.log_box = scrolledtext.ScrolledText(body, height=14, bg=C_LOG_BG, fg=C_LOG_TEXT,
                                                   insertbackground=C_LOG_TEXT, font=("Consolas", 9))
        self.log_box.pack(fill="both", expand=True, pady=(4, 0))
        self.log_box.configure(state="disabled")

        if not HAVE_CURL_CFFI:
            self.log("Note: curl_cffi installed nahi hai — agar MuckRock 403 error de tou "
                      "Run_MuckRock_Downloader.bat dobara chalayein (ye khud install karega).")

        self.root.after(150, self._poll_queue)

    def log(self, msg):
        self.q.put(("log", msg))

    def _queue_stats(self, kw):
        self.q.put(("stats", kw))

    def _poll_queue(self):
        try:
            while True:
                kind, payload = self.q.get_nowait()
                if kind == "log":
                    self.log_box.configure(state="normal")
                    self.log_box.insert("end", payload + "\n")
                    self.log_box.see("end")
                    self.log_box.configure(state="disabled")
                elif kind == "stats":
                    self._apply_stats(payload)
        except queue.Empty:
            pass
        self.root.after(150, self._poll_queue)

    def _apply_stats(self, kw):
        if kw.get("done"):
            self.lbl_current.configure(text="Mukammal ho gaya (Done).")
            self._set_progress(0)
            self.lbl_stats.configure(text="")
            self._set_running(False)
            return
        if "case" in kw:
            self.lbl_current.configure(
                text=f"{kw['case']}  -  file {kw.get('current_file', '?')}/{kw.get('total_files', '?')}")
        if "frac" in kw:
            frac = kw.get("frac")
            self._set_progress(frac or 0)
            speed = kw.get("speed")
            eta = kw.get("eta")
            downloaded = kw.get("downloaded")
            total = kw.get("total")
            parts = []
            if downloaded is not None:
                parts.append(_human(downloaded) + (f" / {_human(total)}" if total else ""))
            if speed:
                parts.append(f"{_human(speed)}/s")
            if eta:
                parts.append(f"ETA {int(eta)}s")
            self.lbl_stats.configure(text="   ".join(parts))

    def _set_progress(self, frac):
        w = self.pbar_canvas.winfo_width() or 700
        self.pbar_canvas.coords(self.pbar_fill, 0, 0, w * max(0, min(1, frac)), 16)

    def _set_running(self, running):
        self.btn_start.set_enabled(not running)
        self.btn_pause.set_enabled(running)
        self.btn_resume.set_enabled(False)
        self.btn_stop.set_enabled(running)

    def load_links_file(self):
        path = filedialog.askopenfilename(filetypes=[("Text files", "*.txt"), ("All files", "*.*")])
        if not path:
            return
        try:
            content = Path(path).read_text(encoding="utf-8", errors="replace")
            existing = self.txt_links.get("1.0", "end").strip()
            self.txt_links.insert("end", ("\n" if existing else "") + content)
        except Exception as e:
            self.log(f"Links.txt load nahi ho saki: {e}")

    def browse_folder(self):
        path = filedialog.askdirectory()
        if path:
            self.out_dir_var.set(path)

    def start_download(self):
        urls = parse_links(self.txt_links.get("1.0", "end"))
        if not urls:
            self.log("Pehle case links paste karein ya Links.txt load karein.")
            return
        out_dir = self.out_dir_var.get().strip() or str(default_out_dir())
        self.log_box.configure(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.configure(state="disabled")
        self.log(f"{len(urls)} case link(s) mile. Save folder: {out_dir}")
        self._set_running(True)
        self.worker = threading.Thread(target=run_bulk, args=(urls, out_dir, self.log, self.control),
                                        daemon=True)
        self.worker.start()

    def pause_download(self):
        self.control.pause()
        self.btn_pause.set_enabled(False)
        self.btn_resume.set_enabled(True)
        self.log("Pause kar diya gaya.")

    def resume_download(self):
        self.control.resume()
        self.btn_pause.set_enabled(True)
        self.btn_resume.set_enabled(False)
        self.log("Resume kar diya gaya.")

    def stop_download(self):
        self.control.stop()
        self.log("Stop kiya ja raha hai...")
        self._set_running(False)


def launch_gui():
    root = tk.Tk()
    App(root)
    root.mainloop()


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def _cli_log(msg):
    print(msg)


def main():
    parser = argparse.ArgumentParser(description="MuckRock case video + document downloader")
    parser.add_argument("urls", nargs="*", help="MuckRock case URLs")
    parser.add_argument("-o", "--out", default=str(default_out_dir()), help="Output folder")
    parser.add_argument("--from-file", help="Text file with one URL per line")
    parser.add_argument("--gui", action="store_true", help="Launch GUI")
    args = parser.parse_args()

    if args.gui or (not args.urls and not args.from_file):
        launch_gui()
        return

    urls = list(args.urls)
    if args.from_file:
        content = Path(args.from_file).read_text(encoding="utf-8", errors="replace")
        urls.extend(parse_links(content))

    if not urls:
        print("Koi URL nahi diya gaya. --gui use karein ya URLs pass karein.")
        return

    control = Control()
    run_bulk(urls, args.out, _cli_log, control)


if __name__ == "__main__":
    main()
