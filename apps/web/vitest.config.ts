import path from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    envDir: path.resolve(__dirname, '.'),
    define: {
      'import.meta.env.MODE': JSON.stringify('test'),
      'import.meta.env.VITE_LOG_LEVEL': JSON.stringify('warn'),
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['../../vitest.setup.ts'],
      passWithNoTests: true,
      server: {
        deps: {
          inline: ['@evefrontier/dapp-kit'],
        },
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary', 'json'],
        reportOnFailure: true,
        exclude: ['**/node_modules/**', '**/dist/**', '**/.output/**'],
      },
    },
  }),
)
