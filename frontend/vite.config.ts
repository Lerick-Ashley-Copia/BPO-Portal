import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_PATH ?? '/',
  server: {
    port: 4300,
    strictPort: true,
  },
  preview: {
    port: 4301,
    strictPort: true,
  },
})
