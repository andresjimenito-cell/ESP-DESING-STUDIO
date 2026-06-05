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
        includeAssets: ['favicon.ico', 'icono.png', 'icono192.png', 'icono512.png', 'app-logo.png', 'robots.txt', 'apple-touch-icon.png'],
        workbox: {
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        manifest: {
          name: 'ESP DESIGN PRO',
          short_name: 'ESP DESIGN PRO',
          description: 'Advanced Engineering Suite for ESP Design',
          theme_color: '#00d7d7',
          background_color: '#0a0c10',
          display: 'standalone',
          icons: [
            {
              src: 'icono.png',
              sizes: '46x46',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icono192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icono512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
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
      exclude: []
    },
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      }
    }
  };
});