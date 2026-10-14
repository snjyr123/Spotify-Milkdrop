# 🎵 Spotify MilkDrop Visualizer (Spicetify)

A classic **MilkDrop** WebGL2 music visualizer built directly into Spotify Desktop via [Spicetify](https://spicetify.app/), powered by [Butterchurn](https://github.com/jberg/butterchurn). Designed for smooth performance and low GPU overhead—scaling cleanly from modern setups down to older hardware.

### Quick Navigation
* **[🍎 macOS Setup Guide (MacBook / iMac)](#-macos-setup-guide-macbook--imac)**
* **[🪟 Windows Setup Guide](#-windows-setup-guide)**
* **[⌨️ Keyboard Shortcuts](#️-keyboard-shortcuts)**
* **[🎨 Adding Custom `.milk` Presets](#-adding-custom-milk-presets-eg-cream-of-the-crop)**

---

# 🍎 macOS Setup Guide (MacBook / iMac)

Open the **Terminal** app (`Cmd + Space` -> type `Terminal` -> press `Enter`) and run the commands below.

### Step 1: Install Spicetify CLI (Skip if already installed)
If you don't have [Spicetify CLI](https://spicetify.app/docs/getting-started) installed on your Mac yet, run this command to install and initialize it:

```bash
curl -fsSL [https://raw.githubusercontent.com/spicetify/cli/main/install.sh](https://raw.githubusercontent.com/spicetify/cli/main/install.sh) | sh
~/.spicetify/spicetify backup apply
```

### Step 2: Install MilkDrop Visualizer + 400+ Offline Presets
Copy and paste this single command block into Terminal. It clones this repository, downloads the offline Butterchurn WebGL2 engine and all 400+ presets into your Spicetify `Extensions` folder, enables the extension, and patches macOS microphone/audio permissions so Spotify won't crash:

```bash
rm -rf /tmp/Spotify-Milkdrop && \
git clone [https://github.com/snjyr123/Spotify-Milkdrop.git](https://github.com/snjyr123/Spotify-Milkdrop.git) /tmp/Spotify-Milkdrop && \
cd /tmp/Spotify-Milkdrop/spicetify-milkdrop && \
SPICETIFY_BIN="$(command -v spicetify || echo "$HOME/.spicetify/spicetify")" && \
EXT_DIR="$("$SPICETIFY_BIN" path userdata)/Extensions" && \
mkdir -p "$EXT_DIR" && \
cp milkdrop.js "$EXT_DIR/milkdrop.js" && \
curl -fsSL "[https://cdn.jsdelivr.net/npm/butterchurn@2.6.7/lib/butterchurn.min.js](https://cdn.jsdelivr.net/npm/butterchurn@2.6.7/lib/butterchurn.min.js)" -o "$EXT_DIR/butterchurn.min.js" && \
curl -fsSL "[https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js](https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js)" -o "$EXT_DIR/butterchurnPresets.min.js" && \
curl -fsSL "[https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra.min.js](https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra.min.js)" -o "$EXT_DIR/butterchurnPresetsExtra.min.js" && \
curl -fsSL "[https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra2.min.js](https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra2.min.js)" -o "$EXT_DIR/butterchurnPresetsExtra2.min.js" && \
"$SPICETIFY_BIN" config extensions butterchurn.min.js butterchurnPresets.min.js butterchurnPresetsExtra.min.js butterchurnPresetsExtra2.min.js milkdrop.js && \
chmod +x install-mac-linux.sh scripts/macos-fix-permissions.sh && \
./install-mac-linux.sh
```

Once finished, open **Spotify** and press **`Ctrl + Shift + M`** (or click the equalizer button in the top bar) to launch MilkDrop!

### Step 3: Set Up Live Audio Loopback on macOS (Optional)
By default, MilkDrop runs in **Simulated Audio** mode so it works immediately with zero setup. If you want the visuals to react to the real-time bass and frequencies of your music using [BlackHole](https://existential.audio/blackhole/):

1. **Install BlackHole 2ch and open Audio MIDI Setup via Terminal:**
   ```bash
   brew install blackhole-2ch
   open -a "Audio MIDI Setup"
   ```
2. In the **Audio Devices** window, click the **`+`** button at the bottom-left and choose **Create Multi-Output Device**.
3. Check both your **Built-in Output / Speakers** (keep it at the top as the *Master Device*) and **BlackHole 2ch** (check *Drift Correction*).
4. Right-click your new **Multi-Output Device** in the left sidebar and click **Use This Device For Sound Output**.
5. Open Spotify, press **`Ctrl + Shift + M`** to open MilkDrop, press **`S`** for Settings, click **Find audio devices**, and select **BlackHole 2ch**.

### Troubleshooting & Uninstall on macOS
* **If Spotify crashes when selecting BlackHole after a Spotify update:** Re-run the macOS permission patch in Terminal:
  ```bash
  curl -fsSL [https://raw.githubusercontent.com/snjyr123/Spotify-Milkdrop/main/spicetify-milkdrop/scripts/macos-fix-permissions.sh](https://raw.githubusercontent.com/snjyr123/Spotify-Milkdrop/main/spicetify-milkdrop/scripts/macos-fix-permissions.sh) | bash
  ```
* **To Uninstall on macOS:**
  ```bash
  SPICETIFY_BIN="$(command -v spicetify || echo "$HOME/.spicetify/spicetify")"
  "$SPICETIFY_BIN" config extensions milkdrop.js- butterchurn.min.js- butterchurnPresets.min.js- butterchurnPresetsExtra.min.js- butterchurnPresetsExtra2.min.js-
  "$SPICETIFY_BIN" apply
  ```

---

# 🪟 Windows Setup Guide

Open **PowerShell** (`Win + X` -> select **Terminal** or **PowerShell**) and run the commands below.

### Step 1: Install Spicetify CLI (Skip if already installed)
If you don't have [Spicetify CLI](https://spicetify.app/docs/getting-started) installed on Windows yet, run this command in PowerShell:

```powershell
iwr -useb [https://raw.githubusercontent.com/spicetify/cli/main/install.ps1](https://raw.githubusercontent.com/spicetify/cli/main/install.ps1) | iex
spicetify backup apply
```

### Step 2: Install MilkDrop Visualizer + 400+ Offline Presets
Copy and paste this single block into PowerShell. It downloads `milkdrop.js` along with the offline Butterchurn WebGL2 engine and all 400+ presets into your Spicetify `Extensions` folder and applies it:

```powershell
if (Test-Path "$env:TEMP\Spotify-Milkdrop") { Remove-Item -Recurse -Force "$env:TEMP\Spotify-Milkdrop" }
git clone [https://github.com/snjyr123/Spotify-Milkdrop.git](https://github.com/snjyr123/Spotify-Milkdrop.git) "$env:TEMP\Spotify-Milkdrop"
Set-Location "$env:TEMP\Spotify-Milkdrop\spicetify-milkdrop"
$extDir = "$(spicetify path userdata)\Extensions"
New-Item -ItemType Directory -Force -Path $extDir | Out-Null
Copy-Item ".\milkdrop.js" -Destination "$extDir\milkdrop.js" -Force
Invoke-WebRequest -Uri "[https://cdn.jsdelivr.net/npm/butterchurn@2.6.7/lib/butterchurn.min.js](https://cdn.jsdelivr.net/npm/butterchurn@2.6.7/lib/butterchurn.min.js)" -OutFile "$extDir\butterchurn.min.js" -UseBasicParsing
Invoke-WebRequest -Uri "[https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js](https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js)" -OutFile "$extDir\butterchurnPresets.min.js" -UseBasicParsing
Invoke-WebRequest -Uri "[https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra.min.js](https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra.min.js)" -OutFile "$extDir\butterchurnPresetsExtra.min.js" -UseBasicParsing
Invoke-WebRequest -Uri "[https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra2.min.js](https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra2.min.js)" -OutFile "$extDir\butterchurnPresetsExtra2.min.js" -UseBasicParsing
spicetify config extensions butterchurn.min.js butterchurnPresets.min.js butterchurnPresetsExtra.min.js butterchurnPresetsExtra2.min.js milkdrop.js
spicetify apply
```

Once finished, open **Spotify** and press **`Ctrl + Shift + M`** (or click the equalizer button in the top bar) to launch MilkDrop!

### Step 3: Set Up Live Audio Loopback on Windows (Optional)
By default, MilkDrop runs in **Simulated Audio** mode so it works immediately. To make the visuals react to real-time system audio using **Stereo Mix** or [VB-CABLE](https://vb-audio.com/Cable/):

1. **Open the Windows Sound Recording control panel via PowerShell:**
   ```powershell
   control mmsys.cpl,,1
   ```
2. Right-click inside the device list, check **Show Disabled Devices**, then right-click **Stereo Mix** and select **Enable** (or install [VB-CABLE](https://vb-audio.com/Cable/)).
3. Open Spotify, press **`Ctrl + Shift + M`** to open MilkDrop, press **`S`** for Settings, click **Find audio devices**, and select **Stereo Mix** or **CABLE Output**.

### Uninstall on Windows
```powershell
spicetify config extensions milkdrop.js- butterchurn.min.js- butterchurnPresets.min.js- butterchurnPresetsExtra.min.js- butterchurnPresetsExtra2.min.js-
spicetify apply
```

---

## ✨ Features

* **400+ Built-in Presets (Offline-Ready):** Pre-loads the Base, Extra, and Extra2 [Butterchurn Preset Packs](https://github.com/jberg/butterchurn-presets) locally so Spotify's Content Security Policy never blocks external scripts.
* **Dual Audio Engine:**
  * **Simulated Beat-Synced Mode (Default):** Works immediately with zero setup using synthesized audio bands synced to track playback.
  * **Live Audio Loopback:** Reacts to real-time system audio frequencies via [BlackHole](https://existential.audio/blackhole/) (macOS) or [VB-CABLE](https://vb-audio.com/Cable/) / Stereo Mix (Windows).
* **Hardware-Friendly Performance Controls:**
  * Choose from 4 Quality tiers (`Ultra-low`, `Low`, `Medium`, `High`), adjustable internal Render Scale (`25%`–`100%`), and an FPS cap (`15`–`60` FPS).
  * **Adaptive Quality:** Automatically lowers internal render scale if your GPU drops frames.
* **Customizable Now Playing Card:**
  * Shows album art, song title, artist, and a live progress bar on track changes—or enable **"Always show track card"** (`I`) to keep it pinned on screen.
* **Full Preset Browser:** Search through presets (`P`), favorite presets (`V`), blacklist/hide unwanted presets (`B`), lock the current preset (`L`), or auto-cycle on a timer.

---

## ⌨️ Keyboard Shortcuts

Press **`Ctrl + Shift + M`** anywhere in Spotify (or click the equalizer icon in the top bar) to open or close the visualizer.

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Shift + M` | Open / close MilkDrop visualizer |
| `Space` | Play / pause track |
| `←` / `→` | Previous / next preset |
| `R` | Load a random preset |
| `L` | Lock / unlock current preset |
| `V` | Favorite / unfavorite current preset |
| `B` | Hide (blacklist) current preset |
| `P` | Open Preset Browser |
| `S` | Open Settings Panel |
| `I` | Pin / unpin the "Now Playing" track card |
| `D` | Toggle real-time FPS & GPU stats overlay |
| `F` | Toggle Fullscreen |
| `H` or `?` | Open Keyboard Shortcuts help |
| `Esc` | Close active panel, or close visualizer |

---

## 🎨 Adding Custom `.milk` Presets (e.g., *Cream of the Crop*)

Because Butterchurn runs on WebGL2 GLSL shaders, raw `.milk` presets must be converted into JSON using [`milkdrop-preset-converter`](https://www.npmjs.com/package/milkdrop-preset-converter).

Run this block in Terminal (replace `/path/to/your/milk/folder` with the folder containing your `.milk` files—stick to 100–300 presets at a time to keep memory usage low):

```bash
mkdir -p ~/milkdrop-convert && cd ~/milkdrop-convert
npm init -y
npm install milkdrop-preset-converter

node -e '
const fs = require("fs"), path = require("path"), conv = require("milkdrop-preset-converter");
const dir = "/path/to/your/milk/folder";
const out = {};
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith(".milk")) {
    try { out[f.slice(0, -5)] = conv.convertPreset(fs.readFileSync(path.join(dir, f), "utf8")); }
    catch (e) { console.warn("Skipped:", f); }
  }
}
fs.writeFileSync("cream-presets.js", "window.CustomMilkdropPresets = Object.assign(window.CustomMilkdropPresets || {}, " + JSON.stringify(out) + ");");
console.log("Converted", Object.keys(out).length, "presets into cream-presets.js!");
'

SPICETIFY_BIN="$(command -v spicetify || echo "$HOME/.spicetify/spicetify")"
cp cream-presets.js "$("$SPICETIFY_BIN" path userdata)/Extensions/cream-presets.js"
"$SPICETIFY_BIN" config extensions cream-presets.js
"$SPICETIFY_BIN" apply
```

---

## 📄 License

Released under the [MIT License](LICENSE). Powered by [Butterchurn](https://github.com/jberg/butterchurn) (MIT).
