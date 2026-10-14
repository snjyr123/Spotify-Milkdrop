// NAME: MilkDrop
// AUTHOR: Sunjay Ramamoorthy
// DESCRIPTION: MilkDrop (Butterchurn) WebGL2 music visualizer for Spicetify.
// Open with the topbar button or Ctrl+Shift+M. Press H inside the visualizer for shortcuts.
// License: MIT

(async function spicetifyMilkDrop() {
  "use strict";
  if (window.__spicetifyMilkDrop) return;
  window.__spicetifyMilkDrop = true;

  const TAG = "[MilkDrop]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // ---------------------------------------------------------------- wait for Spicetify
  // (Deliberately NOT waiting for Player.data: it stays empty until a track has played.)
  for (let i = 0; i < 300; i++) {
    const sp = window.Spicetify;
    if (sp?.Player?.addEventListener && (sp.Topbar?.Button || sp.Playbar?.Button)) break;
    await sleep(100);
  }
  if (!window.Spicetify?.Player?.addEventListener) {
    warn("Spicetify.Player never appeared; giving up.");
    return;
  }
  const Sp = window.Spicetify;

  // ---------------------------------------------------------------- settings
  const LS_KEY = "spicetify-milkdrop:v1";
  const QUALITY = {
    ultralow: { label: "Ultra-low", mw: 16, mh: 12, tex: 0.5, scale: 0.35 },
    low: { label: "Low", mw: 24, mh: 18, tex: 0.5, scale: 0.5 },
    medium: { label: "Medium", mw: 32, mh: 24, tex: 0.75, scale: 0.75 },
    high: { label: "High", mw: 48, mh: 36, tex: 1, scale: 1 },
  };
  const defaults = () => ({
    quality: "low", renderScale: 0.5, fps: 30, gain: 1,
    source: "sim", sourceLabel: "", sourceChosen: false,
    cycle: 20, blend: 2, shuffle: true, favOnly: false, byTrack: false,
    showTrack: true, pinTrack: false, showStats: false, showToast: true, adaptive: true,
    favorites: [], hidden: [], lastPreset: "",
  });
  let S = loadSettings();
  function loadSettings() {
    let s = defaults();
    try { s = { ...s, ...JSON.parse(localStorage.getItem(LS_KEY) || "{}") }; } catch (e) { /* use defaults */ }
    if (!Array.isArray(s.favorites)) s.favorites = [];
    if (!Array.isArray(s.hidden)) s.hidden = [];
    if (!QUALITY[s.quality]) s.quality = "low";
    s.renderScale = clamp(+s.renderScale || 0.5, 0.25, 1);
    s.fps = [15, 24, 30, 45, 60].includes(+s.fps) ? +s.fps : 30;
    return s;
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- engine libraries
  const LIBS = {
    butterchurn: [
      "https://cdn.jsdelivr.net/npm/butterchurn@2.6.7/lib/butterchurn.min.js",
      "https://unpkg.com/butterchurn@2.6.7/lib/butterchurn.min.js",
    ],
    presets: [
      "https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js",
      "https://unpkg.com/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js",
    ],
    extra: [
      "https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra.min.js",
      "https://unpkg.com/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra.min.js",
    ],
    extra2: [
      "https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra2.min.js",
      "https://unpkg.com/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra2.min.js",
    ],
  };
  const getBC = () => {
    const b = window.butterchurn;
    return b?.createVisualizer ? b : b?.default?.createVisualizer ? b.default : null;
  };
  const getPresetLib = () => {
    const p = window.butterchurnPresets;
    return p?.getPresets ? p : p?.default?.getPresets ? p.default : null;
  };
  function injectScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      const timer = setTimeout(() => { s.remove(); reject(new Error("timed out: " + url)); }, 12000);
      s.src = url;
      s.async = true;
      s.onload = () => { clearTimeout(timer); resolve(); };
      s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error("blocked or unreachable: " + url)); };
      document.head.appendChild(s);
    });
  }
  async function evalScript(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
    (0, eval)(await res.text());
  }
  async function loadLib(urls, ready) {
    if (ready()) return; // already present (e.g. loaded locally as its own Spicetify extension)
    const errors = [];
    for (const url of urls) {
      for (const method of [injectScript, evalScript]) {
        try {
          await method(url);
          if (ready()) return;
          errors.push("loaded but no global: " + url);
        } catch (e) { errors.push(e?.message || String(e)); }
      }
    }
    throw new Error(
      "Couldn't load the MilkDrop engine. Spotify may be blocking the CDN.\n\n" +
      "Fallback: download butterchurn.min.js and butterchurnPresets.min.js into your Spicetify " +
      "Extensions folder, add each with `spicetify config extensions <file>`, then run `spicetify apply`.\n\n" +
      "Details:\n" + errors.join("\n")
    );
  }
  function webgl2Supported() {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      const ok = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      return ok;
    } catch (e) { return false; }
  }

  // ---------------------------------------------------------------- state
  let isOpen = false, token = 0, raf = 0;
  let viz = null, vizCanvas = null, vSize = [0, 0], ctxLost = false;
  let presets = null, names = [], cur = "", locked = false;
  const hist = [], badThisSession = new Set();
  let activePanel = null, trackPinned = !!S.pinTrack;
  let cycleTimer = 0, idleTimer = 0, toastTimer = 0, trackTimer = 0, resizeTimer = 0;
  let lastTs = 0, tickT = 0, frames = 0, fps = 0, renderMs = 0, renderErr = 0, lowCount = 0;
  let analysis = null, analysisUri = "";
  const ui = {};
  const A = {
    ctx: null, input: null, meter: null, meterBuf: null, mute: null,
    stream: null, streamSrc: null, sim: null,
    mode: "off", label: "", error: "", level: 0, silent: 0,
  };
  const LOOPBACK_RE = /blackhole|loopback|soundflower|vb-?cable|stereo mix|voicemeeter/i;

  // ---------------------------------------------------------------- tiny DOM helper
  function h(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid);
    return n;
  }

  // ---------------------------------------------------------------- audio
  async function audioInit() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Web Audio isn't available in this Spotify build.");
    A.ctx = new AC({ latencyHint: "interactive" });
    A.input = A.ctx.createGain();
    A.input.gain.value = S.gain;
    A.meter = A.ctx.createAnalyser();
    A.meter.fftSize = 512;
    A.meterBuf = new Uint8Array(A.meter.fftSize);
    A.input.connect(A.meter);
    // Zero-gain path to the speakers keeps the graph "pulled" without any audible output/feedback.
    A.mute = A.ctx.createGain();
    A.mute.gain.value = 0;
    A.input.connect(A.mute);
    A.mute.connect(A.ctx.destination);
    try { await A.ctx.resume(); } catch (e) { /* resumed on first click/keypress instead */ }
  }
  function audioDetach() {
    if (A.stream) {
      const s = A.stream;
      A.stream = null;
      s.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    }
    try { A.streamSrc?.disconnect(); } catch (e) { /* ignore */ }
    A.streamSrc = null;
    if (A.sim) {
      A.sim.nodes.forEach((n) => {
        try { n.stop?.(); } catch (e) { /* ignore */ }
        try { n.disconnect(); } catch (e) { /* ignore */ }
      });
      A.sim = null;
    }
  }
  function audioStop() {
    audioDetach();
    try { A.ctx?.close(); } catch (e) { /* ignore */ }
    A.ctx = A.input = A.meter = A.mute = null;
    A.mode = "off";
    A.silent = 0;
    A.level = 0;
  }
  function friendlyAudioError(e) {
    const n = e?.name || "";
    if (n === "NotAllowedError" || n === "SecurityError")
      return "Microphone access was denied. Allow Spotify under OS Privacy settings -> Microphone, then restart Spotify.";
    if (n === "NotFoundError" || n === "OverconstrainedError")
      return "That audio input wasn't found. If you use BlackHole or VB-Cable, is it installed?";
    if (n === "NotReadableError") return "The audio input is busy or unavailable.";
    return e?.message || String(e);
  }
  async function resolveDeviceId(id, label) {
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
      if (inputs.some((d) => d.deviceId === id)) return id;
      const byLabel = label && inputs.find((d) => d.label === label);
      if (byLabel) return byLabel.deviceId;
    } catch (e) { /* fall through */ }
    return id;
  }
  async function setSource(src, label) {
    audioDetach();
    A.error = "";
    if (src.startsWith("dev:") && navigator.mediaDevices?.getUserMedia) {
      try {
        const id = await resolveDeviceId(src.slice(4), label);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: id ? { exact: id } : undefined,
            echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2,
          },
        });
        if (!A.ctx) { stream.getTracks().forEach((t) => t.stop()); return; } // closed while waiting
        A.stream = stream;
        stream.getAudioTracks().forEach((t) => {
          t.onended = () => {
            if (A.stream !== stream) return;
            toast("Audio device disconnected, using simulated audio");
            setSource("sim", "").then(updateBadge);
          };
        });
        A.streamSrc = A.ctx.createMediaStreamSource(stream);
        A.streamSrc.connect(A.input);
        A.mode = "device";
        A.label = label || stream.getAudioTracks()[0]?.label || "Input device";
        return;
      } catch (e) {
        A.error = friendlyAudioError(e);
        warn("Audio device failed:", e);
      }
    }
    if (!A.ctx) return;
    startSim();
    A.mode = "sim";
    A.label = "Simulated";
  }
  async function autoDetectDevice() {
    if (S.sourceChosen || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput" && d.label);
      const lb = inputs.find((d) => LOOPBACK_RE.test(d.label));
      if (lb) { S.source = "dev:" + lb.deviceId; S.sourceLabel = lb.label; save(); }
    } catch (e) { /* ignore */ }
  }

  // Synthetic audio: a few oscillators/noise bands whose gains follow the beat. Not real audio.
  function startSim() {
    const c = A.ctx;
    const nodes = [], bands = {};
    const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); nodes.push(o); return o; };
    const filt = (type, f, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; nodes.push(b); return b; };
    const band = (name, node) => { const g = c.createGain(); g.gain.value = 0; node.connect(g); g.connect(A.input); nodes.push(g); bands[name] = g; };

    const sub = osc("sine", 55);
    band("sub", sub);
    const bassOsc = osc("sawtooth", 110);
    const lp = filt("lowpass", 500);
    bassOsc.connect(lp);
    band("bass", lp);
    const midOsc = osc("square", 440);
    const bp = filt("bandpass", 1500, 0.7);
    midOsc.connect(bp);
    band("mid", bp);

    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    noise.start();
    nodes.push(noise);
    const hp = filt("highpass", 5000);
    noise.connect(hp);
    band("hat", hp);
    const sn = filt("bandpass", 2500, 0.5);
    noise.connect(sn);
    band("snare", sn);

    A.sim = { nodes, bands, bassOsc, midOsc };
  }
  function setBand(sim, name, v, t) { sim.bands[name].gain.setTargetAtTime(v, t, 0.012); }
  function findIdx(arr, t) { // last element with .start <= t
    let lo = 0, hi = arr.length - 1, r = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (arr[m].start <= t) { r = m; lo = m + 1; } else hi = m - 1;
    }
    return r;
  }
  function simTick() {
    const sim = A.sim;
    if (!sim || !A.ctx) return;
    const t = A.ctx.currentTime;
    const playing = !!Sp.Player.isPlaying?.();
    const pos = (Sp.Player.getProgress?.() || 0) / 1000;
    let level = playing ? 0.8 : 0.05, bright = 0.5, pc = 0, beatAge = 0, beatNo = 0;
    if (playing) {
      const beats = analysis?.beats;
      if (beats?.length) {
        const i = findIdx(beats, pos);
        if (i >= 0) { beatNo = i; beatAge = clamp((pos - beats[i].start) / (beats[i].duration || 0.5), 0, 1); }
      } else {
        const bp = (pos * (analysis?.track?.tempo || 120)) / 60;
        beatNo = Math.floor(bp);
        beatAge = bp - beatNo;
      }
      const segs = analysis?.segments;
      if (segs?.length) {
        const si = findIdx(segs, pos);
        if (si >= 0) {
          const s = segs[si];
          level = clamp(((s.loudness_max ?? -20) + 45) / 40, 0.2, 1);
          bright = clamp(((s.timbre?.[1] ?? 40) + 20) / 160, 0, 1);
          const p = s.pitches;
          if (p) { let best = 0; for (let k = 1; k < 12; k++) if (p[k] > p[best]) best = k; pc = best; }
        }
      }
    }
    const kick = playing ? Math.pow(Math.max(0, 1 - beatAge * 2.2), 2) : 0;
    const snare = playing && beatNo & 1 ? Math.pow(Math.max(0, 1 - beatAge * 3), 2) : 0;
    const hat = playing ? Math.pow(Math.max(0, 1 - ((beatAge + 0.5) % 1) * 5), 2) : 0;
    const wob = 0.5 + 0.5 * Math.sin(pos * 1.3);
    setBand(sim, "sub", 0.9 * kick * level, t);
    setBand(sim, "bass", (0.08 + 0.5 * kick) * level, t);
    setBand(sim, "mid", (0.05 + 0.12 * wob + 0.2 * snare) * level * (0.5 + bright), t);
    setBand(sim, "snare", 0.45 * snare * level, t);
    setBand(sim, "hat", 0.3 * hat * level * (0.4 + bright), t);
    sim.bassOsc.frequency.setTargetAtTime(110 * Math.pow(2, pc / 12), t, 0.05);
    sim.midOsc.frequency.setTargetAtTime(220 * Math.pow(2, (pc + 7) / 12) * (1 + wob), t, 0.05);
  }
  async function loadAnalysis() {
    analysis = null;
    const uri = Sp.Player.data?.item?.uri || Sp.Player.data?.track?.uri || "";
    analysisUri = uri;
    if (!uri || typeof Sp.getAudioData !== "function") return;
    try {
      const data = await Promise.race([
        Sp.getAudioData(uri),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
      ]);
      if (analysisUri === uri && data?.beats?.length) analysis = data;
    } catch (e) { log("Audio analysis unavailable, using a steady 120 BPM pulse:", e?.message || e); }
  }

  // ---------------------------------------------------------------- presets
  function pool() {
    const hid = new Set(S.hidden), fav = new Set(S.favorites);
    return names.filter((n) => !hid.has(n) && !badThisSession.has(n) && (!S.favOnly || fav.has(n)));
  }
  function pickNext(dir) {
    const p = pool();
    if (!p.length) return null;
    if (S.shuffle && dir > 0) {
      if (p.length === 1) return p[0];
      let n;
      do { n = p[(Math.random() * p.length) | 0]; } while (n === cur);
      return n;
    }
    const i = p.indexOf(cur);
    if (i < 0) return dir > 0 ? p[0] : p[p.length - 1];
    return p[(i + dir + p.length) % p.length];
  }
  function loadPreset(name, { blend = S.blend, remember = true } = {}) {
    if (!viz || !presets?.[name]) return false;
    try {
      viz.loadPreset(presets[name], blend);
    } catch (e) {
      if (e instanceof EvalError || /unsafe-eval|Content Security Policy/i.test(e?.message || "")) {
        showError("Spotify's security policy blocks the eval() that MilkDrop presets need. " + (e?.message || ""));
        return false;
      }
      warn("Preset failed, skipping:", name, e);
      badThisSession.add(name);
      return false;
    }
    if (remember && cur && cur !== name) { hist.push(cur); if (hist.length > 50) hist.shift(); }
    cur = name;
    S.lastPreset = name;
    save();
    updateTitle();
    toast(name);
    if (activePanel === "presets") renderPresetList();
    return true;
  }
  function go(dir) {
    if (!viz) return;
    for (let tries = 0; tries < 10; tries++) {
      let n = null, fromHist = false;
      if (dir < 0 && S.shuffle) { n = hist.pop() || null; fromHist = !!n; }
      if (!n) n = pickNext(dir);
      if (!n) { toast("No presets available (check Favorites only / hidden presets)"); return; }
      if (loadPreset(n, { remember: !fromHist })) return;
      if (ui.error.classList.contains("spmd-show")) return;
    }
  }
  function randomPreset() {
    const p = pool().filter((n) => n !== cur);
    if (!p.length) return;
    loadPreset(p[(Math.random() * p.length) | 0]);
    scheduleCycle();
  }
  function scheduleCycle() {
    clearTimeout(cycleTimer);
    cycleTimer = 0;
    if (!isOpen || !(S.cycle > 0)) return;
    cycleTimer = setTimeout(() => {
      if (isOpen && !locked && !document.hidden) go(1);
      scheduleCycle();
    }, S.cycle * 1000);
  }
  function toggleLock() {
    locked = !locked;
    ui.btnLock.classList.toggle("spmd-on", locked);
    updateTitle();
    toast(locked ? "Preset locked" : "Preset unlocked");
  }
  function toggleFavorite() {
    if (!cur) return;
    const i = S.favorites.indexOf(cur);
    if (i >= 0) S.favorites.splice(i, 1); else S.favorites.push(cur);
    save();
    toast((i >= 0 ? "Removed from favorites: " : "★ Favorite: ") + cur);
    if (activePanel === "presets") renderPresetList();
  }
  function hideCurrent() {
    if (!cur) return;
    if (!S.hidden.includes(cur)) S.hidden.push(cur);
    save();
    toast("Hidden: " + cur);
    go(1);
    scheduleCycle();
  }

  // ---------------------------------------------------------------- visualizer lifecycle
  function targetSize() {
    const dpr = window.devicePixelRatio || 1;
    return [
      Math.max(64, Math.round(window.innerWidth * dpr * S.renderScale)),
      Math.max(64, Math.round(window.innerHeight * dpr * S.renderScale)),
    ];
  }
  function buildViz() {
    destroyViz();
    const bc = getBC();
    if (!bc) throw new Error("Butterchurn isn't loaded.");
    const q = QUALITY[S.quality] || QUALITY.low;
    const [w, ht] = targetSize();
    const canvas = h("canvas", { class: "spmd-canvas" });
    canvas.width = w;
    canvas.height = ht;
    ui.root.prepend(canvas);
    try {
      viz = bc.createVisualizer(A.ctx, canvas, {
        width: w, height: ht, meshWidth: q.mw, meshHeight: q.mh, pixelRatio: 1, textureRatio: q.tex,
      });
    } catch (e) { canvas.remove(); throw e; }
    vizCanvas = canvas;
    vSize = [w, ht];
    ctxLost = false;
    canvas.addEventListener("webglcontextlost", onCtxLost);
    canvas.addEventListener("webglcontextrestored", onCtxRestored);
    viz.connectAudio(A.input);
  }
  function destroyViz() {
    if (vizCanvas) {
      vizCanvas.removeEventListener("webglcontextlost", onCtxLost);
      vizCanvas.removeEventListener("webglcontextrestored", onCtxRestored);
      try { vizCanvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext(); } catch (e) { /* ignore */ }
      vizCanvas.remove();
    }
    vizCanvas = null;
    viz = null;
  }
  function rebuildViz() {
    if (!isOpen || !A.ctx) return;
    try {
      const keep = cur;
      buildViz();
      if (keep) loadPreset(keep, { blend: 0, remember: false });
    } catch (e) { warn(e); showError(e); }
  }
  function onCtxLost(e) { e.preventDefault(); ctxLost = true; toast("Graphics context lost, recovering…"); }
  function onCtxRestored() { rebuildViz(); }
  function applySize() {
    if (!viz || !vizCanvas) return;
    const [w, ht] = targetSize();
    if (w === vSize[0] && ht === vSize[1]) return;
    vizCanvas.width = w;
    vizCanvas.height = ht;
    vSize = [w, ht];
    viz.setRendererSize(w, ht, {});
  }
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(applySize, 150); }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!viz || ctxLost || document.hidden) { lastTs = ts; return; }
    const interval = 1000 / S.fps;
    const dt = ts - lastTs;
    if (dt < interval - 2) return;
    lastTs = ts - (dt % interval);
    simTick();
    const t0 = performance.now();
    try {
      viz.render();
      renderErr = 0;
    } catch (e) {
      if (++renderErr === 1) warn("render error:", e);
      if (renderErr > 60) {
        cancelAnimationFrame(raf);
        raf = 0;
        showError("Rendering failed repeatedly: " + (e?.message || e));
        return;
      }
    }
    renderMs = renderMs * 0.9 + (performance.now() - t0) * 0.1;
    frames++;
    if (ts - tickT >= 500) tick(ts);
  }
  function tick(now) {
    const dt = now - tickT;
    tickT = now;
    fps = (frames * 1000) / dt;
    frames = 0;
    const playing = !!Sp.Player.isPlaying?.();

    if (A.meter) {
      A.meter.getByteTimeDomainData(A.meterBuf);
      let pk = 0;
      for (let i = 0; i < A.meterBuf.length; i++) { const v = Math.abs(A.meterBuf[i] - 128); if (v > pk) pk = v; }
      A.level = pk / 128;
    }
    if (A.mode === "device" && playing && A.level < 0.004) A.silent += dt; else A.silent = 0;

    // adaptive quality: only react to a genuinely slow GPU, not to a throttled/occluded window
    if (S.adaptive && fps > 5 && fps < S.fps * 0.75) lowCount++; else lowCount = 0;
    if (lowCount >= 6 && S.renderScale > 0.26) {
      lowCount = 0;
      S.renderScale = Math.max(0.25, Math.round((S.renderScale - 0.1) * 100) / 100);
      save();
      applySize();
      ui.controls?.renderScale?.(S.renderScale);
      toast("Adaptive quality: render scale " + Math.round(S.renderScale * 100) + "%");
    }

    ui.play.textContent = playing ? "❚❚" : "▶";
    if (ui.stats.classList.contains("spmd-show")) {
      const q = QUALITY[S.quality];
      ui.stats.textContent =
        fps.toFixed(0) + " fps (cap " + S.fps + ") · " + renderMs.toFixed(1) + " ms CPU\n" +
        vSize[0] + "×" + vSize[1] + " (" + Math.round(S.renderScale * 100) + "%) · mesh " + q.mw + "×" + q.mh + "\n" +
        "audio: " + A.mode + (A.mode === "device" ? " · level " + (A.level * 100).toFixed(0) + "%" : "");
    }
    if (ui.track.classList.contains("spmd-show")) {
      const dur = Sp.Player.getDuration?.() || 0;
      ui.progress.style.width = (dur > 0 ? clamp(((Sp.Player.getProgress?.() || 0) / dur) * 100, 0, 100) : 0) + "%";
    }
    updateBadge();
    if (activePanel === "settings") updateStatus();
  }

  // ---------------------------------------------------------------- open / close
  async function open() {
    if (isOpen) return;
    isOpen = true;
    const my = ++token;
    buildUI();
    ui.root.classList.add("spmd-open");
    ui.error.classList.remove("spmd-show");
    setLoading("Loading MilkDrop…");
    wakeUI();
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);
    try {
      await loadLib(LIBS.butterchurn, () => !!getBC());
      await loadLib(LIBS.presets, () => !!getPresetLib());
      await loadLib(LIBS.extra, () => !!window.butterchurnPresetsExtra).catch(() => {});
      await loadLib(LIBS.extra2, () => !!window.butterchurnPresetsExtra2).catch(() => {});
      if (my !== token) return;
      if (!presets) {
        presets = Object.assign(
          {},
          getPresetLib().getPresets(),
          window.butterchurnPresetsExtra?.getPresets?.() || {},
          window.butterchurnPresetsExtra2?.getPresets?.() || {},
          window.CustomMilkdropPresets || {}
        );
        names = Object.keys(presets).sort((a, b) => a.localeCompare(b));
      }
      if (!webgl2Supported())
        throw new Error("WebGL2 isn't available here, and MilkDrop (Butterchurn) requires it. Try updating Spotify or your graphics drivers.");
      await audioInit();
      if (my !== token) return;
      await autoDetectDevice();
      await setSource(S.source, S.sourceLabel);
      if (my !== token) return;
      loadAnalysis();
      buildViz();
      setLoading(null);
      const first = names.includes(S.lastPreset) && !S.hidden.includes(S.lastPreset) ? S.lastPreset : pickNext(1);
      if (first) loadPreset(first, { blend: 0, remember: false });
      scheduleCycle();
      trackPinned = !!S.pinTrack;
      updateTrackCard(true);
      syncControls();
      ui.stats.classList.toggle("spmd-show", !!S.showStats);
      updateBadge();
      lastTs = tickT = performance.now();
      frames = 0;
      raf = requestAnimationFrame(frame);
    } catch (e) {
      if (my !== token) return;
      warn(e);
      setLoading(null);
      showError(e);
    }
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    token++;
    cancelAnimationFrame(raf);
    raf = 0;
    [cycleTimer, idleTimer, toastTimer, trackTimer, resizeTimer].forEach(clearTimeout);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("fullscreenchange", onResize);
    if (document.fullscreenElement) Promise.resolve(document.exitFullscreen?.()).catch(() => {});
    destroyViz();
    audioStop();
    analysis = null;
    showPanel(null);
    ui.root.classList.remove("spmd-open", "spmd-idle");
    ui.error.classList.remove("spmd-show");
    setLoading(null);
  }
  function toggle() { if (isOpen) close(); else open(); }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await ui.root.requestFullscreen();
    } catch (e) { toast("Fullscreen isn't available here (the overlay already fills the Spotify window)"); }
  }

  // ---------------------------------------------------------------- track card + events
  function artUrl(item) {
    const m = item?.metadata || {};
    let u = m.image_xlarge_url || m.image_large_url || m.image_url || item?.images?.[0]?.url || "";
    if (u.startsWith("spotify:image:")) u = "https://i.scdn.co/image/" + u.slice(14);
    return u;
  }
  function updateTrackCard(flash) {
    const item = Sp.Player.data?.item || Sp.Player.data?.track;
    ui.tt.textContent = item?.name || item?.metadata?.title || "Nothing playing";
    ui.ta.textContent = item?.artists?.map((a) => a.name).join(", ") || item?.metadata?.artist_name || "";
    const u = artUrl(item);
    if (u) ui.art.src = u; else ui.art.removeAttribute("src");
    if (trackPinned) {
      ui.track.classList.add("spmd-show");
    } else if (flash && S.showTrack) {
      flashTrack();
    }
  }
  function flashTrack() {
    ui.track.classList.add("spmd-show");
    clearTimeout(trackTimer);
    trackTimer = setTimeout(() => { if (!trackPinned) ui.track.classList.remove("spmd-show"); }, 6000);
  }
  function togglePinned() {
    trackPinned = !trackPinned;
    S.pinTrack = trackPinned;
    save();
    ui.controls?.pinTrack?.(trackPinned);
    ui.track.classList.toggle("spmd-show", trackPinned);
    if (!trackPinned) clearTimeout(trackTimer);
    toast(trackPinned ? "Track card pinned" : "Track card unpinned");
  }
  Sp.Player.addEventListener("songchange", () => {
    if (!isOpen || !ui.root) return;
    loadAnalysis();
    updateTrackCard(true);
    if (S.byTrack && !locked && viz) { go(1); scheduleCycle(); }
  });
  Sp.Player.addEventListener("onplaypause", () => {
    if (isOpen && ui.play) ui.play.textContent = Sp.Player.isPlaying?.() ? "❚❚" : "▶";
  });

  // ---------------------------------------------------------------- UI
  function toast(text) {
    if (!S.showToast || !ui.toast) return;
    ui.toast.textContent = text;
    ui.toast.classList.add("spmd-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("spmd-show"), 2500);
  }
  function setLoading(text) {
    ui.loading.textContent = text || "";
    ui.loading.classList.toggle("spmd-show", !!text);
  }
  function showError(e) {
    const msg = typeof e === "string" ? e : e?.message || String(e);
    ui.errBody.textContent = msg;
    ui.error.classList.add("spmd-show");
    wakeUI();
  }
  function updateTitle() { ui.title.textContent = (locked ? "● locked · " : "") + (cur || "MilkDrop"); }
  function updateBadge() {
    if (!ui.badge) return;
    let text, warnState = false;
    if (A.mode === "device") {
      warnState = A.silent > 4000;
      text = (warnState ? "No signal · " : "Live · ") + A.label;
    } else if (A.mode === "sim") {
      text = "Simulated audio" + (A.error ? " (device failed)" : "");
      warnState = !!A.error;
    } else text = "";
    ui.badge.textContent = text;
    ui.badge.classList.toggle("spmd-warn", warnState);
    ui.badge.title = warnState && A.mode === "device"
      ? "No audio is reaching this input. Is your system output set to your loopback / Multi-Output Device?"
      : A.error || "";
  }
  function wakeUI() {
    if (!ui.root) return;
    ui.root.classList.remove("spmd-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!activePanel && !ui.error.classList.contains("spmd-show")) ui.root.classList.add("spmd-idle"); }, 3000);
    if (A.ctx?.state === "suspended") A.ctx.resume().catch(() => {});
  }
  function showPanel(name) {
    const next = activePanel === name ? null : name;
    for (const [k, n] of Object.entries(ui.panels)) n.classList.toggle("spmd-show", k === next);
    activePanel = next;
    ui.btnPresets.classList.toggle("spmd-on", next === "presets");
    ui.btnSettings.classList.toggle("spmd-on", next === "settings");
    ui.btnHelp.classList.toggle("spmd-on", next === "help");
    if (next === "settings") { syncControls(); refreshDevices(false); updateStatus(); }
    if (next === "presets") renderPresetList();
    wakeUI();
  }
  function stopEvt(e) { e.preventDefault(); e.stopPropagation(); }

  function onKey(e) {
    if (e.ctrlKey && e.shiftKey && (e.key === "M" || e.key === "m")) { stopEvt(e); toggle(); return; }
    if (!isOpen) return;
    const tag = e.target?.tagName;
    const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    if (e.key === "Escape") {
      stopEvt(e);
      if (typing) e.target.blur?.();
      if (activePanel) showPanel(null); else close();
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    wakeUI();
    switch (e.key) {
      case " ": Sp.Player.togglePlay?.(); break;
      case "ArrowRight": go(1); scheduleCycle(); break;
      case "ArrowLeft": go(-1); scheduleCycle(); break;
      case "r": case "R": randomPreset(); break;
      case "l": case "L": toggleLock(); break;
      case "f": case "F": toggleFullscreen(); break;
      case "s": case "S": showPanel("settings"); break;
      case "p": case "P": showPanel("presets"); break;
      case "i": case "I": togglePinned(); break;
      case "d": case "D": S.showStats = !S.showStats; save(); ui.stats.classList.toggle("spmd-show", S.showStats); break;
      case "v": case "V": toggleFavorite(); break;
      case "b": case "B": hideCurrent(); break;
      case "h": case "H": case "?": showPanel("help"); break;
      default: return;
    }
    stopEvt(e);
  }
  window.addEventListener("keydown", onKey, true);

  const SHORTCUTS = [
    ["Space", "Play / pause"], ["← / →", "Previous / next preset"], ["R", "Random preset"],
    ["L", "Lock current preset"], ["V", "Favorite current preset"], ["B", "Hide current preset"],
    ["P", "Preset browser"], ["S", "Settings"], ["I", "Pin / unpin track card"],
    ["D", "FPS stats"], ["F", "Fullscreen"], ["H or ?", "This help"],
    ["Esc", "Close panel, then close visualizer"], ["Ctrl+Shift+M", "Open / close (from anywhere)"],
  ];

  function renderPresetList() {
    if (!ui.pList) return;
    const q = ui.pSearch.value.trim().toLowerCase();
    const showHidden = ui.pHidden.checked;
    const fav = new Set(S.favorites), hid = new Set(S.hidden);
    const frag = document.createDocumentFragment();
    let count = 0;
    for (const name of names) {
      const isHidden = hid.has(name);
      if (isHidden && !showHidden) continue;
      if (S.favOnly && !fav.has(name)) continue;
      if (q && !name.toLowerCase().includes(q)) continue;
      const isFav = fav.has(name);
      frag.append(h("div", { class: "spmd-pr" + (name === cur ? " spmd-cur" : "") },
        h("button", { class: "spmd-pn", title: name, text: name, onclick: () => { loadPreset(name); scheduleCycle(); } }),
        h("button", {
          class: "spmd-ic" + (isFav ? " spmd-on" : ""), title: "Favorite", text: isFav ? "★" : "☆",
          onclick: () => { const i = S.favorites.indexOf(name); if (i >= 0) S.favorites.splice(i, 1); else S.favorites.push(name); save(); renderPresetList(); },
        }),
        h("button", {
          class: "spmd-ic" + (isHidden ? " spmd-on" : ""), title: isHidden ? "Unhide" : "Hide this preset", text: isHidden ? "↺" : "×",
          onclick: () => { const i = S.hidden.indexOf(name); if (i >= 0) S.hidden.splice(i, 1); else S.hidden.push(name); save(); renderPresetList(); },
        })));
      if (++count >= 500) break;
    }
    ui.pList.replaceChildren(frag);
    ui.pCount.textContent = count + " shown · " + S.favorites.length + " favorites · " + S.hidden.length + " hidden";
  }

  // ---- settings panel
  function syncControls() {
    const C = ui.controls;
    if (!C) return;
    for (const k of Object.keys(C)) C[k](S[k]);
  }
  function updateStatus() {
    if (!ui.status) return;
    let t = A.mode === "device" ? "Live input: " + A.label : "Simulated (beat-synced, not real audio)";
    if (A.error) t += "\n" + A.error;
    else if (A.mode === "device" && A.silent > 4000) t += "\nNo signal. Is system output set to your loopback / Multi-Output Device?";
    ui.status.textContent = t;
    ui.meterFill.style.width = Math.min(100, A.level * 140) + "%";
  }
  function fillSourceSelect(inputs) {
    const sel = ui.sourceSel;
    const opts = [["sim", "Simulated (no audio capture)"]];
    for (const d of inputs) {
      if (!d.label) continue;
      opts.push(["dev:" + d.deviceId, d.label + (LOOPBACK_RE.test(d.label) ? "  <- recommended" : "")]);
    }
    if (S.source.startsWith("dev:") && !opts.some(([v]) => v === S.source))
      opts.push([S.source, (S.sourceLabel || "Saved input") + " (not currently found)"]);
    sel.replaceChildren(...opts.map(([v, t]) => h("option", { value: v, text: t })));
    sel.value = S.source;
    if (sel.value !== S.source) sel.value = "sim";
  }
  async function refreshDevices(askPermission) {
    if (!navigator.mediaDevices?.enumerateDevices) { ui.devNote.textContent = "This Spotify build has no audio-input API."; return; }
    try {
      let inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
      if (askPermission && inputs.every((d) => !d.label)) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
      }
      fillSourceSelect(inputs);
      const labelled = inputs.filter((d) => d.label);
      ui.devNote.textContent = labelled.length
        ? ""
        : "Click “Find audio devices” to allow microphone access, which is how your OS exposes loopback devices like BlackHole or VB-Cable.";
    } catch (e) { ui.devNote.textContent = friendlyAudioError(e); }
  }
  function applyAll() {
    if (A.input) A.input.gain.value = S.gain;
    trackPinned = !!S.pinTrack;
    ui.track.classList.toggle("spmd-show", trackPinned);
    syncControls();
    scheduleCycle();
    ui.stats.classList.toggle("spmd-show", !!S.showStats);
    rebuildViz();
    if (A.ctx) setSource(S.source, S.sourceLabel).then(() => { updateBadge(); updateStatus(); });
  }

  function buildSettings(panel) {
    const C = (ui.controls = {});
    const row = (label, ctrl, extra) => h("div", { class: "spmd-row" }, h("label", { text: label }), ctrl, extra);
    const select = (key, label, opts, onChange) => {
      const n = h("select", { class: "spmd-in" }, opts.map(([v, t]) => h("option", { value: String(v), text: t })));
      n.addEventListener("change", () => { onChange(n.value); n.blur(); });
      C[key] = (v) => { n.value = String(v); };
      return row(label, n);
    };
    const range = (key, label, min, max, step, scale, fmt, onSet) => {
      const val = h("span", { class: "spmd-val" });
      const n = h("input", { class: "spmd-in", type: "range", min, max, step });
      const show = () => { val.textContent = fmt(+n.value); };
      n.addEventListener("input", () => { show(); onSet(+n.value / scale, false); });
      n.addEventListener("change", () => { onSet(+n.value / scale, true); n.blur(); });
      C[key] = (v) => { n.value = Math.round(v * scale * 100) / 100; show(); };
      return row(label, n, val);
    };
    const check = (key, label, onSet) => {
      const n = h("input", { type: "checkbox" });
      n.addEventListener("change", () => { onSet(n.checked); n.blur(); });
      C[key] = (v) => { n.checked = !!v; };
      return h("label", { class: "spmd-chk" }, n, " " + label);
    };

    ui.sourceSel = h("select", { class: "spmd-in" });
    ui.sourceSel.addEventListener("change", async () => {
      const v = ui.sourceSel.value;
      S.source = v;
      S.sourceLabel = v === "sim" ? "" : ui.sourceSel.selectedOptions[0].textContent.replace(/\s+<-.*$/, "").replace(/ \(not currently found\)$/, "");
      S.sourceChosen = true;
      save();
      ui.sourceSel.blur();
      await setSource(v, S.sourceLabel);
      updateBadge();
      updateStatus();
    });
    ui.devNote = h("div", { class: "spmd-note" });
    ui.status = h("div", { class: "spmd-note" });
    ui.meterFill = h("i");
    const meter = h("div", { class: "spmd-bar" }, ui.meterFill);

    panel.append(
      h("h2", { text: "Settings" }),
      h("h3", { text: "Audio" }),
      row("Source", ui.sourceSel),
      h("button", { class: "spmd-btn", text: "Find audio devices", onclick: () => refreshDevices(true) }),
      ui.devNote, ui.status, meter,
      range("gain", "Sensitivity", 0.25, 4, 0.05, 1, (v) => v.toFixed(2) + "×", (v, commit) => {
        S.gain = v;
        if (A.input) A.input.gain.setTargetAtTime(v, A.ctx.currentTime, 0.05);
        if (commit) save();
      }),
      h("h3", { text: "Performance" }),
      select("quality", "Quality", Object.entries(QUALITY).map(([k, q]) => [k, q.label]), (v) => {
        S.quality = v;
        S.renderScale = QUALITY[v].scale;
        save();
        C.renderScale(S.renderScale);
        rebuildViz();
      }),
      range("renderScale", "Render scale", 25, 100, 5, 100, (v) => Math.round(v) + "%", (v, commit) => {
        S.renderScale = clamp(v, 0.25, 1);
        if (commit) { save(); applySize(); }
      }),
      select("fps", "FPS cap", [15, 24, 30, 45, 60].map((f) => [f, f + " fps"]), (v) => { S.fps = +v; save(); }),
      check("adaptive", "Adaptive quality (lower render scale if too slow)", (v) => { S.adaptive = v; save(); }),
      h("h3", { text: "Presets" }),
      range("cycle", "Auto-change", 0, 120, 5, 1, (v) => (v === 0 ? "off" : Math.round(v) + " s"), (v, commit) => {
        S.cycle = v;
        if (commit) { save(); scheduleCycle(); }
      }),
      range("blend", "Blend time", 0, 10, 0.5, 1, (v) => v.toFixed(1) + " s", (v, commit) => { S.blend = v; if (commit) save(); }),
      check("shuffle", "Shuffle order", (v) => { S.shuffle = v; save(); }),
      check("favOnly", "Favorites only", (v) => { S.favOnly = v; save(); if (activePanel === "presets") renderPresetList(); }),
      check("byTrack", "Change preset on new track", (v) => { S.byTrack = v; save(); }),
      h("h3", { text: "Overlay" }),
      check("showTrack", "Show track card on song change", (v) => { S.showTrack = v; save(); }),
      check("pinTrack", "Always show track card", (v) => {
        S.pinTrack = v;
        trackPinned = v;
        save();
        clearTimeout(trackTimer);
        ui.track.classList.toggle("spmd-show", v);
      }),
      check("showStats", "Show FPS stats", (v) => { S.showStats = v; save(); ui.stats.classList.toggle("spmd-show", v); }),
      check("showToast", "Show preset change notification", (v) => { S.showToast = v; save(); }),
      h("button", {
        class: "spmd-btn spmd-reset", text: "Reset to defaults",
        onclick: () => {
          const keep = { favorites: S.favorites, hidden: S.hidden, lastPreset: S.lastPreset };
          S = { ...defaults(), ...keep };
          save();
          applyAll();
          toast("Settings reset");
        },
      })
    );
  }

  function buildPresetPanel(panel) {
    ui.pSearch = h("input", { class: "spmd-in", type: "search", placeholder: "Search presets…" });
    ui.pSearch.addEventListener("input", () => { clearTimeout(ui.pTimer); ui.pTimer = setTimeout(renderPresetList, 120); });
    ui.pHidden = h("input", { type: "checkbox" });
    ui.pHidden.addEventListener("change", renderPresetList);
    ui.pCount = h("div", { class: "spmd-note" });
    ui.pList = h("div", { class: "spmd-list" });
    panel.append(
      h("h2", { text: "Presets" }), ui.pSearch,
      h("label", { class: "spmd-chk" }, ui.pHidden, " Show hidden"),
      ui.pCount, ui.pList
    );
  }
  function buildHelpPanel(panel) {
    panel.append(h("h2", { text: "Shortcuts" }),
      h("table", { class: "spmd-keys" }, SHORTCUTS.map(([k, d]) => h("tr", {}, h("td", {}, h("kbd", { text: k })), h("td", { text: d })))));
  }

  const CSS = `
.spmd-root{position:fixed;inset:0;z-index:2147483000;background:#000;color:#fff;display:none;font:13px/1.4 var(--font-family,system-ui,-apple-system,sans-serif);user-select:none;overflow:hidden}
.spmd-root.spmd-open{display:block}
.spmd-root.spmd-idle{cursor:none}
.spmd-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.spmd-hud{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px;background:linear-gradient(rgba(0,0,0,.7),transparent);transition:opacity .3s}
.spmd-idle .spmd-hud{opacity:0;pointer-events:none}
.spmd-title{flex:1 1 200px;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spmd-badge{padding:3px 10px;border-radius:12px;background:rgba(255,255,255,.14);font-size:12px;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spmd-badge.spmd-warn{background:#b3541e}
.spmd-btn{background:rgba(255,255,255,.16);border:0;color:#fff;border-radius:14px;padding:5px 11px;font:inherit;cursor:pointer}
.spmd-btn:hover{background:rgba(255,255,255,.3)}
.spmd-btn.spmd-on,.spmd-ic.spmd-on{background:var(--spice-button,#1db954);color:#000}
.spmd-sep{width:1px;height:18px;background:rgba(255,255,255,.25)}
.spmd-toast{position:absolute;top:64px;left:50%;transform:translateX(-50%);z-index:6;background:rgba(0,0,0,.7);padding:8px 16px;border-radius:18px;opacity:0;transition:opacity .3s;pointer-events:none;max-width:70%;text-align:center}
.spmd-toast.spmd-show{opacity:1}
.spmd-loading{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:16px;opacity:.8}
.spmd-loading.spmd-show{display:flex}
.spmd-track{position:absolute;left:20px;bottom:20px;z-index:4;display:flex;gap:12px;align-items:center;background:rgba(0,0,0,.65);padding:10px 14px 10px 10px;border-radius:10px;width:360px;max-width:80vw;opacity:0;transition:opacity .4s;pointer-events:none}
.spmd-track.spmd-show{opacity:1}
.spmd-art{width:64px;height:64px;border-radius:6px;object-fit:cover;background:#222;flex:none}
.spmd-meta{min-width:0;flex:1}
.spmd-tt{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spmd-ta{opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spmd-bar{height:3px;background:rgba(255,255,255,.22);border-radius:2px;margin-top:8px;overflow:hidden}
.spmd-bar>i{display:block;height:100%;width:0;background:var(--spice-button,#1db954)}
.spmd-stats{position:absolute;top:64px;right:16px;z-index:4;display:none;font:12px ui-monospace,Menlo,monospace;background:rgba(0,0,0,.6);padding:6px 10px;border-radius:6px;white-space:pre}
.spmd-stats.spmd-show{display:block}
.spmd-panel{position:absolute;top:0;right:0;bottom:0;z-index:4;width:340px;max-width:92vw;box-sizing:border-box;display:none;overflow:auto;padding:60px 16px 20px;background:rgba(18,18,18,.95);user-select:text}
.spmd-panel.spmd-show{display:block}
.spmd-panel h2{margin:0 0 10px;font-size:18px}
.spmd-panel h3{margin:18px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
.spmd-row{display:grid;grid-template-columns:92px 1fr auto;gap:8px;align-items:center;margin:8px 0}
.spmd-row .spmd-in{grid-column:2}
.spmd-row label{opacity:.85}
.spmd-in{width:100%;box-sizing:border-box;background:#2a2a2a;color:#fff;border:1px solid #444;border-radius:6px;padding:5px 6px;font:inherit}
input[type=range].spmd-in{padding:0;border:0;background:none}
.spmd-val{min-width:44px;text-align:right;opacity:.8;font-variant-numeric:tabular-nums}
.spmd-chk{display:block;margin:7px 0;cursor:pointer}
.spmd-note{margin:6px 0;opacity:.75;font-size:12px;white-space:pre-wrap}
.spmd-reset{margin-top:20px}
.spmd-list{margin-top:6px}
.spmd-pr{display:flex;gap:4px;margin:2px 0;align-items:center}
.spmd-pr.spmd-cur .spmd-pn{background:rgba(255,255,255,.18);font-weight:600}
.spmd-pn{flex:1;min-width:0;text-align:left;background:none;border:0;color:#fff;padding:5px 6px;border-radius:5px;font:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.spmd-pn:hover{background:rgba(255,255,255,.12)}
.spmd-ic{background:rgba(255,255,255,.1);border:0;color:#fff;border-radius:5px;width:26px;height:26px;cursor:pointer;font:inherit}
.spmd-keys{border-collapse:collapse;width:100%}
.spmd-keys td{padding:5px 4px;vertical-align:top}
.spmd-keys kbd{background:#2a2a2a;border:1px solid #444;border-radius:4px;padding:1px 6px;font:12px ui-monospace,Menlo,monospace;white-space:nowrap}
.spmd-error{position:absolute;inset:0;z-index:7;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.85)}
.spmd-error.spmd-show{display:flex}
.spmd-errbox{max-width:620px;width:86%;background:#1c1c1c;border:1px solid #555;border-radius:12px;padding:20px 24px;user-select:text}
.spmd-errbox h2{margin:0 0 10px;font-size:18px}
.spmd-errbody{white-space:pre-wrap;word-break:break-word;margin-bottom:14px;max-height:50vh;overflow:auto}
`;

  function buildUI() {
    if (ui.root) return;
    document.head.appendChild(h("style", { id: "spmd-style", text: CSS }));

    ui.title = h("div", { class: "spmd-title", text: "MilkDrop" });
    ui.badge = h("div", { class: "spmd-badge" });
    ui.play = h("button", { class: "spmd-btn", title: "Play / pause (Space)", text: "▶", onclick: () => Sp.Player.togglePlay?.() });
    ui.btnLock = h("button", { class: "spmd-btn", title: "Lock preset (L)", text: "Lock", onclick: toggleLock });
    ui.btnPresets = h("button", { class: "spmd-btn", title: "Preset browser (P)", text: "Presets", onclick: () => showPanel("presets") });
    ui.btnSettings = h("button", { class: "spmd-btn", title: "Settings (S)", text: "Settings", onclick: () => showPanel("settings") });
    ui.btnHelp = h("button", { class: "spmd-btn", title: "Shortcuts (H)", text: "?", onclick: () => showPanel("help") });

    const hud = h("div", { class: "spmd-hud" },
      ui.title, ui.badge,
      h("button", { class: "spmd-btn", title: "Previous track", text: "◀◀", onclick: () => Sp.Player.back?.() }),
      ui.play,
      h("button", { class: "spmd-btn", title: "Next track", text: "▶▶", onclick: () => Sp.Player.next?.() }),
      h("span", { class: "spmd-sep" }),
      h("button", { class: "spmd-btn", title: "Previous preset (←)", text: "‹ Preset", onclick: () => { go(-1); scheduleCycle(); } }),
      h("button", { class: "spmd-btn", title: "Next preset (→)", text: "Preset ›", onclick: () => { go(1); scheduleCycle(); } }),
      ui.btnLock, ui.btnPresets, ui.btnSettings,
      h("button", { class: "spmd-btn", title: "Fullscreen (F)", text: "Fullscreen", onclick: toggleFullscreen }),
      ui.btnHelp,
      h("button", { class: "spmd-btn", title: "Close (Esc)", text: "✕", onclick: close })
    );

    ui.art = h("img", { class: "spmd-art", alt: "" });
    ui.tt = h("div", { class: "spmd-tt" });
    ui.ta = h("div", { class: "spmd-ta" });
    ui.progress = h("i");
    ui.track = h("div", { class: "spmd-track" }, ui.art, h("div", { class: "spmd-meta" }, ui.tt, ui.ta, h("div", { class: "spmd-bar" }, ui.progress)));

    ui.toast = h("div", { class: "spmd-toast" });
    ui.stats = h("div", { class: "spmd-stats" });
    ui.loading = h("div", { class: "spmd-loading" });
    ui.errBody = h("div", { class: "spmd-errbody" });
    ui.error = h("div", { class: "spmd-error" },
      h("div", { class: "spmd-errbox" }, h("h2", { text: "MilkDrop couldn't start" }), ui.errBody,
        h("button", { class: "spmd-btn", text: "Close", onclick: close })));

    ui.panels = { settings: h("div", { class: "spmd-panel" }), presets: h("div", { class: "spmd-panel" }), help: h("div", { class: "spmd-panel" }) };
    buildSettings(ui.panels.settings);
    buildPresetPanel(ui.panels.presets);
    buildHelpPanel(ui.panels.help);

    ui.root = h("div", { class: "spmd-root" }, ui.loading, ui.track, ui.stats, ui.panels.settings, ui.panels.presets, ui.panels.help, hud, ui.toast, ui.error);
    ui.root.addEventListener("mousemove", wakeUI);
    ui.root.addEventListener("mousedown", wakeUI);
    ui.root.addEventListener("click", (e) => { if (e.target === vizCanvas && activePanel) showPanel(null); });
    ui.root.addEventListener("dblclick", (e) => { if (e.target === vizCanvas) toggleFullscreen(); });
    document.body.appendChild(ui.root);
  }

  // ---------------------------------------------------------------- toolbar button
  const ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18h3V9H4v9zm6 0h3V4h-3v14zm6 0h3v-6h-3v6z"/></svg>';
  try {
    if (Sp.Topbar?.Button) new Sp.Topbar.Button("MilkDrop visualizer", ICON, toggle);
    else if (Sp.Playbar?.Button) new Sp.Playbar.Button("MilkDrop visualizer", ICON, toggle);
    else warn("No Topbar/Playbar button API found; use Ctrl+Shift+M.");
  } catch (e) { warn("Couldn't add the toolbar button; use Ctrl+Shift+M.", e); }
  log("ready (Ctrl+Shift+M or the topbar button)");
})();
