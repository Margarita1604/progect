import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Все запросы React-приложения на /api/... Vite пересылает во Flask.
    // Для браузера это один и тот же адрес (localhost:5173), поэтому
    // cookie сессии работают без настроек CORS.
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
})
