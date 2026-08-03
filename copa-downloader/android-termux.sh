#!/data/data/com.termux/files/usr/bin/bash
# Android (Termux) ke liye — pehli dafa setup + har dafa download
# Chalane ka tareeqa (Termux me):
#     bash android-termux.sh
# Ya seedha:  bash android-termux.sh "<case-ka-link>"

set -e
cd "$(dirname "$0")"

echo "== COPA Downloader (Android/Termux) =="

# Zaroori packages (pehli dafa install honge, phir skip)
pkg update -y >/dev/null 2>&1 || true
pkg install -y python ffmpeg >/dev/null 2>&1 || true
pip install --upgrade yt-dlp >/dev/null 2>&1 || pip install yt-dlp

# Videos phone ke Download folder me aayein (shared storage)
OUT="$HOME/storage/shared/Download/COPA"
if [ ! -d "$HOME/storage" ]; then
  echo "Storage permission maang raha hoon (ek dafa 'Allow' dabayein)..."
  termux-setup-storage || true
  sleep 2
fi

if [ -n "$1" ]; then
  python copa_downloader.py "$1" -o "$OUT"
else
  echo
  read -r -p "Case ka link paste karein: " URL
  python copa_downloader.py "$URL" -o "$OUT"
fi
