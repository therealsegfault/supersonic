import * as Phaser from 'phaser';

const END_CSS = `
#ce-overlay {
  position:fixed;inset:0;z-index:1000;display:flex;flex-direction:row;
  background:#0a0806;font-family:'Fira Sans',sans-serif;user-select:none;
  opacity:0;transition:opacity .5s ease;
}
#ce-overlay.ce-in{opacity:1}
#ce-overlay.ce-out{opacity:0}
#ce-headliner{
  position:absolute;top:0;left:0;right:0;height:68px;z-index:15;
  background:linear-gradient(180deg,#090704,#13100c);
  border-bottom:1px solid #1e1a14;
}
#ce-hu{
  width:42%;height:100%;background:#141416;border-right:2px solid #0a0a0b;
  position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;
}
#ce-hu::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 80% 50% at 50% 60%,rgba(255,160,40,.03) 0%,transparent 70%);
}
.ce-plate{
  position:relative;z-index:2;width:82%;
  background:linear-gradient(180deg,#202024,#1a1a1e);border-radius:10px;padding:18px 18px 16px;
  margin-top:60px;
  box-shadow:inset 0 2px 3px rgba(255,255,255,.06),inset 0 -2px 4px rgba(0,0,0,.6),
    0 8px 32px rgba(0,0,0,.7),0 2px 0 #2e2e34,0 0 0 1px #0a0a0c;
}
.ce-pio{font-family:'Arial Narrow','Arial',sans-serif;font-size:10px;font-weight:bold;
  letter-spacing:4px;color:#555;text-align:right;margin-bottom:10px;text-transform:uppercase;}
.ce-bezel{
  background:#040806;border-radius:5px;padding:12px 14px 10px;margin-bottom:10px;
  border:1px solid #121a12;box-shadow:inset 0 3px 8px rgba(0,0,0,.95);
  position:relative;overflow:hidden;
}
.ce-bezel::before{
  content:'';position:absolute;inset:0;z-index:1;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(0,0,0,.15) 3px,rgba(0,0,0,.15) 4px);
}
#ce-verdict{font-family:'VT323',monospace;font-size:34px;line-height:1;letter-spacing:3px;position:relative;z-index:2;}
#ce-verdict.ok {color:#00ff88;text-shadow:0 0 8px #00ff8899,0 0 22px #00aa4455;}
#ce-verdict.no {color:#ff3078;text-shadow:0 0 8px #ff307899,0 0 22px #aa003355;}
#ce-sub{font-family:'VT323',monospace;font-size:15px;letter-spacing:2px;color:#446644;
  position:relative;z-index:2;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ce-receipt{
  background:#0e0e10;border-radius:4px;padding:12px 14px;margin-bottom:10px;
  border:1px solid #1e1e22;box-shadow:inset 0 2px 5px rgba(0,0,0,.7);
}
.ce-score{font-family:'SuperBubble',sans-serif;font-size:30px;color:#fff;
  text-align:center;margin-bottom:8px;letter-spacing:2px;}
.ce-song{font-size:11px;color:#666;text-align:center;margin-bottom:8px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ce-row{display:flex;justify-content:space-between;margin-bottom:4px;}
.ce-stat{text-align:center;flex:1;}
.ce-sv{font-family:'SuperBubble',sans-serif;font-size:18px;display:block;}
.ce-sl{font-size:9px;color:#3a3a44;letter-spacing:2px;text-transform:uppercase;display:block;margin-top:2px;}
.ce-tl{font-size:10px;font-weight:bold;margin-bottom:5px;}
.ce-track{background:#080a08;border-radius:2px;height:4px;border:1px solid #181e18;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.9);margin-bottom:2px;}
.ce-fill{height:100%;border-radius:2px;}
.ce-prompt{font-family:'VT323',monospace;font-size:17px;letter-spacing:2px;
  color:#3a3228;text-align:center;margin-top:10px;}
.ce-tag{font-size:9px;color:#2a2a30;text-align:center;margin-top:10px;letter-spacing:1px;}
#ce-win{flex:1;height:100%;background:#0d0b09;position:relative;overflow:hidden;}
#ce-win::after{
  content:'';position:absolute;bottom:0;left:0;right:0;height:28%;z-index:5;
  background:linear-gradient(0deg,#0a0806,#131109);border-top:1px solid #1e1c16;pointer-events:none;
}
.ce-wf{
  position:absolute;top:78px;bottom:25%;left:14px;right:18px;
  border-radius:22px 22px 10px 10px;overflow:hidden;
  box-shadow:inset 0 0 0 5px #1c1810,inset 0 0 0 8px #0d0b08,0 6px 30px rgba(0,0,0,.7);
}
.ce-sky{position:absolute;inset:0;
  background:linear-gradient(180deg,#160300 0%,#601500 15%,#a83800 30%,#cc5800 45%,
    #da7018 58%,#e09035 70%,#e8aa55 82%,#f0c880 100%);}
.ce-sun{
  position:absolute;bottom:36%;left:45%;transform:translateX(-50%);
  width:48px;height:48px;border-radius:50%;
  background:radial-gradient(circle,#fffbe6 0%,#fff0a0 30%,#ffcc33 65%,#ff9900 100%);
  box-shadow:0 0 24px 8px rgba(255,180,40,.35),0 0 60px 16px rgba(255,100,0,.18);
}
.ce-bc{position:absolute;left:0;right:0;bottom:0;height:62%;overflow:hidden;}
.ce-bl{position:absolute;bottom:0;left:0;display:flex;}
.ce-bl svg{display:block;flex-shrink:0;}
.ce-far {animation:ceC 120s linear infinite;}
.ce-mid {animation:ceC  80s linear infinite;}
.ce-near{animation:ceC  50s linear infinite;}
@keyframes ceC{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.ce-glass{position:absolute;inset:0;pointer-events:none;z-index:8;}
.ce-gr{position:absolute;inset:0;
  background:linear-gradient(130deg,rgba(255,255,255,.08) 0%,rgba(255,255,255,.03) 20%,transparent 45%);}
.ce-gt{position:absolute;inset:0;background:rgba(200,140,60,.03);}
`;

function makeSeed(s) {
    s = s >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function buildSVG(svgW, svgH, { minBW, maxBW, minBH, maxBH, gapMin, gapMax, fill, win, wChance, aChance, seed }) {
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
        r.setAttribute('fill', fill); g.appendChild(r);
        if (rand() < aChance) {
            const aLen = Math.floor(rand() * 16 + 6);
            const ax = x + Math.floor(bw * (0.3 + rand() * 0.4));
            const a = document.createElementNS(NS, 'rect');
            a.setAttribute('x', ax); a.setAttribute('y', by - aLen);
            a.setAttribute('width', 2); a.setAttribute('height', aLen);
            a.setAttribute('fill', fill); g.appendChild(a);
        }
        if (win && rand() < 0.7) {
            for (let wy = by + 5; wy < svgH - 5; wy += 9) {
                for (let wx = x + 4; wx < x + bw - 6; wx += 8) {
                    if (rand() < wChance) {
                        const w = document.createElementNS(NS, 'rect');
                        w.setAttribute('x', wx); w.setAttribute('y', wy);
                        w.setAttribute('width', 4); w.setAttribute('height', 4);
                        w.setAttribute('fill', win);
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
        el.appendChild(buildSVG(900, h, { ...opts, seed: opts.seed + i * 31337 }));
    el.style.height = h + 'px';
}

export class EndScene extends Phaser.Scene {
    constructor() { super('EndScene'); }

    create(data) {
        const {
            songTitle   = 'Unknown',
            difficulty  = '',
            perfectCount = 0,
            goodCount   = 0,
            missCount   = 0,
            score       = 0,
            tuningPct   = 0,
            accuracy    = 0,
            totalNotes  = 0,
        } = data || {};

        const cleared = tuningPct >= 50;
        const accentHex = cleared ? '#00ff88' : '#ff3078';
        const accentCSS = cleared ? 'ok' : 'no';
        const fillHex   = cleared ? '#00ff88' : '#ff3078';

        // Phaser canvas backing
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2,
            this.scale.width, this.scale.height, 0x080604);

        // Inject styles
        if (!document.getElementById('ce-styles')) {
            const s = document.createElement('style');
            s.id = 'ce-styles'; s.textContent = END_CSS;
            document.head.appendChild(s);
        }

        // Build overlay
        const root = document.createElement('div');
        root.id = 'ce-overlay';
        root.innerHTML = `
          <div id="ce-headliner"></div>
          <div id="ce-hu">
            <div class="ce-plate">
              <div class="ce-pio">Pioneer  DEH-P6000</div>
              <div class="ce-bezel">
                <div id="ce-verdict" class="${accentCSS}">${cleared ? 'CLEARED' : 'NOT CLEARED'}</div>
                <div id="ce-sub">${songTitle} · ${difficulty}</div>
              </div>
              <div class="ce-receipt">
                <div class="ce-song">${songTitle} <span style="color:#2a2a30">·</span> ${difficulty}</div>
                <div class="ce-score">${score.toString().padStart(8, '0')}</div>
                <div class="ce-row">
                  <div class="ce-stat"><span class="ce-sv" style="color:#ffd700">${perfectCount}</span><span class="ce-sl">PERFECT</span></div>
                  <div class="ce-stat"><span class="ce-sv" style="color:#4488ff">${goodCount}</span><span class="ce-sl">GOOD</span></div>
                  <div class="ce-stat"><span class="ce-sv" style="color:#ff3078">${missCount}</span><span class="ce-sl">MISS</span></div>
                  <div class="ce-stat"><span class="ce-sv" style="color:#aaaaaa">${accuracy}%</span><span class="ce-sl">ACC</span></div>
                </div>
                <div class="ce-tl" style="color:${accentHex}">${tuningPct}% tuned</div>
                <div class="ce-track"><div class="ce-fill" style="width:${tuningPct}%;background:${fillHex};box-shadow:0 0 6px ${fillHex}77"></div></div>
              </div>
              <div class="ce-prompt" id="ce-prompt">PRESS ANY KEY</div>
              <div class="ce-tag">SUPERSONIC AUDIO · PROTO v0.0.1</div>
            </div>
          </div>
          <div id="ce-win">
            <div class="ce-wf">
              <div class="ce-sky"><div class="ce-sun"></div></div>
              <div class="ce-bc">
                <div class="ce-bl ce-far"  id="ce-lf"></div>
                <div class="ce-bl ce-mid"  id="ce-lm"></div>
                <div class="ce-bl ce-near" id="ce-ln"></div>
              </div>
              <div class="ce-glass"><div class="ce-gr"></div><div class="ce-gt"></div></div>
            </div>
          </div>`;
        document.body.appendChild(root);
        this._overlay = root;

        // City layers
        fillLayer(root.querySelector('#ce-lf'), 100, { minBW:14,maxBW:32,minBH:22,maxBH:56,gapMin:2,gapMax:6,  fill:'#2c1400',win:'#ff9933',wChance:.45,aChance:.15,seed:0xABCDE });
        fillLayer(root.querySelector('#ce-lm'), 160, { minBW:24,maxBW:65,minBH:55,maxBH:115,gapMin:3,gapMax:10,fill:'#190a00',win:'#ff8822',wChance:.35,aChance:.30,seed:0x12345 });
        fillLayer(root.querySelector('#ce-ln'), 220, { minBW:38,maxBW:95,minBH:95,maxBH:185,gapMin:4,gapMax:14,fill:'#0d0500',win:null,    wChance:0,  aChance:.22,seed:0xF00B  });

        // Fade in (300ms delay matches original)
        this.time.delayedCall(300, () => root.classList.add('ce-in'));

        // Prompt blink (after 1000ms, matches original)
        const prompt = root.querySelector('#ce-prompt');
        this.time.delayedCall(1000, () => {
            let vis = true;
            this._blinkInterval = setInterval(() => {
                if (!prompt) return;
                vis = !vis;
                prompt.style.opacity = vis ? '0.7' : '0.2';
            }, 900);
        });

        // Any key → fade out → SongSelectScene (800ms guard matches original)
        this.time.delayedCall(800, () => {
            this.input.keyboard.once('keydown', () => {
                clearInterval(this._blinkInterval);
                root.classList.remove('ce-in');
                root.classList.add('ce-out');
                this.time.delayedCall(520, () => {
                    root.remove();
                    document.getElementById('ce-styles')?.remove();
                    this.scene.start('SongSelectScene');
                });
            });
        });
    }
}
