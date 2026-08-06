@echo off
REM ==========================================================
REM  Build AlTariq Photoroom Pro  ->  dist\AlTariqPhotoroomPro.exe
REM  Run this on a Windows PC that has Python 3.11 installed.
REM ==========================================================
setlocal
cd /d "%~dp0"

echo [1/4] Installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller==6.11.1

echo [2/4] Downloading offline AI model (one time)...
if not exist models mkdir models
set "U2NET_HOME=%CD%\models"
python -c "from rembg import new_session; new_session('isnet-general-use')"

echo [3/4] Building the EXE (this takes a few minutes)...
pyinstaller --noconfirm --clean altariq_photoroom_pro.spec

echo [4/4] Done!
echo.
echo   EXE ready:  %CD%\dist\AlTariqPhotoroomPro.exe
echo.
pause
