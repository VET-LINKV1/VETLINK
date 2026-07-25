import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    // host: true makes Vite listen on every network interface (0.0.0.0) so
    // a phone on the same Wi-Fi can reach the dev server at the laptop's IP.
    host: true,
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
});
