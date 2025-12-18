## Logging Instructions

- The shared logger is documented here.
- It is OK to import `createLogger` and declare `const log = createLogger();` in new files/components so future code has a logger ready.
- Do not add log statements (especially `log.info` or `log.debug`) unless there is a clear need; avoid noise.
- Always use `log.error(...)` for meaningful error paths instead of calling `console.error` directly.
- When a change requires logger updates, follow the documented patterns; otherwise leave existing logging as-is.

---

# Logger Usage Guide

The shared logger lives in `packages/shared/src/utils/logger.ts` and is exported via `@evevault/shared/utils`. It centralizes the following:

- Environment-aware log level (`debug` in dev, `error` in production, overridable via `VITE_LOG_LEVEL`, `LOG_LEVEL`, or `EVE_VAULT_LOG_LEVEL`)
- Scope auto-discovery (derives the caller’s file + parent folder, so you don’t need to pass strings)
- File/line metadata appended to every log entry for quick DevTools filtering
- Consistent API for `debug`, `info`, `warn`, `error`, plus `.child` to create nested scopes

> **Rule of thumb:** never call `console.*` directly in repo code. Always go through the logger so behavior can be changed globally later (Sentry forwarding, log stripping, etc.).

---

## Quick Start

```ts
import { createLogger } from "@evevault/shared/utils";

const log = createLogger(); // auto-scoped to the current file

log.debug("Fetching balance", { chain });
log.info("Login successful");
log.warn("Missing nonce, generating fallback");
log.error("zkProof failed", error);
```

### Child Scopes

```ts
const log = createLogger();
const authLog = log.child("auth");

authLog.info("Starting login redirect");
authLog.error("Token exchange failed", err);
```

Child scopes append `:<name>` to the parent scope (e.g. `features/wallet:auth`). Useful when a module emits logs for sub-systems (handlers, effects, etc.).

---

## How Auto-Scoping Works

1. When you call `createLogger()` without arguments, the logger inspects the call stack, extracts the file path, and builds a scope using `parentFolder/FileName`.
2. Every log entry prints `"[scope] (relativePath:lineNumber)"` before your message.
3. If you **do** pass a `scope`, it overrides the derived value (helpful for dynamic contexts or non-module code such as inline scripts). The logger suppresses duplicate labels when the manual scope matches the file-derived value.

Examples in DevTools:

```
[features/wallet/WalletScreen] (components/WalletScreen.tsx:85) Stores initialized successfully
[stores/sessionStore] (stores/sessionStore.ts:36) No session data found in sessionStorage
```

---

## Controlling Log Levels

| Env var               | Accepted values                     | Notes                                           |
| --------------------- | ----------------------------------- | ----------------------------------------------- |
| `VITE_LOG_LEVEL`      | `silent` `error` `warn` `info` `debug` | Works in Vite/WXT contexts (`import.meta.env`)   |
| `EVE_VAULT_LOG_LEVEL` | same                                | Works in Node/Bun contexts                      |
| `LOG_LEVEL` / `NODE_ENV` | same / standard envs              | Fallbacks if the vars above are missing         |

- Production default: `error`
- Test default: `warn`
- Everything else: `debug`

Use `silent` to completely mute logs during specific runs.

---

## Debugging Tips

- **Chrome DevTools filters**: Type `[wallet]` or `components/WalletScreen` in the console filter box to narrow logs from a specific module.
- **Jump to source**: The appended `(path:line)` lets you cmd-click to open the exact file/line (DevTools supports this automatically).
- **Group objects**: The logger doesn’t modify arguments; pass structured objects for easier inspection. Example `log.debug("Device data", { nonce, maxEpoch })`.
- **Background/Content scripts**: Works identically there because stack traces are available. Just remember some contexts (e.g., build-time config) may not be able to import `@evevault/shared`—see the note below.

---

## When Not to Use It

- **Build-time configuration files executed before workspace aliases exist** (e.g., `apps/extension/wxt.config.ts`): those scripts execute via Node without Vite’s alias resolution, so importing `@evevault/shared` can fail. Use a local `console` wrapper in those rare cases.
- **Performance-critical hot loops**: If you’re logging inside tight loops, guard the log manually to avoid repeated stack captures (or call `log.debug` sparingly).

---

## Migration Checklist

1. **Replace raw `console.*`** with `createLogger()` instances.
2. **Instantiate once per module** and reuse the same `log` constant.
3. **Use child scopes** for nested behavior or to create specialized loggers for stores, hooks, etc.
4. **Document new logs** only when they carry domain meaning; skip noise.

Following these guidelines keeps logs consistent, searchable, and ready for future destinations (DevTools, file sinks, telemetry services, etc.).

