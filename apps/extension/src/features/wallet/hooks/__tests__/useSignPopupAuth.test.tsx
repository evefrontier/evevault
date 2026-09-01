import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSignPopupAuth } from '../useSignPopupAuth'

const {
  mockUseAuth,
  mockUseDevice,
  mockUseContext,
  mockUseVaultAutoLock,
  mockGetUnlockRemainingMs,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseDevice: vi.fn(),
  mockUseContext: vi.fn(),
  mockUseVaultAutoLock: vi.fn(),
  mockGetUnlockRemainingMs: vi.fn(),
}))

vi.mock('@evevault/shared/auth', () => ({ useAuth: mockUseAuth }))
vi.mock('@evevault/shared/hooks', () => ({
  useDevice: mockUseDevice,
  useContext: mockUseContext,
  useVaultAutoLock: mockUseVaultAutoLock,
}))
vi.mock('@evevault/shared/services/vaultService', () => ({
  ephKeyService: { getUnlockRemainingMs: mockGetUnlockRemainingMs },
}))
vi.mock('@evevault/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evevault/shared/utils')>()
  return {
    ...actual,
    createLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  }
})

function stubDevice(overrides: Record<string, unknown> = {}) {
  const lock = vi.fn(() => Promise.resolve())
  mockUseDevice.mockReturnValue({
    isLocked: false,
    isPinSet: true,
    unlock: vi.fn(),
    lock,
    initializeForChain: vi.fn(() => Promise.resolve()),
    maxEpoch: 100,
    nonce: 'n',
    getZkProof: vi.fn(),
    ephemeralPublicKey: {},
    ...overrides,
  })
  return lock
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    initialize: vi.fn(),
    user: { id_token: 'tok' },
    loading: false,
    login: vi.fn(),
  })
  mockUseContext.mockReturnValue({ chain: 'sui:testnet' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSignPopupAuth', () => {
  it('arms auto-lock for the standalone sign popup', () => {
    stubDevice()
    mockGetUnlockRemainingMs.mockResolvedValue(60_000)
    renderHook(() => useSignPopupAuth())
    expect(mockUseVaultAutoLock).toHaveBeenCalled()
  })

  it('locks the vault when the keeper window has already expired', async () => {
    const lock = stubDevice()
    mockGetUnlockRemainingMs.mockResolvedValue(0)

    const { result } = renderHook(() => useSignPopupAuth())

    await waitFor(() => expect(result.current.lockChecked).toBe(true))
    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('leaves the vault unlocked when the keeper window is still open', async () => {
    const lock = stubDevice()
    mockGetUnlockRemainingMs.mockResolvedValue(30_000)

    const { result } = renderHook(() => useSignPopupAuth())

    await waitFor(() => expect(result.current.lockChecked).toBe(true))
    expect(lock).not.toHaveBeenCalled()
  })

  it('still confirms the check when the keeper query fails', async () => {
    const lock = stubDevice()
    mockGetUnlockRemainingMs.mockRejectedValue(new Error('keeper down'))

    const { result } = renderHook(() => useSignPopupAuth())

    await waitFor(() => expect(result.current.lockChecked).toBe(true))
    expect(lock).not.toHaveBeenCalled()
  })
})
