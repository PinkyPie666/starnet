import { defineConfig } from 'vite';

// Phaser (world) and the Anthropic SDK (Live mode) are reached only through
// dynamic import(), so they land in their own lazy chunks automatically.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
