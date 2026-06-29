import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VAULT_UNLOCK_MS } from './constants'
import { VaultSession } from './vaultSession'

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
})
