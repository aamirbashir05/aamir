[app]

# Naam / package
title = COPA Downloader
package.name = copadownloader
package.domain = org.aamir

# Source (main.py + copa_downloader.py yahin aati hain build ke waqt)
source.dir = .
source.include_exts = py,png,jpg,txt

version = 1.0

# Zaroori python packages (curl_cffi nahi — Android par embed-player kaafi hai)
requirements = python3,kivy==2.3.0,yt-dlp,certifi,pyjnius,android

orientation = portrait
fullscreen = 0

# Android
android.permissions = INTERNET,WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE
android.api = 33
android.minapi = 24
android.archs = arm64-v8a
android.allow_backup = True

# Legacy storage (Download folder me likhne ke liye purane devices par)
android.manifest_placeholders = usesCleartextTraffic=true

# Icon (chahe to baad me apna laga sakte hain)
# icon.filename = %(source.dir)s/icon.png

[buildozer]
log_level = 2
warn_on_root = 0
