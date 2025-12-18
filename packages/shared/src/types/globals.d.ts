import type { ChromeInstance } from "./browser";

type ChromeGlobal = typeof globalThis extends { chrome: infer T }
  ? T
  : ChromeInstance;

declare global {
  // `chrome` is only available in extension contexts. When the official types
  // are present (e.g., in the extension app), use them; otherwise fall back to
  // a minimal interface for shared packages.
  const chrome: ChromeGlobal;
}
