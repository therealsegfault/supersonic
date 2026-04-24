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
        this.mvPath = null;
        this.gifPath = null;
        this.mvVideo = null;
        this.mvReady = false;
        this.mvSyncInterval = null;
        this.heldNotes = new Map();   // key -> note being held
        this.activeMultihits = new Map(); // note -> hit count
        this.songEnded = false;
    }

    create(data) {
        // Accept dynamic song/chart data from SongSelectScene
        if (data && data.chartPath) {
            this.chartPath = data.chartPath;
            this.audioPath = data.audioPath;
            this.songTitle = data.songTitle || 'Unknown';
            this.difficulty = data.difficulty || 'MEDIUM';
            this.mvPath = data.mvPath || null;
            this.gifPath = data.gifPath || null;
        } else {
            this.chartPath = '/src/assets/charts/tellmeyouknow_MEDIUM.json';
            this.audioPath = '/src/assets/audio/tellmeyouknow.mp3';
        }

        this.startTime = null; // set when audio actually starts
        this.loadAudio().then(() => this.startAudio());

        // GameScene always runs on transparent canvas
        // Background layer: MP4 > GIF > computed animation > black
        this.game.canvas.style.backgroundColor = 'transparent';
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
        this.cx = this.scale.width / 2;
        this.cy = this.scale.height / 2;
        this.setupBackground();

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
            fontFamily: 'SuperBubble, sans-serif',
            fontSize: '36px',
            color: '#ffffff',
            shadow: { offsetX: 0, offsetY: 0, color: '#ffffff', blur: 12, fill: true }
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
        this.startMV();
    }

    triggerTapeSlowdown() {
        if (this.isFailing) return;
        this.isFailing = true;
        this.stopMV();

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

    // ── Orbital approach helpers ──
    getOrbitAngle(direction) {
        return {
            left:        Math.PI,
            right:       0,
            top:         -Math.PI / 2,
            bottom:      Math.PI / 2,
            topleft:     -(3 * Math.PI / 4),
            topright:    -(Math.PI / 4),
            bottomleft:  3 * Math.PI / 4,
            bottomright: Math.PI / 4,
        }[direction] ?? 0;
    }

    getOrbitPosition(direction, progress, note = null) {
        const offset     = note?.orbitOffset ?? 0;
        const sweep      = (note?.orbitSweep  ?? Math.PI * 1.2) * (note?.orbitDir ?? 1);
        const startAngle = this.getOrbitAngle(direction) + offset;
        const maxRadius  = Math.hypot(this.cx, this.cy) + 100;
        const radius     = maxRadius * (1 - progress);
        const a          = startAngle + progress * sweep;
        return {
            x: this.cx + Math.cos(a) * radius,
            y: this.cy + Math.sin(a) * radius,
        };
    }

    update() {
        if (this.isFailing || this.isPaused) return;

        const now = this.getCurrentTimeMs();

        // End of song
        if (!this.songEnded && this.songDurationMs > 0 && now >= this.songDurationMs) {
            this.songEnded = true;
            this.endSong();
            return;
        }

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
                const pos = this.getOrbitPosition(note.direction, progress, note);

                note.gameObject.x = pos.x;
                note.gameObject.y = pos.y;

                this.updateTrail(note, pos);

                if (note.glowObject) {
                    note.glowObject.x = pos.x;
                    note.glowObject.y = pos.y;
                }

                const scale = Phaser.Math.Linear(0.2, 1.0, progress);
                note.gameObject.setScale(scale);
                if (note.glowObject) note.glowObject.setScale(scale);

                // ── Cube time-synced tail along orbital path ──
                if (note.tailObject && note.tailGraphics) {
                    const duration = note.duration > 0 ? note.duration : 500;
                    const holdProgress = note.holdStartMs >= 0
                        ? Math.min(1, (now - note.holdStartMs) / duration)
                        : 0;

                    note.tailGraphics.clear();
                    const tailColor = NOTE_COLORS[note.type] || 0xff44aa;
                    note.tailGraphics.lineStyle(8, tailColor, 0.5);
                    note.tailGraphics.beginPath();

                    const maxTailLength = Math.min(0.5, duration / (APPROACH_TIME_MS * 2));
                    const tailLength = maxTailLength * (1 - holdProgress);
                    const tailStart = Math.max(0, progress - tailLength);
                    const steps = 12;
                    for (let s = 0; s <= steps; s++) {
                        const t = Phaser.Math.Linear(tailStart, progress, s / steps);
                        const tp = this.getOrbitPosition(note.direction, t, note);
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
        note.orbitSweep  = Phaser.Math.FloatBetween(Math.PI * 0.65, Math.PI * 1.55);
        note.orbitOffset = Phaser.Math.FloatBetween(-0.4, 0.4);
        note.orbitDir    = Phaser.Math.Between(0, 1) ? 1 : -1;

        const spawn = this.getOrbitPosition(note.direction, 0, note);
        const color = NOTE_COLORS[note.type];

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

    updateTrail(note, pos) {
        if (!note.trailPoints) note.trailPoints = [];
        if (!note.trailGraphics) {
            note.trailGraphics = this.add.graphics();
        }

        note.trailPoints.push({ x: pos.x, y: pos.y });
        if (note.trailPoints.length > 12) note.trailPoints.shift();

        note.trailGraphics.clear();
        const color = NOTE_COLORS[note.type] || 0xffffff;
        const pts = note.trailPoints;

        for (let i = 1; i < pts.length; i++) {
            const alpha = (i / pts.length) * 0.4;
            const width = (i / pts.length) * 6;
            note.trailGraphics.lineStyle(width, color, alpha);
            note.trailGraphics.beginPath();
            note.trailGraphics.moveTo(pts[i-1].x, pts[i-1].y);
            note.trailGraphics.lineTo(pts[i].x, pts[i].y);
            note.trailGraphics.strokePath();
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
        if (note.trailGraphics) { note.trailGraphics.destroy(); note.trailGraphics = null; }

        const targets = [obj, glow, bubble].filter(Boolean);

        this.tweens.add({
            targets,
            x: obj.x + Math.cos(angle) * 180,
            y: obj.y + Math.sin(angle) * 180,
            alpha: 0,
            scaleX: 0.2,
            scaleY: 0.2,
            angle: Phaser.Math.Between(160, 320),
            duration: 380,
            ease: 'Quad.easeOut',
            onComplete: () => {
                targets.forEach(o => o?.destroy());
                if (note.tailGraphics) note.tailGraphics.destroy();
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
        if (note.trailGraphics) { note.trailGraphics.destroy(); note.trailGraphics = null; }
        note.gameObject?.destroy();
        note.glowObject?.destroy();
    }

    handleMultihit(note, offset) {
        // Debounce — ignore hits within 80ms of last hit on this note
        const nowMs = this.getCurrentTimeMs();
        if (note._lastHitMs !== undefined && nowMs - note._lastHitMs < 80) return;
        note._lastHitMs = nowMs;


        const count = (this.activeMultihits.get(note) || 0) + 1;
        // Second hit requires note near strike zone
        if (count === 2 && note.gameObject) {
            const dist = Phaser.Math.Distance.Between(
                note.gameObject.x, note.gameObject.y, this.cx, this.cy
            );
            if (dist > 120) return;
        }
        this.activeMultihits.set(note, count);

        if (count === 1) {
            note.gameObject?.setFillStyle(0xffaa00);
            note.frozen = true;
            note._processing = false;
            note.hit = false;
            this.showJudgement('HIT!', '#44ffaa');

            // Auto-miss if second hit doesn't land within the window
            this.time.delayedCall(MISS_WINDOW_MS * 1.5, () => {
                if (!note.hit && !note.missed) {
                    note.frozen = false;
                    this.missNote(note);
                }
            });

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
            if (note.trailGraphics) { note.trailGraphics.destroy(); note.trailGraphics = null; }
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
        if (note.trailGraphics) { note.trailGraphics.destroy(); note.trailGraphics = null; }
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

    shutdown() {
        this.stopMV();
        clearInterval(this.mvSyncInterval);
        // Restore canvas background for menu scenes
        this.game.canvas.style.backgroundColor = '#0a0a0a';
    }

    setupBackground() {
        if (this.mvPath) {
            this.setupMV();
        } else if (this.gifPath) {
            this.setupGIF();
        } else {
            this.setupComputedBG();
        }
    }

    setupGIF() {
        // Future: animated GIF as background
        // For now fall through to computed
        this.setupComputedBG();
    }

    setupComputedBG() {
        // Fallback — subtle particle field reacting to note intensity
        // Black base
        this.add.rectangle(this.cx, this.cy, this.scale.width, this.scale.height, 0x000000, 1)
            .setDepth(-10);

        // Ambient particle field
        const particles = this.add.particles(this.cx, this.cy, '__DEFAULT', {
            speed: { min: 5, max: 20 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.15, end: 0 },
            lifespan: { min: 2000, max: 4000 },
            quantity: 1,
            frequency: 80,
            tint: [0x4488ff, 0xff44aa, 0x44ffaa, 0x888888],
            alpha: { start: 0.3, end: 0 },
        }).setDepth(-9);
        this.bgParticles = particles;
    }

    setupMV() {
        const mvPath = this.mvPath;
        if (!mvPath) return;

        // Create video element behind canvas
        this.mvVideo = document.createElement('video');
        this.mvVideo.src = mvPath;
        this.mvVideo.muted = true;
        this.mvVideo.loop = true;
        this.mvVideo.playsInline = true;
        this.mvVideo.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            object-fit: cover;
            z-index: -1;
            opacity: 0;
            transition: opacity 0.8s ease;
            pointer-events: none;
        `;
        // Make Phaser canvas transparent so video shows through
        const canvas = this.game.canvas;
        canvas.style.background = 'transparent';
        document.body.appendChild(this.mvVideo);

        // Dark overlay so notes stay readable
        this.mvOverlay = this.add.rectangle(
            this.cx, this.cy,
            this.scale.width, this.scale.height,
            0x000000, 0.55
        ).setDepth(-1);

        // Sync video to audio on canplay
        this.mvVideo.addEventListener('canplay', () => {
            this.mvReady = true;
        });
        this.mvVideo.load();
    }

    startMV() {
        if (!this.mvVideo || !this.mvReady) return;
        this.mvVideo.play().then(() => {
            this.mvVideo.style.opacity = '1';
        }).catch(e => console.warn('MV play failed:', e));
        this.mvSyncInterval = setInterval(() => this.syncMV(), 3000);
    }

    syncMV() {
        if (!this.mvVideo || !this.audioContext) return;
        const gameTime = this.getCurrentTimeMs() / 1000;
        const diff = Math.abs(this.mvVideo.currentTime - (gameTime % this.mvVideo.duration));
        if (diff > 0.3) {
            this.mvVideo.currentTime = gameTime % this.mvVideo.duration;
        }
    }

    stopMV() {
        if (!this.mvVideo) return;
        this.mvVideo.style.opacity = '0';
        clearInterval(this.mvSyncInterval);
        setTimeout(() => {
            this.mvVideo?.pause();
            this.mvVideo?.remove();
            this.mvVideo = null;
        }, 800);
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
                });
            });
        });

    }

    triggerGoodCinematic() {
        this.cameras.main.zoomTo(1.05, 60, 'Linear', false, (cam, progress) => {
            if (progress !== 1) return;
            this.cameras.main.shake(60, 0.004);
            this.cameras.main.zoomTo(1.0, 150, 'Sine.easeOut');
        });
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
                if (note.tailGraphics)  note.tailGraphics.destroy();
                if (note.trailGraphics) { note.trailGraphics.destroy(); note.trailGraphics = null; }
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

    endSong() {
        this.audioContext?.suspend();
        const totalNotes = this.notes.length || 1;
        const totalHits = this.perfectCount + this.goodCount;
        const accuracy = Math.round((totalHits / totalNotes) * 100);
        const score = this.perfectCount * 300 + this.goodCount * 100;

        this.time.delayedCall(800, () => {
            this.cameras.main.fadeOut(700, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.audioContext?.close();
                this.scene.start('EndScene', {
                    songTitle: this.songTitle,
                    difficulty: this.difficulty,
                    perfectCount: this.perfectCount,
                    goodCount: this.goodCount,
                    missCount: this.missCount,
                    score,
                    tuningPct: this.tuningPct,
                    accuracy,
                    totalNotes,
                });
            });
        });
    }

    togglePause() {
        const now = Date.now();
        if (this._lastPauseToggle && now - this._lastPauseToggle < 300) return;
        this._lastPauseToggle = now;

        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            // Pause audio
            if (this.audioContext) this.audioContext.suspend();
            this.pauseStartTime = this.audioContext.currentTime;

            // Pause tweens
            this.tweens.pauseAll();

            // Pause MV
            if (this.mvVideo) this.mvVideo.pause();

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

            // Resume MV
            if (this.mvVideo) this.mvVideo.play().catch(() => {});

            // Remove pause overlay
            this.pauseBg?.destroy();
            this.pauseText?.destroy();
            this.pauseHint?.destroy();
        }
    }
}
