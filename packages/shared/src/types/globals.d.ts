import type { ChromeInstance } from "./browser";

type ChromeGlobal = typeof globalThis extends { chrome: infer T }
  ? T
  : ChromeInstance;

declare global {
  // Shim for third-party packages (e.g. @evefrontier/dapp-kit) that reference
  // NodeJS.Timeout without shipping @types/node as a dependency.
  namespace NodeJS {
    type Timeout = ReturnType<typeof setTimeout>;
  }

  // `chrome` is only available in extension contexts. When the official types
  // are present (e.g., in the extension app), use them; otherwise fall back to
  // a minimal interface for shared packages.
  const chrome: ChromeGlobal;
}
