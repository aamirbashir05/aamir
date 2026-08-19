#!/usr/bin/env bash
# Build a signed Android WebView APK without the Google Android SDK / Gradle.
# Uses: aapt, javac (JDK), dx (repackaged), zipalign, apksigner + a standalone android.jar
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

ANDROID_JAR="${ANDROID_JAR:-/tmp/android.jar}"
DX_JAR="${DX_JAR:-/tmp/dx.jar}"
OUT="${OUT:-$HERE/out}"
KEYSTORE="${KEYSTORE:-$HERE/altariq.keystore}"
KS_PASS="${KS_PASS:-altariq123}"
KEY_ALIAS="${KEY_ALIAS:-altariq}"

rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/obj"

echo "==> [1/6] Generate R.java"
aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -I "$ANDROID_JAR"

echo "==> [2/6] Compile Java"
javac -encoding UTF-8 --release 8 -XDstringConcat=inline -nowarn \
  -classpath "$ANDROID_JAR" \
  -d "$OUT/obj" \
  $(find src "$OUT/gen" -name '*.java')

echo "==> [3/6] Dex (classes.dex)"
java -cp "$DX_JAR" com.android.dx.command.Main --dex \
  --output="$OUT/classes.dex" "$OUT/obj"

echo "==> [4/6] Package resources into APK"
aapt package -f -M AndroidManifest.xml -S res -I "$ANDROID_JAR" \
  -F "$OUT/app.unsigned.apk"

echo "==> [4b] Add classes.dex to APK"
( cd "$OUT" && aapt add app.unsigned.apk classes.dex >/dev/null )

echo "==> [5/6] zipalign"
zipalign -f -p 4 "$OUT/app.unsigned.apk" "$OUT/app.aligned.apk"

echo "==> [5b] Create keystore if missing"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=Al Tariq Printers, O=Al Tariq Printers, L=, ST=, C=PK"
fi

echo "==> [6/6] Sign APK (v1+v2+v3)"
apksigner sign --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" \
  --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$OUT/AlTariqPrinters.apk" "$OUT/app.aligned.apk"

echo "==> Verify signature"
apksigner verify --print-certs "$OUT/AlTariqPrinters.apk" | head -n 6

echo ""
echo "DONE: $OUT/AlTariqPrinters.apk"
ls -la "$OUT/AlTariqPrinters.apk"
