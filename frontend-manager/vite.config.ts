import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/admin/',
  server: {
    proxy: {
      '/admin/api': 'http://localhost:17771',
    },
  },
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },
})
