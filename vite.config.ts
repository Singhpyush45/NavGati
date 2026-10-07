/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** Dev-only: serves POST /api/gemini locally with the server-side key from .env (GEMINI_API_KEY, not VITE_*). */
function geminiDevApi(env: Record<string, string>): Plugin {
  return {
    name: 'navgati-gemini-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/gemini', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let raw = '';
        req.on('data', (c) => { raw += c; if (raw.length > 100_000) req.destroy(); });
        req.on('end', async () => {
          const { handleGemini } = await server.ssrLoadModule('/src/services/ai/geminiHandler.ts');
          let body: unknown = null;
          try { body = JSON.parse(raw); } catch { /* handled as invalid */ }
          const out = await handleGemini(body, { GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_MODEL: env.GEMINI_MODEL });
          res.statusCode = out.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(out.body));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), geminiDevApi(loadEnv(mode, process.cwd(), ''))],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
