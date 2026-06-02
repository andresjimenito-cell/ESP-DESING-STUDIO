/// <reference types="node" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      open: false,
      watch: {
        ignored: ['**/ai_memory.json']
      },
      // Proxy /api/* al backend local (node backend/server.js en puerto 4000)
      // para que `npm run dev` funcione sin necesidad de `vercel dev`
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'app-logo.png', 'robots.txt', 'apple-touch-icon.png'],
        workbox: {
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        manifest: {
          name: 'ESP DESIGN PRO',
          short_name: 'ESP PRO',
          description: 'Advanced Engineering Suite for ESP Design',
          theme_color: '#00d7d7',
          background_color: '#0a0c10',
          display: 'standalone',
          icons: [
            {
              src: 'app-logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    optimizeDeps: {
      exclude: ['jspdf', 'html2canvas']
    },
    resolve: {
      alias: {
        '@': path.resolve('./src'),
        'jspdf': 'https://esm.sh/jspdf@2.5.1',
        'html2canvas': 'https://esm.sh/html2canvas@1.4.1',
      }
    }
  };
});