@echo off
title COPA Video Downloader
cd /d "%~dp0"

echo ============================================
echo   COPA Chicago - Video Downloader
echo ============================================
echo.

rem --- Python dhoondo (py ya python) ---
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY ( where python >nul 2>nul && set "PY=python" )

if not defined PY (
  echo [!] Python nahi mila.
  echo     1^) https://www.python.org/downloads/ se Python install karein
  echo     2^) Install karte waqt "Add python.exe to PATH" par TICK zaroor lagayein
  echo     3^) Phir se yeh file (START-Windows.bat) chalayein
  echo.
  pause
  exit /b
)

echo yt-dlp taaza (update/install) kar raha hoon... thoda intezaar...
%PY% -m pip install --quiet --upgrade pip
%PY% -m pip install --quiet --upgrade yt-dlp curl_cffi

echo.
echo Window khul rahi hai...
%PY% "%~dp0copa_downloader.py"

echo.
pause
