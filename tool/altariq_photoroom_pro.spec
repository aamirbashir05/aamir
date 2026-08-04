# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for AlTariq Photoroom Pro (single-file Windows exe).
from PyInstaller.utils.hooks import collect_all, copy_metadata

datas = [("ui", "ui"), ("models", "models")]
binaries = []
hiddenimports = ["pymatting", "scipy.ndimage", "scipy.special", "scipy.special.cython_special"]

# Grab package data + hidden imports for the AI stack.
for pkg in ("rembg", "onnxruntime", "pymatting"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# Some libraries read their own dist metadata at runtime.
for dist in ("rembg", "onnxruntime", "numpy", "pillow", "pymatting", "tqdm"):
    try:
        datas += copy_metadata(dist)
    except Exception:
        pass

a = Analysis(
    ["app.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "PyQt5", "PyQt6", "PySide2", "PySide6"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="AlTariqPhotoroomPro",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    icon="ui/icon.ico",
)
