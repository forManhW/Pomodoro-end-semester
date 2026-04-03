import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                tasks: resolve(__dirname, 'tasks.html'),
                statistics: resolve(__dirname, 'statistics.html'),
                settings: resolve(__dirname, 'settings.html')
            }
        }
    },
    server: {
        allowedHosts: [
            'premonumental-melita-uncontained.ngrok-free.dev',
        ]
    }
});