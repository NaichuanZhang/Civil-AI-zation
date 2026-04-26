import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { avatarkitVitePlugin } from '@spatialwalk/avatarkit/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), avatarkitVitePlugin(), tailwindcss()],
  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, '../assets'),
    },
  },
});
