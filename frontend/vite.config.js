import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind v4 no lleva tailwind.config.js: se registra como plugin de Vite y
// la personalizacion vive en un bloque @theme dentro del propio CSS.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // El backend corre en 3000. El proxy evita configurar CORS en desarrollo
    // y hace que el frontend hable siempre contra rutas relativas.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
