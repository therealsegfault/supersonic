import * as Phaser from 'phaser';

// ── Timing constants (from SWING) ──
const PERFECT_WINDOW_MS = 80;
const MAX_HIT_WINDOW_MS = 250;
const MISS_WINDOW_MS = 600;
const APPROACH_TIME_MS = 1200;

// ── Note types ──
const NOTE_TYPE = {
    SPHERE: 'sphere',
    CUBE: 'cube',
    PYRAMID: 'pyramid'
};

const NOTE_COLORS = {
    sphere:  0x4488ff,
    cube:    0xff44aa,
    pyramid: 0x44ffaa,
};

// ── Note class ──
class Note {
    constructor(hitTimeMs, type, direction) {
        this.hitTimeMs = hitTimeMs;
        const approachMs = type === 'pyramid' ? APPROACH_TIME_MS * 0.7 : APPROACH_TIME_MS;
        this.spawnTimeMs = hitTimeMs - approachMs;
        this.approachMs = approachMs;
        this.type = type;
        this.direction = direction;
        this.hit = false;
        this.missed = false;
        this.gameObject = null;
        this.glowObject = null;
        this.holdStartMs = -1;
        this.holdKey = null;
        this.hitCount = 0;
        this.frozen = false;
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
        this.cinematicActive = false;
        this.isPaused = false;
        this.pauseStartTime = null;
        this.heldNotes = new Map();   // key -> note being held
        this.activeMultihits = new Map(); // note -> hit count
    }

    create(data) {
        // Accept dynamic song/chart data from SongSelectScene
        if (data && data.chartPath) {
            this.chartPath = data.chartPath;
            this.audioPath = data.audioPath;
            this.songTitle = data.songTitle || 'Unknown';
            this.difficulty = data.difficulty || 'MEDIUM';
        } else {
            this.chartPath = '/src/assets/charts/tellmeyouknow_MEDIUM.json';
            this.audioPath = '/src/assets/audio/tellmeyouknow.mp3';
        }

        this.startTime = null; // set when audio actually starts
        this.loadAudio().then(() => this.startAudio());
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
        this.loadChart(this.chartPath);

        // Input
        this.input.keyboard.addCapture(['D', 'F', 'J', 'K', 'ESC']);
        this.input.keyboard.on('keydown-D', () => this.handleInput(NOTE_TYPE.SPHERE, 'D'));
        this.input.keyboard.on('keydown-F', () => this.handleInput(NOTE_TYPE.CUBE, 'F'));
        this.input.keyboard.on('keydown-J', () => this.handleInput(NOTE_TYPE.PYRAMID, 'J'));
        this.input.keyboard.on('keydown-ESC', () => this.togglePause());
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

        const response = await fetch(this.audioPath);
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    }

    startAudio() {
        if (!this.audioBuffer) return;
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.connect(this.gainNode);
        this.audioStartContextTime = this.audioContext.currentTime;
        this.audioSource.start(0);
        this.startTime = this.time.now;
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
        let chart;
        if (chartPath.startsWith('idb:')) {
            const { loadChart } = await import('./DB.js');
            chart = await loadChart(chartPath.slice(4));
        } else {
            const response = await fetch(chartPath);
            chart = await response.json();
        }

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
        if (!this.audioContext || !this.audioStartContextTime) return -APPROACH_TIME_MS;
        return (this.audioContext.currentTime - this.audioStartContextTime) * 1000;
    }

    // ── Bezier curve helpers ──
    getBezierPoint(p0, cp1, cp2, p1, t) {
        const mt = 1 - t;
        return {
            x: mt*mt*mt*p0.x + 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t*p1.x,
            y: mt*mt*mt*p0.y + 3*mt*mt*t*cp1.y + 3*mt*t*t*cp2.y + t*t*t*p1.y,
        };
    }

    getNoteCurve(spawn, direction) {
        // Control points create a sweeping arc based on spawn direction
        const cx = this.cx, cy = this.cy;
        const dx = cx - spawn.x, dy = cy - spawn.y;
        const perp = { x: -dy, y: dx };
        const len = Math.sqrt(perp.x*perp.x + perp.y*perp.y);
        const norm = { x: perp.x/len, y: perp.y/len };

        // Curve magnitude — sphere gentle, cube moderate, pyramid dramatic
        const mag = direction === 'pyramid' ? 180 : direction === 'cube' ? 100 : 60;

        return {
            p0: spawn,
            cp1: {
                x: spawn.x + dx*0.3 + norm.x*mag,
                y: spawn.y + dy*0.3 + norm.y*mag,
            },
            cp2: {
                x: spawn.x + dx*0.7 - norm.x*mag*0.5,
                y: spawn.y + dy*0.7 - norm.y*mag*0.5,
            },
            p1: { x: cx, y: cy },
        };
    }

    update() {
        if (this.isFailing || this.isPaused) return;

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
            if (note.hit || note.missed || note.frozen) return;

            if (now >= note.spawnTimeMs && !note.gameObject) {
                this.spawnNoteVisual(note);
            }

            if (note.gameObject && !note.frozen) {
                const progress = Math.min(1, (now - note.spawnTimeMs) / (note.approachMs || APPROACH_TIME_MS));
                const spawn = this.getSpawnPosition(note.direction);
                const curve = note.curve || (note.curve = this.getNoteCurve(spawn, note.type));

                const pos = this.getBezierPoint(curve.p0, curve.cp1, curve.cp2, curve.p1, progress);
                note.gameObject.x = pos.x;
                note.gameObject.y = pos.y;

                if (note.glowObject) {
                    note.glowObject.x = pos.x;
                    note.glowObject.y = pos.y;
                }

                const scale = Phaser.Math.Linear(0.2, 1.0, progress);
                note.gameObject.setScale(scale);
                if (note.glowObject) note.glowObject.setScale(scale);

                // ── Cube time-synced tail ──
                if (note.tailObject && note.tailGraphics) {
                    const duration = note.duration > 0 ? note.duration : 500;
                    const holdProgress = note.holdStartMs >= 0
                        ? Math.min(1, (now - note.holdStartMs) / duration)
                        : 0;

                    // Draw tail as line along bezier path behind note
                    note.tailGraphics.clear();
                    const tailColor = NOTE_COLORS[note.type] || 0xff44aa;
                    note.tailGraphics.lineStyle(8, tailColor, 0.5);
                    note.tailGraphics.beginPath();

                    // Tail shrinks from back as hold progresses
                    // maxTailLength in bezier progress units (0-1)
                    const maxTailLength = Math.min(0.5, duration / (APPROACH_TIME_MS * 2));
                    const tailLength = maxTailLength * (1 - holdProgress);
                    const tailStart = Math.max(0, progress - tailLength);
                    const steps = 12;
                    for (let s = 0; s <= steps; s++) {
                        const t = Phaser.Math.Linear(tailStart, progress, s/steps);
                        const tp = this.getBezierPoint(curve.p0, curve.cp1, curve.cp2, curve.p1, t);
                        if (s === 0) note.tailGraphics.moveTo(tp.x, tp.y);
                        else note.tailGraphics.lineTo(tp.x, tp.y);
                    }
                    note.tailGraphics.strokePath();
                }

                // ── Bubble follows pyramid ──
                if (note.bubbleObject) {
                    note.bubbleObject.x = pos.x;
                    note.bubbleObject.y = pos.y;
                    note.bubbleObject.setScale(scale);
                }

                // ── Pyramid approach bounce ──
                if (note.type === NOTE_TYPE.PYRAMID && !note.hitCount) {
                    const bounce = Math.sin(progress * Math.PI * 3) * 8 * (1 - progress);
                    note.gameObject.y += bounce;
                    if (note.bubbleObject) note.bubbleObject.y += bounce;
                }
            }

            if (!note.frozen && now > APPROACH_TIME_MS && now - note.hitTimeMs > MISS_WINDOW_MS) {
                this.missNote(note);
            }
        });

        // Keep frozen pyramid visuals alive
        this.notes.forEach(note => {
            if (!note.frozen || note.missed) return;
            // Just keep it visible, movement handled by tween
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
        const color = NOTE_COLORS[note.type];

        // Pre-calculate bezier curve
        note.curve = this.getNoteCurve(spawn, note.type);

        let glow;
        if (note.type === NOTE_TYPE.SPHERE) {
            glow = this.add.circle(spawn.x, spawn.y, 42, color, 0.12);
        } else if (note.type === NOTE_TYPE.CUBE) {
            glow = this.add.rectangle(spawn.x, spawn.y, 70, 70, color, 0.12);
        } else {
            glow = this.add.triangle(spawn.x, spawn.y, 0, 56, 56, -28, -56, -28, color, 0.12);
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

        // ── Cube tail — drawn as bezier path ──
        if (note.type === NOTE_TYPE.CUBE) {
            note.tailGraphics = this.add.graphics();
            note.tailObject = true; // flag for update loop
        }

        // ── Pyramid bubble ──
        if (note.type === NOTE_TYPE.PYRAMID) {
            const bubble = this.add.circle(spawn.x, spawn.y, 48, color, 0.15);
            bubble.setStrokeStyle(2, color, 0.5);
            note.bubbleObject = bubble;
        }
    }

    burstNote(note, isPerfect) {
        const x = note.gameObject ? note.gameObject.x : this.cx;
        const y = note.gameObject ? note.gameObject.y : this.cy;
        const colors = {
            [NOTE_TYPE.SPHERE]:  0x4488ff,
            [NOTE_TYPE.CUBE]:    0xff44aa,
            [NOTE_TYPE.PYRAMID]: 0x44ffaa,
        };
        const color = isPerfect ? 0xffd700 : (NOTE_COLORS[note.type] || 0xffffff);
        const shardCount = isPerfect ? 12 : 8;

        for (let i = 0; i < shardCount; i++) {
            const angle = (i / shardCount) * Math.PI * 2;
            const speed = isPerfect ? Phaser.Math.Between(120, 220) : Phaser.Math.Between(60, 140);
            const shard = this.add.rectangle(x, y, 12, 4, color);
            shard.setRotation(angle);

            this.tweens.add({
                targets: shard,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: isPerfect ? 600 : 350,
                ease: 'Sine.easeOut',
                onComplete: () => shard.destroy(),
            });
        }

        // White flash
        const flash = this.add.circle(x, y, isPerfect ? 50 : 30, 0xffffff, 0.9);
        this.tweens.add({
            targets: flash,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 200,
            ease: 'Sine.easeOut',
            onComplete: () => flash.destroy(),
        });

        // Shockwave ring for PERFECT
        if (isPerfect) {
            const ring = this.add.circle(x, y, 20, 0xffd700, 0);
            ring.setStrokeStyle(3, 0xffd700, 1);
            this.tweens.add({
                targets: ring,
                scaleX: 4,
                scaleY: 4,
                alpha: 0,
                duration: 400,
                ease: 'Sine.easeOut',
                onComplete: () => ring.destroy(),
            });
        }
    }

    fallNote(note) {
        if (!note.gameObject) return;
        const obj = note.gameObject;
        const glow = note.glowObject;
        const bubble = note.bubbleObject;

        // Drift outward from center then fade
        const angle = Phaser.Math.Angle.Between(
            this.cx, this.cy,
            obj.x || this.cx + 50,
            obj.y || this.cy + 50
        );
        const driftX = obj.x + Math.cos(angle) * 120;
        const driftY = obj.y + Math.sin(angle) * 80;

        const targets = [obj, glow, bubble].filter(Boolean);

        this.tweens.add({
            targets,
            x: driftX,
            y: driftY,
            angle: Phaser.Math.Between(-90, 90),
            alpha: 0.3,
            duration: 300,
            ease: 'Sine.easeOut',
            onComplete: () => {
                // Orbit loosely then fully fade
                this.tweens.add({
                    targets,
                    x: driftX + Phaser.Math.Between(-40, 40),
                    y: driftY + 40,
                    alpha: 0,
                    duration: 400,
                    ease: 'Sine.easeIn',
                    onComplete: () => {
                        obj?.destroy();
                        glow?.destroy();
                        bubble?.destroy();
                        if (note.tailGraphics) note.tailGraphics.destroy();
                    }
                });
            }
        });
    }

    handleInput(type, key) {
        const now = this.getCurrentTimeMs();
        let candidate = null;
        let bestOffset = Infinity;

        this.notes.forEach(note => {
            if (note.missed) return;
            if (note.type !== type) return;
            if (note.type === NOTE_TYPE.CUBE && note.holdStartMs >= 0) return;
            if (note.type === NOTE_TYPE.CUBE && this.heldNotes.size > 0) return;
            if (note.hit && note.type !== NOTE_TYPE.PYRAMID) return;
            // Frozen pyramid — always hittable, no time window
            if (note.frozen) {
                candidate = note;
                bestOffset = 0;
                return;
            }
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
        this.burstNote(note, isPerfect);
        if (note.tailGraphics) note.tailGraphics.destroy();
        note.gameObject?.destroy();
        note.glowObject?.destroy();
    }

    handleMultihit(note, offset) {
        // Debounce — ignore hits within 80ms of last hit on this note
        const nowMs = this.getCurrentTimeMs();
        if (note._lastHitMs !== undefined && nowMs - note._lastHitMs < 80) return;
        note._lastHitMs = nowMs;


        const count = (this.activeMultihits.get(note) || 0) + 1;
        this.activeMultihits.set(note, count);

        if (count === 1) {
            note.gameObject?.setFillStyle(0xffaa00);
            note.frozen = true;
            note._processing = false;
            note.hit = false;
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
            note.missed = true; // fully exclude from update loop
            const isPerfect = offset <= PERFECT_WINDOW_MS;
            isPerfect ? this.perfectCount++ : this.goodCount++;
            this.combo++;
            this.showJudgement(isPerfect ? 'PERFECT' : 'GOOD', isPerfect ? '#00ffb4' : '#4488ff');
            this.updateComboDisplay();
            this.updateScoreDisplay();
            this.updateTuning();
            this.triggerCinematic(isPerfect);
            this.burstNote(note, isPerfect);
            note.glowObject?.destroy();
            note.bubbleObject?.destroy();
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
        this.burstNote(note, isPerfect);

        note.gameObject?.destroy();
        note.glowObject?.destroy();
        note.bubbleObject?.destroy();
        if (note.tailGraphics) note.tailGraphics.destroy();
    }


    missNote(note) {
        note.missed = true;
        this.fallNote(note);
        this.registerMiss();
    }

    registerMiss() {
        this.combo = 0;
        this.missCount++;
        this.showJudgement('MISS', '#ff3078');
        this.updateComboDisplay();
        this.updateScoreDisplay();
        this.updateTuning(true);
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

    updateTuning(isMiss = false) {
        if (isMiss) {
            // Deduct per miss — scaled to chart length
            const totalNotes = this.notes.length || 100;
            const deduction = (100 / totalNotes) * 1.5; // 1.5x MEDIUM multiplier
            this.tuningPct = Math.max(0, Math.round(this.tuningPct - deduction));
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
            tint: NOTE_COLORS[note.type],
        });

        this.time.delayedCall(500, () => emitter.destroy());
    }

    triggerCinematic(isPerfect) {
        if (isPerfect) {
            this.triggerPerfectCinematic();
        } else {
            this.triggerGoodCinematic();
        }
    }

    triggerPerfectCinematic() {
        if (this.cinematicActive) return;
        this.cinematicActive = true;

        // Snap zoom — taut fabric feel
        this.cameras.main.zoomTo(1.06, 60, 'Linear', false, (cam, progress) => {
            if (progress !== 1) return;
            // Hold briefly then shake
            this.time.delayedCall(40, () => {
                this.cameras.main.shake(80, 0.006);
                // Auto resolve notes in a tight window only
                this.autoResolveDuring(400);
                // Zoom back out smoothly
                this.cameras.main.zoomTo(1.0, 250, 'Sine.easeOut');
                this.time.delayedCall(300, () => {
                    this.cinematicActive = false;
        this.isPaused = false;
        this.pauseStartTime = null;
                });
            });
        });

        this.flashTitleCard('PERFECT', '#ffd700');
    }

    triggerGoodCinematic() {
        this.cameras.main.zoomTo(1.05, 60, 'Linear', false, (cam, progress) => {
            if (progress !== 1) return;
            this.cameras.main.shake(60, 0.004);
            this.cameras.main.zoomTo(1.0, 150, 'Sine.easeOut');
        });
        this.flashTitleCard('GOOD', '#4488ff');
    }

    triggerWhoopsSwing() {
        // Camera dips downward
        const cam = this.cameras.main;
        const origY = cam.scrollY;
        this.tweens.add({
            targets: cam,
            scrollY: origY + 30,
            duration: 80,
            ease: 'Sine.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: cam,
                    scrollY: origY,
                    duration: 200,
                    ease: 'Sine.easeOut',
                });
            }
        });
        this.flashVignette();
    }

    autoResolveDuring(durationMs) {
        const now = this.getCurrentTimeMs();
        const windowEnd = now + durationMs;
        this.notes.forEach(note => {
            if (note.hit || note.missed || note.frozen) return;
            if (note.hitTimeMs >= now && note.hitTimeMs <= windowEnd) {
                note.hit = true;
                this.goodCount++;
                this.combo++;
                this.updateComboDisplay();
                this.updateScoreDisplay();
                this.updateTuning();
                this.burstNote(note, false);
                note.gameObject?.destroy();
                note.glowObject?.destroy();
                note.bubbleObject?.destroy();
                if (note.tailGraphics) note.tailGraphics.destroy();
            }
        });
    }

    flashTitleCard(text, color) {
        const card = this.add.text(this.cx, this.cy - 80, text, {
            fontFamily: 'SuperBubble, sans-serif',
            fontSize: '52px',
            color,
            shadow: { offsetX: 0, offsetY: 0, color, blur: 20, fill: true }
        }).setOrigin(0.5).setDepth(15).setAlpha(0);

        this.tweens.add({
            targets: card,
            alpha: { from: 0, to: 1 },
            scaleX: { from: 1.3, to: 1 },
            scaleY: { from: 1.3, to: 1 },
            duration: 80,
            ease: 'Sine.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: card,
                    alpha: 0,
                    duration: 300,
                    delay: 200,
                    onComplete: () => card.destroy()
                });
            }
        });
    }

    flashVignette() {
        const W = this.scale.width;
        const H = this.scale.height;
        const vignette = this.add.rectangle(W/2, H/2, W, H, 0xff0000, 0)
            .setDepth(18);
        this.tweens.add({
            targets: vignette,
            alpha: { from: 0, to: 0.25 },
            duration: 80,
            yoyo: true,
            ease: 'Sine.easeOut',
            onComplete: () => vignette.destroy()
        });
    }

    togglePause() {
        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            // Pause audio
            if (this.audioContext) this.audioContext.suspend();
            this.pauseStartTime = this.audioContext.currentTime;

            // Pause tweens
            this.tweens.pauseAll();

            // Show pause overlay
            const W = this.scale.width;
            const H = this.scale.height;
            this.pauseBg = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.6).setDepth(25);
            this.pauseText = this.add.text(W/2, H/2 - 20, 'PAUSED', {
                fontFamily: 'Fira Sans, sans-serif',
                fontSize: '48px',
                fontStyle: 'bold',
                color: '#ffffff',
            }).setOrigin(0.5).setDepth(26);
            this.pauseHint = this.add.text(W/2, H/2 + 30, 'press ESC to resume', {
                fontFamily: 'Fira Sans, sans-serif',
                fontSize: '16px',
                color: '#666666',
                fontStyle: 'italic',
            }).setOrigin(0.5).setDepth(26);
        } else {
            // Resume audio
            if (this.audioContext) this.audioContext.resume();

            // Adjust startTime for the pause duration
            if (this.pauseStartTime !== undefined) {
                const pauseDuration = this.audioContext.currentTime - this.pauseStartTime;
                this.audioStartContextTime += pauseDuration;
            }

            // Resume tweens
            this.tweens.resumeAll();

            // Remove pause overlay
            this.pauseBg?.destroy();
            this.pauseText?.destroy();
            this.pauseHint?.destroy();
        }
    }
}
