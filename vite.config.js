import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const paymentServer = 'http://127.0.0.1:8787'
const proxy = { '^/api/(create-qr-payment|payment-status|refund-payment)$': paymentServer }

function optionalPaymentHealth(server) {
  server.middlewares.use('/api/payment-health', async (_request, response) => {
    let health = { available: false }
    try {
      const result = await fetch(`${paymentServer}/api/payment-health`, { signal: AbortSignal.timeout(1000) })
      if (result.ok) health = await result.json()
    } catch {
      // The frontend can run on its own in sandbox mode.
    }
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'no-store')
    response.end(JSON.stringify(health))
  })
}

export default defineConfig({
  base: process.env.GITHUB_REPOSITORY ? '/' + process.env.GITHUB_REPOSITORY.split('/')[1] + '/' : '/',
  define: {
    'import.meta.env.IS_GITHUB_PAGES': JSON.stringify(Boolean(process.env.GITHUB_REPOSITORY)),
  },
  plugins: [react(), tailwindcss(), {
    name: 'optional-payment-health',
    configureServer: optionalPaymentHealth,
    configurePreviewServer: optionalPaymentHealth,
  }],
  server: { proxy },
  preview: { proxy },
})
