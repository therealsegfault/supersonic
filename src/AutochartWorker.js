// Web Worker — runs off main thread, no DOM access

function seededRand(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

const DIRECTIONS = ['left', 'right', 'top', 'bottom', 'topleft', 'topright', 'bottomleft', 'bottomright'];

const DIFFICULTY_CONFIG = {
    TUTORIAL:      { minSepMs: 600,  maxChord: 1, threshold: 0.15 },
    EZ:            { minSepMs: 1200, maxChord: 1, threshold: 0.20 },
    NORMAL:        { minSepMs: 500,  maxChord: 1, threshold: 0.15 },
    HARD:          { minSepMs: 500,  maxChord: 2, threshold: 0.10 },
    EXTREME:       { minSepMs: 300,  maxChord: 2, threshold: 0.07 },
    EXTRA_EXTREME: { minSepMs: 150,  maxChord: 3, threshold: 0.04 },
    '300BPM':      { minSepMs: 200,  maxChord: 2, threshold: 0.06 },
};

function freqToMidi(freq) {
    return 12 * Math.log2(freq / 440) + 69;
}

function hannWindow(size) {
    const w = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / size));
    }
    return w;
}

function cooleyTukeyFFT(signal) {
    const N = signal.length;
    const re = new Float32Array(signal);
    const im = new Float32Array(N);

    // Bit reversal
    for (let i = 1, j = 0; i < N; i++) {
        let bit = N >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }

    // FFT
    for (let len = 2; len <= N; len <<= 1) {
        const half = len >> 1;
        const wRe = Math.cos(2 * Math.PI / len);
        const wIm = -Math.sin(2 * Math.PI / len);
        for (let i = 0; i < N; i += len) {
            let curRe = 1, curIm = 0;
            for (let j = 0; j < half; j++) {
                const uRe = re[i + j], uIm = im[i + j];
                const vRe = re[i + j + half] * curRe - im[i + j + half] * curIm;
                const vIm = re[i + j + half] * curIm + im[i + j + half] * curRe;
                re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
                re[i + j + half] = uRe - vRe; im[i + j + half] = uIm - vIm;
                const nr = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = nr;
            }
        }
    }

    const half = N / 2;
    const mag = new Float32Array(half);
    for (let k = 0; k < half; k++) {
        mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N;
    }
    return mag;
}

function detectPitches(mag, sampleRate, windowSize, threshold = 0.008) {
    const pitches = [];
    for (let k = 1; k < mag.length - 1; k++) {
        if (mag[k] > threshold && mag[k] > mag[k-1] && mag[k] > mag[k+1]) {
            const freq = k * sampleRate / windowSize;
            if (freq >= 60 && freq <= 4000) {
                const alpha = mag[k-1], beta = mag[k], gamma = mag[k+1];
                const offset = 0.5 * (alpha - gamma) / (alpha - 2*beta + gamma);
                const refinedFreq = (k + offset) * sampleRate / windowSize;
                const midi = Math.round(freqToMidi(refinedFreq));
                if (midi > 0 && midi < 128) {
                    pitches.push({ midi, magnitude: beta });
                }
            }
        }
    }
    return pitches;
}

function analyze(samples, sampleRate, bpm, difficulty) {
    const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.NORMAL;
    const windowSize = 2048;
    const hopSize = 1024;
    const hann = hannWindow(windowSize);
    const msPerHop = (hopSize / sampleRate) * 1000;
    const minSustainMs = 200;
    const minSustainFrames = Math.ceil(minSustainMs / msPerHop);

    const activeNotes = new Map();
    const sustainedEvents = [];
    const transientEvents = [];

    const totalFrames = Math.floor((samples.length - windowSize) / hopSize);

    for (let f = 0; f < totalFrames; f++) {
        const offset = f * hopSize;
        const windowed = new Float32Array(windowSize);
        let rms = 0;

        for (let i = 0; i < windowSize; i++) {
            windowed[i] = samples[offset + i] * hann[i];
            rms += samples[offset + i] * samples[offset + i];
        }
        rms = Math.sqrt(rms / windowSize);

        const timeMs = (offset / sampleRate) * 1000;
        const mag = cooleyTukeyFFT(windowed);
        const pitches = detectPitches(mag, sampleRate, windowSize);
        const activeMidis = new Set(pitches.map(p => p.midi));

        // Check for notes that ended
        for (const [midi, data] of activeNotes.entries()) {
            if (!activeMidis.has(midi)) {
                const durationMs = timeMs - data.startMs;
                if (data.frames >= minSustainFrames) {
                    sustainedEvents.push({
                        timeMs: data.startMs,
                        durationMs,
                        strength: data.maxMag,
                        isHold: true,
                    });
                }
                activeNotes.delete(midi);
            }
        }

        // Track active notes
        for (const pitch of pitches) {
            if (!activeNotes.has(pitch.midi)) {
                activeNotes.set(pitch.midi, {
                    startMs: timeMs,
                    frames: 0,
                    maxMag: 0,
                });
            }
            const data = activeNotes.get(pitch.midi);
            data.frames++;
            data.maxMag = Math.max(data.maxMag, pitch.magnitude);
        }

        // Amplitude transient detection
        if (rms > config.threshold) {
            transientEvents.push({ timeMs, strength: rms, isHold: false });
        }

        // Report progress every 5%
        if (f % Math.floor(totalFrames / 20) === 0) {
            self.postMessage({ type: 'progress', value: f / totalFrames });
        }
    }

    return { sustainedEvents, transientEvents };
}

function buildNotes(sustainedEvents, transientEvents, bpm, difficulty, durationMs) {
    const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.NORMAL;
    const msPerBeat = 60000 / bpm;
    const msPerSixteenth = msPerBeat / 4;

    function snap(t) {
        return Math.round(Math.round(t / msPerSixteenth) * msPerSixteenth);
    }

    const allEvents = [];

    for (const ev of sustainedEvents) {
        allEvents.push({ ...ev, timeMs: snap(ev.timeMs) });
    }

    // Normalize transient envelope
    const maxRms = Math.max(...transientEvents.map(e => e.strength), 0.001);
    for (const ev of transientEvents) {
        ev.strength = ev.strength / maxRms;
        const covered = allEvents.some(h =>
            h.isHold && ev.timeMs >= h.timeMs && ev.timeMs <= h.timeMs + h.durationMs
        );
        if (!covered) {
            allEvents.push({ ...ev, timeMs: snap(ev.timeMs) });
        }
    }

    allEvents.sort((a, b) => a.timeMs - b.timeMs);

    const filtered = [];
    let lastMs = -9999;
    for (const ev of allEvents) {
        if (ev.timeMs - lastMs >= config.minSepMs) {
            filtered.push(ev);
            lastMs = ev.timeMs;
        }
    }

    const rand = seededRand(bpm * 1000 + filtered.length);
    const dirOrder = [...DIRECTIONS];
    for (let i = dirOrder.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [dirOrder[i], dirOrder[j]] = [dirOrder[j], dirOrder[i]];
    }

    let dirIndex = 0;
    const notes = [];

    for (const ev of filtered) {
        const shape = ev.isHold ? 'cube'
            : ev.strength > 0.88 ? 'pyramid'
            : 'sphere';

        notes.push({
            t: ev.timeMs,
            shape,
            dir: dirOrder[dirIndex++ % dirOrder.length],
            velocity: 1.0,
            intensity: Math.min(3, Math.ceil((ev.strength || 0.5) * 3)),
            duration: ev.isHold ? Math.round(ev.durationMs) : 0,
        });
    }

    return notes;
}

self.onmessage = async (e) => {
    const { audioData, sampleRate, bpm, difficulty, songName, durationMs } = e.data;

    try {
        self.postMessage({ type: 'status', message: 'analyzing audio...' });
        const { sustainedEvents, transientEvents } = analyze(audioData, sampleRate, bpm, difficulty);

        self.postMessage({ type: 'status', message: 'building chart...' });
        console.log('sustained:', sustainedEvents.length, 'transients:', transientEvents.length);
        const notes = buildNotes(sustainedEvents, transientEvents, bpm, difficulty, durationMs);

        const chart = {
            song: songName,
            bpm,
            difficulty,
            durationMs,
            totalNotes: notes.length,
            sections: [],
            notes,
        };

        self.postMessage({ type: 'complete', chart });
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};