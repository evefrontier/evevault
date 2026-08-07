import { readFileSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import { appVersionPlugin } from '../../tools/vite-app-version-plugin'

const extPkg = JSON.parse(
  readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
) as { version?: string }

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
    appVersionPlugin(extPkg.version ?? '0.0.0'),
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
