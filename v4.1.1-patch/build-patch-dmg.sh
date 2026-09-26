#!/bin/bash
set -e

SOURCE_DMG="${1:-$HOME/Downloads/Muse-4.1.dmg}"
OUTPUT_DMG="${2:-$(dirname "$0")/../release/Muse-4.1.1.dmg}"
TEMP_MOUNT="/tmp/muse_dmg_source_mount"

if [ ! -f "$SOURCE_DMG" ]; then
    echo "Error: Source DMG not found at $SOURCE_DMG"
    echo "Usage: ./build-patch-dmg.sh [path/to/Muse-4.1.dmg] [output-dmg-path]"
    exit 1
fi

echo "Mounting $SOURCE_DMG..."
mkdir -p "$TEMP_MOUNT"
hdiutil attach "$SOURCE_DMG" -nobrowse -mountpoint "$TEMP_MOUNT"

TEMP_APP="/tmp/Muse_patch_staging.app"
rm -rf "$TEMP_APP"
echo "Copying Muse.app..."
cp -R "$TEMP_MOUNT/Muse.app" "$TEMP_APP"

echo "Unmounting source DMG..."
hdiutil detach "$TEMP_MOUNT"

echo "Applying v4.1.1 font & localization patch..."
python3 "$(dirname "$0")/patch-dmg.py" "$TEMP_APP" "$OUTPUT_DMG"

rm -rf "$TEMP_APP"
echo "✓ Done! Output DMG: $OUTPUT_DMG"
