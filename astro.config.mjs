import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@astrojs/netlify'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://your-store.netlify.app',
  vite: { plugins: [tailwindcss()] },
  adapter: netlify({ imageCDN: false }),
  integrations: [sitemap()],
})
