import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // API local (apps/api, porta 3333): mesma origem para o cookie de sessão.
  server: { proxy: { '/api': { target: 'http://127.0.0.1:3333', changeOrigin: false } } },
});
