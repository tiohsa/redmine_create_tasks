import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/plugin_assets/create_tasks/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      outDir: '../assets',
      emptyDirBeforeWrite: false,
      rollupOptions: {
        output: {
          entryFileNames: 'javascripts/spa.js',
          chunkFileNames: 'javascripts/[name].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) {
              return 'stylesheets/spa.css';
            }
            return 'javascripts/[name][extname]';
          }
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
