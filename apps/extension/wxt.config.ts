import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { env } from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'wxt'
import { appVersionPlugin } from '../../tools/vite-app-version-plugin'

/**
 * Simple logger for this config file only.
 * This file is loaded by jiti (Node.js) BEFORE Vite starts,
 * so we can't import from @evevault/shared here.
 */
const logger = {
  info: (msg: string, data?: object) =>
    console.log(`[wxt-config] ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg: string) => console.warn(`[wxt-config] ${msg}`),
}

// See https://wxt.dev/api/config.html
// @ts-expect-error - WXT UserConfig types may not include custom vite plugins
export default defineConfig(() => {
  // Load env from root directory (monorepo root)
  // When running from apps/extension, __dirname is apps/extension, so go up 2 levels
  const rootDir = path.resolve(__dirname, '../..')
  // Version comes from extension package.json (updated by Changesets fixed group).
  const extPkg = JSON.parse(
    readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
  ) as { version?: string }
  const version = extPkg.version ?? '0.0.0'
  const envVars = loadEnv(env?.mode || 'development', rootDir, '')
  const includeExtensionKey =
    process.env.WXT_WEBSTORE_BUILD !== 'true' && !!envVars.EXTENSION_ID

  // Debug: log loaded env vars to aid local setup. Gated to non-production so
  // it never runs in release builds.
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Env vars loaded', {
      hasExtensionId: !!envVars.EXTENSION_ID,
      rootDir,
    })
  }

  // Determine Chrome path based on OS and set environment variable for chrome-launcher
  // First check if user has set CHROME_PATH environment variable
  let chromePath: string | undefined = process.env.CHROME_PATH

  if (!chromePath) {
    if (process.platform === 'win32') {
      chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    } else if (process.platform === 'darwin') {
      // macOS Chrome paths (check multiple common locations)
      const macChromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ]

      for (const path of macChromePaths) {
        if (existsSync(path)) {
          chromePath = path
          break
        }
      }
    }
  }

  // Set environment variable that chrome-launcher will pick up
  if (chromePath && !process.env.CHROME_PATH) {
    process.env.CHROME_PATH = chromePath
  }

  // Log Chrome detection status in development
  if (process.env.NODE_ENV !== 'production') {
    if (chromePath) {
      logger.info('Chrome found', { chromePath })
    } else {
      logger.warn(
        '⚠️  Chrome not found. Extension will be built but not auto-launched.',
      )
      logger.warn('   You can manually load it from: .output/chrome-mv3-dev')
      logger.warn(
        '   Or set CHROME_PATH environment variable to your Chrome executable path.',
      )
    }
  }

  return {
    modules: ['@wxt-dev/module-react'],
    manifestVersion: 3,
    srcDir: 'src',
    entrypointsDir: '../entrypoints',
    // WXT owns the dev-server port here (not vite.server.port). Chrome dev uses
    // 3000; the Firefox dev script overrides with `--port 3002` so both
    // extension targets can run at once. Web app is on 3005.
    dev: {
      server: {
        port: 3000,
      },
    },
    // WXT reads binaries[<target browser>] for the chromium binary and
    // binaries.firefox for Firefox. (The old chromiumExecutablePath/
    // executablePath keys are not valid webExt options and were ignored.)
    // Firefox is auto-discovered by web-ext when installed; Chrome is pinned to
    // the detected path so dev auto-launches when it isn't on PATH.
    webExt: {
      binaries: {
        ...(chromePath && { chrome: chromePath }),
      },
    },
    vite: () => ({
      plugins: [
        appVersionPlugin(version),
        tsconfigPaths({
          root: __dirname,
        }),
        tanstackRouter({ quoteStyle: 'double' }),
        tailwindcss(),
      ],
      // Configure Vite to load env vars from monorepo root
      envDir: rootDir,
      optimizeDeps: {
        include: ['@evevault/shared/utils'],
      },
    }),
    manifest: {
      ...(includeExtensionKey ? { key: envVars.EXTENSION_ID } : {}),
      name: 'EVE Vault',
      version,
      description: 'EVE Vault for EVE Frontier with ZKLogin',
      permissions: ['identity', 'storage', 'offscreen'],
      action: {
        default_popup: 'popup.html',
      },
      host_permissions: ['<all_urls>'],
      background: {
        service_worker: 'background.ts',
      },
      web_accessible_resources: [
        {
          resources: ['injected.js', 'announce.js'],
          matches: ['<all_urls>'],
        },
      ],
      content_security_policy: {
        // 'wasm-unsafe-eval' is required for the keeper's Argon2id (hash-wasm)
        // to instantiate its inline WebAssembly in the MV3 service worker.
        // This is the EXTENSION CSP. The web app has its own CSP in
        // amplify.yml (customHeaders). The two are separate surfaces in
        // different formats but share the same allowed-host list and
        // 'wasm-unsafe-eval' grant — change both together.
        extension_pages:
          "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; img-src 'self' data: http://localhost:3000",
      },
    },
    hooks: {
      // WXT adds `scripting` in dev for HMR content-script registration but
      // uses a static content_scripts entry in production. Strip it from
      // release builds only so the Web Store doesn't flag it as unused.
      'build:manifestGenerated'(wxt, manifest) {
        if (process.env.NODE_ENV !== 'development') {
          manifest.permissions = manifest.permissions?.filter(
            (p) => p !== 'scripting',
          )
        }
        // Firefox MV3 refuses to load an extension without an explicit gecko id
        // (it also fixes the moz-extension:// origin, which the OAuth redirect
        // URL derives from). Chrome ignores browser_specific_settings, so scope
        // it to the Firefox build.
        if (wxt.config.browser === 'firefox') {
          manifest.browser_specific_settings = {
            gecko: {
              id: 'evevault@evefrontier.com',
              strict_min_version: '128.0',
            },
          }
          // No offscreen API on Firefox; the keeper runs in-process.
          manifest.permissions = manifest.permissions?.filter(
            (p) => p !== 'offscreen',
          )
        }
      },
    },
  }
})
