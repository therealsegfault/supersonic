import * as Phaser from 'phaser';

// ─────────────────────────────────────────────────────────────────────────────
//  Car Boot CSS — same interior shell as MenuScene, green VFD boot palette
// ─────────────────────────────────────────────────────────────────────────────
const CAR_BOOT_CSS = `
#car-boot-overlay {
  position:fixed; inset:0; z-index:1000;
  display:flex; flex-direction:row;
  background:#0a0806;
  font-family:'Fira Sans',sans-serif;
  user-select:none;
  opacity:1; transition:opacity .6s ease;
}
#car-boot-overlay.cb-fade-out { opacity:0; }

#cb-headliner {
  position:absolute; top:0; left:0; right:0; height:68px; z-index:15;
  background-image:
    repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px),
    repeating-linear-gradient(90deg,transparent 0,transparent 4px,rgba(255,255,255,.008) 4px,rgba(255,255,255,.008) 5px),
    linear-gradient(180deg,#090704,#13100c);
  border-bottom:1px solid #1e1a14;
}
#cb-headliner::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,#0d0a07,#2a2218,#2a2218,#0d0a07);
}

#cb-head-unit {
  width:42%; height:100%; background:#141416; border-right:2px solid #0a0a0b;
  position:relative; display:flex; align-items:center; justify-content:center; overflow:hidden;
}
#cb-head-unit::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(ellipse 80% 50% at 50% 60%,rgba(255,160,40,.04) 0%,transparent 70%),
    repeating-linear-gradient(0deg,transparent 0,transparent 9px,rgba(255,255,255,.004) 9px,rgba(255,255,255,.004) 10px);
}
#cb-head-unit::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:35%;
  background:linear-gradient(0deg,#0d0d10,#141416); border-top:1px solid #1e1e22;
}
.cb-faceplate {
  position:relative; z-index:2; width:82%;
  background:linear-gradient(180deg,#202024,#1a1a1e); border-radius:10px; padding:18px 18px 16px;
  margin-top:60px;
  box-shadow:
    inset 0 2px 3px rgba(255,255,255,.06), inset 0 -2px 4px rgba(0,0,0,.6),
    0 8px 32px rgba(0,0,0,.7), 0 2px 0 #2e2e34, 0 0 0 1px #0a0a0c;
}
.cb-pioneer-logo {
  font-family:'Arial Narrow','Arial',sans-serif; font-size:10px; font-weight:bold;
  letter-spacing:4px; color:#666; text-align:right; margin-bottom:12px; text-transform:uppercase;
}
.cb-lcd-bezel {
  background:#040806; border-radius:5px; padding:14px 14px 12px; margin-bottom:10px;
  border:1px solid #121a12;
  box-shadow:inset 0 3px 8px rgba(0,0,0,.95),inset 0 0 0 1px rgba(0,0,0,.5);
  position:relative; overflow:hidden;
}
.cb-lcd-bezel::before {
  content:''; position:absolute; inset:0; z-index:1; pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(0,0,0,.15) 3px,rgba(0,0,0,.15) 4px);
}
#cb-lcd-main {
  font-family:'VT323',monospace; font-size:38px; line-height:1; letter-spacing:3px;
  color:#001a00; position:relative; z-index:2; min-height:42px;
}
#cb-lcd-main.cb-lit {
  color:#00ff88; text-shadow:0 0 8px #00ff8899,0 0 24px #00aa4455;
}
#cb-lcd-sub {
  font-family:'VT323',monospace; font-size:17px; letter-spacing:2px;
  color:#001a00; position:relative; z-index:2; margin-top:4px;
}
#cb-lcd-sub.cb-lit {
  color:#00bb55; text-shadow:0 0 6px #00aa4444;
}

.cb-progress-track {
  background:#080a08; border-radius:2px; height:4px; margin-bottom:14px;
  border:1px solid #181e18; overflow:hidden;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.9);
}
#cb-progress-fill {
  height:100%; width:0%;
  background:linear-gradient(90deg,#006633,#00ff88);
  border-radius:2px;
  box-shadow:0 0 7px #00ff8877;
}

.cb-cassette-slot {
  background:#080808; border-radius:3px; height:22px; border:1px solid #222226;
  box-shadow:inset 0 2px 5px rgba(0,0,0,.9); position:relative; overflow:hidden; margin-bottom:4px;
}
.cb-cassette-slot::before {
  content:''; position:absolute; top:8px; left:8%; right:8%; height:2px;
  background:linear-gradient(90deg,transparent,#2a2828 20%,#3a3636 50%,#2a2828 80%,transparent);
}
.cb-slot-label {
  font-family:'VT323',monospace; font-size:12px; color:#333; text-align:right;
  letter-spacing:1px; margin-bottom:12px;
}
.cb-knobs-row { display:flex; justify-content:space-around; align-items:flex-end; }
.cb-knob-group { display:flex; flex-direction:column; align-items:center; gap:5px; }
.cb-knob {
  width:38px; height:38px; border-radius:50%;
  background:radial-gradient(circle at 36% 32%,#606066 0%,#383840 40%,#1e1e22 100%);
  border:2px solid #35353c;
  box-shadow:0 4px 10px rgba(0,0,0,.8),inset 0 1px 2px rgba(255,255,255,.08);
  position:relative;
}
.cb-knob::after {
  content:''; position:absolute; top:5px; left:50%; width:2px; height:10px;
  background:#aaa; transform:translateX(-50%); border-radius:1px;
}
.cb-knob-vol::after    { transform-origin:1px 14px; transform:translateX(-50%) rotate(-40deg); }
.cb-knob-bass::after   { transform-origin:1px 14px; transform:translateX(-50%) rotate(10deg); }
.cb-knob-treble::after { transform-origin:1px 14px; transform:translateX(-50%) rotate(-15deg); }
.cb-knob-label { font-size:9px; color:#3a3a44; letter-spacing:2px; text-transform:uppercase; }
.cb-model-tag  { font-size:9px; color:#2a2a30; text-align:center; margin-top:12px; letter-spacing:1px; }

#cb-window-panel {
  flex:1; height:100%; background:#0d0b09; position:relative; overflow:hidden;
}
#cb-window-panel::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:28%; z-index:5;
  background:linear-gradient(0deg,#0a0806,#131109); border-top:1px solid #1e1c16; pointer-events:none;
}
.cb-window-frame {
  position:absolute; top:78px; bottom:25%; left:14px; right:18px;
  border-radius:22px 22px 10px 10px; overflow:hidden;
  box-shadow:inset 0 0 0 5px #1c1810,inset 0 0 0 8px #0d0b08,0 6px 30px rgba(0,0,0,.7);
}
.cb-sky {
  position:absolute; inset:0;
  background:linear-gradient(180deg,
    #1a0400 0%,#7a1e00 12%,#c44a00 28%,#e87000 42%,
    #f59600 55%,#f8b030 65%,#faca58 75%,#fde090 86%,#fff3c0 100%);
}
.cb-sun {
  position:absolute; bottom:38%; left:45%; transform:translateX(-50%);
  width:56px; height:56px; border-radius:50%;
  background:radial-gradient(circle,#fffbe6 0%,#fff0a0 30%,#ffcc33 65%,#ff9900 100%);
  box-shadow:0 0 30px 10px rgba(255,200,50,.5),0 0 70px 20px rgba(255,120,0,.3),0 0 120px 40px rgba(200,60,0,.15);
}
.cb-buildings-container { position:absolute; left:0; right:0; bottom:0; height:62%; overflow:hidden; }
.cb-building-layer { position:absolute; bottom:0; left:0; display:flex; will-change:transform; }
.cb-building-layer svg { display:block; flex-shrink:0; }
/* Car is parked — city barely drifts */
.cb-layer-far  { animation:cbScrollCity 90s linear infinite; }
.cb-layer-mid  { animation:cbScrollCity 55s linear infinite; }
.cb-layer-near { animation:cbScrollCity 32s linear infinite; }
@keyframes cbScrollCity { from{transform:translateX(0)} to{transform:translateX(-50%)} }
.cb-glass { position:absolute; inset:0; pointer-events:none; z-index:8; }
.cb-glass-refl {
  position:absolute; inset:0;
  background:linear-gradient(130deg,rgba(255,255,255,.1) 0%,rgba(255,255,255,.04) 20%,transparent 45%);
}
.cb-glass-tint { position:absolute; inset:0; background:rgba(255,190,80,.04); }
`;

// ─────────────────────────────────────────────────────────────────────────────
//  Building SVG generator (identical to MenuScene)
// ─────────────────────────────────────────────────────────────────────────────
function makeSeed(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function buildSkylineSVG(svgW, svgH, { minBW, maxBW, minBH, maxBH, gapMin, gapMax,
    fillColor, windowColor, windowChance, antennaChance, seed }) {
    const NS   = 'http://www.w3.org/2000/svg';
    const rand = makeSeed(seed);
    const svg  = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', svgW); svg.setAttribute('height', svgH);
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
            ant.setAttribute('fill', fillColor); g.appendChild(ant);
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
    for (let i = 0; i < 2; i++)
        el.appendChild(buildSkylineSVG(svgW, svgH, { ...opts, seed: opts.seed + i * 31337 }));
    el.style.height = svgH + 'px';
}

// ─────────────────────────────────────────────────────────────────────────────
//  BootScene
// ─────────────────────────────────────────────────────────────────────────────
export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
        this._overlay = null;
        this._styleEl = null;
        this._transitioning = false;
    }

    preload() {
        // Preload assets here as they're added
        // this.load.audio('tellmeyouknow', '/src/assets/audio/tellmeyouknow.mp3');
    }

    create() {
        // Phaser canvas sits behind the DOM overlay
        this.add.rectangle(
            this.scale.width / 2, this.scale.height / 2,
            this.scale.width, this.scale.height,
            0x000000
        );
        this._injectStyles();
        this._buildOverlay();
        this._bootSequence();
    }

    _injectStyles() {
        const style = document.createElement('style');
        style.id = 'car-boot-styles';
        style.textContent = CAR_BOOT_CSS;
        document.head.appendChild(style);
        this._styleEl = style;
    }

    _buildOverlay() {
        const root = document.createElement('div');
        root.id = 'car-boot-overlay';
        root.innerHTML = `
          <div id="cb-headliner"></div>

          <div id="cb-head-unit">
            <div class="cb-faceplate">
              <div class="cb-pioneer-logo">Pioneer  DEH-P6000</div>
              <div class="cb-lcd-bezel">
                <div id="cb-lcd-main">........</div>
                <div id="cb-lcd-sub"></div>
              </div>
              <div class="cb-progress-track">
                <div id="cb-progress-fill"></div>
              </div>
              <div class="cb-cassette-slot"></div>
              <div class="cb-slot-label">TAPE A</div>
              <div class="cb-knobs-row">
                <div class="cb-knob-group">
                  <div class="cb-knob cb-knob-vol"></div>
                  <div class="cb-knob-label">VOL</div>
                </div>
                <div class="cb-knob-group">
                  <div class="cb-knob cb-knob-bass"></div>
                  <div class="cb-knob-label">BASS</div>
                </div>
                <div class="cb-knob-group">
                  <div class="cb-knob cb-knob-treble"></div>
                  <div class="cb-knob-label">TREBLE</div>
                </div>
              </div>
              <div class="cb-model-tag">SUPERSONIC AUDIO · PROTO v0.0.1</div>
            </div>
          </div>

          <div id="cb-window-panel">
            <div class="cb-window-frame">
              <div class="cb-sky">
                <div class="cb-sun"></div>
              </div>
              <div class="cb-buildings-container">
                <div class="cb-building-layer cb-layer-far"  id="cb-layer-far"></div>
                <div class="cb-building-layer cb-layer-mid"  id="cb-layer-mid"></div>
                <div class="cb-building-layer cb-layer-near" id="cb-layer-near"></div>
              </div>
              <div class="cb-glass">
                <div class="cb-glass-refl"></div>
                <div class="cb-glass-tint"></div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(root);
        this._overlay = root;
        this._buildCityLayers();
    }

    _buildCityLayers() {
        populateBuildingLayer(this._overlay.querySelector('#cb-layer-far'), 100, {
            minBW:14, maxBW:32, minBH:22, maxBH:56,
            gapMin:2, gapMax:6,  fillColor:'#2c1400',
            windowColor:'#ff9933', windowChance:0.45, antennaChance:0.15, seed:0xABCDE,
        });
        populateBuildingLayer(this._overlay.querySelector('#cb-layer-mid'), 160, {
            minBW:24, maxBW:65, minBH:55, maxBH:115,
            gapMin:3, gapMax:10, fillColor:'#190a00',
            windowColor:'#ff8822', windowChance:0.35, antennaChance:0.30, seed:0x12345,
        });
        populateBuildingLayer(this._overlay.querySelector('#cb-layer-near'), 220, {
            minBW:38, maxBW:95, minBH:95, maxBH:185,
            gapMin:4, gapMax:14, fillColor:'#0d0500',
            windowColor:null, windowChance:0, antennaChance:0.22, seed:0xF00B,
        });
    }

    _bootSequence() {
        const lcdMain = this._overlay.querySelector('#cb-lcd-main');
        const lcdSub  = this._overlay.querySelector('#cb-lcd-sub');
        const fill    = this._overlay.querySelector('#cb-progress-fill');

        const FLICKER_CHARS = '░▒▓█▄▀■□▪▫';
        let flickerCount = 0;

        // Phase 1 — LCD flickers on
        this.time.delayedCall(300, () => {
            this.time.addEvent({
                delay: 80, repeat: 8,
                callback: () => {
                    let str = '';
                    for (let i = 0; i < 8; i++)
                        str += FLICKER_CHARS[Phaser.Math.Between(0, FLICKER_CHARS.length - 1)];
                    lcdMain.textContent = str;
                    lcdMain.className = (flickerCount++ % 2 === 0) ? 'cb-lit' : '';
                }
            });

            // Phase 2 — settle on SUPERSONIC
            this.time.delayedCall(800, () => {
                lcdMain.textContent = 'SUPERSONIC';
                lcdMain.className = 'cb-lit';
                lcdSub.textContent = 'loading...';
                lcdSub.className = 'cb-lit';

                // Phase 3 — fill progress bar over minimum duration
                const minDuration = 1800;
                const startTime = this.time.now;

                this.time.addEvent({
                    delay: 16, repeat: -1,
                    callback: () => {
                        if (!this._overlay) return;
                        const progress = Math.min(1, (this.time.now - startTime) / minDuration);
                        fill.style.width = (progress * 100) + '%';
                        if (progress >= 1) this.transitionToMenu();
                    }
                });
            });
        });
    }

    transitionToMenu() {
        if (this._transitioning) return;
        this._transitioning = true;

        const lcdSub = this._overlay?.querySelector('#cb-lcd-sub');
        if (lcdSub) lcdSub.textContent = 'ready.';

        this.time.delayedCall(400, () => {
            // Fade out the overlay via CSS transition
            if (this._overlay) this._overlay.classList.add('cb-fade-out');
            this.time.delayedCall(620, () => {
                this._teardown();
                this.scene.start('MenuScene');
            });
        });
    }

    _teardown() {
        this._overlay?.remove();  this._overlay = null;
        this._styleEl?.remove();  this._styleEl = null;
    }

    update() { /* all animation is CSS-driven */ }
}
