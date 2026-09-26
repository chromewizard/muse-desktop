#!/usr/bin/env python3
"""
Muse Desktop — bake the community enhancements into the native app's bundled web UI.

The native macOS app (com.meta.endo) does not load muse.ai at runtime: its whole React UI is
shipped as a single-file bundle at Contents/Resources/hatch/index.html (~53 MB), rendered in a
WKWebView. That page's Content-Security-Policy does not restrict scripts, so the enhancement
script from enhancements/inspector-toggle.js can be inlined straight into it.

The block is wrapped in markers so it is idempotent (re-running replaces the previous copy)
and reversible (--restore removes it, or copies index.html.orig back).

Usage:
    python3 inject-enhancements.py /Applications/Muse.app                # inject / update
    python3 inject-enhancements.py /path/to/index.html                   # inject into a bare bundle file
    python3 inject-enhancements.py /Applications/Muse.app --restore      # remove the block again
    python3 inject-enhancements.py /Applications/Muse.app --sign         # also ad-hoc re-sign the .app

Notes on signing:
    Modifying a resource breaks the bundle's signature seal but NOT the main executable's
    signature, so the app still launches and keeps its TCC identity (Computer Use, Full Disk
    Access, etc.). Only pass --sign when you want the ad-hoc signature the v4.1.1 DMG uses;
    that changes the app's code identity and macOS will ask for its permissions again.
    patch-dmg.py calls inject() itself and then re-signs as part of the normal DMG build.
"""

import argparse
import os
import shutil
import subprocess
import sys

START = "<!-- muse-desktop:enhancements:start -->"
END = "<!-- muse-desktop:enhancements:end -->"
DEFAULT_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "enhancements", "inspector-toggle.js")


def log(msg):
    print(f"[Muse-Enhancements] {msg}")


def resolve_index(target):
    """Accept a .app bundle, a Contents dir, a hatch dir, or index.html itself."""
    target = os.path.abspath(target)
    candidates = [
        target,
        os.path.join(target, "index.html"),
        os.path.join(target, "Contents", "Resources", "hatch", "index.html"),
        os.path.join(target, "Resources", "hatch", "index.html"),
    ]
    for c in candidates:
        if os.path.isfile(c) and c.endswith("index.html"):
            return c
    raise FileNotFoundError(f"Could not find hatch/index.html under {target}")


def script_version(src):
    for line in src.splitlines():
        if "@version" in line:
            return line.split("@version", 1)[1].strip()
    return "unknown"


def build_block(script_src):
    version = script_version(script_src)
    if "</script" in script_src.lower():
        raise ValueError("Enhancement script must not contain a closing </script> tag")
    return (
        f"\n{START}\n"
        f'<script data-muse-enhancement="inspector-toggle" data-version="{version}">\n'
        f"{script_src.rstrip()}\n"
        f"</script>\n"
        f"{END}\n"
    )


def strip_block(html):
    start = html.find(START)
    if start == -1:
        return html, False
    end = html.find(END, start)
    if end == -1:
        raise ValueError("Found start marker without end marker — refusing to guess; restore from index.html.orig")
    end += len(END)
    # eat the one leading and one trailing newline we added, so a restore is byte-identical
    if start > 0 and html[start - 1] == "\n":
        start -= 1
    if end < len(html) and html[end] == "\n":
        end += 1
    return html[:start] + html[end:], True


def inject(target, script_path=DEFAULT_SCRIPT, backup=True):
    index = resolve_index(target)
    with open(script_path, "r", encoding="utf-8") as f:
        script_src = f.read()
    with open(index, "r", encoding="utf-8") as f:
        html = f.read()

    orig = index + ".orig"
    if backup and not os.path.exists(orig):
        shutil.copy2(index, orig)
        log(f"Backed up original bundle to {os.path.basename(orig)}")

    html, replaced = strip_block(html)
    block = build_block(script_src)

    # The bundle embeds other HTML documents as strings, so use the LAST </body>.
    pos = html.rfind("</body>")
    if pos == -1:
        pos = html.rfind("</html>")
    if pos == -1:
        html = html + block
    else:
        html = html[:pos] + block + html[pos:]

    try:
        os.chmod(index, 0o644)
    except OSError:
        pass
    with open(index, "w", encoding="utf-8") as f:
        f.write(html)
    log(f"{'Updated' if replaced else 'Injected'} inspector-toggle.js v{script_version(script_src)} into {index}")
    return index


def restore(target):
    index = resolve_index(target)
    orig = index + ".orig"
    if os.path.exists(orig):
        shutil.copy2(orig, index)
        log(f"Restored {index} from index.html.orig")
        return
    with open(index, "r", encoding="utf-8") as f:
        html = f.read()
    html, removed = strip_block(html)
    if not removed:
        log("Nothing to restore — no enhancement block present.")
        return
    try:
        os.chmod(index, 0o644)
    except OSError:
        pass
    with open(index, "w", encoding="utf-8") as f:
        f.write(html)
    log(f"Removed enhancement block from {index}")


def adhoc_sign(app_path):
    if shutil.which("codesign") is None:
        log("codesign not available on this machine — skipping re-sign (the app still launches).")
        return
    subprocess.check_call(["codesign", "--force", "--deep", "-s", "-", app_path])
    log(f"Re-signed {app_path} with an ad-hoc signature.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target", help="Muse.app, or its hatch/index.html")
    ap.add_argument("--script", default=DEFAULT_SCRIPT, help="enhancement script to inline (default: enhancements/inspector-toggle.js)")
    ap.add_argument("--restore", action="store_true", help="remove the enhancement block / restore index.html.orig")
    ap.add_argument("--sign", action="store_true", help="ad-hoc re-sign the .app afterwards (changes its code identity)")
    ap.add_argument("--no-backup", action="store_true", help="do not write index.html.orig")
    args = ap.parse_args()

    if args.restore:
        restore(args.target)
    else:
        inject(args.target, args.script, backup=not args.no_backup)

    if args.sign:
        app = os.path.abspath(args.target)
        while app and not app.endswith(".app"):
            app = os.path.dirname(app)
        if app.endswith(".app"):
            adhoc_sign(app)
        else:
            log("--sign given but target is not inside a .app bundle; skipped.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        log(f"Error: {e}")
        sys.exit(1)
