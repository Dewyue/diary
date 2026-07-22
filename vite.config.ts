import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://dewyue.github.io/diary/
const base = process.env.VITE_BASE_PATH ?? '/diary/'

export default defineConfig({
  base,
  plugins: [react()],
})
