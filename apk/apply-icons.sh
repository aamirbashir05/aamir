#!/usr/bin/env bash
# Custom launcher icon (gaon photo) — har density par legacy ic_launcher set karo
# aur adaptive (anydpi-v26) xml hata do taake yehi icon dikhe.
set -e
RES="apk/android/app/src/main/res"

put () {  # $1=density folder  $2=icon size
  cp "apk/icons/ic_$2.png" "$RES/mipmap-$1/ic_launcher.png"
  cp "apk/icons/ic_$2.png" "$RES/mipmap-$1/ic_launcher_round.png"
  if [ -f "$RES/mipmap-$1/ic_launcher_foreground.png" ]; then
    cp "apk/icons/ic_$2.png" "$RES/mipmap-$1/ic_launcher_foreground.png"
  fi
}

put mdpi 48
put hdpi 72
put xhdpi 96
put xxhdpi 144
put xxxhdpi 192

rm -f "$RES"/mipmap-anydpi-v26/ic_launcher.xml "$RES"/mipmap-anydpi-v26/ic_launcher_round.xml

echo "Custom icons applied."
