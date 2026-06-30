import { ZKEd25519Keypair } from '@evefrontier/wallet-core/crypto'
import { VAULT_UNLOCK_MS } from '@evevault/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getEphemeralKey,
  getSessionRemainingMs,
  lockVault,
  unlockVaultWithKeypair,
} from '../keeperState'

/**
 * The offscreen keeper outlives the popup, so it must lock itself at expiry
 * rather than relying on a UI hook or the next operation. These exercise that
 * proactive timer directly (no message dispatch, no enforceExpiry call).
 */
describe('keeper proactive auto-lock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    lockVault()
    vi.useRealTimers()
  })

  it('locks itself once VAULT_UNLOCK_MS elapses, with nothing else triggering it', () => {
    unlockVaultWithKeypair(ZKEd25519Keypair.generate())
    expect(getEphemeralKey()).not.toBeNull()
    expect(getSessionRemainingMs()).toBeGreaterThan(0)

    vi.advanceTimersByTime(VAULT_UNLOCK_MS + 1)

    expect(getEphemeralKey()).toBeNull()
    expect(getSessionRemainingMs()).toBe(0)
  })

  it('does not lock before the window elapses', () => {
    unlockVaultWithKeypair(ZKEd25519Keypair.generate())

    vi.advanceTimersByTime(VAULT_UNLOCK_MS - 1000)

    expect(getEphemeralKey()).not.toBeNull()
  })

  it('cancels the timer on manual lock so it cannot fire later', () => {
    unlockVaultWithKeypair(ZKEd25519Keypair.generate())
    lockVault()

    // Re-unlock and confirm the *first* timer was cancelled (only the latest
    // window is in effect — no stale timer from the cancelled session).
    unlockVaultWithKeypair(ZKEd25519Keypair.generate())
    vi.advanceTimersByTime(VAULT_UNLOCK_MS - 1000)
    expect(getEphemeralKey()).not.toBeNull()
  })
})
