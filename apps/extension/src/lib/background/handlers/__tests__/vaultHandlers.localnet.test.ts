import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Browser } from 'wxt/browser'
import { handleUnlockVault } from '@/lib/background/handlers/vaultHandlers'
import type { VaultMessage } from '@/lib/background/types'
import { captureKeeperMessage } from './vaultHandlers.test-utils'

vi.mock('@/lib/background/handlers/authHandlers', () => ({
  checkPendingAuthAfterUnlock: vi.fn(),
}))

const DEVICE_KEY = 'evevault:device'
const HASHED_SECRET_KEY = { iv: 'iv', data: 'data', salt: 'salt' }

const mockSender = {} as Browser.runtime.MessageSender

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
  vi.stubGlobal('browser', {
    // A present offscreen document lets KeeperHost.ensureReady skip creation.
    offscreen: {
      hasDocument: vi.fn().mockResolvedValue(true),
    },
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
      sendMessage: vi.fn(async () => keeperResponse),
      lastError: undefined,
    },
  } as unknown as typeof browser)
}

describe('handleUnlockVault — localnet key forwarding', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
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

    expect(browser.runtime.sendMessage).not.toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false }),
    )
  })
})
