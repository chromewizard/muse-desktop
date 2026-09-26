# Muse Desktop

A comprehensive toolkit, launcher, and community fix suite for Muse Desktop on macOS, Windows, and Linux.

---

## ⚡ Releases & Downloads

| Edition | Version | Format | Description |
| :--- | :--- | :--- | :--- |
| **Muse Native App (Community Patch)** | **v4.1.1** | [Download .DMG](release/Muse-4.1.1.dmg) | Patched build fixing missing glyph tofu (`[?]` boxes) & font decoding |
| **Muse Lightweight App-Mode Launcher** | **v1.0** | [Download .ZIP](release/Muse-Mac-App.zip) | Standalone Chrome PWA launcher running isolated window sessions |

---

## 🛠️ Muse v4.1.1 Community Patch (Native macOS App)

The official 4.1 release (`com.meta.endo`) encountered a widespread rendering issue on macOS where all headings, text, and buttons rendered as missing glyphs (`[?]` tofu).

### 🔍 Root Cause Analysis:
1. **Font Packaging Mismatch:** `OptimisticAIVF.ttf` and `OptimisticMonoVF.ttf` in `Contents/Resources/Fonts/` were packaged as WOFF2 webfont streams under `.ttf` file extensions. macOS Apple Type Services (ATS) and CoreText fail to load WOFF2 headers via `ATSApplicationFontsPath`, causing font lookup failures and falling back to `.notdef` question mark boxes across all UI strings.
2. **Missing US English Localization:** The bundle contained `en-GB.lproj` and foreign locales, but omitted `en.lproj`, failing language pack lookups on standard US English configurations.

### 🚀 What's Fixed in v4.1.1:
- Converted and decompressed embedded typefaces to native SFNT TrueType (`0x00010000`) with full variable axes support.
- Restored `en.lproj` localization fallback.
- Re-signed and packaged into a clean, ready-to-run disk image: [`release/Muse-4.1.1.dmg`](release/Muse-4.1.1.dmg).
- Patch scripts and source build tooling are provided in [`v4.1.1-patch/`](v4.1.1-patch/).

---

## 🚀 Muse Lightweight Desktop Launcher

For a lightweight, zero-dependency alternative that runs without font issues or download stalls:

### Option 1: Run the Install Script
Run this single command in your terminal to compile and place `Muse.app` directly on your Desktop:
```bash
bash install-mac.sh
```

### Option 2: Pre-compiled App
Download [`release/Muse-Mac-App.zip`](release/Muse-Mac-App.zip), unzip it, and drag `Muse.app` to your Applications folder or Desktop.

### Option 3: Direct Web Shortcut
Double-click `Muse.webloc` to launch directly in your browser.

---

## 💡 Cross-Platform Usage (Launcher)

### macOS
```bash
open -na "Google Chrome" --args --app="https://muse.ai"
```

### Windows
```cmd
start chrome --app=https://muse.ai
```

### Linux
```bash
google-chrome --app=https://muse.ai
```

---

## License
MIT
