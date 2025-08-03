import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env vars from .env file
  const env = loadEnv(mode, process.cwd(), '');
  
  // Make env vars available to Node.js process for API routes
  Object.assign(process.env, env);
  
  return {
    root: './app',
    publicDir: '../public',
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
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
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
      }
    },
  };
});
