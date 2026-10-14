#!/usr/bin/env bash
# One-step installer for macOS
set -e

SPICETIFY_BIN="$(command -v spicetify || echo "$HOME/.spicetify/spicetify")"
if [ ! -x "$SPICETIFY_BIN" ]; then
  echo "Error: Spicetify CLI not found. Install it from https://spicetify.app"
  exit 1
fi

EXT_DIR="$("$SPICETIFY_BIN" path userdata)/Extensions"
mkdir -p "$EXT_DIR"

echo "Copying milkdrop.js to $EXT_DIR..."
cp milkdrop.js "$EXT_DIR/milkdrop.js"

echo "Configuring and applying Spicetify..."
"$SPICETIFY_BIN" config extensions milkdrop.js
"$SPICETIFY_BIN" apply

if [ "$(uname)" = "Darwin" ] && [ -f "scripts/macos-fix-permissions.sh" ]; then
  echo "Applying macOS audio entitlements fix..."
  chmod +x scripts/macos-fix-permissions.sh
  ./scripts/macos-fix-permissions.sh
fi

echo "Installation complete! Press Ctrl+Shift+M inside Spotify to open MilkDrop."
