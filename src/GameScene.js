import * as Phaser from 'phaser';

// ── Timing constants (from SWING) ──
const PERFECT_WINDOW_MS = 80;
const MAX_HIT_WINDOW_MS = 180;
const MISS_WINDOW_MS = 180;
const APPROACH_TIME_MS = 1200;

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
        this.holdStartMs = -1;
        this.holdKey = null;
        this.hitCount = 0;
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
        this.songTitle = 'Tell Me You Know';
        this.difficulty = 'MEDIUM';
        this.audioContext = null;
        this.audioSource = null;
        this.audioBuffer = null;
        this.gainNode = null;
        this.isFailing = false;
        this.failTimer = null;
        this.failWarning = false;
        this.tuningPct = 100;
        this.heldNotes = new Map();   // key -> note being held
        this.activeMultihits = new Map(); // note -> hit count
    }

    create() {
        this.loadAudio().then(() => this.startAudio());

        this.startTime = this.time.now;
        this.cx = this.scale.width / 2;
        this.cy = this.scale.height / 2;

        // ── Top bar ──
        const BAR_H = 72;

        // Bar background
        this.add.rectangle(this.cx, BAR_H / 2, this.scale.width, BAR_H, 0x000000, 0.88)
            .setDepth(20);

        // Bottom edge line
        this.add.rectangle(this.cx, BAR_H, this.scale.width, 1, 0x00ffb4, 1)
            .setDepth(21);

        // ── Left — song info ──
        this.add.text(20, 14, this.songTitle, {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '17px',
            fontStyle: 'bold',
            color: '#ffffff',
        }).setDepth(21);

        this.add.text(20, 38, this.difficulty, {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '13px',
            color: '#888888',
            letterSpacing: 3,
        }).setDepth(21);

        // ── Center — tuning ──
        this.tuningPercentText = this.add.text(this.cx, 10, '100% tuned', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#ffd700',
        }).setOrigin(0.5, 0).setDepth(21);

        this.tuningProseText = this.add.text(this.cx, 30, 'Perfect. The world holds its breath with you.', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '11px',
            fontStyle: 'italic',
            color: '#777777',
            align: 'center',
            wordWrap: { width: 420 }
        }).setOrigin(0.5, 0).setDepth(21);

        // Tuning fill bar
        const fillBarW = 320;
        const fillBarX = this.cx - fillBarW / 2;
        const fillBarY = 58;

        // Track
        this.add.rectangle(this.cx, fillBarY, fillBarW, 3, 0xffffff, 0.1)
            .setDepth(21);

        // Fill
        this.tuningFill = this.add.rectangle(fillBarX, fillBarY, fillBarW, 3, 0xffd700, 1)
            .setOrigin(0, 0.5)
            .setDepth(22);

        // ── Right — score ──
        this.scoreLabel = this.add.text(this.scale.width - 20, 10, 'SCORE', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '11px',
            color: '#888888',
            letterSpacing: 2,
        }).setOrigin(1, 0).setDepth(21);

        this.scoreText = this.add.text(this.scale.width - 20, 24, '00000000', {
            fontFamily: 'SuperBubble, sans-serif',
            fontSize: '28px',
            color: '#ffffff',
        }).setOrigin(1, 0).setDepth(21);

        // ── Strike zone ──
        this.add.circle(this.cx, this.cy, 55).setStrokeStyle(2, 0xffffff, 0.15);
        this.add.circle(this.cx, this.cy, 8, 0xffffff, 0.6);

        // ── Judgement ──
        this.judgementDisplay = this.add.text(this.cx, this.cy - 120, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(10);

        // ── Combo ──
        this.comboDisplay = this.add.text(this.cx, this.cy + 90, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#ffdd00',
        }).setOrigin(0.5).setDepth(10);

        // ── Progress bar — bottom ──
        const barY = this.scale.height - 24;
        const barW = this.scale.width - 80;
        const barX = 40;

        this.add.rectangle(barX + barW / 2, barY, barW, 3, 0xffffff, 0.1).setDepth(10);
        this.progressFill = this.add.rectangle(barX, barY, 0, 3, 0x00ffb4, 0.8)
            .setOrigin(0, 0.5).setDepth(10);

        this.timeDisplay = this.add.text(this.cx, barY - 14, '', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '12px',
            color: '#555555',
        }).setOrigin(0.5).setDepth(10);

        // Spawn notes
        this.loadChart('/src/assets/charts/tellmeyouknow_MEDIUM.json');

        // Input
        this.input.keyboard.addCapture(['D', 'F', 'J', 'K']);
        this.input.keyboard.on('keydown-D', () => this.handleInput(NOTE_TYPE.SPHERE, 'D'));
        this.input.keyboard.on('keydown-F', () => this.handleInput(NOTE_TYPE.CUBE, 'F'));
        this.input.keyboard.on('keydown-J', () => this.handleInput(NOTE_TYPE.PYRAMID, 'J'));
        this.input.keyboard.on('keyup-D', () => this.handleRelease('D'));
        this.input.keyboard.on('keyup-F', () => this.handleRelease('F'));
        this.input.keyboard.on('keyup-J', () => this.handleRelease('J'));

        // Fade in
        this.cameras.main.fadeIn(400, 0, 0, 0);

        // Initial tuning
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
        this.time.delayedCall(300, () => this.cameras.main.shake(150, 0.008));
        this.time.delayedCall(800, () => this.cameras.main.shake(100, 0.005));
        this.time.delayedCall(1200, () => this.cameras.main.fadeOut(800, 0, 0, 0));
        this.time.delayedCall(2000, () => this.showFailScreen());
    }

    showFailScreen() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        const pct = this.tuningPct;

        const notCleared = this.add.text(cx, cy - 40, 'NOT CLEARED', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#ff3078',
        }).setOrigin(0.5).setDepth(30).setAlpha(0);

        const pctText = this.add.text(cx, cy + 20, `${pct}% tuned`, {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '28px',
            color: '#aaaaaa',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(30).setAlpha(0);

        const continueText = this.add.text(cx, cy + 60, 'press any key to continue', {
            fontFamily: 'Fira Sans, sans-serif',
            fontSize: '16px',
            color: '#555555',
        }).setOrigin(0.5).setDepth(30).setAlpha(0);

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

    getSpawnPosition(direction) {
        const w = this.scale.width;
        const h = this.scale.height;
        const margin = 80;

        return {
            left:        { x: -margin,    y: this.cy },
            right:       { x: w + margin, y: this.cy },
            top:         { x: this.cx,    y: -margin },
            bottom:      { x: this.cx,    y: h + margin },
            topleft:     { x: -margin,    y: -margin },
            topright:    { x: w + margin, y: -margin },
            bottomleft:  { x: -margin,    y: h + margin },
            bottomright: { x: w + margin, y: h + margin },
        }[direction];
    }

    async loadChart(chartPath) {
        const response = await fetch(chartPath);
        const chart = await response.json();

        this.songTitle = chart.song;
        this.difficulty = chart.difficulty;
        this.songDurationMs = chart.durationMs;

        chart.notes.forEach(n => {
            const note = new Note(n.t, n.shape, n.dir);
            note.velocity = n.velocity ?? 1.0;
            note.intensity = n.intensity ?? 1;
            note.duration = n.duration ?? 0;
            this.notes.push(note);
        });

        console.log(`Loaded ${this.notes.length} notes from ${chartPath}`);
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

            if (note.gameObject && !note.frozen) {
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

                // Tail follows cube toward spawn
                if (note.tailObject) {
                    const spawn2 = this.getSpawnPosition(note.direction);
                    const angle = Phaser.Math.Angle.Between(this.cx, this.cy, spawn2.x, spawn2.y);
                    note.tailObject.x = note.gameObject.x + Math.cos(angle) * 40 * scale;
                    note.tailObject.y = note.gameObject.y + Math.sin(angle) * 40 * scale;
                    note.tailObject.setRotation(angle);
                    note.tailObject.setScale(scale);
                }

                // Bubble follows pyramid
                if (note.bubbleObject) {
                    note.bubbleObject.x = note.gameObject.x;
                    note.bubbleObject.y = note.gameObject.y;
                    note.bubbleObject.setScale(scale);
                }
            }

            if (!note.frozen && now - note.hitTimeMs > MISS_WINDOW_MS) {
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

        // ── Cube tail ──
        if (note.type === NOTE_TYPE.CUBE) {
            const tail = this.add.rectangle(spawn.x, spawn.y, 60, 10, color, 0.4);
            note.tailObject = tail;
        }

        // ── Pyramid bubble ──
        if (note.type === NOTE_TYPE.PYRAMID) {
            const bubble = this.add.circle(spawn.x, spawn.y, 48, color, 0.2);
            bubble.setStrokeStyle(2, color, 0.6);
            note.bubbleObject = bubble;
        }
    }

    handleInput(type, key) {
        const now = this.getCurrentTimeMs();
        let candidate = null;
        let bestOffset = Infinity;

        this.notes.forEach(note => {
            if (note.missed) return;
            if (note.type !== type) return;
            if (note.type === NOTE_TYPE.CUBE && note.holdStartMs >= 0) return;
            if (note.hit && note.type !== NOTE_TYPE.PYRAMID) return;
<<<<<<< HEAD
=======
            // Frozen pyramid — always hittable, no time window
            if (note.frozen) {
                candidate = note;
                bestOffset = 0;
                return;
            }
>>>>>>> add562d (new song: its coming to a close i guess i should know)
            const offset = Math.abs(note.hitTimeMs - now);
            if (offset <= MAX_HIT_WINDOW_MS && offset < bestOffset) {
                candidate = note;
                bestOffset = offset;
            }
        });

        if (!candidate) return;

        if (candidate.type === NOTE_TYPE.CUBE) {
            this.startHold(candidate, bestOffset, key);
        } else if (candidate.type === NOTE_TYPE.PYRAMID) {
            this.handleMultihit(candidate, bestOffset);
        } else {
            this.hitNote(candidate, bestOffset);
        }
<<<<<<< HEAD
=======
    }

    startHold(note, offset, key) {
        const isPerfect = offset <= PERFECT_WINDOW_MS;
        note.holdStartMs = this.getCurrentTimeMs();
        note.holdKey = key;
        note.hit = true; // prevent auto-miss during hold
        this.heldNotes.set(key, note);
        note.gameObject?.setFillStyle(isPerfect ? 0xffd700 : 0x88ccff);
        this.showJudgement('HOLD', '#ff44aa');
    }

    handleRelease(key) {
        const note = this.heldNotes.get(key);
        if (!note) return;
        this.heldNotes.delete(key);

        const now = this.getCurrentTimeMs();
        const expectedDuration = note.duration || 500;
        const releaseOffset = Math.abs(now - (note.hitTimeMs + expectedDuration));
        const isPerfect = releaseOffset <= PERFECT_WINDOW_MS;

        note.hit = true;
        isPerfect ? this.perfectCount++ : this.goodCount++;
        this.combo++;

        this.showJudgement(isPerfect ? 'PERFECT' : 'GOOD', isPerfect ? '#00ffb4' : '#4488ff');
        this.updateComboDisplay();
        this.updateScoreDisplay();
        this.updateTuning();
        this.triggerCinematic(isPerfect);
        this.spawnHitParticles(note);
        note.tailObject?.destroy();
        note.gameObject?.destroy();
        note.glowObject?.destroy();
    }

    handleMultihit(note, offset) {
        const count = (this.activeMultihits.get(note) || 0) + 1;
        this.activeMultihits.set(note, count);

        if (count === 1) {
            note.hit = false; // explicitly keep hittable for second hit
            note.frozen = true; // stop update loop from moving it
            // Spin away then bounce back
            if (note.gameObject) {
                const ox = note.gameObject.x;
                const oy = note.gameObject.y;
                this.tweens.add({
                    targets: note.gameObject,
                    x: ox + Phaser.Math.Between(-80, 80),
                    y: oy + Phaser.Math.Between(-80, 80),
                    angle: 360,
                    duration: 300,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        this.tweens.add({
                            targets: note.gameObject,
                            x: this.cx,
                            y: this.cy - 60,
                            angle: 0,
                            duration: 300,
                            ease: 'Sine.easeIn'
                        });
                    }
                });
            }
            note.gameObject?.setFillStyle(0xffaa00);
            this.showJudgement('HIT!', '#44ffaa');
            if (note.bubbleObject) {
                this.tweens.add({
                    targets: note.bubbleObject,
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    duration: 200,
                    ease: 'Sine.easeOut',
                    onComplete: () => note.bubbleObject?.destroy()
                });
                note.bubbleObject = null;
            }
        } else if (count >= 2) {
            this.activeMultihits.delete(note);
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
            note.glowObject?.destroy();
            this.time.delayedCall(120, () => note.gameObject?.destroy());
        }
>>>>>>> add562d (new song: its coming to a close i guess i should know)
    }

    startHold(note, offset, key) {
        const isPerfect = offset <= PERFECT_WINDOW_MS;
        note.holdStartMs = this.getCurrentTimeMs();
        note.holdKey = key;
        this.heldNotes.set(key, note);
        note.gameObject?.setFillStyle(isPerfect ? 0xffd700 : 0x88ccff);
        this.showJudgement('HOLD', '#ff44aa');
    }

    handleRelease(key) {
        const note = this.heldNotes.get(key);
        if (!note) return;
        this.heldNotes.delete(key);

        const now = this.getCurrentTimeMs();
        const expectedDuration = note.duration || 500;
        const releaseOffset = Math.abs(now - (note.hitTimeMs + expectedDuration));
        const isPerfect = releaseOffset <= PERFECT_WINDOW_MS;

        note.hit = true;
        isPerfect ? this.perfectCount++ : this.goodCount++;
        this.combo++;

        this.showJudgement(isPerfect ? 'PERFECT' : 'GOOD', isPerfect ? '#00ffb4' : '#4488ff');
        this.updateComboDisplay();
        this.updateScoreDisplay();
        this.updateTuning();
        this.triggerCinematic(isPerfect);
        this.spawnHitParticles(note);
        note.tailObject?.destroy();
        note.gameObject?.destroy();
        note.glowObject?.destroy();
    }

    handleMultihit(note, offset) {
        const count = (this.activeMultihits.get(note) || 0) + 1;
        this.activeMultihits.set(note, count);

        if (count === 1) {
            note.gameObject?.setFillStyle(0xffaa00);
            this.showJudgement('HIT!', '#44ffaa');
            if (note.bubbleObject) {
                this.tweens.add({
                    targets: note.bubbleObject,
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    duration: 200,
                    ease: 'Sine.easeOut',
                    onComplete: () => note.bubbleObject?.destroy()
                });
                note.bubbleObject = null;
            }
        } else if (count >= 2) {
            this.activeMultihits.delete(note);
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
            note.glowObject?.destroy();
            this.time.delayedCall(120, () => note.gameObject?.destroy());
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
        note.tailObject?.destroy();
        note.bubbleObject?.destroy();
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
        this.scoreText.setText(score.toString().padStart(8, '0'));
        this.flashScoreAberration();
    }

    flashScoreAberration() {
        const cx = this.scoreText.x;
        const cy = this.scoreText.y;
        const txt = this.scoreText.text;

        const red = this.add.text(cx - 3, cy + 2, txt, {
            fontFamily: 'SuperBubble, sans-serif',
            fontSize: '28px',
            color: '#ff0055',
        }).setOrigin(1, 0).setDepth(21).setAlpha(0.7);

        const blue = this.add.text(cx + 3, cy - 2, txt, {
            fontFamily: 'SuperBubble, sans-serif',
            fontSize: '28px',
            color: '#0055ff',
        }).setOrigin(1, 0).setDepth(21).setAlpha(0.7);

        this.tweens.add({
            targets: [red, blue],
            alpha: 0,
            duration: 180,
            ease: 'Sine.easeOut',
            onComplete: () => {
                red.destroy();
                blue.destroy();
            }
        });
    }

    getTuningData(pct) {
        if (pct === 100) return {
            label: '100% tuned',
            color: '#ffd700',
            fillColor: 0xffd700,
            prose: 'Perfect. The world holds its breath with you.'
        };
        if (pct >= 90) return {
            label: `${pct}% tuned`,
            color: '#00ffb4',
            fillColor: 0x00ffb4,
            prose: 'The world stills beneath your feet. You feel a sense of calm overtake the place. As if the world paused, then started off again.'
        };
        if (pct >= 75) return {
            label: `${pct}% tuned`,
            color: '#4488ff',
            fillColor: 0x4488ff,
            prose: 'Something hums just beneath the surface. The city is listening.'
        };
        if (pct >= 60) return {
            label: `${pct}% tuned`,
            color: '#ffdd00',
            fillColor: 0xffdd00,
            prose: 'The frequency wavers. You can feel it slipping at the edges.'
        };
        if (pct >= 40) return {
            label: `${pct}% tuned`,
            color: '#ff8800',
            fillColor: 0xff8800,
            prose: 'The air feels wrong. Like a song played in the wrong key.'
        };
        if (pct > 0) return {
            label: `${pct}% tuned`,
            color: '#ff3078',
            fillColor: 0xff3078,
            prose: 'The world is losing the thread. So are you.'
        };
        return {
            label: '0% tuned',
            color: '#ff3078',
            fillColor: 0xff3078,
            prose: ''
        };
    }

    updateTuning() {
        const total = this.perfectCount + this.goodCount + this.missCount;
        
        if (total === 0) {
            this.tuningPct = 100;
        } else {
            const accuracy = ((this.perfectCount + this.goodCount * 0.85) / total) * 100;
            this.tuningPct = Math.round(accuracy);
        }

        const data = this.getTuningData(this.tuningPct);
        this.tuningPercentText.setText(data.label).setColor(data.color);
        this.tuningProseText.setText(data.prose);

        // Update fill bar width and color
        const fillBarW = 320;
        this.tuningFill.width = fillBarW * (this.tuningPct / 100);
        this.tuningFill.setFillStyle(data.fillColor);

        // Fail condition
        if (!this.isFailing && !this.failTimer) {
            if (this.tuningPct < 50) {
                this.failTimer = this.time.delayedCall(50000, () => {
                    this.triggerTapeSlowdown();
                });
                this.failWarning = true;
            }
        } else if (this.failTimer && this.failWarning) {
            if (this.tuningPct >= 50) {
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