import { defineConfig } from 'vite'


export default defineConfig({
    root: 'frontend',
    plugins: [],
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:8081',
                changeOrigin: true,
                secure: false,
                timeout: 60000,
            },
            '/static': {
                target: 'http://localhost:8081',
                changeOrigin: true,
                secure: false,
                timeout: 60000,
            },
        },
    },
})
