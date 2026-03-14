import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    entries: ['src/**/*.{js,jsx}']  // ← add this line
  }
})