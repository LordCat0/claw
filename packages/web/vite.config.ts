import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';

export default defineConfig({
  plugins: [preact(), vanillaExtractPlugin()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-clerk',
              test: /[\\/]node_modules[\\/]@clerk[\\/]/,
              tags: ['$initial']
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              tags: ['$initial']
            }
          ]
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: path => path.replace(/^\/api/, '')
      }
    }
  }
});
