import { defineConfig } from 'vite';

export default defineConfig({
    base: '/supersonic/',
    server: {
        port: 5173,
        host: true,
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser'],
                    tonal: ['tonal'],
                }
            }
        }
    }
});
