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
  },
});
