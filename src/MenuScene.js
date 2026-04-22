import * as Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
        this.menuItems = ['PLAY', 'ARCADE', 'OPTIONS', 'CREDITS'];
        this.selectedIndex = 0;
        this.optionsOpen = false;
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        // ── Background — dark room ──
        this.add.rectangle(cx, cy, W, H, 0x0a0a0a);

        // Subtle noise grain overlay via tiled graphics
        const grain = this.add.graphics();
        for (let i = 0; i < 800; i++) {
            const gx = Phaser.Math.Between(0, W);
            const gy = Phaser.Math.Between(0, H);
            const a = Phaser.Math.FloatBetween(0.02, 0.06);
            grain.fillStyle(0xffffff, a);
            grain.fillRect(gx, gy, 1, 1);
        }

        // ── Boombox body ──
        const BW = Math.min(W * 0.82, 1100);
        const BH = Math.min(H * 0.72, 420);
        const BX = cx - BW / 2;
        const BY = cy - BH / 2;

        // Drop shadow
        this.add.rectangle(cx + 8, cy + 10, BW, BH, 0x000000, 0.5).setOrigin(0.5);

        // Main body — worn silver
        const body = this.add.graphics();
        body.fillStyle(0xc8c8c8);
        body.fillRoundedRect(BX, BY, BW, BH, 18);

        // Worn edge highlight top
        body.fillStyle(0xe8e8e8);
        body.fillRoundedRect(BX, BY, BW, 6, { tl: 18, tr: 18, bl: 0, br: 0 });

        // Worn shadow bottom
        body.fillStyle(0x909090);
        body.fillRoundedRect(BX, BY + BH - 6, BW, 6, { tl: 0, tr: 0, bl: 18, br: 18 });

        // Yellowed plastic panel center
        body.fillStyle(0xd4c89a, 0.3);
        body.fillRoundedRect(BX + BW * 0.28, BY + 12, BW * 0.44, BH - 24, 10);

        // Screw heads — four corners
        const screwPositions = [
            [BX + 22, BY + 22], [BX + BW - 22, BY + 22],
            [BX + 22, BY + BH - 22], [BX + BW - 22, BY + BH - 22]
        ];
        screwPositions.forEach(([sx, sy]) => {
            body.fillStyle(0x888888);
            body.fillCircle(sx, sy, 5);
            body.fillStyle(0x666666);
            body.fillRect(sx - 3, sy - 0.5, 6, 1);
            body.fillRect(sx - 0.5, sy - 3, 1, 6);
        });

        // ── Left speaker grille ──
        this.drawSpeakerGrille(BX + 14, BY + 30, BW * 0.22, BH - 60);

        // ── Right speaker grille ──
        this.drawSpeakerGrille(BX + BW - 14 - BW * 0.22, BY + 30, BW * 0.22, BH - 60);

        // ── Center panel ──
        const CPX = BX + BW * 0.28 + 8;
        const CPW = BW * 0.44 - 16;
        const CPY = BY + 16;
        const CPH = BH - 32;

        // ── VFD Display ──
        const VFH = CPH * 0.32;
        const VFY = CPY + 10;

        // Display bezel
        const disp = this.add.graphics();
        disp.fillStyle(0x1a1a1a);
        disp.fillRoundedRect(CPX, VFY, CPW, VFH, 6);

        // VFD glow bg
        disp.fillStyle(0x0a1a0a);
        disp.fillRoundedRect(CPX + 4, VFY + 4, CPW - 8, VFH - 8, 4);

        // Display glow effect
        const glowRect = this.add.rectangle(
            CPX + CPW / 2, VFY + VFH / 2,
            CPW - 8, VFH - 8,
            0x00ff44, 0.04
        ).setOrigin(0.5);

        // VFD text — selected item
        this.vfdText = this.add.text(CPX + CPW / 2, VFY + VFH / 2 - 8, this.menuItems[0], {
            fontFamily: 'Fira Sans, monospace',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#00ff88',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ff44', blur: 12, fill: true }
        }).setOrigin(0.5);

        // VFD subtitle — navigation hint
        this.vfdSub = this.add.text(CPX + CPW / 2, VFY + VFH / 2 + 16, '◄ ►  to navigate', {
            fontFamily: 'Fira Sans, monospace',
            fontSize: '11px',
            color: '#005522',
        }).setOrigin(0.5);

        // ── Tape deck ──
        const TDY = VFY + VFH + 10;
        const TDH = CPH * 0.28;
        const TDW = CPW * 0.72;
        const TDX = CPX + (CPW - TDW) / 2;

        // Tape deck window
        const tape = this.add.graphics();
        tape.fillStyle(0x111111);
        tape.fillRoundedRect(TDX, TDY, TDW, TDH, 6);
        tape.fillStyle(0x1a1208);
        tape.fillRoundedRect(TDX + 3, TDY + 3, TDW - 6, TDH - 6, 4);

        // Cassette body
        const cassW = TDW - 20;
        const cassH = TDH - 14;
        const cassX = TDX + 10;
        const cassY = TDY + 7;

        tape.fillStyle(0x2a1f0a);
        tape.fillRoundedRect(cassX, cassY, cassW, cassH, 4);

        // Cassette label
        tape.fillStyle(0xd4a843);
        tape.fillRoundedRect(cassX + cassW * 0.15, cassY + 4, cassW * 0.7, cassH * 0.45, 2);

        // Label text — the secret detail
        this.add.text(
            cassX + cassW * 0.15 + (cassW * 0.7) / 2,
            cassY + 4 + (cassH * 0.45) / 2,
            'do no harm  ·  side A',
            {
                fontFamily: 'Fira Sans, sans-serif',
                fontSize: '8px',
                color: '#3a1a00',
                fontStyle: 'italic'
            }
        ).setOrigin(0.5);

        // Tape reels
        const reelY = cassY + cassH * 0.72;
        const reelR = cassH * 0.22;
        const reel1X = cassX + cassW * 0.28;
        const reel2X = cassX + cassW * 0.72;

        tape.fillStyle(0x111111);
        tape.fillCircle(reel1X, reelY, reelR);
        tape.fillCircle(reel2X, reelY, reelR);

        // Reel spokes — animated
        this.reel1 = this.add.graphics();
        this.reel2 = this.add.graphics();
        this.reel1X = reel1X;
        this.reel1Y = reelY;
        this.reel2X = reel2X;
        this.reel2Y = reelY;
        this.reelR = reelR;
        this.reelAngle = 0;
        this.drawReels();

        // ── Buttons ──
        const BTY = TDY + TDH + 14;
        const BTH = CPH - (BTY - CPY) - 8;

        // RW button
        this.rwBtn = this.createButton(CPX + CPW * 0.08, BTY, CPW * 0.18, BTH * 0.55, '◄◄', 0x555555, () => this.navigate(-1));

        // FF button
        this.ffBtn = this.createButton(CPX + CPW * 0.74, BTY, CPW * 0.18, BTH * 0.55, '►►', 0x555555, () => this.navigate(1));

        // PLAY button — bigger, center
        this.playBtn = this.createButton(CPX + CPW * 0.38, BTY - 4, CPW * 0.24, BTH * 0.65, '▶', 0x2a5a2a, () => this.startGame());

        // STOP button
        this.stopBtn = this.createButton(CPX + CPW * 0.08, BTY + BTH * 0.62, CPW * 0.18, BTH * 0.38, '■', 0x444444, () => {});

        // OPT button
        this.optBtn = this.createButton(CPX + CPW * 0.74, BTY + BTH * 0.62, CPW * 0.18, BTH * 0.38, 'OPT', 0x444444, () => this.toggleOptions());

        // ── Keyboard input ──
        this.input.keyboard.addCapture(['LEFT', 'RIGHT', 'ENTER', 'SPACE', 'O']);
        this.input.keyboard.on('keydown-LEFT',  () => this.navigate(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.navigate(1));
        this.input.keyboard.on('keydown-ENTER', () => this.startGame());
        this.input.keyboard.on('keydown-SPACE', () => this.startGame());

        // ── Version tag ──
        this.add.text(W - 16, H - 16, 'SUPERSONIC  proto v0.0.1', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '11px',
            color: '#333333',
        }).setOrigin(1, 1);

        // ── Fade in ──
        this.cameras.main.fadeIn(800, 0, 0, 0);

        // ── VFD pulse tween ──
        this.tweens.add({
            targets: glowRect,
            alpha: { from: 0.04, to: 0.08 },
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    drawSpeakerGrille(x, y, w, h) {
        const g = this.add.graphics();
        const cols = Math.floor(w / 10);
        const rows = Math.floor(h / 10);
        const startX = x + (w - cols * 10) / 2;
        const startY = y + (h - rows * 10) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const px = startX + c * 10 + 2;
                const py = startY + r * 10 + 2;
                g.fillStyle(0x888888, 0.6);
                g.fillCircle(px, py, 2.5);
                g.fillStyle(0x555555, 0.4);
                g.fillCircle(px + 0.5, py + 0.5, 2.5);
            }
        }

        // Fabric overlay
        g.fillStyle(0x777777, 0.08);
        g.fillRect(x, y, w, h);
    }

    drawReels() {
        [this.reel1, this.reel2].forEach((reel, idx) => {
            reel.clear();
            const rx = idx === 0 ? this.reel1X : this.reel2X;
            const ry = idx === 0 ? this.reel1Y : this.reel2Y;
            const r = this.reelR;
            const angle = this.reelAngle + (idx * Math.PI / 3);

            reel.fillStyle(0x333333);
            reel.fillCircle(rx, ry, r - 2);

            // Spokes
            for (let i = 0; i < 3; i++) {
                const a = angle + (i * Math.PI * 2 / 3);
                reel.fillStyle(0x666666);
                reel.fillRect(
                    rx + Math.cos(a) * 2 - 1,
                    ry + Math.sin(a) * 2 - 1,
                    Math.cos(a) * (r - 4),
                    2
                );
            }

            reel.fillStyle(0x222222);
            reel.fillCircle(rx, ry, r * 0.3);
        });
    }

    createButton(x, y, w, h, label, color, callback) {
        const g = this.add.graphics();

        const draw = (pressed) => {
            g.clear();
            // Button body
            g.fillStyle(pressed ? 0x333333 : color);
            g.fillRoundedRect(x, y + (pressed ? 2 : 0), w, h - (pressed ? 2 : 0), 5);
            // Top highlight
            if (!pressed) {
                g.fillStyle(0xffffff, 0.15);
                g.fillRoundedRect(x, y, w, 4, { tl: 5, tr: 5, bl: 0, br: 0 });
            }
            // Bottom shadow
            g.fillStyle(0x000000, 0.3);
            g.fillRoundedRect(x, y + h - 3, w, 3, { tl: 0, tr: 0, bl: 5, br: 5 });
        };

        draw(false);

        const txt = this.add.text(x + w / 2, y + h / 2, label, {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: label.length > 2 ? '11px' : '16px',
            fontStyle: 'bold',
            color: '#cccccc',
        }).setOrigin(0.5);

        // Hit area
        const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
            .setInteractive({ useHandCursor: true });

        zone.on('pointerdown', () => {
            draw(true);
            txt.setY(y + h / 2 + 2);
            callback();
        });

        zone.on('pointerup', () => {
            draw(false);
            txt.setY(y + h / 2);
        });

        zone.on('pointerout', () => {
            draw(false);
            txt.setY(y + h / 2);
        });

        return { g, txt, zone };
    }

    navigate(dir) {
        this.selectedIndex = (this.selectedIndex + dir + this.menuItems.length) % this.menuItems.length;
        this.vfdText.setText(this.menuItems[this.selectedIndex]);

        // Click feel — brief dim
        this.tweens.add({
            targets: this.vfdText,
            alpha: { from: 0.3, to: 1 },
            duration: 80,
            ease: 'Linear'
        });
    }

    toggleOptions() {
        this.optionsOpen = !this.optionsOpen;
        if (this.optionsOpen) {
            this.showOptionsPanel();
        } else {
            this.hideOptionsPanel();
        }
    }

    showOptionsPanel() {
        const W = this.scale.width;
        const H = this.scale.height;

        this.optPanel = this.add.container(0, 0);

        const bg = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 340, 220, 0x111111, 0.96);
        bg.setStrokeStyle(1, 0x333333);

        const title = this.add.text(W / 2, H / 2 - 85, 'OPTIONS', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '14px',
            color: '#666666',
            letterSpacing: 4,
        }).setOrigin(0.5);

        const importBtn = this.add.text(W / 2, H / 2 - 40, '[ IMPORT SONG ]', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#00ff88',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        importBtn.on('pointerover', () => importBtn.setColor('#ffffff'));
        importBtn.on('pointerout',  () => importBtn.setColor('#00ff88'));
        importBtn.on('pointerdown', () => this.triggerImport());

        const hint = this.add.text(W / 2, H / 2 - 10, 'import an mp3 and autochart it', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '12px',
            fontStyle: 'italic',
            color: '#444444',
        }).setOrigin(0.5);

        this.importStatus = this.add.text(W / 2, H / 2 + 20, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            color: '#888888',
            align: 'center',
            wordWrap: { width: 300 }
        }).setOrigin(0.5);

        const closeBtn = this.add.text(W / 2, H / 2 + 70, '[ CLOSE ]', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '14px',
            color: '#444444',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        closeBtn.on('pointerdown', () => this.toggleOptions());

        this.optPanel.add([bg, title, importBtn, hint, this.importStatus, closeBtn]);
        this.optPanel.setDepth(30);
    }

    hideOptionsPanel() {
        this.optPanel?.destroy();
        this.optPanel = null;
        this.vfdSub.setText('◄ ►  to navigate');
    }

    triggerImport() {
        // Create hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/mpeg,audio/mp3,.mp3';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const bpmStr = window.prompt(`BPM for "${file.name}"? (check tunebat.com)`);
            const bpm = parseFloat(bpmStr);
            if (!bpm || isNaN(bpm)) {
                this.importStatus.setText('cancelled or invalid BPM').setColor('#ff3078');
                return;
            }

            this.importStatus.setText('analyzing audio...').setColor('#ffdd00');

            try {
                const { autochartFromFile } = await import('./Autochart.js');
                const { saveChart, saveSong, saveAudio } = await import('./DB.js');
                const difficulties = ['EZ', 'MEDIUM', 'HARD'];
                const charts = {};
                const songName = file.name.replace(/\.[^/.]+$/, '');

                for (const diff of difficulties) {
                    const chart = await autochartFromFile(file, bpm, diff, (p) => {
                        const pct = typeof p === 'number' ? ` ${Math.round(p * 100)}%` : '';
                        this.importStatus.setText(`charting ${diff}...${pct}`).setColor('#ffdd00');
                    });
                    const chartId = `${songName}_${diff}`;
                    await saveChart(chartId, chart);
                    charts[diff] = `idb:${chartId}`;
                }

                // Save audio to IndexedDB for persistence
                this.importStatus.setText('saving audio...').setColor('#ffdd00');
                await saveAudio(songName, file);

                const song = {
                    id: songName,
                    title: songName.replace(/_/g, ' '),
                    artist: 'imported',
                    audio: `idb-audio:${songName}`,
                    charts,
                    label_color: '#4488ff',
                    label_text_color: '#ffffff',
                    _imported: true,
                };

                await saveSong(song);
                this.importStatus.setText(`✓ saved! go to song select`).setColor('#00ff88');

            } catch (err) {
                console.error(err);
                this.importStatus.setText('something went wrong').setColor('#ff3078');
            }

            document.body.removeChild(input);
        };

        input.click();
    }

    startGame() {
        const item = this.menuItems[this.selectedIndex];
        if (item === 'PLAY' || item === 'ARCADE') {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('SongSelectScene');
            });
        }
    }

    update() {
        // Spin reels
        this.reelAngle += 0.015;
        this.drawReels();
    }
}