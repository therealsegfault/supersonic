// ── Supersonic local database ──
// Wraps IndexedDB for chart and song storage

const DB_NAME = 'supersonic';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('charts')) {
                db.createObjectStore('charts', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('songs')) {
                db.createObjectStore('songs', { keyPath: 'id' });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveChart(id, chart) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('charts', 'readwrite');
        tx.objectStore('charts').put({ id, ...chart });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadChart(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('charts', 'readonly');
        const req = tx.objectStore('charts').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

export async function saveSong(song) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readwrite');
        tx.objectStore('songs').put(song);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadAllSongs() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readonly');
        const req = tx.objectStore('songs').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

export async function saveVideo(id, file) {
    const db = await openDB();
    const arrayBuffer = await file.arrayBuffer();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readwrite');
        tx.objectStore('songs').put({ id: `video_${id}`, buffer: arrayBuffer, type: file.type });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadVideo(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readonly');
        const req = tx.objectStore('songs').get(`video_${id}`);
        req.onsuccess = () => {
            if (!req.result) return resolve(null);
            const blob = new Blob([req.result.buffer], { type: req.result.type });
            resolve(URL.createObjectURL(blob));
        };
        req.onerror = () => reject(req.error);
    });
}

export async function saveAudio(id, file) {
    const db = await openDB();
    const arrayBuffer = await file.arrayBuffer();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readwrite');
        tx.objectStore('songs').put({ id: `audio_${id}`, buffer: arrayBuffer, type: file.type });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadAudio(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readonly');
        const req = tx.objectStore('songs').get(`audio_${id}`);
        req.onsuccess = () => {
            if (!req.result) return resolve(null);
            const blob = new Blob([req.result.buffer], { type: req.result.type });
            resolve(URL.createObjectURL(blob));
        };
        req.onerror = () => reject(req.error);
    });
}

export async function deleteSong(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['songs', 'charts'], 'readwrite');
        tx.objectStore('songs').delete(id);
        // Delete all difficulty charts for this song
        ['EZ', 'MEDIUM', 'HARD', 'EXTREME', 'EXTRA_EXTREME', 'TUTORIAL', '300BPM'].forEach(diff => {
            tx.objectStore('charts').delete(`${id}_${diff}`);
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
