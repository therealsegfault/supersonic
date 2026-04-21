import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';

// ── Args ──
const [,, audioFile, bpmArg, difficulty = 'MEDIUM'] = process.argv;

if (!audioFile || !bpmArg) {
    console.log('Usage: node autochart.js <audiofile.mp3> <bpm> [difficulty]');
    console.log('Difficulties: TUTORIAL, EZ, MEDIUM, HARD, EXTREME, EXTRA_EXTREME, 300BPM');
    process.exit(1);
}

const BPM = parseFloat(bpmArg);
const SAMPLE_RATE = 44100;
const DIRECTIONS = ['left', 'right', 'top', 'bottom', 'topleft', 'topright', 'bottomleft', 'bottomright'];
const SHAPES = ['sphere', 'cube', 'pyramid'];

// ── Difficulty config ──
const DIFFICULTY_CONFIG = {
    TUTORIAL:      { multiplier: 0,   minSepMs: 200, maxChord: 1, threshold: 0.15 },
    EZ:            { multiplier: 0.5, minSepMs: 1200, maxChord: 1, threshold: 0.12 },
    MEDIUM:        { multiplier: 1.0, minSepMs: 800, maxChord: 1, threshold: 0.08 },
    HARD:          { multiplier: 1.5, minSepMs: 600, maxChord: 2, threshold: 0.06 },
    EXTREME:       { multiplier: 2.0, minSepMs: 400, maxChord: 2, threshold: 0.04 },
    EXTRA_EXTREME: { multiplier: 3.0, minSepMs: 200,  maxChord: 3, threshold: 0.02 },
    '300BPM':      { multiplier: 1.0, minSepMs: 100, maxChord: 2, threshold: 0.06 },
};

const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.MEDIUM;

// ── Decode audio to raw PCM via ffmpeg ──
console.log(`Loading ${audioFile}...`);
let pcmBuffer;
try {
    pcmBuffer = execSync(
        `ffmpeg -i "${audioFile}" -f s16le -ac 1 -ar ${SAMPLE_RATE} -loglevel quiet pipe:1`,
        { maxBuffer: 200 * 1024 * 1024 }
    );
} catch (e) {
    console.error('ffmpeg failed — is it installed? brew install ffmpeg');
    process.exit(1);
}

// ── Build amplitude envelope ──
console.log('Analyzing audio...');
const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
const windowSize = Math.floor(SAMPLE_RATE * 0.02); // 20ms windows
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
for (let i = 1; i < normalized.length - 1; i++) {
    if (normalized[i] > config.threshold &&
        normalized[i] > normalized[i - 1] &&
        normalized[i] > normalized[i + 1]) {
        peaks.push({ idx: i, strength: normalized[i] });
        i += 4; // skip ahead to avoid clustering
    }
}

// ── Snap to BPM grid ──
const msPerBeat = 60000 / BPM;
const msPerSixteenth = msPerBeat / 4;
const msPerWindow = 20;

const snapped = new Map();
for (const peak of peaks) {
    const timeMs = peak.idx * msPerWindow;
    const snapIdx = Math.round(timeMs / msPerSixteenth);
    const snappedMs = Math.round(snapIdx * msPerSixteenth);
    // Keep strongest peak per grid slot
    if (!snapped.has(snappedMs) || snapped.get(snappedMs).strength < peak.strength) {
        snapped.set(snappedMs, { timeMs: snappedMs, strength: peak.strength });
    }
}

// ── Filter by minimum separation ──
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
const rng = (seed) => {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
};
const rand = rng(BPM * 1000 + filtered.length);

let dirIndex = 0;
// Shuffle direction order per song
const dirOrder = [...DIRECTIONS];
for (let i = dirOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [dirOrder[i], dirOrder[j]] = [dirOrder[j], dirOrder[i]];
}

const notes = [];
const totalNotes = filtered.length;

for (const peak of filtered) {
    const chordSize = (config.maxChord > 1 && rand() < 0.2)
        ? 2
        : 1;

    const usedDirs = new Set();

    for (let c = 0; c < chordSize; c++) {
        // Round robin direction
        let tries = 0;
        while (usedDirs.has(dirOrder[dirIndex % dirOrder.length]) && tries < DIRECTIONS.length) {
            dirIndex++;
            tries++;
        }
        const dir = dirOrder[dirIndex % dirOrder.length];
        dirIndex++;
        usedDirs.add(dir);

        // Shape based on strength and density
        let shape;
        if (peak.strength > 0.8) {
            shape = 'pyramid';
        } else if (peak.strength > 0.5) {
            shape = 'cube';
        } else {
            shape = 'sphere';
        }

        // Intensity 1-3 based on strength, uncapped placeholder for FEVER/CHALLENGE
        const intensity = Math.min(3, Math.ceil(peak.strength * 3));

        notes.push({
            t: peak.timeMs,
            shape,
            dir,
            velocity: 1.0,
            intensity,
            duration: 0,
        });
    }
}

// ── Get song duration via ffprobe ──
let durationMs = 0;
try {
    const probe = execSync(
        `ffprobe -v quiet -print_format json -show_format "${audioFile}"`,
        { encoding: 'utf8' }
    );
    const info = JSON.parse(probe);
    durationMs = Math.round(parseFloat(info.format.duration) * 1000);
} catch (e) {
    console.warn('Could not detect duration — set manually in chart');
}

// ── Build chart ──
const songName = path.basename(audioFile, path.extname(audioFile));
const chart = {
    song: songName,
    bpm: BPM,
    difficulty,
    durationMs,
    totalNotes: notes.length,
    sections: [],
    notes,
};

// ── Write output ──
const outFile = `${songName}_${difficulty}.json`;
writeFileSync(outFile, JSON.stringify(chart, null, 2));
console.log(`✓ ${notes.length} notes → ${outFile}`);
console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);
console.log(`  BPM: ${BPM} | Difficulty: ${difficulty}`);