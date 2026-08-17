import { execSync } from 'node:child_process'

/**
 * Short commit SHA of the current build, for build provenance exposed to dApps.
 * Prefers a CI-provided SHA (BUILD_COMMIT / GITHUB_SHA env) so release builds
 * report the exact commit even when .git is absent; falls back to local git,
 * then "unknown".
 */
function resolveCommit(): string {
  const fromEnv = process.env.BUILD_COMMIT ?? process.env.GITHUB_SHA
  if (fromEnv) return fromEnv.slice(0, 8)
  try {
    return execSync('git rev-parse --short=8 HEAD', {
      encoding: 'utf-8',
    }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Vite plugin that exposes build info as the virtual module `virtual:app-version`.
 * Emits APP_VERSION (from package.json, passed by the caller) and BUILD_COMMIT
 * (resolved here), so apps can import them without using import.meta.env.
 *
 * Shared by apps/extension (wxt.config) and apps/web (vite.config).
 */
export function appVersionPlugin(appVersion: string) {
  const commit = resolveCommit()
  return {
    name: 'app-version',
    resolveId(id: string) {
      if (id === 'virtual:app-version') return id
    },
    load(id: string) {
      if (id === 'virtual:app-version')
        return [
          `export const APP_VERSION = ${JSON.stringify(appVersion)};`,
          `export const BUILD_COMMIT = ${JSON.stringify(commit)};`,
        ].join('\n')
    },
  }
}
