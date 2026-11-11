import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';

export default defineConfig({
  plugins: [preact(), vanillaExtractPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: path => path.replace(/^\/api/, '')
      }
    }
  }
});
