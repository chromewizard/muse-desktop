#!/usr/bin/env python3
"""
Muse v4.1.1 Community Patcher
Resolves the missing-glyph ('?' tofu) bug and font loading failure in Meta Muse 4.1 (com.meta.endo).

Root Cause:
In Meta Muse 4.1, the fonts in Contents/Resources/Fonts/ (OptimisticAIVF.ttf and OptimisticMonoVF.ttf)
were packaged as WOFF2 webfonts with .ttf file extensions.
macOS Apple Type Services (ATS) and CoreText fail to load WOFF2 binary containers through
ATSApplicationFontsPath, leading to complete glyph lookup failure and rendering all UI text
as '?' .notdef tofu boxes. Furthermore, en.lproj was omitted from the bundle.

Fix:
1. Decompresses the embedded WOFF2 font tables to standard SFNT TrueType (0x00010000).
2. Restores en.lproj localization mapping.
3. Bakes enhancements/inspector-toggle.js into the bundled web UI (Contents/Resources/hatch/index.html):
   Inspector open by default, On/Off state pill, Cmd+Option+I, and the Beacon twirl on close.
4. Ad-hoc signs the app bundle and builds a distribution DMG.
"""

import os
import sys
import shutil
import subprocess
import tempfile

import importlib.util

def _load_injector():
    """inject-enhancements.py lives next to this file (hyphenated name, so load it by path)."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "inject-enhancements.py")
    spec = importlib.util.spec_from_file_location("inject_enhancements", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def log(msg):
    print(f"[Muse-Patcher] {msg}")

def check_dependencies():
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        log("Installing required fonttools and brotli packages...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "fonttools", "brotli"])

def patch_app(app_path):
    from fontTools.ttLib import TTFont
    fonts_dir = os.path.join(app_path, "Contents", "Resources", "Fonts")
    if not os.path.exists(fonts_dir):
        log(f"Warning: Fonts directory not found at {fonts_dir}")
        return

    # 1. Convert WOFF2 fonts to native SFNT TrueType
    for font_filename in ["OptimisticAIVF.ttf", "OptimisticMonoVF.ttf"]:
        font_path = os.path.join(fonts_dir, font_filename)
        if os.path.exists(font_path):
            log(f"Converting {font_filename} from WOFF2 container to native SFNT TrueType...")
            os.chmod(font_path, 0o644)
            font = TTFont(font_path)
            if font.flavor == 'woff2':
                font.flavor = None
                font.save(font_path)
                log(f"✓ {font_filename} successfully converted to TrueType.")
            else:
                log(f"• {font_filename} is already native font format ({font.flavor}).")

    # 2. Ensure en.lproj exists
    res_dir = os.path.join(app_path, "Contents", "Resources")
    en_dir = os.path.join(res_dir, "en.lproj")
    en_gb_dir = os.path.join(res_dir, "en-GB.lproj")
    if not os.path.exists(en_dir) and os.path.exists(en_gb_dir):
        log("Restoring missing en.lproj localization bundle...")
        shutil.copytree(en_gb_dir, en_dir)
        log("✓ en.lproj created from en-GB.lproj.")

    # 3. Bake the community enhancements into the bundled web UI (no backup inside a DMG build)
    log("Injecting enhancements/inspector-toggle.js into Contents/Resources/hatch/index.html...")
    _load_injector().inject(app_path, backup=False)
    log("✓ Beacon Activity Inspector enhancements baked into the native UI.")

    # 4. Ad-hoc re-sign
    log("Re-signing app bundle with ad-hoc signature...")
    subprocess.check_call(["codesign", "--force", "--deep", "-s", "-", app_path])
    log("✓ Muse.app successfully re-signed.")

def create_dmg(app_path, output_dmg):
    log(f"Packaging {output_dmg}...")
    with tempfile.TemporaryDirectory() as staging:
        staged_app = os.path.join(staging, "Muse.app")
        shutil.copytree(app_path, staged_app, symlinks=True)
        os.symlink("/Applications", os.path.join(staging, "Applications"))
        
        if os.path.exists(output_dmg):
            os.remove(output_dmg)
            
        subprocess.check_call([
            "hdiutil", "create",
            "-volname", "Muse 4.1.1",
            "-srcfolder", staging,
            "-ov",
            "-format", "UDZO",
            output_dmg
        ])
    log(f"✓ Successfully built DMG: {output_dmg}")

def main():
    check_dependencies()
    
    if len(sys.argv) > 1 and sys.argv[1].endswith(".app"):
        app_path = sys.argv[1]
        out_dmg = sys.argv[2] if len(sys.argv) > 2 else "Muse-4.1.1.dmg"
        patch_app(app_path)
        create_dmg(app_path, out_dmg)
    else:
        log("Usage: python3 patch-dmg.py /path/to/Muse.app [output.dmg]")

if __name__ == "__main__":
    main()
