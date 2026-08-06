// Test-only replacement for `wxt/browser`, wired in via `test.alias` in
// vitest.config.ts. The real module resolves `browser` once at import time
// (`globalThis.browser ?? globalThis.chrome`), which would go stale as tests
// swap the global with `vi.stubGlobal('browser', ...)` per test. This proxy
// instead reads `globalThis.browser` live on every access, so each test's stub
// is what source code sees.
// biome-ignore-all lint/suspicious/noExplicitAny: test shim over the untyped global
export const browser: any = new Proxy(
  {},
  {
    get(_target, prop) {
      return (globalThis as any).browser?.[prop]
    },
  },
)
