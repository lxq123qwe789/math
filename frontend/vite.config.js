import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devHost = env.VITE_DEV_HOST || '0.0.0.0'
  const devPort = Number(env.VITE_DEV_PORT || 5173)
  const apiBase = env.VITE_API_BASE || '/api'
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8000'
  const customAllowedHosts = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    plugins: [vue()],
    server: {
      host: devHost,
      port: devPort,
      allowedHosts: ['.cpolar.top', ...customAllowedHosts],
      proxy: {
        [apiBase]: {
          target: apiTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        }
      }
    }
  }
})
