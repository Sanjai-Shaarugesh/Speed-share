import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import svelte from '@astrojs/svelte';
import serviceWorker from 'astrojs-service-worker';

// https://astro.build/config
export default defineConfig({
  site: 'https://github.com/Sanjai-Shaarugesh',
  outDir: './build',
  output: 'static',
  compressHTML: true,
  integrations: [ svelte(), serviceWorker()],
  vite: {
    plugins: [tailwindcss()]
  }
});
