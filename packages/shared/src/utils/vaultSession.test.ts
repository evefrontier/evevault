import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VAULT_UNLOCK_MS } from './constants'
import { VaultSession, type VaultSessionStorage } from './vaultSession'

const createMemoryStorage = (
  initial: number | null = null,
): VaultSessionStorage & { value: number | null } => {
  const storage = {
    value: initial,
    load: () => storage.value,
    save: (expiry: number | null) => {
      storage.value = expiry
    },
  }
  return storage
}

describe('VaultSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is inactive before any unlock', () => {
    const session = new VaultSession()
    expect(session.isActive()).toBe(false)
  })

  it('is active immediately after unlock', () => {
    const session = new VaultSession()
    session.unlock()
    expect(session.isActive()).toBe(true)
  })

  it('stays active up to the expiry and locks after it', () => {
    const session = new VaultSession()
    session.unlock()

    vi.advanceTimersByTime(VAULT_UNLOCK_MS - 1)
    expect(session.isActive()).toBe(true)

    vi.advanceTimersByTime(2)
    expect(session.isActive()).toBe(false)
  })

  it('honours a custom duration', () => {
    const session = new VaultSession()
    session.unlock(1000)

    vi.advanceTimersByTime(999)
    expect(session.isActive()).toBe(true)

    vi.advanceTimersByTime(2)
    expect(session.isActive()).toBe(false)
  })

  it('extends the window when unlock is called again', () => {
    const session = new VaultSession()
    session.unlock()

    vi.advanceTimersByTime(VAULT_UNLOCK_MS - 100)
    expect(session.isActive()).toBe(true)

    // Re-unlock resets the window from now, so the original expiry is moot.
    session.unlock()
    vi.advanceTimersByTime(200)
    expect(session.isActive()).toBe(true)
  })

  it('is inactive after clear', () => {
    const session = new VaultSession()
    session.unlock()
    session.clear()
    expect(session.isActive()).toBe(false)
  })

  describe('with persistence storage', () => {
    it('saves the expiry on unlock and null on clear', () => {
      const storage = createMemoryStorage()
      const session = new VaultSession(storage)

      session.unlock(1000)
      expect(storage.value).toBe(Date.now() + 1000)

      session.clear()
      expect(storage.value).toBeNull()
    })

    it('resumes a persisted window with its remaining time intact', () => {
      const storage = createMemoryStorage(Date.now() + 5000)
      const session = new VaultSession(storage)

      expect(session.isActive()).toBe(true)
      expect(session.remainingMs()).toBe(5000)

      vi.advanceTimersByTime(5001)
      expect(session.isActive()).toBe(false)
    })

    it('stays inactive when the persisted window has already elapsed', () => {
      const storage = createMemoryStorage(Date.now() - 1)
      const session = new VaultSession(storage)

      expect(session.isActive()).toBe(false)
    })

    it('starts fresh when storage holds nothing', () => {
      const session = new VaultSession(createMemoryStorage())
      expect(session.isActive()).toBe(false)
    })
  })
})
