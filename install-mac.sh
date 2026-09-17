#!/bin/bash
# Builds and installs Muse.app to ~/Desktop

TARGET="$HOME/Desktop/Muse.app"
echo "Compiling Muse.app to $TARGET..."

osacompile -o "$TARGET" -e 'do shell script "open -na \"Google Chrome\" --args --app=\"https://muse.ai\""'

if [ -d "$TARGET" ]; then
    echo "✓ Success! Muse.app is ready on your Desktop."
else
    echo "✗ Compilation failed."
    exit 1
fi
