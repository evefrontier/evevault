/// <reference types="chrome"/>

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

/**
 * Session-storage persistence for the keeper offscreen document.
 *
 * Why this exists:
 *   The keeper's RAM-only `ephemeralKey` and unlock state survive only
 *   as long as the offscreen document does. Chromium MV3 closes the
 *   offscreen document when the service worker is torn down (after
 *   ~30 seconds of idle), which loses all module-level state and
 *   surfaces as `[KEEPER_EPH_SIGN] LOCKED` even though the user's
 *   10-minute unlock window has not actually expired.
 *
 * What we use:
 *   `chrome.storage.session` — in-memory only, isolated per-extension,
 *   cleared on browser-process exit. Critically, it is NOT written to
 *   disk and does not survive a browser restart, which is the right
 *   security boundary for an "ephemeral" key.
 *
 * What we persist:
 *   - The encoded secret key for the ephemeral keypair (Ed25519)
 *   - The unlock-expiry timestamp
 *
 * What we do NOT persist:
 *   - The user PIN (never stored anywhere by the keeper)
 *   - The decrypted master keypair (only ephemeral keys are session-scoped)
 *   - WebCrypto-derived `CryptoKey` instances (those are non-extractable)
 *
 * If the user runs CLEAR_EPHKEY (explicit lock), we clear session storage
 * too. If the unlock expires naturally, we clear it. If the offscreen
 * document is re-created and the session entry is missing, we stay locked.
 */

const STORAGE_KEY = "keeper.session.v1";

interface PersistedKeeperState {
  /** Ed25519 keypair encoded as a Sui-format secret key string. */
  secretKey: string;
  /** ms-since-epoch when the unlock window expires. */
  unlockExpiry: number;
}

/**
 * Serialize and persist current keeper state to chrome.storage.session.
 * Safe to call repeatedly; failures are non-fatal (we just stay in
 * RAM-only mode like before this patch).
 */
export async function persistKeeperState(
  ephemeralKey: Ed25519Keypair,
  unlockExpiry: number,
): Promise<void> {
  try {
    const state: PersistedKeeperState = {
      secretKey: ephemeralKey.getSecretKey(),
      unlockExpiry,
    };
    await chrome.storage.session.set({ [STORAGE_KEY]: state });
  } catch {
    // chrome.storage.session may be unavailable in some test environments
    // or older Chromium builds; treat as best-effort.
  }
}

/**
 * Clear all persisted keeper state from session storage.
 * Called on explicit lock (CLEAR_EPHKEY) and on natural expiry.
 */
export async function clearPersistedKeeperState(): Promise<void> {
  try {
    await chrome.storage.session.remove(STORAGE_KEY);
  } catch {
    // best-effort
  }
}

/**
 * Result of attempting to restore keeper state on offscreen document load.
 */
export interface RestoredKeeperState {
  ephemeralKey: Ed25519Keypair;
  unlockExpiry: number;
}

/**
 * Attempt to restore keeper state from session storage. Returns null if:
 *   - No persisted state exists
 *   - Persisted state has expired (we also clear it in that case)
 *   - The persisted secret key fails to decode
 *   - chrome.storage.session is unavailable
 */
export async function restoreKeeperState(): Promise<RestoredKeeperState | null> {
  try {
    if (!chrome.storage?.session) return null;

    const raw = await chrome.storage.session.get(STORAGE_KEY);
    const state = raw?.[STORAGE_KEY] as PersistedKeeperState | undefined;
    if (
      !state ||
      typeof state.secretKey !== "string" ||
      typeof state.unlockExpiry !== "number"
    ) {
      return null;
    }

    if (Date.now() > state.unlockExpiry) {
      // Expired — clean up and stay locked.
      await clearPersistedKeeperState();
      return null;
    }

    const ephemeralKey = Ed25519Keypair.fromSecretKey(state.secretKey);
    return { ephemeralKey, unlockExpiry: state.unlockExpiry };
  } catch {
    return null;
  }
}
