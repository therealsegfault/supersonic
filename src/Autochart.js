// ── Browser-side autochart — no ffmpeg needed ──

const DIRECTIONS = ['left', 'right', 'top', 'bottom', 'topleft', 'topright', 'bottomleft', 'bottomright'];

const DIFFICULTY_CONFIG = {
    TUTORIAL:      { multiplier: 0,   minSepMs: 600,  maxChord: 1, threshold: 0.15 },
    EZ:            { multiplier: 0.5, minSepMs: 1200, maxChord: 1, threshold: 0.20 },
    MEDIUM:        { multiplier: 1.0, minSepMs: 800,  maxChord: 1, threshold: 0.15 },
    HARD:          { multiplier: 1.5, minSepMs: 500,  maxChord: 2, threshold: 0.10 },
    EXTREME:       { multiplier: 2.0, minSepMs: 300,  maxChord: 2, threshold: 0.07 },
    EXTRA_EXTREME: { multiplier: 3.0, minSepMs: 150,  maxChord: 3, threshold: 0.04 },
    '300BPM':      { multiplier: 1.0, minSepMs: 200,  maxChord: 2, threshold: 0.06 },
};

function seededRand(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

export async function autochartFromFile(file, bpm, difficulty = 'MEDIUM') {
    const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.MEDIUM;

    // ── Decode audio ──
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();

    // ── Build amplitude envelope ──
    const samples = audioBuffer.getChannelData(0); // mono
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
    const envelope = [];

    for (let w = 0; w < Math.floor(samples.length / windowSize); w++) {
        let sum = 0;
        const start = w * windowSize;
        const end = Math.min(start + windowSize, samples.length);
        for (let i = start; i < end; i++) {
            sum += samples[i] * samples[i];
        }
        envelope.push(Math.sqrt(sum / (end - start)));
    }

    // Normalize
    const maxEnv = Math.max(...envelope);
    const normalized = envelope.map(v => v / maxEnv);

    // ── Find peaks ──
    const peaks = [];
    let i = 1;
    while (i < normalized.length - 1) {
        if (normalized[i] > config.threshold &&
            normalized[i] > normalized[i - 1] &&
            normalized[i] > normalized[i + 1]) {
            peaks.push({ idx: i, strength: normalized[i] });
            i += 4;
        } else {
            i++;
        }
    }

    // ── Snap to BPM grid ──
    const msPerBeat = 60000 / bpm;
    const msPerSixteenth = msPerBeat / 4;
    const msPerWindow = 20;

    const snapped = new Map();
    for (const peak of peaks) {
        const timeMs = peak.idx * msPerWindow;
        const snapIdx = Math.round(timeMs / msPerSixteenth);
        const snappedMs = Math.round(snapIdx * msPerSixteenth);
        if (!snapped.has(snappedMs) || snapped.get(snappedMs).strength < peak.strength) {
            snapped.set(snappedMs, { timeMs: snappedMs, strength: peak.strength });
        }
    }

    // ── Filter by min separation ──
    const sorted = [...snapped.values()].sort((a, b) => a.timeMs - b.timeMs);
    const filtered = [];
    let lastMs = -9999;
    for (const peak of sorted) {
        if (peak.timeMs - lastMs >= config.minSepMs) {
            filtered.push(peak);
            lastMs = peak.timeMs;
        }
    }

    // ── Assign directions and shapes ──
    const rand = seededRand(bpm * 1000 + filtered.length);
    const dirOrder = [...DIRECTIONS];
    for (let i = dirOrder.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [dirOrder[i], dirOrder[j]] = [dirOrder[j], dirOrder[i]];
    }

    let dirIndex = 0;
    const notes = [];

    for (const peak of filtered) {
        const chordSize = config.maxChord > 1 && rand() < 0.2 ? 2 : 1;
        const usedDirs = new Set();

        for (let c = 0; c < chordSize; c++) {
            let tries = 0;
            while (usedDirs.has(dirOrder[dirIndex % dirOrder.length]) && tries < DIRECTIONS.length) {
                dirIndex++;
                tries++;
            }
            const dir = dirOrder[dirIndex % dirOrder.length];
            dirIndex++;
            usedDirs.add(dir);

            const shape = peak.strength > 0.8 ? 'pyramid'
                        : peak.strength > 0.5 ? 'cube'
                        : 'sphere';

            notes.push({
                t: peak.timeMs,
                shape,
                dir,
                velocity: 1.0,
                intensity: Math.min(3, Math.ceil(peak.strength * 3)),
                duration: 0,
            });
        }
    }

    return {
        song: file.name.replace(/\.[^/.]+$/, ''),
        bpm,
        difficulty,
        durationMs: Math.round(audioBuffer.duration * 1000),
        totalNotes: notes.length,
        sections: [],
        notes,
    };
}