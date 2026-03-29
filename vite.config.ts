import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,           // Opens browser automatically
      gzipSize: true,      // Show gzipped sizes
      brotliSize: true,    // Show brotli sizes
      filename: 'dist/stats.html'
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});