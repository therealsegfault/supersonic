import * as Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // ── Ambient floating note shapes ──
        this.shapes = [];
        for (let i = 0; i < 18; i++) {
            this.spawnAmbientShape();
        }

        // ── Title ──
        // Shadow/aberration layers
        this.add.text(cx + 3, cy - 160 + 3, 'SUPERSONIC', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '96px',
            fontStyle: 'bold',
            color: '#ff0055',
        }).setOrigin(0.5).setAlpha(0.5);

        this.add.text(cx - 3, cy - 160 - 3, 'SUPERSONIC', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '96px',
            fontStyle: 'bold',
            color: '#0055ff',
        }).setOrigin(0.5).setAlpha(0.5);

        // Main title
        this.titleText = this.add.text(cx, cy - 160, 'SUPERSONIC', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '96px',
            fontStyle: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5);

        // ── Subtitle ──
        this.add.text(cx, cy - 80, 'a game about feeling it', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '20px',
            color: '#888888',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // ── Start button ──
        const btnW = 280;
        const btnH = 64;
        const btnX = cx - btnW / 2;
        const btnY = cy + 20;

        this.btnBg = this.add.rectangle(cx, cy + 52, btnW, btnH, 0xffffff, 0)
            .setStrokeStyle(2, 0xffffff, 0.6)
            .setInteractive({ useHandCursor: true });

        this.btnText = this.add.text(cx, cy + 52, 'START', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#ffffff',
            letterSpacing: 8,
        }).setOrigin(0.5);

        // Button pulse animation
        this.tweens.add({
            targets: [this.btnBg, this.btnText],
            alpha: { from: 0.6, to: 1 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Button hover
        this.btnBg.on('pointerover', () => {
            this.btnBg.setStrokeStyle(2, 0x00ffb4, 1);
            this.btnText.setColor('#00ffb4');
            this.tweens.getTweensOf([this.btnBg, this.btnText]).forEach(t => t.stop());
            this.btnBg.setAlpha(1);
            this.btnText.setAlpha(1);
        });

        this.btnBg.on('pointerout', () => {
            this.btnBg.setStrokeStyle(2, 0xffffff, 0.6);
            this.btnText.setColor('#ffffff');
            this.tweens.add({
                targets: [this.btnBg, this.btnText],
                alpha: { from: 0.6, to: 1 },
                duration: 900,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });

        // Button click → transition
        this.btnBg.on('pointerdown', () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('GameScene');
            });
        });

        // ── Version tag ──
        this.add.text(16, this.scale.height - 28, 'PROTO v0.0.1', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            color: '#444444',
        });

        // ── Fade in ──
        this.cameras.main.fadeIn(600, 0, 0, 0);

        // ── Ambient shape spawner ──
        this.time.addEvent({
            delay: 1200,
            callback: this.spawnAmbientShape,
            callbackScope: this,
            loop: true
        });
    }

    spawnAmbientShape() {
        const w = this.scale.width;
        const h = this.scale.height;

        const types = ['circle', 'rect', 'triangle'];
        const type = types[Phaser.Math.Between(0, 2)];
        const colors = [0x4488ff, 0xff44aa, 0x44ffaa, 0xffffff];
        const color = colors[Phaser.Math.Between(0, 3)];
        const size = Phaser.Math.Between(6, 22);

        // Spawn from random edge
        const edge = Phaser.Math.Between(0, 3);
        let x, y;
        if (edge === 0) { x = Phaser.Math.Between(0, w); y = -40; }
        else if (edge === 1) { x = w + 40; y = Phaser.Math.Between(0, h); }
        else if (edge === 2) { x = Phaser.Math.Between(0, w); y = h + 40; }
        else { x = -40; y = Phaser.Math.Between(0, h); }

        let shape;
        if (type === 'circle') {
            shape = this.add.circle(x, y, size, color, 0.15);
        } else if (type === 'rect') {
            shape = this.add.rectangle(x, y, size * 2, size * 2, color, 0.15);
        } else {
            shape = this.add.triangle(x, y, 0, size * 2, size * 2, -size, -size * 2, -size, color, 0.15);
        }

        // Drift toward center loosely
        const angle = Phaser.Math.Angle.Between(x, y, w / 2, h / 2);
        const speed = Phaser.Math.Between(20, 60);
        const duration = Phaser.Math.Between(6000, 14000);

        this.tweens.add({
            targets: shape,
            x: x + Math.cos(angle) * speed * (duration / 1000),
            y: y + Math.sin(angle) * speed * (duration / 1000),
            alpha: { from: 0, to: 0.12 },
            duration: duration,
            ease: 'Linear',
            onComplete: () => shape.destroy()
        });
    }

    update() {
        // Gentle title float
        if (this.titleText) {
            this.titleText.y = (this.scale.height / 2 - 160) +
                Math.sin(this.time.now / 1800) * 4;
        }
    }
}