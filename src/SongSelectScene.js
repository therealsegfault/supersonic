import * as Phaser from 'phaser';
import { autochartFromFile } from './Autochart.js';

export class SongSelectScene extends Phaser.Scene {
    constructor() {
        super('SongSelectScene');
        this.songs = [];
        this.selectedSong = 0;
        this.selectedDiff = 'MEDIUM';
        this.difficulties = ['TUTORIAL', 'EZ', 'MEDIUM', 'HARD', 'EXTREME', 'EXTRA_EXTREME', '300BPM'];
        this.diffIndex = 2; // MEDIUM default
        this.flipped = false;
        this.animating = false;
    }

    async create() {
        const W = this.scale.width;
        const H = this.scale.height;
        this.cx = W / 2;
        this.cy = H / 2;

        // Load manifest
        const res = await fetch('/src/assets/charts/manifest.json');
        this.manifest = await res.json();
        this.songs = [...this.manifest.songs];

        // Load any session-imported songs
        const additions = JSON.parse(sessionStorage.getItem('manifest_additions') || '[]');
        this.songs = [...this.songs, ...additions];

        // Background
        this.add.rectangle(this.cx, this.cy, W, H, 0x0a0a0a);

        // Draw boombox — same as menu but zoomed in on deck
        this.drawBoombox();

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

        // Reel spin
        this.reelAngle = 0;

        // Fade in
        this.cameras.main.fadeIn(400, 0, 0, 0);

        // Info text
        this.infoText = this.add.text(this.cx, H - 40, '← → song   ↑ ↓ difficulty   ENTER confirm   ESC back', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            color: '#444444',
        }).setOrigin(0.5).setDepth(10);
    }

    drawBoombox() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Boombox — wider, zoomed in feel
        const BW = Math.min(W * 0.75, 900);
        const BH = Math.min(H * 0.65, 360);
        const BX = this.cx - BW / 2;
        const BY = this.cy - BH / 2 - 20;

        this.BX = BX; this.BY = BY; this.BW = BW; this.BH = BH;

        const body = this.add.graphics();
        body.fillStyle(0xc8c8c8);
        body.fillRoundedRect(BX, BY, BW, BH, 16);
        body.fillStyle(0xe8e8e8);
        body.fillRoundedRect(BX, BY, BW, 5, { tl: 16, tr: 16, bl: 0, br: 0 });
        body.fillStyle(0x909090);
        body.fillRoundedRect(BX, BY + BH - 5, BW, 5, { tl: 0, tr: 0, bl: 16, br: 16 });

        // Screw heads
        [[BX+20, BY+20],[BX+BW-20, BY+20],[BX+20, BY+BH-20],[BX+BW-20, BY+BH-20]].forEach(([sx,sy]) => {
            body.fillStyle(0x888888);
            body.fillCircle(sx, sy, 4);
            body.fillStyle(0x555555);
            body.fillRect(sx-3, sy-0.5, 6, 1);
            body.fillRect(sx-0.5, sy-3, 1, 6);
        });

        // Speaker grilles
        this.drawGrille(BX + 12, BY + 24, BW * 0.18, BH - 48);
        this.drawGrille(BX + BW - 12 - BW * 0.18, BY + 24, BW * 0.18, BH - 48);

        // Center panel
        this.CPX = BX + BW * 0.22;
        this.CPY = BY + 16;
        this.CPW = BW * 0.56;
        this.CPH = BH - 32;

        // Tape deck window — open, darker
        const DX = this.CPX + this.CPW * 0.05;
        const DY = this.CPY + this.CPH * 0.08;
        const DW = this.CPW * 0.9;
        const DH = this.CPH * 0.55;

        this.DX = DX; this.DY = DY; this.DW = DW; this.DH = DH;

        const deck = this.add.graphics();
        deck.fillStyle(0x111111);
        deck.fillRoundedRect(DX, DY, DW, DH, 8);
        deck.fillStyle(0x0a0a0a);
        deck.fillRoundedRect(DX + 4, DY + 4, DW - 8, DH - 8, 5);

        // Reel wells
        this.reel1X = DX + DW * 0.28;
        this.reel2X = DX + DW * 0.72;
        this.reelCY = DY + DH * 0.6;
        this.reelR = DH * 0.22;
        this.reelsGfx = this.add.graphics();
        this.drawReels();

        // Song info panel below deck
        const IPY = this.CPY + this.CPH * 0.68;
        const IPH = this.CPH * 0.28;

        this.songTitleText = this.add.text(this.CPX + this.CPW / 2, IPY + 10, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#222222',
        }).setOrigin(0.5, 0).setDepth(5);

        this.songArtistText = this.add.text(this.CPX + this.CPW / 2, IPY + 34, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            color: '#555555',
            fontStyle: 'italic',
        }).setOrigin(0.5, 0).setDepth(5);

        this.diffText = this.add.text(this.CPX + this.CPW / 2, IPY + 56, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#00aa66',
            letterSpacing: 2,
        }).setOrigin(0.5, 0).setDepth(5);
    }

    drawGrille(x, y, w, h) {
        const g = this.add.graphics();
        const cols = Math.floor(w / 9);
        const rows = Math.floor(h / 9);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                g.fillStyle(0x888888, 0.5);
                g.fillCircle(x + c * 9 + 4, y + r * 9 + 4, 2.2);
            }
        }
    }

    drawReels() {
        this.reelsGfx.clear();
        [this.reel1X, this.reel2X].forEach((rx, idx) => {
            const angle = this.reelAngle + idx * Math.PI / 3;
            this.reelsGfx.fillStyle(0x2a2a2a);
            this.reelsGfx.fillCircle(rx, this.reelCY, this.reelR);
            for (let i = 0; i < 3; i++) {
                const a = angle + i * Math.PI * 2 / 3;
                this.reelsGfx.fillStyle(0x555555);
                this.reelsGfx.fillRect(
                    rx + Math.cos(a) * 3 - 1,
                    this.reelCY + Math.sin(a) * 3 - 1,
                    Math.cos(a) * (this.reelR - 4),
                    2
                );
            }
            this.reelsGfx.fillStyle(0x111111);
            this.reelsGfx.fillCircle(rx, this.reelCY, this.reelR * 0.3);
        });
    }

    drawTapes() {
        // Destroy all tracked tape objects cleanly
        if (this.tapeObjects) {
            this.tapeObjects.forEach(o => o.destroy());
        }
        this.tapeObjects = [];

        const song = this.songs[this.selectedSong];
        if (!song) return;

        const CW = this.DW * 0.75;
        const CH = this.DH * 0.62;
        const CX = this.DX + (this.DW - CW) / 2;
        const CY = this.DY + (this.DH - CH) / 2 - 8;

        const cass = this.add.graphics();
        this.tapeObjects.push(cass);

        if (!this.flipped) {
            // Front face — song info
            cass.fillStyle(Phaser.Display.Color.HexStringToColor(song.label_color || '#d4a843').color);
            cass.fillRoundedRect(CX, CY, CW, CH, 5);

            // Tape window
            cass.fillStyle(0x111111);
            cass.fillRoundedRect(CX + CW * 0.25, CY + CH * 0.35, CW * 0.5, CH * 0.35, 3);

            // Label
            cass.fillStyle(0xffffff, 0.9);
            cass.fillRoundedRect(CX + 8, CY + 6, CW - 16, CH * 0.28, 3);

            this.add.text(CX + CW / 2, CY + CH * 0.14, song.title, {
                fontFamily: 'Fira Sans, sans-serif',
                fontSize: '12px',
                fontStyle: 'bold',
                color: song.label_text_color || '#3a1a00',
            }).setOrigin(0.5).setDepth(6);

            this.add.text(CX + CW / 2, CY + CH * 0.26, song.artist, {
                fontFamily: 'Fira Sans, sans-serif',
                fontSize: '10px',
                fontStyle: 'italic',
                color: song.label_text_color || '#3a1a00',
            }).setOrigin(0.5).setDepth(6);

        } else {
            // Back face — difficulty select
            cass.fillStyle(0x2a2a2a);
            cass.fillRoundedRect(CX, CY, CW, CH, 5);

            this.add.text(CX + CW / 2, CY + 10, 'DIFFICULTY', {
                fontFamily: 'Fira Sans, sans-serif',
                fontSize: '11px',
                color: '#666666',
                letterSpacing: 3,
            }).setOrigin(0.5, 0).setDepth(6);

            this.difficulties.forEach((diff, idx) => {
                const isSelected = idx === this.diffIndex;
                const dy = CY + 30 + idx * 18;
                if (isSelected) {
                    cass.fillStyle(0x00aa66, 0.3);
                    cass.fillRect(CX + 8, dy - 2, CW - 16, 16);
                }
                this.add.text(CX + CW / 2, dy, diff, {
                    fontFamily: 'Fira Sans, sans-serif',
                    fontSize: isSelected ? '12px' : '10px',
                    fontStyle: isSelected ? 'bold' : 'normal',
                    color: isSelected ? '#00ff88' : '#444444',
                }).setOrigin(0.5, 0).setDepth(6);
            });
        }


        // Neighbor tapes — previous and next
        const prevSong = this.songs[(this.selectedSong - 1 + this.songs.length) % this.songs.length];
        const nextSong = this.songs[(this.selectedSong + 1) % this.songs.length];

        if (this.songs.length > 1) {
            this.drawNeighborTape(this.DX + 8, CY + 10, CW * 0.55, CH * 0.8, prevSong, -1);
            this.drawNeighborTape(this.DX + this.DW - 8 - CW * 0.55, CY + 10, CW * 0.55, CH * 0.8, nextSong, 1);
        }

        // Update info panel
        this.songTitleText.setText(song.title);
        this.songArtistText.setText(song.artist);
        this.diffText.setText(this.difficulties[this.diffIndex]);
    }

    drawNeighborTape(x, y, w, h, song) {
        if (!song) return;
        const g = this.add.graphics();
        g.fillStyle(Phaser.Display.Color.HexStringToColor(song.label_color || '#888888').color, 0.4);
        g.fillRoundedRect(x, y, w, h, 4);
        const t = this.add.text(x + w / 2, y + h / 2, song.title, {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '9px',
            color: '#ffffff',
        }).setOrigin(0.5).setDepth(5).setAlpha(0.5);
        this.tapeObjects.push(g, t);
    }

    navigateSong(dir) {
        if (this.animating || this.flipped) return;
        this.selectedSong = (this.selectedSong + dir + this.songs.length) % this.songs.length;
        this.drawTapes();
    }

    navigateDiff(dir) {
        if (this.animating) return;
        if (!this.flipped) {
            // Flip to back
            this.flipTape();
            return;
        }
        this.diffIndex = (this.diffIndex + dir + this.difficulties.length) % this.difficulties.length;
        this.selectedDiff = this.difficulties[this.diffIndex];
        this.drawTapes();
    }

    flipTape() {
        if (this.animating) return;
        this.animating = true;

        const targets = this.tapeObjects || [];
        this.tweens.add({
            targets,
            scaleX: 0,
            duration: 150,
            ease: 'Sine.easeIn',
            onComplete: () => {
                this.flipped = !this.flipped;
                this.drawTapes();
                this.tweens.add({
                    targets: this.tapeObjects,
                    scaleX: 1,
                    duration: 150,
                    ease: 'Sine.easeOut',
                    onComplete: () => { this.animating = false; }
                });
            }
        });
    }

    confirm() {
        if (this.animating) return;

        if (!this.flipped) {
            // First press — flip to difficulty
            this.flipTape();
            return;
        }

        // Second press — load the song
        const song = this.songs[this.selectedSong];
        const diff = this.difficulties[this.diffIndex];
        const chartPath = song.charts[diff];

        if (!chartPath) {
            // No chart for this difficulty yet
            this.diffText.setText(`no chart for ${diff}`).setColor('#ff3078');
            this.time.delayedCall(1000, () => {
                this.diffText.setText(diff).setColor('#00aa66');
            });
            return;
        }

        this.animating = true;

        // Tape slides into deck
        this.tweens.add({
            targets: this.tapeContainer,
            y: this.reelCY - 20,
            duration: 300,
            ease: 'Sine.easeIn',
            onComplete: () => {
                // Reels spin up
                this.reelSpinning = true;
                this.time.delayedCall(400, () => {
                    this.cameras.main.fadeOut(600, 0, 0, 0);
                    this.cameras.main.once('camerafadeoutcomplete', () => {
                        this.scene.start('GameScene', {
                            chartPath,
                            audioPath: song.audio,
                            songTitle: song.title,
                            artist: song.artist,
                            difficulty: diff,
                        });
                    });
                });
            }
        });
    }

    goBack() {
        if (this.flipped) {
            this.flipTape();
            return;
        }
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('MenuScene');
        });
    }

    update() {
        if (!this.reelsGfx) return;
        this.reelAngle += this.reelSpinning ? 0.08 : 0.015;
        this.drawReels();
    }
}