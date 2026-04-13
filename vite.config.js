import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Si el sitio está en un subdirectorio (ej: dominio.com/app/), cambiá base a '/app/'
// Si está en la raíz del dominio, dejá '/' (default)
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          react:  ['react', 'react-dom', 'react-router-dom'],
          zxing:  ['@zxing/library'],
        },
      },
    },
  },
})
