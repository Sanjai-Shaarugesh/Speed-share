import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import svelte from '@astrojs/svelte';
import serviceWorker from 'astrojs-service-worker';

import solidJs from '@astrojs/solid-js';

// https://astro.build/config
export default defineConfig({
  site: 'https://github.com/Sanjai-Shaarugesh/Speed-share',
  outDir: './build',
  output: 'static',
  compressHTML: true,
  integrations: [svelte(), serviceWorker(), solidJs({ devtools: true })],
  vite: {
    plugins: [tailwindcss()]
  }
});