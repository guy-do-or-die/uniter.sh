import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load env vars from .env file
  const env = loadEnv(mode, process.cwd(), '');
  
  // Make env vars available to Node.js process for API routes
  Object.assign(process.env, env);
  
  return {
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
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Add API key header
              const apiKey = process.env.ONEINCH_API_KEY;
              if (apiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              }
              console.log(`[PROXY] ${req.method} ${req.url} -> ${proxyReq.getHeader('host')}${proxyReq.path}`);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log(`[PROXY] ${proxyRes.statusCode} ${req.url}`);
            });
          }
        }
      }
    },
  };
});
