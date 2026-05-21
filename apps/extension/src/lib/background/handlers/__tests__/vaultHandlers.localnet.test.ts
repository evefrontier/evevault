import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleUnlockVault } from '@/lib/background/handlers/vaultHandlers'
import type { VaultMessage } from '@/lib/background/types'

vi.mock('@/lib/background/handlers/authHandlers', () => ({
  checkPendingAuthAfterUnlock: vi.fn(),
}))

vi.mock('@/lib/background/services/offscreenService', () => ({
  ensureOffscreen: vi.fn().mockResolvedValue(undefined),
}))

const DEVICE_KEY = 'evevault:device'
const HASHED_SECRET_KEY = { iv: 'iv', data: 'data', salt: 'salt' }

const mockSender = {} as chrome.runtime.MessageSender

function makeUnlockMessage(
  overrides: Partial<VaultMessage> = {},
): VaultMessage {
  return {
    type: 'UNLOCK_VAULT',
    hashedSecretKey: HASHED_SECRET_KEY,
    pin: '123456',
    ...overrides,
  } as unknown as VaultMessage
}

function stubKeeperBridge(
  localnetValue: unknown,
  keeperResponse: unknown = { ok: true },
) {
  const deviceValue =
    localnetValue !== undefined
      ? JSON.stringify({
          state: {
            localnet: {
              encryptedKey:
                typeof localnetValue === 'object'
                  ? JSON.stringify(localnetValue)
                  : localnetValue,
              address: null,
            },
          },
          version: 0,
        })
      : undefined
  globalThis.chrome = {
    storage: {
      local: {
        get: vi
          .fn()
          .mockResolvedValue(
            deviceValue !== undefined ? { [DEVICE_KEY]: deviceValue } : {},
          ),
        remove: vi.fn(),
        set: vi.fn(),
      },
    },
    runtime: {
      sendMessage: vi.fn((_msg, callback) => {
        callback(keeperResponse)
      }),
      lastError: undefined,
    },
  } as unknown as typeof chrome
}

function captureKeeperMessage(): Record<string, unknown> | undefined {
  const calls = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mock
    .calls
  return calls[0]?.[0] as Record<string, unknown> | undefined
}

describe('handleUnlockVault — localnet key forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes encrypted blob to keeper when storage contains a valid HashedData object', async () => {
    const encryptedBlob = { iv: 'aaa', data: 'bbb', salt: 'ccc' }
    stubKeeperBridge(encryptedBlob)
    const sendResponse = vi.fn()

    await handleUnlockVault(makeUnlockMessage(), mockSender, sendResponse)

    const msg = captureKeeperMessage()
    expect(msg?.encryptedLocalnetKey).toEqual(encryptedBlob)
    expect(sendResponse).toHaveBeenCalledWith({ ok: true })
  })

  it('passes null to keeper when storage is empty', async () => {
    stubKeeperBridge(undefined)
    const sendResponse = vi.fn()

    await handleUnlockVault(makeUnlockMessage(), mockSender, sendResponse)

    const msg = captureKeeperMessage()
    expect(msg?.encryptedLocalnetKey).toBeNull()
  })

  it("passes null when stored value is an object without a 'data' field", async () => {
    stubKeeperBridge({ something: 'else' })
    const sendResponse = vi.fn()

    await handleUnlockVault(makeUnlockMessage(), mockSender, sendResponse)

    const msg = captureKeeperMessage()
    expect(msg?.encryptedLocalnetKey).toBeNull()
  })

  it('returns error response when keeper reports failure', async () => {
    stubKeeperBridge(undefined, { ok: false, error: 'Bad PIN' })
    const sendResponse = vi.fn()

    await handleUnlockVault(makeUnlockMessage(), mockSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'Bad PIN' })
  })

  it('returns error when hashedSecretKey is missing', async () => {
    stubKeeperBridge(undefined)
    const sendResponse = vi.fn()

    await handleUnlockVault(
      makeUnlockMessage({ hashedSecretKey: undefined }),
      mockSender,
      sendResponse,
    )

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false }),
    )
  })
})
