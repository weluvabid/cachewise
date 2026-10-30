import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/cachewise/' : '/',
  plugins: [tailwindcss(), svelte()],
  build: {
    target: 'es2022',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    reportCompressedSize: true,
  },
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      cachewise: fileURLToPath(new URL('../../packages/cachewise/src/index.ts', import.meta.url)),
    },
  },
});
