import * as Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Preload assets here as they're added
        // this.load.audio('tellmeyouknow', '/src/assets/audio/tellmeyouknow.mp3');
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        // ── Black background ──
        this.add.rectangle(cx, cy, W, H, 0x000000).setDepth(-100);

        // ── Boombox body — simplified boot version ──
        const BW = 480;
        const BH = 200;
        const BX = cx - BW / 2;
        const BY = cy - BH / 2;

        const body = this.add.graphics();
        body.fillStyle(0xc8c8c8);
        body.fillRoundedRect(BX, BY, BW, BH, 14);
        body.fillStyle(0xe8e8e8);
        body.fillRoundedRect(BX, BY, BW, 5, { tl: 14, tr: 14, bl: 0, br: 0 });
        body.fillStyle(0x909090);
        body.fillRoundedRect(BX, BY + BH - 5, BW, 5, { tl: 0, tr: 0, bl: 14, br: 14 });

        // Speaker grilles
        this.drawMiniGrille(BX + 12, BY + 20, 90, BH - 40);
        this.drawMiniGrille(BX + BW - 102, BY + 20, 90, BH - 40);

        // ── VFD display ──
        const VX = cx - 120;
        const VY = BY + 18;
        const VW = 240;
        const VH = 80;

        const disp = this.add.graphics();
        disp.fillStyle(0x111111);
        disp.fillRoundedRect(VX, VY, VW, VH, 5);
        disp.fillStyle(0x050f05);
        disp.fillRoundedRect(VX + 3, VY + 3, VW - 6, VH - 6, 3);

        // VFD text — flicker then settle
        this.vfdMain = this.add.text(cx, VY + 28, '........', {
            fontFamily: 'Fira Sans, monospace',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#003300',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ff44', blur: 8, fill: true }
        }).setOrigin(0.5).setAlpha(0);

        this.vfdSub = this.add.text(cx, VY + 54, '', {
            fontFamily: 'Fira Sans, monospace',
            fontSize: '11px',
            color: '#004400',
        }).setOrigin(0.5).setAlpha(0);

        // ── Tape reels ──
        const reelY = BY + BH - 38;
        this.reel1X = cx - 60;
        this.reel2X = cx + 60;
        this.reelY = reelY;
        this.reelR = 18;
        this.reelAngle = 0;
        this.reels = this.add.graphics();
        this.drawReels();

        // ── Progress bar ──
        const barY = BY + BH + 20;
        const barW = BW - 40;
        this.add.rectangle(cx, barY, barW, 3, 0x333333).setOrigin(0.5);
        this.progressBar = this.add.rectangle(
            cx - barW / 2, barY, 0, 3, 0x00ff88, 1
        ).setOrigin(0, 0.5);
        this.barW = barW;

        this.vfdSub2 = this.add.text(cx, barY + 14, 'LOADING...', {
            fontFamily: 'Fira Sans, monospace',
            fontSize: '10px',
            color: '#444444',
            letterSpacing: 3,
        }).setOrigin(0.5);

        // ── Boot sequence ──
        this.bootSequence();
    }

    drawMiniGrille(x, y, w, h) {
        const g = this.add.graphics();
        const cols = Math.floor(w / 8);
        const rows = Math.floor(h / 8);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                g.fillStyle(0x888888, 0.5);
                g.fillCircle(x + c * 8 + 4, y + r * 8 + 4, 2);
            }
        }
    }

    drawReels() {
        this.reels.clear();
        [this.reel1X, this.reel2X].forEach((rx, idx) => {
            const angle = this.reelAngle + idx * Math.PI / 3;
            this.reels.fillStyle(0x333333);
            this.reels.fillCircle(rx, this.reelY, this.reelR);
            for (let i = 0; i < 3; i++) {
                const a = angle + i * Math.PI * 2 / 3;
                this.reels.fillStyle(0x666666);
                this.reels.fillRect(
                    rx + Math.cos(a) * 3 - 1,
                    this.reelY + Math.sin(a) * 3 - 1,
                    Math.cos(a) * (this.reelR - 4),
                    2
                );
            }
            this.reels.fillStyle(0x1a1a1a);
            this.reels.fillCircle(rx, this.reelY, this.reelR * 0.35);
        });
    }

    bootSequence() {
        const FLICKER_CHARS = '░▒▓█▄▀■□▪▫';
        let flickerCount = 0;

        // Phase 1 — VFD flickers on
        this.time.delayedCall(300, () => {
            this.vfdMain.setAlpha(1);

            const flicker = this.time.addEvent({
                delay: 80,
                repeat: 8,
                callback: () => {
                    let str = '';
                    for (let i = 0; i < 8; i++) {
                        str += FLICKER_CHARS[Phaser.Math.Between(0, FLICKER_CHARS.length - 1)];
                    }
                    this.vfdMain.setText(str);
                    this.vfdMain.setColor(
                        flickerCount % 2 === 0 ? '#00ff44' : '#003300'
                    );
                    flickerCount++;
                }
            });

            // Phase 2 — settle on SUPERSONIC
            this.time.delayedCall(800, () => {
                this.vfdMain.setText('SUPERSONIC');
                this.vfdMain.setColor('#00ff88');
                this.vfdSub.setAlpha(1).setText('loading...');

                // Phase 3 — fill progress bar over minimum duration
                const minDuration = 1800;
                const startTime = this.time.now;

                this.time.addEvent({
                    delay: 16,
                    repeat: -1,
                    callback: () => {
                        const elapsed = this.time.now - startTime;
                        const progress = Math.min(1, elapsed / minDuration);
                        this.progressBar.width = this.barW * progress;

                        if (progress >= 1) {
                            this.transitionToMenu();
                        }
                    }
                });
            });
        });
    }

    transitionToMenu() {
        if (this._transitioning) return;
        this._transitioning = true;

        this.vfdSub.setText('ready.');
        this.time.delayedCall(400, () => {
            this.cameras.main.fadeOut(600, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('MenuScene');
            });
        });
    }

    update() {
        this.reelAngle += 0.02;
        this.drawReels();
    }
}