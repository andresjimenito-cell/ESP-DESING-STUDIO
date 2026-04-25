import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      open: true,
    },
    plugins: [
      react(),
      {
        name: 'ai-memory-server',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/api/ai-memory' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', () => {
                try {
                  const data = JSON.parse(body);
                  fs.writeFileSync(path.resolve('./ai_memory.json'), JSON.stringify(data, null, 2));
                  res.statusCode = 200;
                  res.end('OK');
                } catch (e) {
                  res.statusCode = 400;
                  res.end('Invalid JSON');
                }
              });
            } else if (req.url === '/api/ai-memory' && req.method === 'GET') {
               const p = path.resolve('./ai_memory.json');
               if (fs.existsSync(p)) {
                 res.setHeader('Content-Type', 'application/json');
                 res.end(fs.readFileSync(p));
               } else {
                 res.end('[]');
               }
            } else {
              next();
            }
          });
        }
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icono.png', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'ESP DESIGN PRO',
          short_name: 'ESP PRO',
          description: 'Advanced Engineering Suite for ESP Design',
          theme_color: '#00d7d7',
          background_color: '#0a0c10',
          display: 'standalone',
          icons: [
            {
              src: 'icono.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icono.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      }
    }
  };
});