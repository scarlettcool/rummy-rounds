import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  server: {
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../backend/src/game/rules', import.meta.url))] },
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000' },
  },
  preview: {
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000' },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@rules': fileURLToPath(new URL('../backend/src/game/rules', import.meta.url)),
    },
  },
})
