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
        this.songDurationMs = 14000;
        this.audioContext = null;
        this.audioSource = null;
        this.audioBuffer = null;
        this.gainNode = null;
        this.isFailing = false;
        this.failTimer = null;
        this.failWarning = false;
    }

    create() {
    this.loadAudio().then(() => {
        this.startAudio();
    });

        this.startTime = this.time.now;
        this.cx = this.scale.width / 2;
        this.cy = this.scale.height / 2;

        // Strike zone
        this.add.circle(this.cx, this.cy, 55).setStrokeStyle(2, 0xffffff, 0.15);
        this.add.circle(this.cx, this.cy, 8, 0xffffff, 0.6);

        // ── HUD ──

        // Score — top left
        this.scoreDisplay = this.add.text(20, 20, 'SCORE 00000000', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '18px',
            color: '#ffffff',
        }).setDepth(10);

        // Tuning percentage — top center
        this.tuningPercent = this.add.text(this.cx, 20, '100% tuned', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#00ffb4',
        }).setOrigin(0.5, 0).setDepth(10);

        // Tuning prose — below percentage
        this.tuningProse = this.add.text(this.cx, 44, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            fontStyle: 'italic',
            color: '#aaaaaa',
            align: 'center',
            wordWrap: { width: 500 }
        }).setOrigin(0.5, 0).setDepth(10);

        // Judgement — center
        this.judgementDisplay = this.add.text(this.cx, this.cy - 120, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(10);

        // Combo — below judgement
        this.comboDisplay = this.add.text(this.cx, this.cy + 90, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#ffdd00',
        }).setOrigin(0.5).setDepth(10);

        // Miss counter — top right
        this.missDisplay = this.add.text(this.scale.width - 20, 20, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '15px',
            color: '#ff3078',
        }).setOrigin(1, 0).setDepth(10);

        // ── Progress bar — bottom ──
        const barY = this.scale.height - 24;
        const barW = this.scale.width - 80;
        const barX = 40;

        this.add.rectangle(barX + barW / 2, barY, barW, 4, 0xffffff, 0.1).setDepth(10);
        this.progressFill = this.add.rectangle(barX, barY, 0, 4, 0x00ffb4, 0.8)
            .setOrigin(0, 0.5).setDepth(10);

        this.timeDisplay = this.add.text(this.cx, barY - 14, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '12px',
            color: '#666666',
        }).setOrigin(0.5).setDepth(10);

        // Spawn notes
        this.spawnTestNotes();

        // Input
        this.input.keyboard.addCapture(['D', 'F', 'J', 'K']);
        this.input.keyboard.on('keydown-D', () => this.handleInput(NOTE_TYPE.SPHERE));
        this.input.keyboard.on('keydown-F', () => this.handleInput(NOTE_TYPE.CUBE));
        this.input.keyboard.on('keydown-J', () => this.handleInput(NOTE_TYPE.PYRAMID));

        // Fade in
        this.cameras.main.fadeIn(400, 0, 0, 0);

        // Initial tuning state
        this.updateTuning();
    }

    async loadAudio() {
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);

        const response = await fetch('/src/assets/audio/tellmeyouknow.mp3');
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    }

    startAudio() {
        if (!this.audioBuffer) return;
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.connect(this.gainNode);
        this.audioSource.start(0);
    }

    triggerTapeSlowdown() {
        if (this.isFailing) return;
        this.isFailing = true;

        const source = this.audioSource;
        const ctx = this.audioContext;
        if (!source) return;

        source.playbackRate.setValueAtTime(1, ctx.currentTime);
        source.playbackRate.linearRampToValueAtTime(0, ctx.currentTime + 2);

        this.gainNode.gain.setValueAtTime(1, ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);

        this.cameras.main.shake(200, 0.01);

        this.time.delayedCall(300, () => {
            this.cameras.main.shake(150, 0.008);
        });

        this.time.delayedCall(800, () => {
            this.cameras.main.shake(100, 0.005);
        });

        this.time.delayedCall(1200, () => {
            this.cameras.main.fadeOut(800, 0, 0, 0);
        });

        this.time.delayedCall(2000, () => {
            this.showFailScreen();
        });
    }

    showFailScreen() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        const pct = this.getCurrentTuningPct();

        const notCleared = this.add.text(cx, cy - 40, 'NOT CLEARED', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#ff3078',
        }).setOrigin(0.5).setDepth(20).setAlpha(0);

        const pctText = this.add.text(cx, cy + 20, `${pct}% tuned`, {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '28px',
            color: '#aaaaaa',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(20).setAlpha(0);

        const continueText = this.add.text(cx, cy + 60, 'press any key to continue', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '16px',
            color: '#555555',
        }).setOrigin(0.5).setDepth(20).setAlpha(0);

        this.cameras.main.fadeIn(600, 0, 0, 0);

        [notCleared, pctText, continueText].forEach(c => {
            this.tweens.add({
                targets: c,
                alpha: 1,
                duration: 600,
                ease: 'Sine.easeIn'
            });
        });

        this.input.keyboard.once('keydown', () => {
            this.audioContext?.close();
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('MenuScene');
            });
        });
    }

    getCurrentTuningPct() {
        const total = this.perfectCount + this.goodCount + this.missCount;
        if (total === 0) return 100;
        const accuracy = ((this.perfectCount + this.goodCount * 0.7) / total) * 100;
        return Math.round(accuracy);
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
        if (this.isFailing) return;

        const now = this.getCurrentTimeMs();

        // Progress bar
        const songProgress = Math.min(1, now / this.songDurationMs);
        const barW = this.scale.width - 80;
        this.progressFill.width = barW * songProgress;

        // Time display
        const elapsed = Math.floor(now / 1000);
        const total = Math.floor(this.songDurationMs / 1000);
        const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        this.timeDisplay.setText(`${fmt(elapsed)} / ${fmt(total)}`);

        // Notes
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

        // Fade judgement
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

        let glow;
        if (note.type === NOTE_TYPE.SPHERE) {
            glow = this.add.circle(spawn.x, spawn.y, 42, color, 0.15);
        } else if (note.type === NOTE_TYPE.CUBE) {
            glow = this.add.rectangle(spawn.x, spawn.y, 70, 70, color, 0.15);
        } else {
            glow = this.add.triangle(spawn.x, spawn.y, 0, 56, 56, -28, -56, -28, color, 0.15);
        }
        note.glowObject = glow;

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
        this.updateTuning();
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
        this.updateScoreDisplay();
        this.updateTuning();
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
        this.missDisplay.setText(this.missCount > 0 ? `${this.missCount} miss` : '');
    }

    getTuningData(pct) {
        if (pct === 100) return {
            label: '100% tuned',
            color: '#ffd700',
            prose: 'Perfect. The world holds its breath with you.'
        };
        if (pct >= 90) return {
            label: `${pct}% tuned`,
            color: '#00ffb4',
            prose: 'The world stills beneath your feet. You feel a sense of calm overtake the place. As if the world paused, then started off again.'
        };
        if (pct >= 75) return {
            label: `${pct}% tuned`,
            color: '#4488ff',
            prose: 'Something hums just beneath the surface. The city is listening.'
        };
        if (pct >= 60) return {
            label: `${pct}% tuned`,
            color: '#ffdd00',
            prose: 'The frequency wavers. You can feel it slipping at the edges.'
        };
        if (pct >= 40) return {
            label: `${pct}% tuned`,
            color: '#ff8800',
            prose: 'The air feels wrong. Like a song played in the wrong key.'
        };
        if (pct > 0) return {
            label: `${pct}% tuned`,
            color: '#ff3078',
            prose: 'The world is losing the thread. So are you.'
        };
        return {
            label: '0% tuned',
            color: '#ff3078',
            prose: ''
        };
    }

    updateTuning() {
        const total = this.perfectCount + this.goodCount + this.missCount;
        if (total === 0) {
            const data = this.getTuningData(100);
            this.tuningPercent.setText(data.label).setColor(data.color);
            this.tuningProse.setText(data.prose);
            return;
        }

        const accuracy = ((this.perfectCount + this.goodCount * 0.7) / total) * 100;
        const pct = Math.round(accuracy);
        const data = this.getTuningData(pct);
        this.tuningPercent.setText(data.label).setColor(data.color);
        this.tuningProse.setText(data.prose);

        // Fail condition check
        if (!this.isFailing && !this.failTimer) {
            if (pct < 50) {
                this.failTimer = this.time.delayedCall(50000, () => {
                    this.triggerTapeSlowdown();
                });
                this.failWarning = true;
            }
        } else if (this.failTimer && this.failWarning) {
            if (pct >= 50) {
                this.failTimer.remove();
                this.failTimer = null;
                this.failWarning = false;
            }
        }
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