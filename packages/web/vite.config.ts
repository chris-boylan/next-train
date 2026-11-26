import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const GREEN = '#169b62';

/** e.g. "2026-11-26 · 45232c5": the build date and commit, shown on the help page. */
function appVersion(): string {
  const date = new Date().toISOString().slice(0, 10);
  try {
    return `${date} · ${execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()}`;
  } catch {
    return date;
  }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [
    react(),
    // Installable on the home screen ("Add to Home Screen" on iOS). The service worker precaches the app shell so
    // it opens instantly and offline; live times always come from the network.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Next Train?',
        short_name: 'Next Train',
        description: 'Live Irish Rail train times',
        lang: 'en-IE',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: GREEN,
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkOnly' }],
      },
    }),
  ],
  server: {
    // In production CloudFront routes /api/* to the API; locally, the dev API server does.
    proxy: { '/api': 'http://localhost:3001' },
  },
});
