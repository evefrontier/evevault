import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addPendingDappId,
  clearPendingAuth,
  getPending,
  getPendingAndClear,
  PENDING_AUTH_TIMEOUT_MS,
  sendPendingAuthError,
  setPendingAuthAfterUnlock,
  setPendingAuthWindowId,
} from '../pendingAuth'

const { mockSendToTab, mockSendAuthError } = vi.hoisted(() => ({
  mockSendToTab: vi.fn(),
  mockSendAuthError: vi.fn(),
}))

vi.mock('@/lib/background/messaging/tabMessaging', () => ({
  sendToTab: mockSendToTab,
}))

vi.mock('../authHelpers', () => ({
  sendAuthError: mockSendAuthError,
}))

beforeEach(() => {
  clearPendingAuth()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
  clearPendingAuth()
})

describe('clearPendingAuth', () => {
  it('cancels a pending timeout and nulls state', () => {
    vi.useFakeTimers()
    setPendingAuthAfterUnlock('id-1', 'ext')
    expect(getPending()).not.toBeNull()

    clearPendingAuth()

    expect(getPending()).toBeNull()
    // Advance past the timeout — sendAuthError must not fire
    vi.advanceTimersByTime(PENDING_AUTH_TIMEOUT_MS + 1)
    expect(mockSendAuthError).not.toHaveBeenCalled()
  })
})

describe('sendPendingAuthError', () => {
  it('calls sendAuthError for ext type', () => {
    sendPendingAuthError({ id: 'ext-id', type: 'ext' })
    expect(mockSendAuthError).toHaveBeenCalledWith('ext-id', {
      message: 'Vault unlock was cancelled or timed out.',
    })
    expect(mockSendToTab).not.toHaveBeenCalled()
  })

  it('calls sendToTab for dapp type with tabId', () => {
    sendPendingAuthError({ id: 'dapp-id', type: 'dapp', tabId: 7 })
    expect(mockSendToTab).toHaveBeenCalledWith(7, {
      id: 'dapp-id',
      type: 'auth_error',
      error: { message: 'Vault unlock was cancelled or timed out.' },
    })
    expect(mockSendAuthError).not.toHaveBeenCalled()
  })

  it('sends to all ids including additionalIds for dapp type', () => {
    sendPendingAuthError({
      id: 'primary-id',
      type: 'dapp',
      tabId: 3,
      additionalIds: ['extra-1', 'extra-2'],
    })
    expect(mockSendToTab).toHaveBeenCalledTimes(3)
    expect(mockSendToTab).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ id: 'primary-id' }),
    )
    expect(mockSendToTab).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ id: 'extra-1' }),
    )
    expect(mockSendToTab).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ id: 'extra-2' }),
    )
  })

  it('does nothing for dapp type without tabId', () => {
    sendPendingAuthError({ id: 'dapp-id', type: 'dapp' })
    expect(mockSendToTab).not.toHaveBeenCalled()
    expect(mockSendAuthError).not.toHaveBeenCalled()
  })
})

describe('addPendingDappId', () => {
  it('returns false when there is no pending auth', () => {
    expect(addPendingDappId(1, 'id')).toBe(false)
  })

  it('returns false when pending type is ext', () => {
    setPendingAuthAfterUnlock('ext-id', 'ext')
    expect(addPendingDappId(1, 'new-id')).toBe(false)
  })

  it('returns false when pending tabId does not match', () => {
    setPendingAuthAfterUnlock('dapp-id', 'dapp', 5)
    expect(addPendingDappId(99, 'new-id')).toBe(false)
  })

  it('appends id and returns true for matching dapp pending', () => {
    setPendingAuthAfterUnlock('dapp-id', 'dapp', 5)
    const result = addPendingDappId(5, 'new-id')
    expect(result).toBe(true)
    const pending = getPending()
    expect(pending?.additionalIds).toContain('new-id')
  })

  it('returns true without duplicate when id is already tracked', () => {
    setPendingAuthAfterUnlock('dapp-id', 'dapp', 5)
    addPendingDappId(5, 'new-id')
    const result = addPendingDappId(5, 'new-id')
    expect(result).toBe(true)
    expect(
      getPending()?.additionalIds?.filter((x) => x === 'new-id'),
    ).toHaveLength(1)
  })
})

describe('setPendingAuthAfterUnlock', () => {
  it('sets pending state with provided fields', () => {
    setPendingAuthAfterUnlock('my-id', 'dapp', 10, 99, 'tenant-abc')
    const pending = getPending()
    expect(pending).toMatchObject({
      id: 'my-id',
      type: 'dapp',
      tabId: 10,
      windowId: 99,
      tenantId: 'tenant-abc',
    })
  })

  it('replaces existing pending state by calling clearPendingAuth first', () => {
    setPendingAuthAfterUnlock('first-id', 'ext')
    setPendingAuthAfterUnlock('second-id', 'dapp', 1)
    expect(getPending()?.id).toBe('second-id')
  })

  it('fires sendAuthError after PENDING_AUTH_TIMEOUT_MS elapses', () => {
    vi.useFakeTimers()
    setPendingAuthAfterUnlock('timeout-id', 'ext')
    vi.advanceTimersByTime(PENDING_AUTH_TIMEOUT_MS)
    expect(mockSendAuthError).toHaveBeenCalledWith('timeout-id', {
      message: 'Vault unlock was cancelled or timed out.',
    })
    expect(getPending()).toBeNull()
  })
})

describe('setPendingAuthWindowId', () => {
  it('updates windowId when the pending id matches', () => {
    setPendingAuthAfterUnlock('my-id', 'ext')
    setPendingAuthWindowId('my-id', 42)
    expect(getPending()?.windowId).toBe(42)
  })

  it('ignores the update when there is no pending auth', () => {
    // Should not throw
    setPendingAuthWindowId('ghost-id', 1)
  })

  it('ignores the update when the pending id does not match (stale caller)', () => {
    setPendingAuthAfterUnlock('current-id', 'ext')
    setPendingAuthWindowId('stale-id', 99)
    expect(getPending()?.windowId).toBeUndefined()
  })

  it('ignores a conflicting windowId when one is already set', () => {
    setPendingAuthAfterUnlock('my-id', 'ext')
    setPendingAuthWindowId('my-id', 10)
    setPendingAuthWindowId('my-id', 20)
    expect(getPending()?.windowId).toBe(10)
  })
})

describe('getPendingAndClear', () => {
  it('returns the pending entry and resets state to null', () => {
    setPendingAuthAfterUnlock('clear-me', 'ext')
    const result = getPendingAndClear()
    expect(result?.id).toBe('clear-me')
    expect(getPending()).toBeNull()
  })

  it('returns null when there is no pending auth', () => {
    expect(getPendingAndClear()).toBeNull()
  })
})
