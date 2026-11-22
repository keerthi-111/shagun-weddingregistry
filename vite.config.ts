import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, Vite serves the React app on :5173 and forwards /api to the .NET API.
// `npm run build` writes the app into the API's wwwroot so one .NET process serves everything.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.API_URL || 'http://localhost:5080' },
  },
  build: {
    outDir: '../backend/Shagun.Api/wwwroot',
    emptyOutDir: true,
  },
});
