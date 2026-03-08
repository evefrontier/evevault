/** Individual storage keys for use in stores and auth. */
export const AUTH_STORAGE_KEY = "evevault:auth";
export const DEVICE_STORAGE_KEY = "evevault:device";
export const NETWORK_STORAGE_KEY = "evevault:network";
export const TOKENLIST_STORAGE_KEY = "evevault:tokenlist";
export const JWT_STORAGE_KEY = "evevault:jwt";
export const DEV_MODE_STORAGE_KEY = "evevault:dev-mode";

/** Persist keys used by Zustand and auth (localStorage / chrome.storage.local). Cleared on reset. */
export const EVEVAULT_STORAGE_KEYS = [
  AUTH_STORAGE_KEY,
  DEVICE_STORAGE_KEY,
  NETWORK_STORAGE_KEY,
  TOKENLIST_STORAGE_KEY,
  JWT_STORAGE_KEY,
  DEV_MODE_STORAGE_KEY,
] as const;

/** Extension-only chrome.storage.local keys cleared on reset (not covered by cleanupExtensionStorage). */
export const EXTENSION_EXTRA_KEYS = [
  "pendingAction",
  "transactionResult",
] as const;

/** sessionStorage key for post-login redirect path. */
export const SESSION_STORAGE_REDIRECT_KEY = "evevault_redirect_after_login";
