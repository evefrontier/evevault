import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addPendingDappId,
  clearPendingAuth,
  getPending,
  getPendingAndClear,
  PENDING_AUTH_TIMEOUT_MS,
  type PendingDappAuth,
  sendPendingAuthError,
  setPendingAuthAfterUnlock,
  setPendingAuthWindowId,
  takePendingAttempt,
  takePendingDapp,
} from '../pendingAuth'

function getPendingDapp(): PendingDappAuth | undefined {
  const pending = getPending()
  return pending?.type === 'dapp' ? pending : undefined
}

const dappContext = { origin: 'https://dapp.example' }
const otherContext = { origin: 'https://other.example' }
const doc = (tabId: number, documentId = 'doc-1') => ({ tabId, documentId })

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
    setPendingAuthAfterUnlock({ id: 'id-1', type: 'ext' })
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
    sendPendingAuthError({
      id: 'dapp-id',
      type: 'dapp',
      target: { tabId: 7, documentId: 'doc-1' },
      dappContext,
      additionalIds: [],
    })
    expect(mockSendToTab).toHaveBeenCalledWith(doc(7), {
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
      target: { tabId: 3, documentId: 'doc-1' },
      dappContext,
      additionalIds: ['extra-1', 'extra-2'],
    })
    expect(mockSendToTab).toHaveBeenCalledTimes(3)
    expect(mockSendToTab).toHaveBeenCalledWith(doc(3), {
      id: 'primary-id',
      type: 'auth_error',
      error: { message: 'Vault unlock was cancelled or timed out.' },
    })
    expect(mockSendToTab).toHaveBeenCalledWith(doc(3), {
      id: 'extra-1',
      type: 'auth_error',
      error: { message: 'Vault unlock was cancelled or timed out.' },
    })
    expect(mockSendToTab).toHaveBeenCalledWith(doc(3), {
      id: 'extra-2',
      type: 'auth_error',
      error: { message: 'Vault unlock was cancelled or timed out.' },
    })
  })
})

describe('addPendingDappId', () => {
  it('returns false when there is no pending auth', () => {
    expect(addPendingDappId(doc(1), 'id', dappContext)).toBe(false)
  })

  it('returns false when pending type is ext', () => {
    setPendingAuthAfterUnlock({ id: 'ext-id', type: 'ext' })
    expect(addPendingDappId(doc(1), 'new-id', dappContext)).toBe(false)
  })

  it('returns false when pending tabId does not match', () => {
    setPendingAuthAfterUnlock({
      id: 'dapp-id',
      type: 'dapp',
      target: { tabId: 5, documentId: 'doc-1' },
      dappContext,
    })
    expect(addPendingDappId(doc(99), 'new-id', dappContext)).toBe(false)
  })

  it('retargets the pending to the new request when the tab document changed', () => {
    setPendingAuthAfterUnlock({
      id: 'dapp-id',
      type: 'dapp',
      target: { tabId: 5, documentId: 'doc-1' },
      dappContext,
      windowId: 77,
    })
    addPendingDappId(doc(5), 'extra-id', dappContext)

    expect(addPendingDappId(doc(5, 'doc-2'), 'new-id', otherContext)).toBe(true)
    expect(getPending()).toEqual({
      id: 'new-id',
      type: 'dapp',
      target: doc(5, 'doc-2'),
      windowId: 77,
      dappContext: otherContext,
      additionalIds: [],
    })
  })

  it('sends auth_error to the replaced ids at their own document', () => {
    setPendingAuthAfterUnlock({
      id: 'dapp-id',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })
    addPendingDappId(doc(5), 'extra-id', dappContext)

    addPendingDappId(doc(5, 'doc-2'), 'new-id', otherContext)

    const error = { message: 'Replaced by a newer sign-in request.' }
    expect(mockSendToTab).toHaveBeenCalledTimes(2)
    expect(mockSendToTab).toHaveBeenCalledWith(doc(5), {
      id: 'dapp-id',
      type: 'auth_error',
      error,
    })
    expect(mockSendToTab).toHaveBeenCalledWith(doc(5), {
      id: 'extra-id',
      type: 'auth_error',
      error,
    })
  })

  it('restarts the timeout for the retargeted request', () => {
    vi.useFakeTimers()
    setPendingAuthAfterUnlock({
      id: 'dapp-id',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })
    vi.advanceTimersByTime(PENDING_AUTH_TIMEOUT_MS - 1000)

    addPendingDappId(doc(5, 'doc-2'), 'new-id', otherContext)
    mockSendToTab.mockClear()
    vi.advanceTimersByTime(1000)
    expect(getPending()?.id).toBe('new-id')
    expect(mockSendToTab).not.toHaveBeenCalled()

    vi.advanceTimersByTime(PENDING_AUTH_TIMEOUT_MS)
    expect(getPending()).toBeNull()
    expect(mockSendToTab).toHaveBeenCalledWith(doc(5, 'doc-2'), {
      id: 'new-id',
      type: 'auth_error',
      error: { message: 'Vault unlock was cancelled or timed out.' },
    })
  })

  it('retargets on a new document from the same origin (page reload)', () => {
    setPendingAuthAfterUnlock({
      id: 'dapp-id',
      type: 'dapp',
      target: { tabId: 5, documentId: 'doc-1' },
      dappContext,
    })

    expect(addPendingDappId(doc(5, 'doc-2'), 'new-id', dappContext)).toBe(true)
    expect(getPending()).toMatchObject({
      id: 'new-id',
      target: doc(5, 'doc-2'),
    })
  })

  it('appends id and returns true for matching dapp pending', () => {
    setPendingAuthAfterUnlock({
      id: 'dapp-id',
      type: 'dapp',
      target: { tabId: 5, documentId: 'doc-1' },
      dappContext,
    })
    const result = addPendingDappId(doc(5), 'new-id', dappContext)
    expect(result).toBe(true)
    expect(getPendingDapp()?.additionalIds).toContain('new-id')
  })

  it('returns true without duplicate when id is already tracked', () => {
    setPendingAuthAfterUnlock({
      id: 'dapp-id',
      type: 'dapp',
      target: { tabId: 5, documentId: 'doc-1' },
      dappContext,
    })
    addPendingDappId(doc(5), 'new-id', dappContext)
    const result = addPendingDappId(doc(5), 'new-id', dappContext)
    expect(result).toBe(true)
    expect(
      getPendingDapp()?.additionalIds?.filter((x) => x === 'new-id'),
    ).toHaveLength(1)
  })
})

describe('setPendingAuthAfterUnlock', () => {
  it('sets dapp pending state with provided fields', () => {
    setPendingAuthAfterUnlock({
      id: 'my-id',
      type: 'dapp',
      target: { tabId: 10, documentId: 'doc-1' },
      dappContext,
      windowId: 99,
    })
    expect(getPending()).toEqual({
      id: 'my-id',
      type: 'dapp',
      target: { tabId: 10, documentId: 'doc-1' },
      dappContext,
      windowId: 99,
      additionalIds: [],
    })
  })

  it('sets ext pending state with provided fields', () => {
    setPendingAuthAfterUnlock({
      id: 'my-id',
      type: 'ext',
      windowId: 99,
      tenantId: 'tenant-abc',
    })
    expect(getPending()).toEqual({
      id: 'my-id',
      type: 'ext',
      windowId: 99,
      tenantId: 'tenant-abc',
    })
  })

  it('replaces existing pending state by calling clearPendingAuth first', () => {
    setPendingAuthAfterUnlock({ id: 'first-id', type: 'ext' })
    setPendingAuthAfterUnlock({
      id: 'second-id',
      type: 'dapp',
      target: { tabId: 1, documentId: 'doc-1' },
      dappContext,
    })
    expect(getPending()?.id).toBe('second-id')
  })

  it('sends auth_error to the requests of the entry it replaces', () => {
    setPendingAuthAfterUnlock({
      id: 'first-id',
      type: 'dapp',
      target: doc(1),
      dappContext,
    })
    addPendingDappId(doc(1), 'first-extra', dappContext)

    setPendingAuthAfterUnlock({
      id: 'second-id',
      type: 'dapp',
      target: doc(2, 'doc-2'),
      dappContext,
    })

    const error = { message: 'Replaced by a newer sign-in request.' }
    expect(mockSendToTab).toHaveBeenCalledTimes(2)
    expect(mockSendToTab).toHaveBeenCalledWith(doc(1), {
      id: 'first-id',
      type: 'auth_error',
      error,
    })
    expect(mockSendToTab).toHaveBeenCalledWith(doc(1), {
      id: 'first-extra',
      type: 'auth_error',
      error,
    })
  })

  it('sends auth_error to a replaced ext login', () => {
    setPendingAuthAfterUnlock({ id: 'ext-id', type: 'ext' })
    setPendingAuthAfterUnlock({ id: 'ext-id-2', type: 'ext' })
    expect(mockSendAuthError).toHaveBeenCalledWith('ext-id', {
      message: 'Replaced by a newer sign-in request.',
    })
  })

  it('fires sendAuthError after PENDING_AUTH_TIMEOUT_MS elapses', () => {
    vi.useFakeTimers()
    setPendingAuthAfterUnlock({ id: 'timeout-id', type: 'ext' })
    vi.advanceTimersByTime(PENDING_AUTH_TIMEOUT_MS)
    expect(mockSendAuthError).toHaveBeenCalledWith('timeout-id', {
      message: 'Vault unlock was cancelled or timed out.',
    })
    expect(getPending()).toBeNull()
  })
})

describe('setPendingAuthWindowId', () => {
  it('updates windowId when the attempt matches', () => {
    const attempt = setPendingAuthAfterUnlock({
      id: 'my-id',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })
    setPendingAuthWindowId(attempt, 42)
    expect(getPending()?.windowId).toBe(42)
  })

  it('updates windowId after the pending was retargeted to a new document', () => {
    const attempt = setPendingAuthAfterUnlock({
      id: 'first-id',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })
    addPendingDappId(doc(5, 'doc-2'), 'second-id', otherContext)
    setPendingAuthWindowId(attempt, 42)
    expect(getPending()).toMatchObject({ id: 'second-id', windowId: 42 })
  })

  it('ignores the update when there is no pending auth', () => {
    expect(() => setPendingAuthWindowId(1, 1)).not.toThrow()
    expect(getPending()).toBeNull()
  })

  it('ignores a late window from an attempt that was replaced (A1 → B → A2)', () => {
    const a1 = setPendingAuthAfterUnlock({
      id: 'a1',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })
    setPendingAuthAfterUnlock({
      id: 'b',
      type: 'dapp',
      target: doc(6, 'doc-b'),
      dappContext: otherContext,
    })
    const a2 = setPendingAuthAfterUnlock({
      id: 'a2',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })

    setPendingAuthWindowId(a1, 10)
    expect(getPending()?.id).toBe('a2')
    expect(getPending()?.windowId).toBeUndefined()

    setPendingAuthWindowId(a2, 30)
    expect(getPending()).toMatchObject({ id: 'a2', windowId: 30 })
  })

  it('ignores a conflicting windowId when one is already set', () => {
    const attempt = setPendingAuthAfterUnlock({
      id: 'my-id',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })
    setPendingAuthWindowId(attempt, 10)
    setPendingAuthWindowId(attempt, 20)
    expect(getPending()?.windowId).toBe(10)
  })
})

describe('takePendingAttempt', () => {
  it('returns and clears the pending entry of the attempt', () => {
    const attempt = setPendingAuthAfterUnlock({
      id: 'my-id',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })
    addPendingDappId(doc(5), 'extra-id', dappContext)
    expect(takePendingAttempt(attempt)).toMatchObject({
      id: 'my-id',
      additionalIds: ['extra-id'],
    })
    expect(getPending()).toBeNull()
  })

  it('leaves a newer attempt for the same tab in place (A1 → B → A2)', () => {
    const a1 = setPendingAuthAfterUnlock({
      id: 'a1',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })
    setPendingAuthAfterUnlock({
      id: 'b',
      type: 'dapp',
      target: doc(6, 'doc-b'),
      dappContext: otherContext,
    })
    setPendingAuthAfterUnlock({
      id: 'a2',
      type: 'dapp',
      target: doc(5),
      dappContext,
    })

    expect(takePendingAttempt(a1)).toBeNull()
    expect(getPending()?.id).toBe('a2')
  })

  it('returns null once the entry was cleared', () => {
    const attempt = setPendingAuthAfterUnlock({ id: 'ext-id', type: 'ext' })
    clearPendingAuth()
    expect(takePendingAttempt(attempt)).toBeNull()
  })
})

describe('takePendingDapp', () => {
  it('returns and clears the dapp pending for the tab', () => {
    setPendingAuthAfterUnlock({
      id: 'my-id',
      type: 'dapp',
      target: { tabId: 5, documentId: 'doc-1' },
      dappContext,
    })
    addPendingDappId(doc(5), 'extra-id', dappContext)
    expect(takePendingDapp(5)).toMatchObject({
      id: 'my-id',
      additionalIds: ['extra-id'],
    })
    expect(getPending()).toBeNull()
  })

  it('leaves a pending for another tab in place', () => {
    setPendingAuthAfterUnlock({
      id: 'my-id',
      type: 'dapp',
      target: { tabId: 6, documentId: 'doc-1' },
      dappContext,
    })
    expect(takePendingDapp(5)).toBeNull()
    expect(getPending()?.id).toBe('my-id')
  })

  it('leaves an ext pending in place', () => {
    setPendingAuthAfterUnlock({ id: 'ext-id', type: 'ext' })
    expect(takePendingDapp(5)).toBeNull()
    expect(getPending()?.id).toBe('ext-id')
  })
})

describe('getPendingAndClear', () => {
  it('returns the pending entry and resets state to null', () => {
    setPendingAuthAfterUnlock({ id: 'clear-me', type: 'ext' })
    const result = getPendingAndClear()
    expect(result?.id).toBe('clear-me')
    expect(getPending()).toBeNull()
  })

  it('returns null when there is no pending auth', () => {
    expect(getPendingAndClear()).toBeNull()
  })
})
