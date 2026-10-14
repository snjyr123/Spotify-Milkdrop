# Spicetify MilkDrop Visualizer

A classic **MilkDrop** WebGL2 music visualizer extension for [Spicetify](https://spicetify.app/), powered by [Butterchurn](https://github.com/jberg/butterchurn). Built for high performance and low GPU overhead—scaling cleanly from modern setups down to older hardware.

---

## Features

- **400+ Built-in Presets:** Automatically loads the base, extra, and extra2 Butterchurn preset packs, plus supports custom converted `.milk` packs (e.g., *Cream of the Crop*).
- **Dual Audio Engine:**
  - **Simulated Beat-Synced Mode (Zero Setup):** Works out of the box using synthesized audio bands synced to track playback.
  - **Live Loopback Capture:** Supports real-time system audio loopback via **BlackHole** (macOS) or **VB-Cable / Stereo Mix** (Windows).
- **Hardware-Friendly Performance Controls:**
  - 4 Quality tiers (`Ultra-low`, `Low`, `Medium`, `High`), adjustable internal Render Scale (`25%`–`100%`), and configurable FPS cap (`15`–`60` FPS).
  - **Adaptive Quality:** Automatically lowers internal render resolution if your GPU drops frames.
- **Customizable Now Playing Overlay:**
  - Displays album art, track title, artist, and progress bar on song change—or toggle **"Always show track card"** (`I`) to keep it permanently pinned.
- **Full Preset Browser:** Search presets, star your favorites (`V`), hide unwanted presets (`B`), lock the current preset (`L`), or auto-cycle on a timer or track change.

---

## Installation

### Prerequisites
Make sure you have [Spicetify CLI](https://spicetify.app/docs/getting-started) installed and applied to your Spotify desktop client.

---

### macOS Installation (Terminal)

1. **Clone the repository and copy `milkdrop.js` to your Spicetify Extensions folder:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/spicetify-milkdrop.git
   cd spicetify-milkdrop
   mkdir -p ~/.config/spicetify/Extensions
   cp milkdrop.js ~/.config/spicetify/Extensions/milkdrop.js
   ```

2. **Enable the extension and apply Spicetify:**
   ```bash
   spicetify config extensions milkdrop.js
   spicetify apply
   ```
   *(Tip: If macOS says `command not found: spicetify`, replace `spicetify` with `~/.spicetify/spicetify` in the commands above).*

3. **(Required for Live Audio / BlackHole on macOS) Re-sign Spotify with Audio Entitlements:**
   Because patching Spotify invalidates its official bundle signature, macOS will crash Spotify if you grant microphone/loopback permission without re-signing the bundle. Run the included helper script whenever you run `spicetify apply`:
   ```bash
   chmod +x scripts/macos-fix-permissions.sh
   ./scripts/macos-fix-permissions.sh
   ```

---

### Windows Installation (PowerShell)

1. **Clone the repository and copy `milkdrop.js` into your Spicetify Extensions directory:**
   ```powershell
   git clone https://github.com/YOUR_USERNAME/spicetify-milkdrop.git
   cd spicetify-milkdrop
   $extDir = "$(spicetify path userdata)\Extensions"
   Copy-Item .\milkdrop.js -Destination $extDir -Force
   ```

2. **Register the extension and apply Spicetify:**
   ```powershell
   spicetify config extensions milkdrop.js
   spicetify apply
   ```

---

## Setting Up Live Audio Loopback (Optional)

By default, the visualizer starts in **Simulated Audio** mode so it works immediately. For true real-time frequency response, route your system audio through a virtual loopback device:

### On macOS (using BlackHole)
1. Install [BlackHole 2ch](https://existential.audio/blackhole/) (`brew install blackhole-2ch`).
2. Open **Audio MIDI Setup** (`Cmd + Space` -> type *Audio MIDI Setup*).
3. Click the **`+`** button at the bottom-left and select **Create Multi-Output Device**.
4. Check both your **Built-in Output / Speakers** (set as Master Device at the top) and **BlackHole 2ch** (enable *Drift Correction*).
5. Right-click the new **Multi-Output Device** and select **Use This Device For Sound Output**.
6. Ensure you ran `./scripts/macos-fix-permissions.sh`, open Spotify, launch MilkDrop (`Ctrl + Shift + M`), open **Settings (`S`)**, click **Find audio devices**, and select **BlackHole 2ch**.

### On Windows (using Stereo Mix or VB-Cable)
1. Enable **Stereo Mix** in Windows Sound Settings (*More sound settings -> Recording tab -> Right-click Stereo Mix -> Enable*), or install [VB-CABLE](https://vb-audio.com/Cable/).
2. Open Spotify, launch MilkDrop (`Ctrl + Shift + M`), open **Settings (`S`)**, click **Find audio devices**, and select **Stereo Mix** or **CABLE Output**.

---

## Keyboard Shortcuts

Press **`Ctrl + Shift + M`** anywhere in Spotify (or click the equalizer icon in the top bar) to toggle the visualizer.

| Key | Action |
| :--- | :--- |
| `Ctrl + Shift + M` | Open / close MilkDrop visualizer |
| `Space` | Play / pause track |
| `←` / `→` | Previous / next preset |
| `R` | Load a random preset |
| `L` | Lock / unlock the current preset |
| `V` | Favorite / unfavorite the current preset |
| `B` | Hide (blacklist) the current preset |
| `P` | Open Preset Browser |
| `S` | Open Settings Panel |
| `I` | Pin / unpin the "Now Playing" track card |
| `D` | Toggle real-time FPS & GPU performance stats |
| `F` | Toggle Fullscreen |
| `H` or `?` | Show keyboard shortcuts help |
| `Esc` | Close active side panel, or close visualizer |

---

## Adding Custom `.milk` Presets (e.g., *Cream of the Crop*)

Because Butterchurn uses WebGL2 GLSL shaders rather than DirectX HLSL, raw `.milk` files must be converted to JSON using [`milkdrop-preset-converter`](https://www.npmjs.com/package/milkdrop-preset-converter).

*(Note: Convert 100–300 of your favorite `.milk` files at a time rather than all 9,795 at once to keep startup fast and memory usage low).*

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
```
Copy `cream-presets.js` into your Spicetify `Extensions` folder, run `spicetify config extensions cream-presets.js`, and run `spicetify apply`.

---

## Troubleshooting

- **CDN Blocked by Spotify:** If Spotify blocks external scripts from `jsdelivr` or `unpkg`, download the engine files locally into your Spicetify `Extensions` folder:
  ```bash
  cd "$(spicetify path userdata)/Extensions"
  curl -LO https://cdn.jsdelivr.net/npm/butterchurn@2.6.7/lib/butterchurn.min.js
  curl -LO https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js
  spicetify config extensions butterchurn.min.js
  spicetify config extensions butterchurnPresets.min.js
  spicetify apply
  ```
- **Spotify Crashes When Selecting Audio Device on macOS:** Run `./scripts/macos-fix-permissions.sh` after every `spicetify apply` so macOS TCC allows microphone/loopback capture on the modified Spotify app bundle.

---

## License

Released under the [MIT License](LICENSE). Powered by [Butterchurn](https://github.com/jberg/butterchurn) (MIT).
