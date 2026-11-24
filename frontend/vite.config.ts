import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind()],
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8080' } },
  test: { environment: 'jsdom', include: ['src/**/*.test.tsx'] },
})
