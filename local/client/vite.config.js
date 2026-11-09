import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    commonjsOptions: {
      include: [/shared/, /node_modules/],
      transformMixedEsModules: true
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Listen on all addresses (--host 0.0.0.0)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: { message: 'Backend offline, using client fallback', code: 'BACKEND_OFFLINE' } }));
            }
          });
        }
      }
    }
  }
});
