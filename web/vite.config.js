import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
// npm run build → ../public/app (served by the Worker at /app/). SINGLE=1 → one HTML file for previews.
const single = !!process.env.SINGLE;
export default defineConfig({
  base: single ? './' : '/app/',
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  build: single ? { outDir: 'dist-single', emptyOutDir: true, assetsInlineLimit: 1e8 } : { outDir: '../public/app', emptyOutDir: true, assetsInlineLimit: 4096 },
  server: { proxy: { '/api': 'http://localhost:8787', '/auth': 'http://localhost:8787', '/files': 'http://localhost:8787' } },
});
