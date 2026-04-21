import * as Phaser from 'phaser';

// ── Timing constants (from SWING) ──
const PERFECT_WINDOW_MS = 110;
const MAX_HIT_WINDOW_MS = 250;
const MISS_WINDOW_MS = 250;
const APPROACH_TIME_MS = 2000;

// ── Note types ──
const NOTE_TYPE = {
    SPHERE: 'sphere',
    CUBE: 'cube',
    PYRAMID: 'pyramid'
};

const DIRECTIONS = ['left', 'right', 'top', 'bottom', 'topleft', 'topright', 'bottomleft', 'bottomright'];

// ── Note class ──
class Note {
    constructor(hitTimeMs, type, direction) {
        this.hitTimeMs = hitTimeMs;
        this.spawnTimeMs = hitTimeMs - APPROACH_TIME_MS;
        this.type = type;
        this.direction = direction;
        this.hit = false;
        this.missed = false;
        this.gameObject = null;
        this.glowObject = null;
    }
}

// ── Game Scene ──
export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.notes = [];
        this.startTime = 0;
        this.combo = 0;
        this.perfectCount = 0;
        this.goodCount = 0;
        this.missCount = 0;
    }

    create() {
        this.startTime = this.time.now;
        this.cx = this.scale.width / 2;
        this.cy = this.scale.height / 2;

        // Strike zone
        this.add.circle(this.cx, this.cy, 55).setStrokeStyle(2, 0xffffff, 0.3);
        this.add.circle(this.cx, this.cy, 8, 0xffffff, 0.8);

        // UI
        this.judgementDisplay = this.add.text(this.cx, this.cy - 120, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(10);

        this.comboDisplay = this.add.text(this.cx, this.cy + 90, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '24px',
            color: '#ffdd00'
        }).setOrigin(0.5).setDepth(10);

        this.scoreDisplay = this.add.text(16, 16, 'SCORE 00000000', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '20px',
            color: '#ffffff'
        }).setDepth(10);

        // Spawn test notes
        this.spawnTestNotes();

        // Input
        this.input.keyboard.addCapture(['D', 'F', 'J', 'K']);
        this.input.keyboard.on('keydown-D', () => this.handleInput(NOTE_TYPE.SPHERE));
        this.input.keyboard.on('keydown-F', () => this.handleInput(NOTE_TYPE.CUBE));
        this.input.keyboard.on('keydown-J', () => this.handleInput(NOTE_TYPE.PYRAMID));

        // Fade in from menu
        this.cameras.main.fadeIn(400, 0, 0, 0);
    }

    getSpawnPosition(direction) {
        const w = this.scale.width;
        const h = this.scale.height;
        const margin = 80;

        const positions = {
            left:        { x: -margin,    y: this.cy },
            right:       { x: w + margin, y: this.cy },
            top:         { x: this.cx,    y: -margin },
            bottom:      { x: this.cx,    y: h + margin },
            topleft:     { x: -margin,    y: -margin },
            topright:    { x: w + margin, y: -margin },
            bottomleft:  { x: -margin,    y: h + margin },
            bottomright: { x: w + margin, y: h + margin },
        };

        return positions[direction];
    }

    spawnTestNotes() {
        const sequence = [
            { time: 2000,  type: NOTE_TYPE.SPHERE,  dir: 'left' },
            { time: 3000,  type: NOTE_TYPE.CUBE,    dir: 'top' },
            { time: 4000,  type: NOTE_TYPE.PYRAMID, dir: 'right' },
            { time: 5000,  type: NOTE_TYPE.SPHERE,  dir: 'bottom' },
            { time: 6000,  type: NOTE_TYPE.CUBE,    dir: 'topleft' },
            { time: 7000,  type: NOTE_TYPE.PYRAMID, dir: 'topright' },
            { time: 8000,  type: NOTE_TYPE.SPHERE,  dir: 'bottomleft' },
            { time: 9000,  type: NOTE_TYPE.CUBE,    dir: 'bottomright' },
            { time: 11000, type: NOTE_TYPE.SPHERE,  dir: 'left' },
            { time: 11000, type: NOTE_TYPE.PYRAMID, dir: 'right' },
            { time: 11200, type: NOTE_TYPE.CUBE,    dir: 'top' },
            { time: 11200, type: NOTE_TYPE.SPHERE,  dir: 'bottom' },
            { time: 12000, type: NOTE_TYPE.PYRAMID, dir: 'topleft' },
            { time: 12000, type: NOTE_TYPE.CUBE,    dir: 'bottomright' },
        ];

        sequence.forEach(n => {
            this.notes.push(new Note(n.time, n.type, n.dir));
        });
    }

    getCurrentTimeMs() {
        return this.time.now - this.startTime;
    }

    update() {
        const now = this.getCurrentTimeMs();

        this.notes.forEach(note => {
            if (note.hit || note.missed) return;

            if (now >= note.spawnTimeMs && !note.gameObject) {
                this.spawnNoteVisual(note);
            }

            if (note.gameObject) {
                const progress = Math.min(1, (now - note.spawnTimeMs) / APPROACH_TIME_MS);
                const spawn = this.getSpawnPosition(note.direction);

                note.gameObject.x = Phaser.Math.Linear(spawn.x, this.cx, progress);
                note.gameObject.y = Phaser.Math.Linear(spawn.y, this.cy, progress);

                if (note.glowObject) {
                    note.glowObject.x = note.gameObject.x;
                    note.glowObject.y = note.gameObject.y;
                }

                const scale = Phaser.Math.Linear(0.2, 1.0, progress);
                note.gameObject.setScale(scale);
                if (note.glowObject) note.glowObject.setScale(scale);
            }

            if (now - note.hitTimeMs > MISS_WINDOW_MS) {
                this.missNote(note);
            }
        });

        if (this.judgementDisplay.alpha > 0.01) {
            this.judgementDisplay.setAlpha(
                Phaser.Math.Linear(this.judgementDisplay.alpha, 0, 0.06)
            );
        }
    }

    spawnNoteVisual(note) {
        const spawn = this.getSpawnPosition(note.direction);
        const colors = {
            [NOTE_TYPE.SPHERE]:  0x4488ff,
            [NOTE_TYPE.CUBE]:    0xff44aa,
            [NOTE_TYPE.PYRAMID]: 0x44ffaa,
        };
        const color = colors[note.type];

        // Glow
        let glow;
        if (note.type === NOTE_TYPE.SPHERE) {
            glow = this.add.circle(spawn.x, spawn.y, 42, color, 0.15);
        } else if (note.type === NOTE_TYPE.CUBE) {
            glow = this.add.rectangle(spawn.x, spawn.y, 70, 70, color, 0.15);
        } else {
            glow = this.add.triangle(spawn.x, spawn.y, 0, 56, 56, -28, -56, -28, color, 0.15);
        }
        note.glowObject = glow;

        // Core
        let obj;
        if (note.type === NOTE_TYPE.SPHERE) {
            obj = this.add.circle(spawn.x, spawn.y, 28, color);
        } else if (note.type === NOTE_TYPE.CUBE) {
            obj = this.add.rectangle(spawn.x, spawn.y, 52, 52, color);
        } else {
            obj = this.add.triangle(spawn.x, spawn.y, 0, 48, 48, -24, -48, -24, color);
        }

        note.gameObject = obj;
    }

    handleInput(type) {
        const now = this.getCurrentTimeMs();
        let candidate = null;
        let bestOffset = Infinity;

        this.notes.forEach(note => {
            if (note.hit || note.missed) return;
            if (note.type !== type) return;
            const offset = Math.abs(note.hitTimeMs - now);
            if (offset <= MAX_HIT_WINDOW_MS && offset < bestOffset) {
                candidate = note;
                bestOffset = offset;
            }
        });

        if (candidate) {
            this.hitNote(candidate, bestOffset);
        } else {
            this.registerMiss();
        }
    }

    hitNote(note, offset) {
        note.hit = true;
        const isPerfect = offset <= PERFECT_WINDOW_MS;
        isPerfect ? this.perfectCount++ : this.goodCount++;
        this.combo++;

        this.showJudgement(isPerfect ? 'PERFECT' : 'GOOD', isPerfect ? '#00ffb4' : '#4488ff');
        this.updateComboDisplay();
        this.updateScoreDisplay();
        this.triggerCinematic(isPerfect);
        this.spawnHitParticles(note);

        if (note.gameObject) {
            note.gameObject.setFillStyle(isPerfect ? 0xffd700 : 0x88ccff);
            note.glowObject?.destroy();
            this.time.delayedCall(120, () => note.gameObject?.destroy());
        }
    }

    missNote(note) {
        note.missed = true;
        note.gameObject?.destroy();
        note.glowObject?.destroy();
        this.registerMiss();
    }

    registerMiss() {
        this.combo = 0;
        this.missCount++;
        this.showJudgement('MISS', '#ff3078');
        this.updateComboDisplay();
        this.triggerWhoopsSwing();
    }

    showJudgement(text, color) {
        this.judgementDisplay.setText(text).setColor(color).setAlpha(1);
    }

    updateComboDisplay() {
        this.comboDisplay.setText(this.combo > 1 ? `${this.combo} COMBO` : '');
    }

    updateScoreDisplay() {
        const score = this.perfectCount * 300 + this.goodCount * 100;
        this.scoreDisplay.setText(`SCORE ${score.toString().padStart(8, '0')}`);
    }

    spawnHitParticles(note) {
        const colors = {
            [NOTE_TYPE.SPHERE]:  0x4488ff,
            [NOTE_TYPE.CUBE]:    0xff44aa,
            [NOTE_TYPE.PYRAMID]: 0x44ffaa,
        };

        const emitter = this.add.particles(this.cx, this.cy, '__DEFAULT', {
            speed: { min: 80, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.4, end: 0 },
            lifespan: 400,
            quantity: 12,
            tint: colors[note.type],
        });

        this.time.delayedCall(500, () => emitter.destroy());
    }

    triggerCinematic(isPerfect) {
        this.cameras.main.zoomTo(
            isPerfect ? 1.08 : 1.05, 60, 'Linear', false,
            (cam, progress) => {
                if (progress === 1) {
                    this.time.delayedCall(40, () => {
                        this.cameras.main.shake(80, isPerfect ? 0.006 : 0.004);
                        this.cameras.main.zoomTo(1.0, 100);
                    });
                }
            }
        );
    }

    triggerWhoopsSwing() {
        this.cameras.main.zoomTo(1.03, 80, 'Linear', false, (cam, progress) => {
            if (progress === 1) {
                this.cameras.main.zoomTo(0.98, 120, 'Linear', false, (cam2, p2) => {
                    if (p2 === 1) this.cameras.main.zoomTo(1.0, 80);
                });
            }
        });
    }
}