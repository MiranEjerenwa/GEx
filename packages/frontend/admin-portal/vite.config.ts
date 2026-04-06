import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/admin-portal/',
  server: { port: 3002 },
  build: { outDir: 'dist', sourcemap: false },
});