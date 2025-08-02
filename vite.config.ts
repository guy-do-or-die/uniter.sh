import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './app',
  publicDir: '../public',
  envDir: resolve(__dirname),
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['xterm', '@xterm/addon-fit'],
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app',
      'uniter.sh',
      '.uniter.sh'
    ],
    headers: {
      'ngrok-skip-browser-warning': 'true'
    },
  },
});
