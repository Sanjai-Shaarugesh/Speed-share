import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import svelte from '@astrojs/svelte';
import serviceWorker from 'astrojs-service-worker';




// https://astro.build/config
export default defineConfig({
  site: 'https://github.com/Sanjai-Shaarugesh/Speed-share',
  outDir: './build',
  output: 'static',
  build: {
    format: 'file' // Ensures proper paths for Capacitor
  },
  compressHTML: true,
  integrations: [svelte(), serviceWorker()],
  vite: {
    plugins: [tailwindcss()]
  },
  server: {
    host: '0.0.0.0', // This makes it accessible from other devices
    port: 5173 // Default Vite port (you can change this if needed)
  }
});