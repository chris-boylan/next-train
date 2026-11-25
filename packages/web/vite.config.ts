import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // In production CloudFront routes /api/* to the API; locally, the dev API server does.
    proxy: { '/api': 'http://localhost:3001' },
  },
});
