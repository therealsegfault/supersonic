import * as Phaser from 'phaser';

// Convert AudioBuffer to WAV Blob for storage
function audioBufferToWavBlob(audioBuffer) {
    const numChannels = 1;
    const sampleRate  = audioBuffer.sampleRate;
    const samples     = audioBuffer.getChannelData(0);
    const buffer      = new ArrayBuffer(44 + samples.length * 2);
    const view        = new DataView(buffer);
    const writeStr    = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Car Interior Menu — CSS injected into document head
// ─────────────────────────────────────────────────────────────────────────────
const CAR_MENU_CSS = `
#car-menu-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; flex-direction: row;
  background: #0a0806;
  font-family: 'Fira Sans', sans-serif;
  user-select: none;
  animation: carMenuFadeIn 1.1s cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes carMenuFadeIn { from { opacity:0 } to { opacity:1 } }

/* headliner */
#cm-headliner {
  position:absolute; top:0; left:0; right:0; height:68px; z-index:15;
  background-image:
    repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px),
    repeating-linear-gradient(90deg,transparent 0,transparent 4px,rgba(255,255,255,.008) 4px,rgba(255,255,255,.008) 5px),
    linear-gradient(180deg,#090704,#13100c);
  border-bottom:1px solid #1e1a14;
}
#cm-headliner::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,#0d0a07,#2a2218,#2a2218,#0d0a07);
}

/* ── head unit ── */
#cm-head-unit {
  width:42%; height:100%; background:#141416; border-right:2px solid #0a0a0b;
  position:relative; display:flex; align-items:center; justify-content:center; overflow:hidden;
}
#cm-head-unit::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(ellipse 80% 50% at 50% 60%,rgba(255,160,40,.04) 0%,transparent 70%),
    repeating-linear-gradient(0deg,transparent 0,transparent 9px,rgba(255,255,255,.004) 9px,rgba(255,255,255,.004) 10px);
}
#cm-head-unit::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:35%;
  background:linear-gradient(0deg,#0d0d10,#141416); border-top:1px solid #1e1e22;
}
.cm-faceplate {
  position:relative; z-index:2; width:82%;
  background:linear-gradient(180deg,#202024,#1a1a1e); border-radius:10px; padding:18px 18px 16px;
  margin-top:60px;
  box-shadow:
    inset 0 2px 3px rgba(255,255,255,.06), inset 0 -2px 4px rgba(0,0,0,.6),
    0 8px 32px rgba(0,0,0,.7), 0 2px 0 #2e2e34, 0 0 0 1px #0a0a0c;
}
.cm-pioneer-logo {
  font-family:'Arial Narrow','Arial',sans-serif; font-size:10px; font-weight:bold;
  letter-spacing:4px; color:#666; text-align:right; margin-bottom:12px; text-transform:uppercase;
}
.cm-lcd-bezel {
  background:#06090a; border-radius:5px; padding:12px 14px 10px; margin-bottom:12px;
  border:1px solid #151818;
  box-shadow:inset 0 3px 8px rgba(0,0,0,.95),inset 0 0 0 1px rgba(0,0,0,.5);
  position:relative; overflow:hidden;
}
.cm-lcd-bezel::before {
  content:''; position:absolute; inset:0; z-index:1; pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(0,0,0,.15) 3px,rgba(0,0,0,.15) 4px);
}
.cm-lcd-option {
  font-family:'VT323',monospace; font-size:38px; line-height:1; letter-spacing:2px;
  color:#ffaa00; text-shadow:0 0 8px #ff8800cc,0 0 22px #ff550066;
  position:relative; z-index:2; transition:color .15s,text-shadow .15s;
}
.cm-lcd-freq {
  font-family:'VT323',monospace; font-size:19px; color:#cc6600;
  text-shadow:0 0 6px #ff440044; letter-spacing:1px; margin-top:3px;
  position:relative; z-index:2;
}
.cm-lcd-track {
  font-family:'VT323',monospace; font-size:16px; color:#885500; letter-spacing:1px; margin-top:1px;
  position:relative; z-index:2;
}
#cm-eq-display {
  display:flex; align-items:flex-end; gap:3px; height:22px; margin-bottom:12px; padding:0 2px;
}
.cm-eq-bar {
  flex:1; background:linear-gradient(0deg,#ff6600,#ffaa00 60%,#ffee44);
  border-radius:1px 1px 0 0; opacity:.75; min-height:2px;
}
.cm-cassette-slot {
  background:#080808; border-radius:3px; height:22px; border:1px solid #222226;
  box-shadow:inset 0 2px 5px rgba(0,0,0,.9); position:relative; overflow:hidden;
  margin-bottom:4px;
}
.cm-cassette-slot::before {
  content:''; position:absolute; top:8px; left:8%; right:8%; height:2px;
  background:linear-gradient(90deg,transparent 0%,#2a2828 20%,#3a3636 50%,#2a2828 80%,transparent);
}
.cm-slot-label {
  font-family:'VT323',monospace; font-size:12px; color:#333; text-align:right;
  letter-spacing:1px; margin-bottom:12px;
}
.cm-knobs-row { display:flex; justify-content:space-around; align-items:flex-end; }
.cm-knob-group { display:flex; flex-direction:column; align-items:center; gap:5px; }
.cm-knob {
  width:38px; height:38px; border-radius:50%;
  background:radial-gradient(circle at 36% 32%,#606066 0%,#383840 40%,#1e1e22 100%);
  border:2px solid #35353c;
  box-shadow:0 4px 10px rgba(0,0,0,.8),inset 0 1px 2px rgba(255,255,255,.08);
  position:relative;
}
.cm-knob::after {
  content:''; position:absolute; top:5px; left:50%; width:2px; height:10px;
  background:#aaa; transform:translateX(-50%); border-radius:1px;
}
.cm-knob-vol::after    { transform-origin:1px 14px; transform:translateX(-50%) rotate(-40deg); }
.cm-knob-bass::after   { transform-origin:1px 14px; transform:translateX(-50%) rotate(10deg); }
.cm-knob-treble::after { transform-origin:1px 14px; transform:translateX(-50%) rotate(-15deg); }
.cm-knob-label { font-size:9px; color:#3a3a44; letter-spacing:2px; text-transform:uppercase; }
.cm-model-tag {
  font-size:9px; color:#2a2a30; text-align:center; margin-top:12px; letter-spacing:1px;
}

/* ── window panel ── */
#cm-window-panel {
  flex:1; height:100%; background:#0d0b09; position:relative; overflow:hidden;
}
#cm-window-panel::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:28%; z-index:5;
  background:linear-gradient(0deg,#0a0806,#131109); border-top:1px solid #1e1c16; pointer-events:none;
}
.cm-window-frame {
  position:absolute; top:78px; bottom:25%; left:14px; right:18px;
  border-radius:22px 22px 10px 10px; overflow:hidden;
  box-shadow:inset 0 0 0 5px #1c1810,inset 0 0 0 8px #0d0b08,0 6px 30px rgba(0,0,0,.7);
}
.cm-sky {
  position:absolute; inset:0;
  background:linear-gradient(180deg,
    #1a0400 0%,#7a1e00 12%,#c44a00 28%,#e87000 42%,
    #f59600 55%,#f8b030 65%,#faca58 75%,#fde090 86%,#fff3c0 100%);
}
.cm-sun {
  position:absolute; bottom:38%; left:45%; transform:translateX(-50%);
  width:56px; height:56px; border-radius:50%;
  background:radial-gradient(circle,#fffbe6 0%,#fff0a0 30%,#ffcc33 65%,#ff9900 100%);
  box-shadow:0 0 30px 10px rgba(255,200,50,.5),0 0 70px 20px rgba(255,120,0,.3),0 0 120px 40px rgba(200,60,0,.15);
}
.cm-buildings-container { position:absolute; left:0; right:0; bottom:0; height:62%; overflow:hidden; }
.cm-building-layer { position:absolute; bottom:0; left:0; display:flex; will-change:transform; }
.cm-building-layer svg { display:block; flex-shrink:0; }
.cm-layer-far  { animation:cmScrollCity 28s linear infinite; }
.cm-layer-mid  { animation:cmScrollCity 16s linear infinite; }
.cm-layer-near { animation:cmScrollCity  9s linear infinite; }
@keyframes cmScrollCity { from{transform:translateX(0)} to{transform:translateX(-50%)} }
.cm-glass { position:absolute; inset:0; pointer-events:none; z-index:8; }
.cm-glass-refl {
  position:absolute; inset:0;
  background:linear-gradient(130deg,rgba(255,255,255,.1) 0%,rgba(255,255,255,.04) 20%,transparent 45%);
}
.cm-glass-tint { position:absolute; inset:0; background:rgba(255,190,80,.04); }

/* ── visor ── */
#cm-visor-section {
  position:absolute; top:0; left:50%; transform:translateX(-50%); width:460px; z-index:25;
}
.cm-visor-clip {
  width:56px; height:8px; margin:0 auto;
  background:linear-gradient(180deg,#2a2520,#1e1a15);
  border-radius:0 0 4px 4px; border:1px solid #3a3328; border-top:none;
}
.cm-visor-body {
  background:#1e1a15; border-radius:0 0 12px 12px; padding:10px 14px 14px;
  box-shadow:0 6px 24px rgba(0,0,0,.75),0 2px 6px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.04);
  background-image:
    repeating-linear-gradient(45deg,transparent 0,transparent 3px,rgba(255,255,255,.01) 3px,rgba(255,255,255,.01) 4px),
    repeating-linear-gradient(-45deg,transparent 0,transparent 3px,rgba(0,0,0,.04) 3px,rgba(0,0,0,.04) 4px),
    linear-gradient(180deg,#1e1a15,#1a1510);
}
.cm-visor-label {
  font-size:9px; letter-spacing:3px; color:#3a3228; text-align:center;
  text-transform:uppercase; margin-bottom:10px;
}
.cm-cassette-wallet { display:flex; gap:8px; justify-content:center; align-items:flex-end; padding:0 6px 4px; }
.cm-wallet-pocket { position:relative; width:78px; height:58px; flex-shrink:0; cursor:pointer; }
.cm-pocket-sleeve {
  position:absolute; bottom:0; left:0; right:0; height:26px;
  background:linear-gradient(180deg,#2a2218,#141008);
  border-radius:2px 2px 4px 4px; border:1px solid #3a2e20; border-top:none; z-index:3;
}
.cm-pocket-sleeve::before {
  content:''; position:absolute; top:3px; left:4px; right:4px; height:1px;
  border-top:1px dashed rgba(255,255,255,.06);
}
.cm-cassette {
  position:absolute; top:0; left:0; right:0; height:50px;
  background:#18140e; border-radius:4px 4px 2px 2px; border:1px solid #2e2618;
  z-index:2; overflow:hidden;
  transform:translateY(12px);
  transition:transform .35s cubic-bezier(.34,1.5,.64,1),box-shadow .3s ease,filter .3s ease;
  box-shadow:0 3px 8px rgba(0,0,0,.6);
}
.cm-cassette::before {
  content:''; position:absolute; top:0; left:4px; right:4px; height:2px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent); border-radius:1px;
}
.cm-cassette.selected {
  transform:translateY(-4px);
  box-shadow:0 0 0 1px rgba(255,200,80,.4),0 8px 24px rgba(255,150,20,.35),0 3px 10px rgba(0,0,0,.6);
  filter:brightness(1.08);
}
.cm-sticker {
  position:absolute; top:3px; left:3px; right:3px; height:24px; border-radius:2px;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; overflow:hidden;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.1);
}
.cm-sticker::after {
  content:''; position:absolute; inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.12) 0%,transparent 50%);
  border-radius:2px; pointer-events:none;
}
.cm-sticker-doodle { font-size:10px; line-height:1; position:relative; z-index:1; }
.cm-sticker-label {
  font-family:'Permanent Marker',cursive; font-size:7.5px; line-height:1.1;
  text-align:center; position:relative; z-index:1; white-space:nowrap;
}
.cm-tape-window {
  position:absolute; bottom:4px; left:50%; transform:translateX(-50%);
  width:50px; height:14px; border-radius:7px; background:#0a0806; border:1px solid #2a2218;
  display:flex; align-items:center; justify-content:space-around; padding:0 7px; overflow:hidden;
}
.cm-tape-reel {
  width:8px; height:8px; border-radius:50%; border:1.5px solid #3a3028; background:#111; position:relative;
}
.cm-tape-reel::after {
  content:''; position:absolute; top:50%; left:50%; width:2px; height:2px;
  border-radius:50%; background:#555; transform:translate(-50%,-50%);
}
.cm-tape-bridge { width:12px; height:3px; background:#2a2218; border-radius:1px; }
.cm-nav-row {
  display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding:0 2px;
}
.cm-chevron {
  background:none; border:none; color:#4a3e2e; font-size:20px; cursor:pointer;
  width:32px; height:28px; display:flex; align-items:center; justify-content:center;
  border-radius:4px; transition:color .15s,background .15s; line-height:1;
}
.cm-chevron:hover { color:#c89040; background:rgba(255,180,50,.1); }
.cm-nav-hint { font-family:'VT323',monospace; font-size:15px; color:#3a3228; letter-spacing:1px; text-align:center; }

/* bottom hint */
#cm-press-hint {
  position:absolute; bottom:22px; left:50%; transform:translateX(-50%);
  font-family:'VT323',monospace; font-size:20px; color:#4a3e2e; letter-spacing:3px;
  z-index:30; white-space:nowrap; animation:cmHintBlink 2.4s ease-in-out infinite;
}
@keyframes cmHintBlink { 0%,100%{opacity:.7} 50%{opacity:.2} }

/* LCD flash */
@keyframes cmLcdFlash {
  0%   { color:#fff; text-shadow:0 0 24px #fff,0 0 40px #ffaa00; }
  100% { color:#ffaa00; text-shadow:0 0 8px #ff8800cc,0 0 22px #ff550066; }
}
.cm-lcd-flash { animation:cmLcdFlash .25s ease-out forwards; }

/* options modal */
#cm-options-modal {
  position:fixed; inset:0; z-index:2000; display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.7);
}
.cm-modal-box {
  background:#111; border:1px solid #333; border-radius:8px; padding:32px 40px;
  min-width:340px; text-align:center; box-shadow:0 8px 40px rgba(0,0,0,.8);
}
.cm-modal-title {
  font-family:'VT323',monospace; font-size:22px; color:#555; letter-spacing:4px; margin-bottom:24px;
}
.cm-modal-btn {
  display:block; width:100%; background:none; border:none; cursor:pointer;
  font-family:'Fira Sans',sans-serif; font-size:18px; font-weight:700;
  padding:8px 0; margin-bottom:8px; border-radius:4px; transition:background .15s;
}
.cm-modal-btn:hover { background:rgba(255,255,255,.05); }
.cm-modal-hint {
  font-family:'Fira Sans',sans-serif; font-size:12px; font-style:italic;
  color:#444; margin:8px 0 16px;
}
#cm-import-status {
  font-family:'Fira Sans',sans-serif; font-size:13px; color:#888;
  min-height:18px; margin-bottom:12px; word-wrap:break-word;
}
.cm-modal-close {
  font-family:'Fira Sans',sans-serif; font-size:14px; color:#444; cursor:pointer;
  background:none; border:none; letter-spacing:1px;
  transition:color .15s;
}
.cm-modal-close:hover { color:#888; }
`;

// ─────────────────────────────────────────────────────────────────────────────
//  Building SVG generator (mirrors the mockup)
// ─────────────────────────────────────────────────────────────────────────────
function makeSeed(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function buildSkylineSVG(svgW, svgH, { minBW, maxBW, minBH, maxBH, gapMin, gapMax,
    fillColor, windowColor, windowChance, antennaChance, seed }) {
    const NS  = 'http://www.w3.org/2000/svg';
    const rand = makeSeed(seed);
    const svg  = document.createElementNS(NS, 'svg');
    svg.setAttribute('width',   svgW);
    svg.setAttribute('height',  svgH);
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.style.cssText = 'display:block;flex-shrink:0';
    const g = document.createElementNS(NS, 'g');

    let x = 0;
    while (x < svgW + maxBW) {
        const bw = Math.floor(rand() * (maxBW - minBW) + minBW);
        const bh = Math.floor(rand() * (maxBH - minBH) + minBH);
        const by = svgH - bh;

        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', x); rect.setAttribute('y', by);
        rect.setAttribute('width', bw); rect.setAttribute('height', bh + 2);
        rect.setAttribute('fill', fillColor);
        g.appendChild(rect);

        if (rand() < antennaChance) {
            const aLen = Math.floor(rand() * 16 + 6);
            const ax   = x + Math.floor(bw * (0.3 + rand() * 0.4));
            const ant  = document.createElementNS(NS, 'rect');
            ant.setAttribute('x', ax); ant.setAttribute('y', by - aLen);
            ant.setAttribute('width', 2); ant.setAttribute('height', aLen);
            ant.setAttribute('fill', fillColor);
            g.appendChild(ant);
            const dot = document.createElementNS(NS, 'rect');
            dot.setAttribute('x', ax); dot.setAttribute('y', by - aLen - 2);
            dot.setAttribute('width', 2); dot.setAttribute('height', 2);
            dot.setAttribute('fill', '#ff4400'); dot.setAttribute('opacity', '0.5');
            g.appendChild(dot);
        }

        if (windowColor && rand() < 0.7) {
            for (let wy = by + 5; wy < svgH - 5; wy += 9) {
                for (let wx = x + 4; wx < x + bw - 6; wx += 8) {
                    if (rand() < windowChance) {
                        const win = document.createElementNS(NS, 'rect');
                        win.setAttribute('x', wx); win.setAttribute('y', wy);
                        win.setAttribute('width', 4); win.setAttribute('height', 4);
                        win.setAttribute('fill', windowColor);
                        win.setAttribute('opacity', (0.2 + rand() * 0.5).toFixed(2));
                        g.appendChild(win);
                    }
                }
            }
        }
        x += bw + Math.floor(rand() * (gapMax - gapMin) + gapMin);
    }
    svg.appendChild(g);
    return svg;
}

function populateBuildingLayer(el, svgH, opts) {
    const svgW = 900;
    for (let i = 0; i < 2; i++) {
        el.appendChild(buildSkylineSVG(svgW, svgH, { ...opts, seed: opts.seed + i * 31337 }));
    }
    el.style.height = svgH + 'px';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Menu option definitions
// ─────────────────────────────────────────────────────────────────────────────
const MENU_DEFS = [
    { label: 'NEW GAME',   doodle: '🌅', stickerBg: '#e8c97a', stickerText: '#2d1a00' },
    { label: 'LOAD GAME',  doodle: '〜', stickerBg: '#7abde8', stickerText: '#001e33' },
    { label: 'CONFIG',     doodle: '⚙',  stickerBg: '#c4c4c4', stickerText: '#181818' },
    { label: 'EXIT',       doodle: '⏏',  stickerBg: '#e87a7a', stickerText: '#2d0000' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  MenuScene
// ─────────────────────────────────────────────────────────────────────────────
export class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
        this.selectedIndex = 0;
        this.optionsOpen   = false;
        this._overlay      = null;
        this._styleEl      = null;
        this._eqRAF        = null;
        this._keyHandler   = null;
    }

    preload() { /* nothing to load — menu is pure DOM */ }

    create() {
        // Black backing for Phaser canvas
        this.add.rectangle(
            this.scale.width / 2, this.scale.height / 2,
            this.scale.width, this.scale.height,
            0x000000
        );

        this._injectStyles();
        this._buildOverlay();
        this._bindKeys();

        this.cameras.main.fadeIn(600, 0, 0, 0);

        this.events.once('shutdown', () => this._teardown());
        this.events.once('destroy',  () => this._teardown());
    }

    // ── Inject CSS ───────────────────────────────────────────────────────────
    _injectStyles() {
        if (document.getElementById('car-menu-styles')) return;
        const style = document.createElement('style');
        style.id = 'car-menu-styles';
        style.textContent = CAR_MENU_CSS;
        document.head.appendChild(style);
        this._styleEl = style;
    }

    // ── Build DOM overlay ────────────────────────────────────────────────────
    _buildOverlay() {
        const root = document.createElement('div');
        root.id = 'car-menu-overlay';
        root.innerHTML = `
          <div id="cm-headliner"></div>

          <!-- Left: head unit -->
          <div id="cm-head-unit">
            <div class="cm-faceplate">
              <div class="cm-pioneer-logo">Pioneer  DEH-P6000</div>
              <div class="cm-lcd-bezel">
                <div class="cm-lcd-option" id="cm-lcd-option">${MENU_DEFS[0].label}</div>
                <div class="cm-lcd-freq">FM  88.5 MHz  ◄◄  ▶</div>
                <div class="cm-lcd-track" id="cm-lcd-track">TRACK 01 / 0${MENU_DEFS.length}</div>
              </div>
              <div id="cm-eq-display"></div>
              <div class="cm-cassette-slot"></div>
              <div class="cm-slot-label">TAPE A</div>
              <div class="cm-knobs-row">
                <div class="cm-knob-group">
                  <div class="cm-knob cm-knob-vol"></div>
                  <div class="cm-knob-label">VOL</div>
                </div>
                <div class="cm-knob-group">
                  <div class="cm-knob cm-knob-bass"></div>
                  <div class="cm-knob-label">BASS</div>
                </div>
                <div class="cm-knob-group">
                  <div class="cm-knob cm-knob-treble"></div>
                  <div class="cm-knob-label">TREBLE</div>
                </div>
              </div>
              <div class="cm-model-tag">SUPERSONIC AUDIO · PROTO v0.0.1</div>
            </div>
          </div>

          <!-- Right: window -->
          <div id="cm-window-panel">
            <div class="cm-window-frame">
              <div class="cm-sky">
                <div class="cm-sun"></div>
              </div>
              <div class="cm-buildings-container">
                <div class="cm-building-layer cm-layer-far"  id="cm-layer-far"></div>
                <div class="cm-building-layer cm-layer-mid"  id="cm-layer-mid"></div>
                <div class="cm-building-layer cm-layer-near" id="cm-layer-near"></div>
              </div>
              <div class="cm-glass">
                <div class="cm-glass-refl"></div>
                <div class="cm-glass-tint"></div>
              </div>
            </div>
          </div>

          <!-- Visor + wallet -->
          <div id="cm-visor-section">
            <div class="cm-visor-clip"></div>
            <div class="cm-visor-body">
              <div class="cm-visor-label">Cassette Organizer</div>
              <div class="cm-cassette-wallet" id="cm-cassette-wallet"></div>
              <div class="cm-nav-row">
                <button class="cm-chevron" id="cm-chevron-left"  aria-label="Previous">❮</button>
                <div class="cm-nav-hint">← → NAVIGATE  ·  ENTER CONFIRM</div>
                <button class="cm-chevron" id="cm-chevron-right" aria-label="Next">❯</button>
              </div>
            </div>
          </div>

          <div id="cm-press-hint">PRESS ENTER</div>
        `;
        document.body.appendChild(root);
        this._overlay = root;

        this._buildCassettes();
        this._buildCityLayers();
        this._startEQ();
    }

    // ── Cassette wallet ──────────────────────────────────────────────────────
    _buildCassettes() {
        const wallet = this._overlay.querySelector('#cm-cassette-wallet');
        MENU_DEFS.forEach((def, i) => {
            const pocket = document.createElement('div');
            pocket.className = 'cm-wallet-pocket';
            pocket.innerHTML = `
              <div class="cm-cassette${i === 0 ? ' selected' : ''}" id="cm-cassette-${i}">
                <div class="cm-sticker" style="background:${def.stickerBg}">
                  <span class="cm-sticker-doodle">${def.doodle}</span>
                  <span class="cm-sticker-label" style="color:${def.stickerText}">${def.label}</span>
                </div>
                <div class="cm-tape-window">
                  <div class="cm-tape-reel"></div>
                  <div class="cm-tape-bridge"></div>
                  <div class="cm-tape-reel"></div>
                </div>
              </div>
              <div class="cm-pocket-sleeve"></div>
            `;
            pocket.addEventListener('click', () => {
                if (i === this.selectedIndex) this._fireOption();
                else this._selectIndex(i);
            });
            wallet.appendChild(pocket);
        });
    }

    // ── City layers ──────────────────────────────────────────────────────────
    _buildCityLayers() {
        populateBuildingLayer(this._overlay.querySelector('#cm-layer-far'), 100, {
            minBW:14, maxBW:32, minBH:22, maxBH:56,
            gapMin:2, gapMax:6,  fillColor:'#2c1400',
            windowColor:'#ff9933', windowChance:0.45, antennaChance:0.15, seed:0xABCDE,
        });
        populateBuildingLayer(this._overlay.querySelector('#cm-layer-mid'), 160, {
            minBW:24, maxBW:65, minBH:55, maxBH:115,
            gapMin:3, gapMax:10, fillColor:'#190a00',
            windowColor:'#ff8822', windowChance:0.35, antennaChance:0.30, seed:0x12345,
        });
        populateBuildingLayer(this._overlay.querySelector('#cm-layer-near'), 220, {
            minBW:38, maxBW:95, minBH:95, maxBH:185,
            gapMin:4, gapMax:14, fillColor:'#0d0500',
            windowColor:null,    windowChance:0,    antennaChance:0.22, seed:0xF00B,
        });
    }

    // ── EQ animation ─────────────────────────────────────────────────────────
    _startEQ() {
        const container = this._overlay.querySelector('#cm-eq-display');
        const bars = [];
        for (let i = 0; i < 13; i++) {
            const b = document.createElement('div');
            b.className = 'cm-eq-bar';
            b.style.cssText = 'flex:1;height:30%';
            container.appendChild(b);
            bars.push(b);
        }
        let t = 0;
        const tick = () => {
            if (!this._overlay) return;
            t += 0.07;
            bars.forEach((bar, i) => {
                const h = 15 + 68 * (
                    0.5
                    + 0.35 * Math.sin(t * 1.4  + i * 0.65)
                    + 0.15 * Math.sin(t * 2.3  + i * 1.1 )
                    + 0.10 * Math.sin(t * 0.45 + i * 0.3 )
                );
                bar.style.height = h + '%';
            });
            this._eqRAF = requestAnimationFrame(tick);
        };
        this._eqRAF = requestAnimationFrame(tick);
    }

    // ── Keyboard ─────────────────────────────────────────────────────────────
    _bindKeys() {
        this.input.keyboard.addCapture(['LEFT', 'RIGHT', 'ENTER', 'SPACE', 'ESCAPE']);
        this.input.keyboard.on('keydown-LEFT',   () => this.navigate(-1));
        this.input.keyboard.on('keydown-RIGHT',  () => this.navigate( 1));
        this.input.keyboard.on('keydown-ENTER',  () => this._fireOption());
        this.input.keyboard.on('keydown-SPACE',  () => this._fireOption());
        this.input.keyboard.on('keydown-ESCAPE', () => { if (this.optionsOpen) this.hideOptionsPanel(); });

        // Chevrons
        this._overlay.querySelector('#cm-chevron-left') .addEventListener('click', () => this.navigate(-1));
        this._overlay.querySelector('#cm-chevron-right').addEventListener('click', () => this.navigate( 1));
    }

    // ── Navigation ───────────────────────────────────────────────────────────
    navigate(dir) {
        this._selectIndex(this.selectedIndex + dir);
    }

    _selectIndex(idx) {
        this._overlay?.querySelector(`#cm-cassette-${this.selectedIndex}`)?.classList.remove('selected');
        this.selectedIndex = ((idx % MENU_DEFS.length) + MENU_DEFS.length) % MENU_DEFS.length;
        this._overlay?.querySelector(`#cm-cassette-${this.selectedIndex}`)?.classList.add('selected');

        const def = MENU_DEFS[this.selectedIndex];
        const lcdEl = this._overlay?.querySelector('#cm-lcd-option');
        if (lcdEl) {
            lcdEl.textContent = def.label;
            // Flicker
            lcdEl.classList.remove('cm-lcd-flash');
            void lcdEl.offsetWidth;
        }
        const trackEl = this._overlay?.querySelector('#cm-lcd-track');
        if (trackEl) trackEl.textContent = `TRACK 0${this.selectedIndex + 1} / 0${MENU_DEFS.length}`;
    }

    // ── Fire selected option ─────────────────────────────────────────────────
    _fireOption() {
        const lcdEl = this._overlay?.querySelector('#cm-lcd-option');
        if (lcdEl) {
            lcdEl.classList.remove('cm-lcd-flash');
            void lcdEl.offsetWidth;
            lcdEl.classList.add('cm-lcd-flash');
        }

        switch (this.selectedIndex) {
            case 0: // NEW GAME
            case 1: // LOAD GAME
                this.startGame();
                break;
            case 2: // CONFIG
                this.toggleOptions();
                break;
            case 3: // EXIT
                // No-op in browser context
                break;
        }
    }

    // ── Transition to song select ────────────────────────────────────────────
    startGame() {
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this._teardown();
            this.scene.start('SongSelectScene');
        });
    }

    // ── Options panel (DOM modal) ─────────────────────────────────────────────
    toggleOptions() {
        this.optionsOpen ? this.hideOptionsPanel() : this.showOptionsPanel();
    }

    showOptionsPanel() {
        if (this.optionsOpen) return;
        this.optionsOpen = true;

        const modal = document.createElement('div');
        modal.id = 'cm-options-modal';
        modal.innerHTML = `
          <div class="cm-modal-box">
            <div class="cm-modal-title">OPTIONS</div>
            <button class="cm-modal-btn" id="cm-import-btn"    style="color:#00ff88">[ IMPORT SONG ]</button>
            <button class="cm-modal-btn" id="cm-import-mv-btn" style="color:#ff44aa">[ IMPORT MV ]</button>
            <div class="cm-modal-hint">import an mp3 and autochart it</div>
            <div id="cm-import-status"></div>
            <button class="cm-modal-close" id="cm-modal-close">[ CLOSE ]</button>
          </div>
        `;
        document.body.appendChild(modal);
        this._optModal = modal;

        this.importStatus = modal.querySelector('#cm-import-status');
        modal.querySelector('#cm-import-btn')   .addEventListener('click', () => this.triggerImport());
        modal.querySelector('#cm-import-mv-btn').addEventListener('click', () => this.triggerImportMV());
        modal.querySelector('#cm-modal-close')  .addEventListener('click', () => this.hideOptionsPanel());
    }

    hideOptionsPanel() {
        this.optionsOpen = false;
        this._optModal?.remove();
        this._optModal = null;
    }

    // ── Import song ───────────────────────────────────────────────────────────
    triggerImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/mpeg,audio/mp3,.mp3,audio/flac,.flac,audio/x-flac';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this.importStatus.textContent = 'reading metadata...';
            this.importStatus.style.color = '#ffdd00';

            try {
                const { autochartFromFile } = await import('./Autochart.js');
                const { saveChart, saveSong, saveAudio } = await import('./DB.js');
                const { parseBlob } = await import('music-metadata-browser');
                const difficulties = ['EZ', 'NORMAL', 'HARD'];
                const charts = {};

                let songTitle = file.name.replace(/\.[^/.]+$/, '');
                let artist = 'imported';
                let detectedBpm = null;

                try {
                    const meta = await parseBlob(file);
                    if (meta.common.title)  songTitle   = meta.common.title;
                    if (meta.common.artist) artist      = meta.common.artist;
                    if (meta.common.bpm)    detectedBpm = Math.round(meta.common.bpm);
                } catch (metaErr) { console.warn('Could not read metadata:', metaErr); }

                let bpmFinal = detectedBpm;
                if (!bpmFinal) {
                    const bpmStr = window.prompt(`BPM for "${songTitle}"? (check tunebat.com)`);
                    bpmFinal = parseFloat(bpmStr);
                } else {
                    const confirm = window.prompt(
                        `Detected BPM: ${bpmFinal} for "${songTitle}". Press OK to use or enter a different BPM.`,
                        detectedBpm
                    );
                    if (confirm && !isNaN(parseFloat(confirm))) bpmFinal = parseFloat(confirm);
                }

                if (!bpmFinal || isNaN(bpmFinal)) {
                    this.importStatus.textContent = 'cancelled';
                    this.importStatus.style.color = '#ff3078';
                    return;
                }

                const songName = songTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                for (const diff of difficulties) {
                    const chart = await autochartFromFile(file, bpmFinal, diff, (p) => {
                        const pct = typeof p === 'number' ? ` ${Math.round(p * 100)}%` : '';
                        this.importStatus.textContent = `charting ${diff}...${pct}`;
                        this.importStatus.style.color = '#ffdd00';
                    });
                    const chartId = `${songName}_${diff}`;
                    await saveChart(chartId, chart);
                    charts[diff] = `idb:${chartId}`;
                }

                this.importStatus.textContent = 'saving audio...';
                this.importStatus.style.color = '#ffdd00';
                await saveAudio(songName, file);

                const song = {
                    id: songName, title: songTitle, artist,
                    audio: `idb-audio:${songName}`, charts,
                    label_color: '#4488ff', label_text_color: '#ffffff', _imported: true,
                };
                await saveSong(song);
                this.importStatus.textContent = '✓ saved! go to song select';
                this.importStatus.style.color = '#00ff88';

            } catch (err) {
                console.error(err);
                this.importStatus.textContent = 'something went wrong';
                this.importStatus.style.color = '#ff3078';
            }
            document.body.removeChild(input);
        };
        input.click();
    }

    // ── Import MV ─────────────────────────────────────────────────────────────
    async triggerImportMV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/mp4,video/webm,.mp4,.webm';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this.importStatus.textContent = 'reading video metadata...';
            this.importStatus.style.color = '#ffdd00';

            let songTitle = file.name.replace(/\.[^/.]+$/, '');
            let artist = 'imported';
            let detectedBpm = null;

            try {
                const { parseBlob } = await import('music-metadata-browser');
                const meta = await parseBlob(file);
                if (meta.common.title)  songTitle   = meta.common.title;
                if (meta.common.artist) artist      = meta.common.artist;
                if (meta.common.bpm)    detectedBpm = Math.round(meta.common.bpm);
            } catch (e) { console.warn('No metadata in video:', e); }

            const bpmStr = window.prompt(
                `BPM for "${songTitle}"?${detectedBpm ? ` (detected: ${detectedBpm})` : ' (check tunebat.com)'}`,
                detectedBpm || ''
            );
            const bpmFinal = parseFloat(bpmStr);
            if (!bpmFinal || isNaN(bpmFinal)) {
                this.importStatus.textContent = 'cancelled';
                this.importStatus.style.color = '#ff3078';
                document.body.removeChild(input);
                return;
            }

            try {
                const { autochartFromFile } = await import('./Autochart.js');
                const { saveChart, saveSong, saveAudio, saveVideo } = await import('./DB.js');

                const songName = songTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                const difficulties = ['EZ', 'NORMAL', 'HARD'];
                const charts = {};

                this.importStatus.textContent = 'extracting audio...';
                this.importStatus.style.color = '#ffdd00';
                const arrayBuffer = await file.arrayBuffer();
                const audioCtx    = new AudioContext();
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
                await audioCtx.close();

                const wavBlob  = audioBufferToWavBlob(audioBuffer);
                const audioFile = new File([wavBlob], `${songName}.wav`, { type: 'audio/wav' });

                for (const diff of difficulties) {
                    const chart = await autochartFromFile(audioFile, bpmFinal, diff, (p) => {
                        const pct = typeof p === 'number' ? ` ${Math.round(p * 100)}%` : '';
                        this.importStatus.textContent = `charting ${diff}...${pct}`;
                        this.importStatus.style.color = '#ffdd00';
                    });
                    const chartId = `${songName}_${diff}`;
                    await saveChart(chartId, chart);
                    charts[diff] = `idb:${chartId}`;
                }

                this.importStatus.textContent = 'saving audio...';
                await saveAudio(songName, audioFile);
                this.importStatus.textContent = 'saving video...';
                await import('./DB.js').then(({ saveVideo }) => saveVideo(songName, file));

                const song = {
                    id: songName, title: songTitle, artist,
                    audio: `idb-audio:${songName}`, mv: `idb-video:${songName}`, charts,
                    label_color: '#ff44aa', label_text_color: '#ffffff', _imported: true,
                };
                await saveSong(song);
                this.importStatus.textContent = '✓ MV imported! go to song select';
                this.importStatus.style.color = '#00ff88';

            } catch (err) {
                console.error(err);
                this.importStatus.textContent = 'something went wrong';
                this.importStatus.style.color = '#ff3078';
            }
            document.body.removeChild(input);
        };
        input.click();
    }

    // ── Teardown ──────────────────────────────────────────────────────────────
    _teardown() {
        if (this._eqRAF) { cancelAnimationFrame(this._eqRAF); this._eqRAF = null; }
        this._overlay?.remove();   this._overlay  = null;
        this._optModal?.remove();  this._optModal = null;
        this._styleEl?.remove();   this._styleEl  = null;
    }

    update() { /* all animation is CSS/rAF driven */ }
}
