import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Default base is /scadenziario/ for GitHub Pages.
// For native Android build, the command line flag `--base /` is used.
export default defineConfig({
  plugins: [react()],
  base: '/scadenziario/'
})
