import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  base: '/',
  plugins: [glsl()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0
  }
});
