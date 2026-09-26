# Muse Desktop — Version 4.1.1 (beta) by Divine Pharaoh

A comprehensive toolkit, launcher, and community fix suite for Muse Desktop on macOS, Windows, and Linux.

---

## ⚡ Releases & Downloads

| Edition | Version | Format | Description |
| :--- | :--- | :--- | :--- |
| **Muse Native App (Community Patch)** | **Version 4.1.1 (beta) by Divine Pharaoh** | [Download .DMG](release/Muse-4.1.1.dmg) | Production macOS build with native TrueType typography & full entitlements |
| **Muse Standalone PWA Launcher** | **v1.1** | [Download .ZIP](release/Muse-Mac-App.zip) | Lightweight client with persistent Activity Inspector & Google/Email OAuth |

---

## 🌟 New Feature: Beacon Activity Inspector — default-on, state pill, and the Beacon twirl

In the official desktop client, Beacon's **Right-Hand Activity Inspector** (Activity, Approvals, Upcoming, Identity) is collapsed by default and easily missed:
* **The Problem:** The right activity drawer (showing live tool executions like *"Load Tool Namespace"*, memory, and permissions) could only be toggled by clicking the Beacon avatar pill at the top of the chat, with zero visual cue — nothing tells you the little guy is a control, or whether the drawer is on or off.
* **The Feature Add** (`enhancements/inspector-toggle.js` v1.4.0):
  1. **Open by default.** The Inspector opens on launch, on the Activity tab, so tool calls are visible from the first message.
  2. **State pill in the header.** An **`Inspector ● On / ○ Off`** toggle sits next to `Invite`; the dot pops when the state changes, `aria-pressed` tracks it for VoiceOver, and **`Cmd + Option + I`** toggles it from anywhere.
  3. **The twirl.** When you close the drawer with the top-right **X**, Beacon springs back to the top-center of the chat and, the moment he lands, does a full 2.4 s turn: a little wind-up, all the way around with his stubby arms lifting through the back view and settling as he comes home, then a landing bounce that bobs his name tag. It's driven by twelve hand-drawn views of him (0°–330°, `enhancements/art/`), cross-dissolved as the angle sweeps, drawn over the avatar's own backdrop, so you see his real side profiles rather than a flat card flipping. It teaches, without a tooltip, that *he* is the handle that brings the drawer back. Hovering him lifts him slightly and shows a tooltip; `prefers-reduced-motion` gets a soft pulse instead. The move only runs for the stock Beacon avatar (built-in `/avatars/hatch*` media, or pixels that read as his fabric); a user-replaced avatar gets a plain hop.

The turnaround art was drawn by Ian's GPT assistant from the resting avatar (`enhancements/art/beacon-turnaround-arm-lift-12-keyframes-v1.png`, with the steady-arm baseline alongside); `enhancements/art/build-sheet.py` keys the white backdrop to alpha and packs the 12 views into the 42 KB WebP atlas that ships inside the script.

### Where it runs
* **Native macOS app:** baked into the bundled UI. The native app does not load muse.ai at runtime — its entire React UI ships as `Contents/Resources/hatch/index.html` — so `v4.1.1-patch/patch-dmg.py` inlines the script into that file when building the DMG. For an already-installed app: `python3 v4.1.1-patch/inject-enhancements.py /Applications/Muse.app` (idempotent; `--restore` puts the original bytes back).
* **PWA launcher:** load `enhancements/inspector-toggle.js` as a userscript (it carries a `@match https://muse.ai/*` header).

---

## 🛠️ Muse Version 4.1.1 (beta) by Divine Pharaoh (Native macOS App)

The official 4.1 release (`com.meta.endo`) encountered a widespread rendering issue on macOS where all headings, text, and buttons rendered as missing glyphs (`[?]` tofu).

### 🔍 Root Cause Analysis:
1. **Font Packaging Mismatch:** `OptimisticAIVF.ttf` and `OptimisticMonoVF.ttf` in `Contents/Resources/Fonts/` were packaged as WOFF2 webfont streams under `.ttf` file extensions. macOS Apple Type Services (ATS) and CoreText fail to load WOFF2 headers via `ATSApplicationFontsPath`, causing font lookup failures and falling back to `.notdef` question mark boxes across all UI strings.
2. **Missing US English Localization:** The bundle contained `en-GB.lproj` and foreign locales, but omitted `en.lproj`, failing language pack lookups on standard US English configurations.

### 🚀 What's Fixed in Version 4.1.1 (beta) by Divine Pharaoh:
- Converted and decompressed embedded typefaces to native SFNT TrueType (`0x00010000`) with full variable axes support.
- Restored `en.lproj` localization fallback.
- Preserved official OAuth capabilities and AppSSO authentication pipelines.
- Packaged as a clean, compressed disk image (`release/Muse-4.1.1.dmg`).
- Patch scripts and source build tooling are provided in [`v4.1.1-patch/`](v4.1.1-patch/).

---

## 🔬 Benchmark vs. Recent ChatGPT Desktop (`com.openai.codex`)

We analyzed the latest macOS ChatGPT desktop architecture (`/Applications/ChatGPT.app` v26.924) to align Muse Desktop with modern AI desktop design standards:

| Feature | ChatGPT Desktop | Official Muse 4.1 | Version 4.1.1 (beta) by Divine Pharaoh |
| :--- | :--- | :--- | :--- |
| **3-Column Architecture** | Chats (left), Conversation (center), Canvas/Inspector (right) | Sidebar collapsed by default | Left History drawer + Explicit Right Inspector toggle |
| **Inspector Accessibility** | Dedicated toolbar button | Hidden behind avatar pill | Open by default + `Inspector On/Off` state pill + `Cmd+Option+I` + Beacon twirl on close |
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
