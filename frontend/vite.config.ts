import { createLogger } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

/** Benign disconnects when the backend/client closes a proxied WS mid-flight. */
const QUIET_PROXY_ERRNOS = new Set(['ECONNRESET', 'EPIPE', 'ECONNREFUSED'])

const logger = createLogger()
const logError = logger.error.bind(logger)
logger.error = (msg, options) => {
  const code = (options?.error as NodeJS.ErrnoException | undefined)?.code
  if (code && QUIET_PROXY_ERRNOS.has(code)) return
  logError(msg, options)
}

export default defineConfig({
  customLogger: logger,
  plugins: [
    react(),
    ...(process.env.ANALYZE === '1'
      ? [visualizer({
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
          open: false,
        })]
      : []),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
        configure: (proxy: any, _options: any) => {
          proxy.on('proxyRes', (proxyRes: any, req: any, _res: any) => {
            if (req.url?.startsWith('/api/chat/stream')) {
              proxyRes.headers['cache-control'] = 'no-cache'
              proxyRes.headers['x-accel-buffering'] = 'no'
              delete proxyRes.headers['content-length']
            }
          })
        },
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
  },
})
