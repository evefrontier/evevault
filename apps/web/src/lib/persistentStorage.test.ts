import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './persistentStorage'

describe('requestPersistentStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false when the StorageManager API is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('returns false when persist() is not implemented', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn() } })
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('short-circuits without requesting when storage is already persisted', async () => {
    const persist = vi.fn()
    vi.stubGlobal('navigator', {
      storage: { persisted: vi.fn(async () => true), persist },
    })

    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('requests a grant and returns its result when not yet persisted', async () => {
    const persist = vi.fn(async () => true)
    vi.stubGlobal('navigator', {
      storage: { persisted: vi.fn(async () => false), persist },
    })

    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  it('returns false when the browser declines the grant', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persisted: vi.fn(async () => false),
        persist: vi.fn(async () => false),
      },
    })

    expect(await requestPersistentStorage()).toBe(false)
  })

  it('swallows errors and returns false', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persisted: vi.fn(async () => {
          throw new Error('boom')
        }),
        persist: vi.fn(),
      },
    })

    expect(await requestPersistentStorage()).toBe(false)
  })
})
