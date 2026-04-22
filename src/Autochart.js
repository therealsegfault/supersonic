import { Note } from 'tonal';

export async function autochartFromFile(file, bpm, difficulty = 'MEDIUM', onProgress) {
    return new Promise(async (resolve, reject) => {
        // Decode audio on main thread (fast)
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        await audioCtx.close();

        const samples = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const durationMs = Math.round(audioBuffer.duration * 1000);
        const songName = file.name.replace(/\.[^/.]+$/, '');

        // Spin up worker
        const worker = new Worker(
            new URL('./AutochartWorker.js', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (e) => {
            const { type, chart, message, value } = e.data;
            if (type === 'progress' && onProgress) {
                onProgress(value);
            } else if (type === 'status' && onProgress) {
                onProgress(message);
            } else if (type === 'complete') {
                worker.terminate();
                resolve(chart);
            } else if (type === 'error') {
                worker.terminate();
                reject(new Error(message));
            }
        };

        worker.onerror = (err) => {
            worker.terminate();
            reject(err);
        };

        // Transfer samples buffer to worker (zero-copy)
        const copy = new Float32Array(samples);
        worker.postMessage({
            audioData: copy,
            sampleRate,
            bpm,
            difficulty,
            songName,
            durationMs,
        }, [copy.buffer]);
    });
}