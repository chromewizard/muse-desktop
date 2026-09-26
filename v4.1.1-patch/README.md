# Muse v4.1.1 Community Patch & Technical Analysis

This directory contains the patch script, technical root cause analysis, and build tools for **Muse Desktop v4.1.1** (patching the official `com.meta.endo` v4.1 release).

---

## 🐛 Issues Identified in Muse v4.1

### 1. Missing-Glyph Tofu (`[?]` Boxes) Throughout Onboarding
- **Symptom:** On initial launch on macOS, all headings, labels, body text, and interactive buttons in the onboarding flow render as missing glyph boxes (`[?]` / `.notdef` tofu).
- **Root Cause:** In the application bundle at `Contents/Resources/Fonts/`, the embedded typefaces (`OptimisticAIVF.ttf` and `OptimisticMonoVF.ttf`) are **WOFF2 webfont streams** wrapped in `.ttf` file extensions. macOS Apple Type Services (ATS) and CoreText cannot parse WOFF2 binary table headers when registered via `ATSApplicationFontsPath`. The font registration fails to provide valid glyph tables, causing CoreText font lookups to fail and fall back to `.notdef` (question mark boxes).
- **Secondary Root Cause:** Missing default `en.lproj` localization bundle. The app shipped with `en-GB.lproj` and foreign locales, but lacked `en.lproj`, resulting in missing locale lookups on US English macOS installations.

### 2. Onboarding Window Navigation & Download Stalls
- **Symptom:** Download and progress handlers stall during initial onboarding connection.

---

## 🛠️ The Fix in v4.1.1

1. **Native SFNT TrueType Decompression:**
   Extracted and decompressed the WOFF2 font tables into full native SFNT TrueType fonts (`0x00010000`) with complete `cmap`, `glyf`, `loca`, and variable font axes (`fvar`, `gvar`). CoreText now recognizes and renders all glyphs natively with zero tofu.
2. **Localization Resolution:**
   Created a proper fallback for `en.lproj` so US English installations immediately locate `fbt_language_pack.bin` and localized strings.
3. **App Bundle Re-signature & Packaging:**
   Re-signed the patched bundle with an ad-hoc code signature and packaged it into a clean, distributable disk image (`Muse-4.1.1.dmg`).

---

## 📦 How to Install / Download

- **Pre-built DMG:** Download [`release/Muse-4.1.1.dmg`](../release/Muse-4.1.1.dmg) or grab it from GitHub Releases: [v4.1.1 Release](https://github.com/chromewizard/muse-desktop/releases/tag/v4.1.1).
- Mount the DMG and drag **Muse.app** to your `/Applications` folder.

---

## ⚙️ Building the Patch from Source

To patch an official `Muse-4.1.dmg` locally:

```bash
# Automated build
bash v4.1.1-patch/build-patch-dmg.sh ~/Downloads/Muse-4.1.dmg ./release/Muse-4.1.1.dmg
```
