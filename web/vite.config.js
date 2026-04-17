import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ice-config': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ice-config/, '/getIceConfig'),
      },
      '/verify-paystack': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/verify-paystack/, '/verifyPaystack'),
      },
      '/finalize-session-billing': {
        target: 'http://localhost:5001/claxi-bakayise/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/finalize-session-billing/, '/finalizeSessionBilling'),
      },
    },
  },
})
