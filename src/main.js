import * as Phaser from 'phaser';

// ── Timing constants (from SWING) ──
const PERFECT_WINDOW_MS = 110;
const MAX_HIT_WINDOW_MS = 250;
const MISS_WINDOW_MS = 250;
const APPROACH_TIME_MS = 2000;

// ── Note types (replaces lanes) ──
const NOTE_TYPE = {
    SPHERE: 'sphere',   // A - straight hit
    CUBE: 'cube',       // X - hold
    PYRAMID: 'pyramid'  // Y - multi
};

// ── Note class ──
class Note {
    constructor(hitTimeMs, type, x, y) {
        this.hitTimeMs = hitTimeMs;
        this.spawnTimeMs = hitTimeMs - APPROACH_TIME_MS;
        this.type = type;
        this.targetX = x;
        this.targetY = y;
        this.hit = false;
        this.missed = false;
        this.gameObject = null;
    }
}

// ── Main scene ──
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.notes = [];
        this.startTime = 0;
        this.combo = 0;
        this.perfectCount = 0;
        this.goodCount = 0;
        this.missCount = 0;
        this.judgementText = null;
        this.judgementTimer = 0;
    }

    create() {
        this.startTime = this.time.now;

        // Strike zone — where notes fly toward
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        this.strikeZone = this.add.circle(cx, cy, 50, 0xffffff, 0.1);
        this.add.circle(cx, cy, 50).setStrokeStyle(2, 0xffffff, 0.4);

        // Judgement text
        this.judgementDisplay = this.add.text(cx, cy - 100, '', {
            fontFamily: 'sans-serif',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Combo text
        this.comboDisplay = this.add.text(cx, cy + 80, '', {
            fontFamily: 'sans-serif',
            fontSize: '24px',
            color: '#ffdd00'
        }).setOrigin(0.5);

        // Spawn some test notes
        this.spawnTestNotes();

        // Input
   this.input.keyboard.addCapture(['D', 'F', 'J', 'K']);

this.input.keyboard.on('keydown-D', () => this.handleInput(NOTE_TYPE.SPHERE));
this.input.keyboard.on('keydown-F', () => this.handleInput(NOTE_TYPE.CUBE));
this.input.keyboard.on('keydown-J', () => this.handleInput(NOTE_TYPE.PYRAMID));
}

    spawnTestNotes() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // Spawn notes at different times and positions
        const testNotes = [
            { time: 2000, type: NOTE_TYPE.SPHERE,  fromX: this.scale.width + 50, fromY: cy },
            { time: 3000, type: NOTE_TYPE.CUBE,    fromX: this.scale.width + 50, fromY: cy - 100 },
            { time: 4000, type: NOTE_TYPE.PYRAMID, fromX: this.scale.width + 50, fromY: cy + 100 },
            { time: 5000, type: NOTE_TYPE.SPHERE,  fromX: this.scale.width + 50, fromY: cy },
            { time: 6000, type: NOTE_TYPE.CUBE,    fromX: this.scale.width + 50, fromY: cy - 150 },
        ];

        testNotes.forEach(n => {
            const note = new Note(n.time, n.type, cx, cy);
            note.spawnX = n.fromX;
            note.spawnY = n.fromY;
            this.notes.push(note);
        });
    }

    getCurrentTimeMs() {
        return this.time.now - this.startTime;
    }

    update() {
        const now = this.getCurrentTimeMs();

        this.notes.forEach(note => {
            if (note.hit || note.missed) return;

            // Spawn the visual when it's time
            if (now >= note.spawnTimeMs && !note.gameObject) {
                this.spawnNoteVisual(note);
            }

            // Move note toward strike zone
            if (note.gameObject) {
                const progress = (now - note.spawnTimeMs) / APPROACH_TIME_MS;
                note.gameObject.x = Phaser.Math.Linear(note.spawnX, note.targetX, progress);
                note.gameObject.y = Phaser.Math.Linear(note.spawnY, note.targetY, progress);

                // Scale up as it approaches — the 3D fudge
                const scale = Phaser.Math.Linear(0.3, 1.0, progress);
                note.gameObject.setScale(scale);
            }

            // Auto miss
            if (now - note.hitTimeMs > MISS_WINDOW_MS) {
                this.missNote(note);
            }
        });

        // Fade judgement text
        if (this.judgementDisplay.alpha > 0) {
            this.judgementDisplay.setAlpha(
                Phaser.Math.Linear(this.judgementDisplay.alpha, 0, 0.05)
            );
        }
    }

    spawnNoteVisual(note) {
        let obj;
        const colors = {
            [NOTE_TYPE.SPHERE]:  0x4488ff,
            [NOTE_TYPE.CUBE]:    0xff44aa,
            [NOTE_TYPE.PYRAMID]: 0x44ffaa,
        };
        const color = colors[note.type];

        if (note.type === NOTE_TYPE.SPHERE) {
            obj = this.add.circle(note.spawnX, note.spawnY, 30, color);
        } else if (note.type === NOTE_TYPE.CUBE) {
            obj = this.add.rectangle(note.spawnX, note.spawnY, 54, 54, color);
        } else {
            // Triangle for pyramid
            const tri = this.add.triangle(
                note.spawnX, note.spawnY,
                0, 40, 40, -20, -40, -20,
                color
            );
            obj = tri;
        }

        note.gameObject = obj;
    }

    handleInput(type) {
        const now = this.getCurrentTimeMs();

        // Find best candidate — closest note of matching type in window
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

        if (isPerfect) {
            this.perfectCount++;
            this.combo++;
            this.showJudgement('PERFECT', '#00ffb4');
        } else {
            this.goodCount++;
            this.combo++;
            this.showJudgement('GOOD', '#4488ff');
        }

        this.updateComboDisplay();
        this.triggerCinematic(note, isPerfect);

        // Flash and destroy note visual
        if (note.gameObject) {
            const color = isPerfect ? 0xffd700 : 0x4488ff;
            note.gameObject.setFillStyle(color);
            this.time.delayedCall(120, () => {
                note.gameObject?.destroy();
            });
        }
    }

    missNote(note) {
        note.missed = true;
        note.gameObject?.destroy();
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
        this.judgementDisplay
            .setText(text)
            .setColor(color)
            .setAlpha(1);
    }

    updateComboDisplay() {
        if (this.combo > 1) {
            this.comboDisplay.setText(`${this.combo} COMBO`);
        } else {
            this.comboDisplay.setText('');
        }
    }

    triggerCinematic(note, isPerfect) {
        // Snap zoom
        this.cameras.main.zoomTo(
            isPerfect ? 1.08 : 1.05,
            60,
            'Linear',
            false,
            (cam, progress) => {
                if (progress === 1) {
                    // Hold on solid line briefly then shake
                    this.time.delayedCall(40, () => {
                        this.cameras.main.shake(80, isPerfect ? 0.006 : 0.004);
                        this.cameras.main.zoomTo(1.0, 100);
                    });
                }
            }
        );
    }

    triggerWhoopsSwing() {
        // Affectionate miss swing — overshoots, never finds the solid line
        this.cameras.main.zoomTo(1.03, 80, 'Linear', false, (cam, progress) => {
            if (progress === 1) {
                this.cameras.main.zoomTo(0.98, 120, 'Linear', false, (cam2, p2) => {
                    if (p2 === 1) this.cameras.main.zoomTo(1.0, 80);
                });
            }
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: GameScene
};

new Phaser.Game(config);