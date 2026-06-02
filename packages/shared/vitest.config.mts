import path from 'node:path'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const viteEnvDefine = {
  'import.meta.env.MODE': JSON.stringify('test'),
  'import.meta.env.VITE_LOG_LEVEL': JSON.stringify('warn'),
}

const inlineDappKit = {
  server: {
    deps: {
      inline: ['@evefrontier/wallet-core'],
    },
  },
}

export default defineConfig({
  define: viteEnvDefine,
  plugins: [
    react(),
    tsconfigPaths({
      root: __dirname,
    }),
  ],
  resolve: {
    alias: [
      {
        find: /^#\/(.+)$/,
        replacement: path.resolve(__dirname, './src/$1'),
      },
    ],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    mainFields: ['module', 'main'],
  },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.config.{ts,js,mjs,cjs}',
      ],
    },
    projects: [
      {
        test: {
          name: 'unit-node',
          include: ['src/**/*.node.test.{ts,tsx}'],
          environment: 'node',
          globals: true,
          setupFiles: ['../../vitest.setup.ts'],
          ...inlineDappKit,
        },
      },
      {
        test: {
          name: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            'src/**/*.browser.test.{ts,tsx}',
            'src/**/*.node.test.{ts,tsx}',
          ],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['../../vitest.setup.ts'],
          ...inlineDappKit,
        },
      },
      {
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
          globals: true,
          setupFiles: ['../../vitest.setup.ts'],
          ...inlineDappKit,
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
