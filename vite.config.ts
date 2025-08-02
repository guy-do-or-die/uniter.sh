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
    proxy: {
      '/api/1inch': {
        target: 'https://api.1inch.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/1inch/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // Add API key from environment variable
            const apiKey = process.env.ONEINCH_API_KEY;
            console.log('🔑 Vite Proxy Debug:', {
              apiKeyPresent: !!apiKey,
              apiKeyLength: apiKey?.length || 0,
              url: _req.url
            });
            if (apiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              console.log('✅ Added Authorization header to proxy request');
            } else {
              console.error('❌ No API key found in process.env.ONEINCH_API_KEY');
            }
          });
        }
      }
    }
  },
});
