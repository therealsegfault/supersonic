import * as Phaser from 'phaser';

export class EndScene extends Phaser.Scene {
    constructor() {
        super('EndScene');
    }

    create(data) {
        const W = this.scale.width;
        const H = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

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

        // Background
        this.add.rectangle(cx, cy, W, H, 0x050505);

        // Subtle grain
        const grain = this.add.graphics();
        for (let i = 0; i < 600; i++) {
            grain.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.015, 0.045));
            grain.fillRect(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 1, 1);
        }

        // Divider line
        this.add.rectangle(cx, cy - 10, W * 0.6, 1, cleared ? 0x00ffb4 : 0xff3078, 0.35);

        // ── Verdict ──
        const verdictColor  = cleared ? '#00ffb4' : '#ff3078';
        const verdictText   = cleared ? 'CLEARED' : 'NOT CLEARED';
        this.add.text(cx, cy - 130, verdictText, {
            fontFamily: 'SuperBubble, sans-serif',
            fontSize: '52px',
            color: verdictColor,
            shadow: { offsetX: 0, offsetY: 0, color: verdictColor, blur: 24, fill: true },
        }).setOrigin(0.5).setAlpha(0).setDepth(5);

        // ── Song info ──
        this.add.text(cx, cy - 65, songTitle, {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5).setAlpha(0).setDepth(5);

        this.add.text(cx, cy - 40, difficulty, {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            color: '#555555',
            letterSpacing: 4,
        }).setOrigin(0.5).setAlpha(0).setDepth(5);

        // ── Score ──
        this.add.text(cx, cy - 8, score.toString().padStart(8, '0'), {
            fontFamily: 'SuperBubble, sans-serif',
            fontSize: '42px',
            color: '#ffffff',
        }).setOrigin(0.5).setAlpha(0).setDepth(5);

        // ── Stats row ──
        const statsY = cy + 52;
        const col = W * 0.16;

        [
            { label: 'PERFECT', value: perfectCount, color: '#ffd700' },
            { label: 'GOOD',    value: goodCount,    color: '#4488ff' },
            { label: 'MISS',    value: missCount,    color: '#ff3078' },
            { label: 'ACCURACY', value: `${accuracy}%`, color: '#aaaaaa' },
        ].forEach(({ label, value, color }, i) => {
            const x = cx - col * 1.5 + col * i;
            this.add.text(x, statsY, String(value), {
                fontFamily: 'SuperBubble, sans-serif',
                fontSize: '26px',
                color,
            }).setOrigin(0.5, 1).setAlpha(0).setDepth(5);
            this.add.text(x, statsY + 4, label, {
                fontFamily: 'Fira Sans, sans-serif',
                fontSize: '10px',
                color: '#444444',
                letterSpacing: 2,
            }).setOrigin(0.5, 0).setAlpha(0).setDepth(5);
        });

        // ── Tuning bar ──
        const barW = W * 0.38;
        const barX = cx - barW / 2;
        const barY = cy + 108;

        const tuningLabel = this.add.text(cx, barY - 18, `${tuningPct}% tuned`, {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            fontStyle: 'bold',
            color: cleared ? '#00ffb4' : '#ff3078',
        }).setOrigin(0.5, 1).setAlpha(0).setDepth(5);

        this.add.rectangle(cx, barY, barW, 3, 0xffffff, 0.08).setDepth(5);
        const fillColor = cleared ? 0x00ffb4 : 0xff3078;
        const fill = this.add.rectangle(barX, barY, barW * (tuningPct / 100), 3, fillColor, 1)
            .setOrigin(0, 0.5).setAlpha(0).setDepth(5);

        // ── Prompt ──
        const prompt = this.add.text(cx, cy + 148, 'press any key to continue', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            color: '#333333',
            fontStyle: 'italic',
        }).setOrigin(0.5).setAlpha(0).setDepth(5);

        // ── Fade-in all objects ──
        const allText = this.children.list.filter(c => c.alpha === 0);
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.tweens.add({
            targets: allText,
            alpha: 1,
            duration: 600,
            ease: 'Sine.easeOut',
            delay: 300,
        });

        // ── Prompt blink (after reveal) ──
        this.time.delayedCall(1000, () => {
            this.tweens.add({
                targets: prompt,
                alpha: { from: 1, to: 0.25 },
                duration: 900,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
        });

        // ── Input — any key goes to song select ──
        this.time.delayedCall(800, () => {
            this.input.keyboard.once('keydown', () => {
                this.cameras.main.fadeOut(400, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.start('SongSelectScene');
                });
            });
        });
    }
}
