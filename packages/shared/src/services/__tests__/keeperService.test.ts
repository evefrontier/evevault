import { afterEach, describe, expect, it, vi } from 'vitest'
import { ephKeyService } from '#/services/keeperService'
import { VaultMessageTypes } from '#/types/messages'

// Mock chrome.runtime.sendMessage
const mockSendMessage = vi.fn()
;(global as unknown as { chrome: unknown }).chrome = {
  runtime: {
    sendMessage: mockSendMessage,
  },
  // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
} as any

describe('ephKeyService.lock()', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends LOCK message to keeper and succeeds when response is ok', async () => {
    mockSendMessage.mockResolvedValueOnce({ ok: true })

    await ephKeyService.lock()

    expect(mockSendMessage).toHaveBeenCalledOnce()
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: VaultMessageTypes.LOCK,
    })
  })

  it('throws error when keeper response is not ok', async () => {
    const errorMessage = 'Keeper lock failed'
    mockSendMessage.mockResolvedValueOnce({
      ok: false,
      error: errorMessage,
    })

    await expect(ephKeyService.lock()).rejects.toThrow(errorMessage)

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: VaultMessageTypes.LOCK,
    })
  })

  it('throws error when keeper response is undefined', async () => {
    mockSendMessage.mockResolvedValueOnce(undefined)

    await expect(ephKeyService.lock()).rejects.toThrow('Failed to lock vault')

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: VaultMessageTypes.LOCK,
    })
  })

  it('throws error when keeper response has no error message', async () => {
    mockSendMessage.mockResolvedValueOnce({ ok: false })

    await expect(ephKeyService.lock()).rejects.toThrow('Failed to lock vault')
  })
})

describe('ephKeyService.rotateEphemeralKeyPair()', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends ROTATE_KEYPAIR message and returns refreshed key', async () => {
    mockSendMessage.mockResolvedValueOnce({
      ok: true,
      hashedSecretKey: { iv: 'iv', data: 'data', salt: 'salt' },
      publicKeyBytes: new Uint8Array(32).fill(7),
    })

    const result = await ephKeyService.rotateEphemeralKeyPair()

    expect(mockSendMessage).toHaveBeenCalledOnce()
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: VaultMessageTypes.ROTATE_KEYPAIR,
    })
    expect(result.hashedSecretKey).toEqual({
      iv: 'iv',
      data: 'data',
      salt: 'salt',
    })
    expect(result.publicKey).toBeDefined()
  })
})

describe('ephKeyService.getUnlockRemainingMs()', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns remainingMs from an ok response', async () => {
    mockSendMessage.mockResolvedValueOnce({ ok: true, remainingMs: 42_000 })

    await expect(ephKeyService.getUnlockRemainingMs()).resolves.toBe(42_000)
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: VaultMessageTypes.GET_UNLOCK_REMAINING,
    })
  })

  it('returns 0 when ok but remainingMs is missing', async () => {
    mockSendMessage.mockResolvedValueOnce({ ok: true })

    await expect(ephKeyService.getUnlockRemainingMs()).resolves.toBe(0)
  })

  it('returns 0 when the response is not ok', async () => {
    mockSendMessage.mockResolvedValueOnce({ ok: false })

    await expect(ephKeyService.getUnlockRemainingMs()).resolves.toBe(0)
  })

  it('returns 0 when the keeper response is undefined', async () => {
    mockSendMessage.mockResolvedValueOnce(undefined)

    await expect(ephKeyService.getUnlockRemainingMs()).resolves.toBe(0)
  })
})
