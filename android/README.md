# Al Tariq Printers — Native Android WebView App

A standalone **native WebView** Android app (NOT a TWA) that opens
`https://altariqprinters.store/app.html` fullscreen — no browser address bar,
no "Running in Chrome" banner.

## What it does
- Loads the site inside a native `WebView` (own engine, not Chrome Custom Tabs).
- JavaScript, DOM storage, cookies, zoom enabled.
- Hardware **Back** button navigates WebView history.
- `http/https` links stay in-app; `tel:`, `mailto:`, `whatsapp:`, `intent:` etc.
  open the matching external app.
- File uploads (`<input type=file>`) via the system picker.
- Downloads handled through Android `DownloadManager`.

## App details
| | |
|---|---|
| Package | `store.altariqprinters.app` |
| Label | Al Tariq Printers |
| minSdk / targetSdk | 21 (Android 5.0) / 34 (Android 14) |
| Signing | v1 + v2 + v3 schemes |

## Build (no Google SDK / Gradle required)
This project builds with just the OS tools — handy in locked-down CI where
`dl.google.com` is blocked.

Prerequisites (Debian/Ubuntu): `sudo apt-get install -y aapt apksigner zipalign default-jdk-headless`

Plus two standalone jars:
- `android.jar` (API 34 platform stub) → set `ANDROID_JAR=/path/android.jar`
- repackaged dx dexer → set `DX_JAR=/path/dx.jar`
  (`com.jakewharton.android.repackaged:dalvik-dx:14.0.0_r21` from Maven Central)

Then:
```bash
ANDROID_JAR=/path/android.jar DX_JAR=/path/dx.jar bash build.sh
# -> out/AlTariqPrinters.apk
```

## Signing key (IMPORTANT)
The APK is signed with a keystore that is **intentionally not committed**
(this repo is also published as a website, so a committed keystore would be
public). Keep the `altariq.keystore` file safe — Android requires the **same**
key to ship updates that install over an existing install. Losing it means
users must uninstall before updating.
