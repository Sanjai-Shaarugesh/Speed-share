import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import svelte from '@astrojs/svelte';
import serviceWorker from 'astrojs-service-worker';

// https://astro.build/config
export default defineConfig({
  site: 'https://github.com/Sanjai-Shaarugesh/Speed-share',
  outDir: './build',
  output: 'static',
  compressHTML: true,
  integrations: [tailwind(), svelte(), serviceWorker()],
  vite: {
    plugins: []
  }
});
