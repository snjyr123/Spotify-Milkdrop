#!/usr/bin/env bash
# Fixes macOS TCC Microphone / Loopback crash on Spicetify-patched Spotify.app
set -e

SPOTIFY_APP="/Applications/Spotify.app"
ENTITLEMENTS="/tmp/spotify_entitlements.plist"

if [ ! -d "$SPOTIFY_APP" ]; then
  echo "Error: $SPOTIFY_APP not found."
  exit 1
fi

echo "1. Closing Spotify..."
killall Spotify 2>/dev/null || true

echo "2. Adding NSMicrophoneUsageDescription to Info.plist..."
/usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string 'MilkDrop Visualizer audio loopback'" "$SPOTIFY_APP/Contents/Info.plist" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Set :NSMicrophoneUsageDescription 'MilkDrop Visualizer audio loopback'" "$SPOTIFY_APP/Contents/Info.plist"

echo "3. Creating audio-input entitlements..."
cat << 'EOF' > "$ENTITLEMENTS"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
</dict>
</plist>
EOF

echo "4. Resetting TCC Microphone state for com.spotify.client..."
tccutil reset Microphone com.spotify.client 2>/dev/null || true

echo "5. Signing Spotify Helper bundles and main application..."
find "$SPOTIFY_APP/Contents/Frameworks" -maxdepth 2 \( -name "*.app" -o -name "*.framework" \) -exec codesign --force --entitlements "$ENTITLEMENTS" --sign - {} +
codesign --force --entitlements "$ENTITLEMENTS" --sign - "$SPOTIFY_APP"

echo "Done! You can now open Spotify and select BlackHole / Audio Input in MilkDrop."
