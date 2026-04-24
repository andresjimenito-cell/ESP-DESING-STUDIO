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
      open: true,
    },
    plugins: [
      react(),
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