# Muse Desktop Launcher

A lightweight standalone desktop app and launcher for [muse.ai](https://muse.ai).

Runs `muse.ai` in a clean, dedicated window frame without browser tabs, URL bars, or address navigation clutter.

---

## 🚀 Quick Install (macOS)

### Option 1: Run the Install Script
Run this single command in your terminal to build and place `Muse.app` directly on your Desktop:
```bash
bash install-mac.sh
```

### Option 2: Pre-compiled App
Download `release/Muse-Mac-App.zip`, unzip it, and drag `Muse.app` to your Applications folder or Desktop.

### Option 3: Direct Web Shortcut
Double-click `Muse.webloc` to open `muse.ai` in your default web browser.

---

## 🛠️ How It Works
The macOS launcher uses Chrome's native application mode:
```bash
open -na "Google Chrome" --args --app="https://muse.ai"
```
This isolates Muse into its own floating window with independent window controls while leveraging full hardware acceleration, audio/video playback, and active browser sessions.

---

## Cross-Platform Usage

### Windows
Run in Command Prompt or PowerShell:
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
