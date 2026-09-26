# Muse Desktop

A comprehensive toolkit, launcher, and community fix suite for Muse Desktop on macOS, Windows, and Linux.

---

## ⚡ Releases & Downloads

| Edition | Version | Format | Description |
| :--- | :--- | :--- | :--- |
| **Muse Native App (Community Patch)** | **v4.1.1** | [Download .DMG](release/Muse-4.1.1.dmg) | Production macOS build with native TrueType typography & full entitlements |
| **Muse Standalone PWA Launcher** | **v1.1** | [Download .ZIP](release/Muse-Mac-App.zip) | Lightweight client with persistent Activity Inspector & Google/Email OAuth |

---

## 🌟 New Feature: Beacon Activity Inspector Toggle

In the official desktop client, Beacon's **Right-Hand Activity Inspector** (Tasks, Security, Timeline, and Identity) is collapsed by default and easily missed:
* **The Problem:** The right activity drawer (showing live tool executions like *"Load Tool Namespace"*, memory, and permissions) could only be toggled by clicking the Beacon avatar pill at the top of the chat, with zero visual cue.
* **The Feature Add:**
  1. **Top-Right Toolbar Toggle:** Injected an explicit **`[Inspector]`** pill button next to `Invite` in the header bar.
  2. **Keyboard Shortcut:** Added standard macOS shortcut **`Cmd + Option + I`** to instantly open/close Beacon's inspector panel from anywhere in the app.
  3. Script and integration available in [`enhancements/inspector-toggle.js`](enhancements/inspector-toggle.js).

---

## 🛠️ Muse v4.1.1 Community Patch (Native macOS App)

The official 4.1 release (`com.meta.endo`) encountered a widespread rendering issue on macOS where all headings, text, and buttons rendered as missing glyphs (`[?]` tofu).

### 🔍 Root Cause Analysis:
1. **Font Packaging Mismatch:** `OptimisticAIVF.ttf` and `OptimisticMonoVF.ttf` in `Contents/Resources/Fonts/` were packaged as WOFF2 webfont streams under `.ttf` file extensions. macOS Apple Type Services (ATS) and CoreText fail to load WOFF2 headers via `ATSApplicationFontsPath`, causing font lookup failures and falling back to `.notdef` question mark boxes across all UI strings.
2. **Missing US English Localization:** The bundle contained `en-GB.lproj` and foreign locales, but omitted `en.lproj`, failing language pack lookups on standard US English configurations.

### 🚀 What's Fixed in v4.1.1:
- Converted and decompressed embedded typefaces to native SFNT TrueType (`0x00010000`) with full variable axes support.
- Restored `en.lproj` localization fallback.
- Preserved official OAuth capabilities and AppSSO authentication pipelines.
- Packaged as a clean, compressed disk image (`release/Muse-4.1.1.dmg`).
- Patch scripts and source build tooling are provided in [`v4.1.1-patch/`](v4.1.1-patch/).

---

## 🔬 Benchmark vs. Recent ChatGPT Desktop (`com.openai.codex`)

We analyzed the latest macOS ChatGPT desktop architecture (`/Applications/ChatGPT.app` v26.924) to align Muse Desktop with modern AI desktop design standards:

| Feature | ChatGPT Desktop | Official Muse 4.1 | Muse Desktop v4.1.1 (Ours) |
| :--- | :--- | :--- | :--- |
| **3-Column Architecture** | Chats (left), Conversation (center), Canvas/Inspector (right) | Sidebar collapsed by default | Left History drawer + Explicit Right Inspector toggle |
| **Inspector Accessibility** | Dedicated toolbar button | Hidden behind avatar pill | Persistent header button + `Cmd+Option+I` shortcut |
| **Font Rendering** | Native system SFNT | Broken WOFF2 container (`[?]` tofu) | **Fixed** native SFNT TrueType (`0x00010000`) |
| **Packaging** | Compressed UDZO DMG with drag-to-Applications | Standard DMG | High-compression UDZO DMG installer |

---

## 🚀 Quick Install (macOS)

### Option 1: Native App Installer (DMG)
Download [`release/Muse-4.1.1.dmg`](release/Muse-4.1.1.dmg), open it, and drag `Muse.app` to your Applications folder.

### Option 2: Run the Install Script
Run this single command in your terminal to build and place `Muse.app` directly on your Desktop:
```bash
bash install-mac.sh
```

---

## License
MIT
