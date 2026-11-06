/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import pkg from './package.json' with { type: 'json' };

const stub = (name: string) => fileURLToPath(new URL(`./src/globe/stubs/${name}.ts`, import.meta.url));

// Für GitHub Pages liegt die App unter /<repo-name>/, sonst unter /.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    // Ungenutzte, sehr große Abhängigkeiten der Globus-Bibliothek durch Platzhalter ersetzen
    alias: [
      { find: /^three\/webgpu$/, replacement: stub('webgpu') },
      { find: /^three\/tsl$/, replacement: stub('tsl') },
      { find: /^h3-js$/, replacement: stub('h3') },
    ],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Fernweh – Mein Reise-Atlas',
        short_name: 'Fernweh',
        description: 'Wo du warst, wo du hinwillst – und alles, was du dazu gesammelt hast.',
        lang: 'de',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#05070f',
        theme_color: '#05070f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        // Startbilder lädt iOS nur bei der Installation – nicht offline vorhalten
        globIgnores: ['splash/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
