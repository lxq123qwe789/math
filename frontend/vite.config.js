import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const customAllowedHosts = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    plugins: [vue()],
    server: {
      port: 5173,
      allowedHosts: ['.cpolar.top', ...customAllowedHosts],
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
        }
      }
    }
  }
})
