import * as Phaser from 'phaser';
import { autochartFromFile } from './Autochart.js';

// ─── Background car interior CSS (behind transparent canvas) ────────────────
const SS_CSS = `
#ss-bg {
  position:fixed;inset:0;z-index:-1;display:flex;flex-direction:row;
  background:#0a0806;pointer-events:none;
  filter:blur(2.5px) brightness(0.6);
}
#ss-headliner {
  position:absolute;top:0;left:0;right:0;height:68px;z-index:5;
  background:linear-gradient(180deg,#090704,#13100c);border-bottom:1px solid #1e1a14;
}
#ss-hu {
  width:42%;height:100%;background:#141416;border-right:2px solid #0a0a0b;
  display:flex;align-items:center;justify-content:center;position:relative;
}
.ss-plate {
  position:relative;z-index:2;width:82%;
  background:linear-gradient(180deg,#202024,#1a1a1e);border-radius:10px;padding:18px 18px 16px;
  margin-top:60px;
  box-shadow:inset 0 2px 3px rgba(255,255,255,.06),0 8px 32px rgba(0,0,0,.7),0 0 0 1px #0a0a0c;
}
.ss-pio {font-family:'Arial Narrow','Arial',sans-serif;font-size:10px;font-weight:bold;
  letter-spacing:4px;color:#444;text-align:right;margin-bottom:10px;text-transform:uppercase;}
.ss-bezel {
  background:#040806;border-radius:5px;padding:10px 12px;margin-bottom:10px;
  border:1px solid #121a12;box-shadow:inset 0 3px 8px rgba(0,0,0,.95);overflow:hidden;
}
#ss-lcd {
  font-family:'VT323',monospace;font-size:22px;letter-spacing:3px;color:#00aa55;
  white-space:nowrap;overflow:hidden;
}
#ss-lcd-sub {font-family:'VT323',monospace;font-size:14px;color:#336633;letter-spacing:2px;margin-top:2px;}
.ss-lcd-scroll {display:inline-block;animation:ss-marquee 7s linear infinite;}
@keyframes ss-marquee {0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.ss-slot {background:#080808;border-radius:3px;height:22px;border:1px solid #222226;
  box-shadow:inset 0 2px 5px rgba(0,0,0,.9);margin-bottom:4px;}
.ss-knobs {display:flex;justify-content:space-around;align-items:flex-end;margin-top:10px;}
.ss-kg {display:flex;flex-direction:column;align-items:center;gap:5px;}
.ss-knob {width:34px;height:34px;border-radius:50%;
  background:radial-gradient(circle at 36% 32%,#606066 0%,#383840 40%,#1e1e22 100%);
  border:2px solid #35353c;}
.ss-kl {font-size:9px;color:#2a2a30;letter-spacing:2px;text-transform:uppercase;}
#ss-win {flex:1;height:100%;background:#0d0b09;position:relative;overflow:hidden;}
#ss-win::after {
  content:'';position:absolute;bottom:0;left:0;right:0;height:28%;z-index:5;
  background:linear-gradient(0deg,#0a0806,#131109);border-top:1px solid #1e1c16;
}
.ss-wf {
  position:absolute;top:78px;bottom:25%;left:14px;right:18px;
  border-radius:22px 22px 10px 10px;overflow:hidden;
  box-shadow:inset 0 0 0 5px #1c1810,inset 0 0 0 8px #0d0b08;
}
.ss-sky {position:absolute;inset:0;
  background:linear-gradient(180deg,#1a0400 0%,#7a1e00 12%,#c44a00 28%,#e87000 42%,
    #f59600 55%,#f8b030 65%,#faca58 75%,#fde090 86%,#fff3c0 100%);}
.ss-sun {position:absolute;bottom:38%;left:45%;transform:translateX(-50%);
  width:56px;height:56px;border-radius:50%;
  background:radial-gradient(circle,#fffbe6 0%,#fff0a0 30%,#ffcc33 65%,#ff9900 100%);
  box-shadow:0 0 30px 10px rgba(255,200,50,.5),0 0 70px 20px rgba(255,120,0,.3);}
.ss-bc {position:absolute;left:0;right:0;bottom:0;height:62%;overflow:hidden;}
.ss-bl {position:absolute;bottom:0;left:0;display:flex;}
.ss-bl svg {display:block;flex-shrink:0;}
.ss-far  {animation:ssCity 16s linear infinite;}
.ss-mid  {animation:ssCity  9s linear infinite;}
.ss-near {animation:ssCity  5s linear infinite;}
@keyframes ssCity {from{transform:translateX(0)}to{transform:translateX(-50%)}}
.ss-glass {position:absolute;inset:0;pointer-events:none;z-index:8;}
.ss-gr {position:absolute;inset:0;
  background:linear-gradient(130deg,rgba(255,255,255,.1) 0%,rgba(255,255,255,.04) 20%,transparent 45%);}
.ss-gt {position:absolute;inset:0;background:rgba(255,190,80,.04);}
`;

// ─── Building generator (same seed/logic as menu) ────────────────────────────
function makeSeed(s) {
    s = s >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function buildSkylineSVG(svgW, svgH, { minBW, maxBW, minBH, maxBH, gapMin, gapMax,
    fillColor, windowColor, windowChance, antennaChance, seed }) {
    const NS = 'http://www.w3.org/2000/svg';
    const rand = makeSeed(seed);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', svgW); svg.setAttribute('height', svgH);
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.style.cssText = 'display:block;flex-shrink:0';
    const g = document.createElementNS(NS, 'g');
    let x = 0;
    while (x < svgW + maxBW) {
        const bw = Math.floor(rand() * (maxBW - minBW) + minBW);
        const bh = Math.floor(rand() * (maxBH - minBH) + minBH);
        const by = svgH - bh;
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', by);
        r.setAttribute('width', bw); r.setAttribute('height', bh + 2);
        r.setAttribute('fill', fillColor); g.appendChild(r);
        if (rand() < antennaChance) {
            const aLen = Math.floor(rand() * 16 + 6);
            const ax = x + Math.floor(bw * (0.3 + rand() * 0.4));
            const a = document.createElementNS(NS, 'rect');
            a.setAttribute('x', ax); a.setAttribute('y', by - aLen);
            a.setAttribute('width', 2); a.setAttribute('height', aLen);
            a.setAttribute('fill', fillColor); g.appendChild(a);
        }
        if (windowColor && rand() < 0.7) {
            for (let wy = by + 5; wy < svgH - 5; wy += 9) {
                for (let wx = x + 4; wx < x + bw - 6; wx += 8) {
                    if (rand() < windowChance) {
                        const w = document.createElementNS(NS, 'rect');
                        w.setAttribute('x', wx); w.setAttribute('y', wy);
                        w.setAttribute('width', 4); w.setAttribute('height', 4);
                        w.setAttribute('fill', windowColor);
                        w.setAttribute('opacity', (0.2 + rand() * 0.5).toFixed(2));
                        g.appendChild(w);
                    }
                }
            }
        }
        x += bw + Math.floor(rand() * (gapMax - gapMin) + gapMin);
    }
    svg.appendChild(g); return svg;
}
function fillLayer(el, h, opts) {
    for (let i = 0; i < 2; i++)
        el.appendChild(buildSkylineSVG(900, h, { ...opts, seed: opts.seed + i * 31337 }));
    el.style.height = h + 'px';
}

// ─────────────────────────────────────────────────────────────────────────────
export class SongSelectScene extends Phaser.Scene {
    constructor() {
        super('SongSelectScene');
        this.songs = [];
        this.selectedSong = 0;
        this.selectedDiff = 'MEDIUM';
        this.difficulties = ['TUTORIAL', 'EZ', 'MEDIUM', 'HARD', 'EXTREME', 'EXTRA_EXTREME', '300BPM'];
        this.diffIndex = 2;
        this.flipped = false;
        this.animating = false;
    }

    async create() {
        const W = this.scale.width;
        const H = this.scale.height;
        this.cx = W / 2;
        this.cy = H / 2;

        // Reset state
        this.flipped = false;
        this.animating = false;
        this.selectedSong = 0;
        this.diffIndex = 2;
        this.selectedDiff = 'MEDIUM';
        this.tapeObjects = [];

        // Load manifest
        const res = await fetch('/charts/manifest.json');
        if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status} ${res.url}`);
        const text = await res.text();
        console.log('manifest raw:', text.slice(0, 100));
        this.manifest = JSON.parse(text);
        this.songs = [...this.manifest.songs];

        // Load imported songs from IndexedDB
        try {
            const { loadAllSongs, loadAudio } = await import('./DB.js');
            const imported = await loadAllSongs();
            const { loadVideo } = await import('./DB.js');
            for (const song of imported) {
                if (song.audio && song.audio.startsWith('idb-audio:')) {
                    const audioId = song.audio.slice(10);
                    song.audio = await loadAudio(audioId) || song.audio;
                }
                if (song.mv && song.mv.startsWith('idb-video:')) {
                    const videoId = song.mv.slice(10);
                    song.mv = await loadVideo(videoId) || song.mv;
                }
            }
            this.songs = [...this.songs, ...imported];
        } catch (e) {
            console.warn('Could not load imported songs:', e);
        }

        // Transparent canvas — DOM bg shows through
        this.game.canvas.style.backgroundColor = 'transparent';
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

        // Inject DOM car interior background
        this._injectBG();

        // Dark scrim over the blurred bg to make wallet readable
        this.add.rectangle(this.cx, this.cy, W, H, 0x000000, 0.35).setDepth(-5);

        // Draw wallet shell (sets DX/DY/DW/DH, text objects, reel coords)
        this._drawWalletShell();

        // Draw initial tape
        this.drawTapes();

        // Input
        this.input.keyboard.addCapture(['LEFT', 'RIGHT', 'UP', 'DOWN', 'ENTER', 'SPACE', 'ESCAPE']);
        this.input.keyboard.on('keydown-LEFT',   () => this.navigateSong(-1));
        this.input.keyboard.on('keydown-RIGHT',  () => this.navigateSong(1));
        this.input.keyboard.on('keydown-UP',     () => this.navigateDiff(-1));
        this.input.keyboard.on('keydown-DOWN',   () => this.navigateDiff(1));
        this.input.keyboard.on('keydown-ENTER',  () => this.confirm());
        this.input.keyboard.on('keydown-SPACE',  () => this.confirm());
        this.input.keyboard.on('keydown-ESCAPE', () => this.goBack());

        this.reelAngle = 0;
        this.cameras.main.fadeIn(400, 0, 0, 0);

        this.events.once('shutdown', () => this._teardown());
        this.events.once('destroy',  () => this._teardown());
    }

    // ── DOM background ───────────────────────────────────────────────────────
    _injectBG() {
        document.getElementById('ss-bg')?.remove();
        document.getElementById('ss-styles')?.remove();

        const style = document.createElement('style');
        style.id = 'ss-styles'; style.textContent = SS_CSS;
        document.head.appendChild(style);
        this._styleEl = style;

        const bg = document.createElement('div');
        bg.id = 'ss-bg';
        bg.innerHTML = `
          <div id="ss-headliner"></div>
          <div id="ss-hu">
            <div class="ss-plate">
              <div class="ss-pio">Pioneer  DEH-P6000</div>
              <div class="ss-bezel">
                <div id="ss-lcd">SELECT SONG</div>
                <div id="ss-lcd-sub">FREE PLAY</div>
              </div>
              <div class="ss-slot"></div>
              <div class="ss-knobs">
                <div class="ss-kg"><div class="ss-knob"></div><div class="ss-kl">VOL</div></div>
                <div class="ss-kg"><div class="ss-knob"></div><div class="ss-kl">BASS</div></div>
                <div class="ss-kg"><div class="ss-knob"></div><div class="ss-kl">TREBLE</div></div>
              </div>
            </div>
          </div>
          <div id="ss-win">
            <div class="ss-wf">
              <div class="ss-sky"><div class="ss-sun"></div></div>
              <div class="ss-bc">
                <div class="ss-bl ss-far"  id="ss-lf"></div>
                <div class="ss-bl ss-mid"  id="ss-lm"></div>
                <div class="ss-bl ss-near" id="ss-ln"></div>
              </div>
              <div class="ss-glass"><div class="ss-gr"></div><div class="ss-gt"></div></div>
            </div>
          </div>`;
        document.body.appendChild(bg);
        this._bg = bg;

        fillLayer(bg.querySelector('#ss-lf'), 100, { minBW:14,maxBW:32,minBH:22,maxBH:56,  gapMin:2,gapMax:6,  fillColor:'#2c1400',windowColor:'#ff9933',windowChance:.45,antennaChance:.15,seed:0xABCDE });
        fillLayer(bg.querySelector('#ss-lm'), 160, { minBW:24,maxBW:65,minBH:55,maxBH:115, gapMin:3,gapMax:10, fillColor:'#190a00',windowColor:'#ff8822',windowChance:.35,antennaChance:.30,seed:0x12345 });
        fillLayer(bg.querySelector('#ss-ln'), 220, { minBW:38,maxBW:95,minBH:95,maxBH:185, gapMin:4,gapMax:14, fillColor:'#0d0500',windowColor:null,     windowChance:0,   antennaChance:.22,seed:0xF00B  });
    }

    _teardown() {
        this._bg?.remove();      this._bg = null;
        this._styleEl?.remove(); this._styleEl = null;
        this.game.canvas.style.backgroundColor = '#0a0a0a';
    }

    // ── Wallet shell (replaces drawBoombox) ──────────────────────────────────
    _drawWalletShell() {
        const W = this.scale.width, H = this.scale.height;
        const PW = Math.min(W * 0.72, 720);
        const PH = Math.min(H * 0.70, 460);
        const PX = W / 2 - PW / 2;
        const PY = H / 2 - PH / 2 - 16;

        const g = this.add.graphics().setDepth(1);

        // Outer leather body
        g.fillStyle(0x1a160f);
        g.fillRoundedRect(PX - 22, PY - 22, PW + 44, PH + 44, 16);
        // Inner wallet body
        g.fillStyle(0x221c14);
        g.fillRoundedRect(PX, PY, PW, PH, 10);
        // Stitching
        g.lineStyle(1, 0x3a3020, 0.5);
        g.strokeRoundedRect(PX + 7, PY + 7, PW - 14, PH - 14, 7);

        // Visor clip at top center
        g.fillStyle(0x2a2318);
        g.fillRoundedRect(W / 2 - 30, PY - 30, 60, 16, { tl:0, tr:0, bl:4, br:4 });

        // Tape area
        this.DX = PX + 18;
        this.DY = PY + 46;
        this.DW = PW - 36;
        this.DH = PH - 100;

        // Info row at bottom of wallet
        const IY = PY + PH - 50;
        this.add.text(W / 2, IY, '', {}).setDepth(0); // placeholder, texts set below

        this.songTitleText = this.add.text(W / 2, IY, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '17px', fontStyle: 'bold', color: '#c89848',
        }).setOrigin(0.5, 0).setDepth(5);

        this.songArtistText = this.add.text(W / 2, IY + 22, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '12px', fontStyle: 'italic', color: '#7a6035',
        }).setOrigin(0.5, 0).setDepth(5);

        this.diffText = this.add.text(W / 2, IY + 40, '', {
            fontFamily: "'VT323', monospace",
            fontSize: '15px', color: '#00aa66', letterSpacing: 3,
        }).setOrigin(0.5, 0).setDepth(5);


        // Nav hint below wallet
        this.add.text(W / 2, PY + PH + 30, '← → song   ↑ ↓ difficulty   ENTER confirm   ESC back', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '12px', color: '#3a3020',
        }).setOrigin(0.5).setDepth(5);

        // Reel coords (offscreen — wallet view, not deck view)
        this.reel1X = -999; this.reel2X = -998;
        this.reelCY = -999; this.reelR = 20;
        this.reelsGfx = this.add.graphics().setDepth(0);

        // Unused but referenced by confirm() original tween
        this.tapeContainer = null;
    }

    // ── drawGrille/drawReels (minimal — reels are offscreen) ────────────────
    drawGrille() {}
    drawReels() { this.reelsGfx?.clear(); }

    // ── Tapes ────────────────────────────────────────────────────────────────
    drawTapes() {
        if (this.tapeObjects) this.tapeObjects.forEach(o => o.destroy());
        this.tapeObjects = [];

        const song = this.songs[this.selectedSong];
        if (!song) return;

        const TW = Math.min(this.DW * 0.36, 168);
        const TH = Math.round(TW * 0.64);
        const TX = this.DX + this.DW / 2 - TW / 2;
        const TY = this.DY + this.DH / 2 - TH / 2;

        const cass = this.add.graphics().setDepth(6);
        this.tapeObjects.push(cass);

        if (!this.flipped) {
            const bgColor = Phaser.Display.Color.HexStringToColor(song.label_color || '#d4a843').color;
            // Drop shadow
            cass.fillStyle(0x000000, 0.45);
            cass.fillRoundedRect(TX + 5, TY + 8, TW, TH, 6);
            // Body
            cass.fillStyle(bgColor);
            cass.fillRoundedRect(TX, TY, TW, TH, 6);
            // Top highlight
            cass.fillStyle(0xffffff, 0.07);
            cass.fillRoundedRect(TX, TY, TW, 3, { tl:6, tr:6, bl:0, br:0 });
            // Tape window
            cass.fillStyle(0x080808);
            cass.fillRoundedRect(TX + TW * 0.2, TY + TH * 0.36, TW * 0.6, TH * 0.36, 4);
            // Reel dots
            [[TX + TW * 0.34, TY + TH * 0.54], [TX + TW * 0.66, TY + TH * 0.54]].forEach(([rx, ry]) => {
                cass.fillStyle(0x222222); cass.fillCircle(rx, ry, TH * 0.1);
                cass.fillStyle(0x444444); cass.fillCircle(rx, ry, TH * 0.055);
            });
            // Sticker
            cass.fillStyle(0xffffff, 0.92);
            cass.fillRoundedRect(TX + 6, TY + 4, TW - 12, TH * 0.28, 2);

            const tc = song.label_text_color || '#3a1a00';
            const stickerW = TW - 14;
            const charsPerLine = Math.floor(stickerW / 6.5);
            const maxChars = charsPerLine * 2 - 1;
            const rawTitle = song.title || '';
            const rawArtist = song.artist || '';
            const titleStr = rawTitle.length > maxChars ? rawTitle.slice(0, maxChars) + '\u2026' : rawTitle;
            const artistStr = rawArtist.length > charsPerLine ? rawArtist.slice(0, charsPerLine - 1) + '\u2026' : rawArtist;
            const t1 = this.add.text(TX + TW / 2, TY + 5, titleStr, {
                fontFamily: "'Permanent Marker', cursive",
                fontSize: '11px', color: '#000000', align: 'center',
                wordWrap: { width: stickerW }, maxLines: 2,
            }).setOrigin(0.5, 0).setDepth(7);
            const t2 = this.add.text(TX + TW / 2, TY + TH * 0.22, artistStr, {
                fontFamily: 'Fira Sans, sans-serif',
                fontSize: '8px', fontStyle: 'italic', color: tc,
            }).setOrigin(0.5).setDepth(7);
            this.tapeObjects.push(t1, t2);

        } else {
            // Difficulty back face
            cass.fillStyle(0x1a1611);
            cass.fillRoundedRect(TX, TY, TW, TH, 6);
            cass.lineStyle(1, 0x3a3020, 0.5);
            cass.strokeRoundedRect(TX + 2, TY + 2, TW - 4, TH - 4, 5);

            const lbl = this.add.text(TX + TW / 2, TY + 8, 'DIFFICULTY', {
                fontFamily: "'VT323', monospace", fontSize: '12px',
                color: '#4a3e28', letterSpacing: 2,
            }).setOrigin(0.5, 0).setDepth(7);
            this.tapeObjects.push(lbl);

            this.difficulties.forEach((diff, idx) => {
                const sel = idx === this.diffIndex;
                const dy = TY + 26 + idx * 16;
                if (sel) { cass.fillStyle(0x00aa66, 0.22); cass.fillRect(TX + 6, dy - 1, TW - 12, 14); }
                const dt = this.add.text(TX + TW / 2, dy, diff, {
                    fontFamily: 'Fira Sans, sans-serif',
                    fontSize: sel ? '11px' : '9px', fontStyle: sel ? 'bold' : 'normal',
                    color: sel ? '#00ff88' : '#3a3020',
                }).setOrigin(0.5, 0).setDepth(7);
                this.tapeObjects.push(dt);
            });
        }

        // Neighbor tapes
        if (this.songs.length > 1) {
            const NW = TW * 0.58, NH = TH * 0.72, gap = TW * 0.14;
            const prev = this.songs[(this.selectedSong - 1 + this.songs.length) % this.songs.length];
            const next = this.songs[(this.selectedSong + 1) % this.songs.length];
            this.drawNeighborTape(TX - NW - gap, TY + (TH - NH) / 2, NW, NH, prev);
            this.drawNeighborTape(TX + TW + gap, TY + (TH - NH) / 2, NW, NH, next);
        }

        // Clear Phaser info row — info is now shown on the DOM LCD
        this.songTitleText.setText('');
        this.songArtistText.setText('');

        // Update DOM head unit LCD with title (scrolling), artist, and difficulty
        const lcd = document.getElementById('ss-lcd');
        const lcdSub = document.getElementById('ss-lcd-sub');
        if (lcd) {
            const title = song.title.toUpperCase();
            if (title.length > 14) {
                const padded = title + '\u00a0\u00a0\u00a0\u00a0\u00a0' + title;
                lcd.innerHTML = `<span class="ss-lcd-scroll">${padded}</span>`;
            } else {
                lcd.textContent = title;
            }
        }
        if (lcdSub) {
            const diffColors = { TUTORIAL:'#888888', EZ:'#44bb44', MEDIUM:'#00cc77',
                HARD:'#ffaa00', EXTREME:'#ff4444', EXTRA_EXTREME:'#ff00ff', '300BPM':'#ffffff' };
            const col = diffColors[this.difficulties[this.diffIndex]] || '#00aa66';
            const artist = (song.artist || '').toUpperCase();
            lcdSub.innerHTML = `${artist} &nbsp;<span style="color:${col};font-weight:bold">${this.difficulties[this.diffIndex]}</span>`;
        }
    }

    drawNeighborTape(x, y, w, h, song) {
        if (!song) return;
        const g = this.add.graphics().setDepth(4);
        const bgColor = Phaser.Display.Color.HexStringToColor(song.label_color || '#6a5030').color;
        g.fillStyle(bgColor, 0.3);
        g.fillRoundedRect(x, y, w, h, 4);
        // Tape window
        g.fillStyle(0x080808, 0.7);
        g.fillRoundedRect(x + w * 0.2, y + h * 0.36, w * 0.6, h * 0.32, 3);
        // Reel dots
        [[x + w * 0.34, y + h * 0.52], [x + w * 0.66, y + h * 0.52]].forEach(([rx, ry]) => {
            g.fillStyle(0x222222); g.fillCircle(rx, ry, h * 0.1);
            g.fillStyle(0x444444); g.fillCircle(rx, ry, h * 0.055);
        });
        const nChars = Math.floor((w - 8) / 5);
        const rawT = song.title || '';
        const nTitle = rawT.length > nChars ? rawT.slice(0, nChars - 1) + '\u2026' : rawT;
        const t = this.add.text(x + w / 2, y + h * 0.1, nTitle, {
            fontFamily: 'Fira Sans, sans-serif', fontSize: '8px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(5).setAlpha(0.4);
        this.tapeObjects.push(g, t);
    }

    // ── Navigation (unchanged logic) ─────────────────────────────────────────
    navigateSong(dir) {
        if (this.animating || this.flipped) return;
        this.selectedSong = (this.selectedSong + dir + this.songs.length) % this.songs.length;
        this.drawTapes();
    }

    navigateDiff(dir) {
        if (this.animating) return;
        if (!this.flipped) { this.flipTape(); return; }
        this.diffIndex = (this.diffIndex + dir + this.difficulties.length) % this.difficulties.length;
        this.selectedDiff = this.difficulties[this.diffIndex];
        this.drawTapes();
    }

    flipTape() {
        if (this.animating) return;
        this.animating = true;
        const targets = this.tapeObjects || [];
        this.tweens.add({
            targets, scaleX: 0, duration: 150, ease: 'Sine.easeIn',
            onComplete: () => {
                this.flipped = !this.flipped;
                this.drawTapes();
                this.tweens.add({
                    targets: this.tapeObjects, scaleX: 1, duration: 150, ease: 'Sine.easeOut',
                    onComplete: () => { this.animating = false; }
                });
            }
        });
    }

    // ── Confirm ───────────────────────────────────────────────────────────────
    confirm() {
        if (this.animating) return;
        if (!this.flipped) { this.flipTape(); return; }

        const song = this.songs[this.selectedSong];
        const diff = this.difficulties[this.diffIndex];
        const chartPath = song.charts[diff];

        if (!chartPath) {
            this.diffText.setText(`no chart for ${diff}`).setColor('#ff3078');
            this.time.delayedCall(1000, () => this.diffText.setText(diff).setColor('#00aa66'));
            return;
        }

        this.animating = true;

        // Tape ejects toward deck
        this.tweens.add({
            targets: this.tapeObjects,
            y: `+=${this.scale.height * 0.5}`,
            alpha: 0,
            duration: 380,
            ease: 'Sine.easeIn',
            onComplete: () => {
                this.reelSpinning = true;
                this.time.delayedCall(320, () => {
                    this._rippleTransition(() => {
                        this._teardown();
                        this.scene.start('GameScene', {
                            chartPath,
                            audioPath: song.audio,
                            songTitle: song.title,
                            artist: song.artist,
                            difficulty: diff,
                            mvPath: song.mv || null,
                        });
                    });
                });
            }
        });
    }

    _rippleTransition(onComplete) {
        const el = document.createElement('div');
        const W = window.innerWidth, H = window.innerHeight;
        const size = Math.hypot(W, H) * 2.6;
        // Originates from head unit cassette slot (left ~30%, vertical center)
        el.style.cssText = `
            position:fixed;border-radius:50%;pointer-events:none;z-index:3000;
            background:#0a0806;width:0;height:0;
            left:${W * 0.3}px;top:${H * 0.56}px;
            transform:translate(-50%,-50%);
            transition:width .72s cubic-bezier(.3,0,.15,1),height .72s cubic-bezier(.3,0,.15,1);
        `;
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.width = size + 'px'; el.style.height = size + 'px'; });
        setTimeout(() => { el.remove(); onComplete(); }, 780);
    }

    // ── Back ─────────────────────────────────────────────────────────────────
    goBack() {
        if (this.flipped) { this.flipTape(); return; }
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this._teardown();
            this.scene.start('MenuScene');
        });
    }

    update() {
        this.reelAngle += this.reelSpinning ? 0.08 : 0.015;
        // Reels are offscreen in wallet view; drawReels() is a no-op
    }
}
