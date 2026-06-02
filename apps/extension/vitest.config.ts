import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    'import.meta.env.MODE': JSON.stringify('test'),
    'import.meta.env.VITE_LOG_LEVEL': JSON.stringify('warn'),
  },
  plugins: [
    react(),
    tsconfigPaths({
      root: __dirname,
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'entrypoints/**/*.test.{ts,tsx}'],
    setupFiles: ['../../vitest.setup.ts'],
    server: {
      deps: {
        inline: ['@evefrontier/wallet-core'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.wxt/**',
        '**/.output/**',
      ],
    },
  },
})
