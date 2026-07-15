import { VAULT_UNLOCK_MS } from './constants'

/**
 * Persists the unlock-window expiry so it can outlive the process that set it
 * (e.g. sessionStorage on web, where OAuth sign-in reloads the page).
 * `load()` runs once at construction; implementations own validation of
 * whatever they read back.
 */
export interface VaultSessionStorage {
  load(): number | null
  save(expiry: number | null): void
}

/**
 * The single source of truth for vault unlock-window timing.
 *
 * Both the web vault (webVaultService) and the extension keeper (keeperState)
 * gate access on the same rule — "unlocked iff now < expiry" — but hold their
 * secrets differently and clear them in their own way. This class owns ONLY the
 * expiry timestamp and the rule, with no knowledge of keys, so the timing logic
 * can't silently diverge between the two surfaces. Each caller still owns when
 * to clear its own secrets in response to isActive() going false — including
 * re-loading them when a storage-restored session is active but the secrets
 * died with the previous process.
 *
 * Date.now() is read internally so callers (and their fake-timer tests) need no
 * clock plumbing.
 */
export class VaultSession {
  private expiry: number | null

  constructor(private storage?: VaultSessionStorage) {
    this.expiry = storage?.load() ?? null
  }

  /** Start or extend the unlock window from now. */
  unlock(durationMs: number = VAULT_UNLOCK_MS): void {
    this.expiry = Date.now() + durationMs
    this.storage?.save(this.expiry)
  }

  /**
   * True while the unlock window is still open. The boundary is strict: at
   * exactly `expiry` the window is considered closed (`now < expiry`).
   */
  isActive(): boolean {
    return this.expiry !== null && Date.now() < this.expiry
  }

  /**
   * Milliseconds left in the window. Returns 0 whenever there is no active
   * window — i.e. never unlocked, cleared, OR expired. 0 does NOT specifically
   * mean "expired"; pair with isActive()/unlock state if you need to tell
   * "never unlocked" apart from "elapsed".
   */
  remainingMs(): number {
    if (this.expiry === null) return 0
    return Math.max(0, this.expiry - Date.now())
  }

  /** End the session immediately. */
  clear(): void {
    this.expiry = null
    this.storage?.save(null)
  }
}
