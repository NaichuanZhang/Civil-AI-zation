import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { avatarkitVitePlugin } from '@spatialwalk/avatarkit/vite';

export default defineConfig({
  plugins: [react(), avatarkitVitePlugin()],
});
