import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Normalise BASE_PATH: strip trailing slash, keep leading slash.
  // Vite's `base` option requires a trailing slash, so we add it back here.
  const rawBase = (env.BASE_PATH ?? '').replace(/\/+$/, '');
  const viteBase = rawBase ? `${rawBase}/` : '/';

  return {
    plugins: [vue(), tailwindcss(), visualizer({ open: false, filename: 'dist/stats.html' })],
    base: viteBase,
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-vue': ['vue', 'vue-router', 'pinia'],
            'vendor-socket': ['socket.io-client'],
            'vendor-axios': ['axios'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@scripts': path.resolve(__dirname, './scripts'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: ['dev-m3p7ridp3fwt.menkar.ru', 'dev-games.menkar.ru', 'games.menkar.ru', 'localhost'],
    },
  };
});
