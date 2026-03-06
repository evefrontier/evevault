/** Persist keys used by Zustand and auth (localStorage / chrome.storage.local). Cleared on reset. */
export const EVEVAULT_STORAGE_KEYS = [
  "evevault:auth",
  "evevault:device",
  "evevault:network",
  "evevault:tokenlist",
  "evevault:jwt",
  "evevault:dev-mode",
] as const;

/** Extension-only chrome.storage.local keys cleared on reset (not covered by cleanupExtensionStorage). */
export const EXTENSION_EXTRA_KEYS = [
  "pendingAction",
  "transactionResult",
] as const;

/** sessionStorage key for post-login redirect path. */
export const SESSION_STORAGE_REDIRECT_KEY = "evevault_redirect_after_login";
