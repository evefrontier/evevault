import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _handleClearZkProof,
  _handleCreateKeypair,
  _handleGetPublicKey,
  _handleGetZkProof,
  _handleRotateKeypair,
  _handleSetZkProof,
  _handleZkEphSignBytes,
  handleLock,
} from '@/lib/background/handlers/vaultHandlers'
import type { VaultMessage } from '@/lib/background/types'

vi.mock('@/lib/background/handlers/authHandlers', () => ({
  checkPendingAuthAfterUnlock: vi.fn(),
}))

vi.mock('@/lib/background/services/offscreenService', () => ({
  ensureOffscreen: vi.fn().mockResolvedValue(undefined),
}))

const mockSender = {} as chrome.runtime.MessageSender

function makeMessage(overrides: Partial<VaultMessage> = {}): VaultMessage {
  return { type: 'VAULT_MSG', ...overrides } as unknown as VaultMessage
}

function stubKeeperBridge(keeperResponse: unknown = { ok: true }) {
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
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

describe('handleLock', () => {
  beforeEach(() => stubKeeperBridge())
  afterEach(() => vi.clearAllMocks())

  it('sends CLEAR_EPHKEY to keeper and returns ok', async () => {
    const sendResponse = vi.fn()
    await handleLock(makeMessage(), mockSender, sendResponse)

    expect(captureKeeperMessage()?.type).toBe('KEEPER_CLEAR_EPHKEY')
    expect(sendResponse).toHaveBeenCalledWith({ ok: true })
  })

  it('returns error when keeper reports failure', async () => {
    stubKeeperBridge({ ok: false, error: 'Keeper unavailable' })
    const sendResponse = vi.fn()

    await handleLock(makeMessage(), mockSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'Keeper unavailable',
    })
  })

  it('returns fallback error message when keeper fails with no message', async () => {
    stubKeeperBridge({ ok: false })
    const sendResponse = vi.fn()

    await handleLock(makeMessage(), mockSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'Failed to lock vault',
    })
  })

  it('returns true (async channel indicator)', async () => {
    const result = await handleLock(makeMessage(), mockSender, vi.fn())
    expect(result).toBe(true)
  })
})

describe('_handleCreateKeypair', () => {
  const HASHED_KEY = { iv: 'i', data: 'd', salt: 's' }
  const PUBLIC_KEY_BYTES = [1, 2, 3]

  afterEach(() => vi.clearAllMocks())

  it('forwards pin to keeper and returns hashedSecretKey and publicKeyBytes', async () => {
    stubKeeperBridge({
      ok: true,
      hashedSecretKey: HASHED_KEY,
      publicKeyBytes: PUBLIC_KEY_BYTES,
    })
    const sendResponse = vi.fn()

    _handleCreateKeypair(
      makeMessage({ pin: '123456' }),
      mockSender,
      sendResponse,
    )
    await new Promise((r) => setTimeout(r, 0))

    const msg = captureKeeperMessage()
    expect(msg?.type).toBe('KEEPER_CREATE_KEYPAIR')
    expect(msg?.pin).toBe('123456')
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      hashedSecretKey: HASHED_KEY,
      publicKeyBytes: PUBLIC_KEY_BYTES,
    })
  })

  it('returns error when keeper reports failure', async () => {
    stubKeeperBridge({ ok: false, error: 'Keypair creation failed' })
    const sendResponse = vi.fn()

    _handleCreateKeypair(
      makeMessage({ pin: '123456' }),
      mockSender,
      sendResponse,
    )
    await new Promise((r) => setTimeout(r, 0))

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'Keypair creation failed',
    })
  })

  it('returns fallback error when keeper fails with no message', async () => {
    stubKeeperBridge({ ok: false })
    const sendResponse = vi.fn()

    _handleCreateKeypair(makeMessage(), mockSender, sendResponse)
    await new Promise((r) => setTimeout(r, 0))

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'Failed to set key in keeper',
    })
  })

  it('returns true synchronously (keeps channel open)', () => {
    stubKeeperBridge({ ok: true })
    const result = _handleCreateKeypair(makeMessage(), mockSender, vi.fn())
    expect(result).toBe(true)
  })
})

describe('_handleRotateKeypair', () => {
  const HASHED_KEY = { iv: 'i', data: 'd', salt: 's' }
  const PUBLIC_KEY_BYTES = [4, 5, 6]

  afterEach(() => vi.clearAllMocks())

  it('sends ROTATE_KEYPAIR to keeper and returns new key material', async () => {
    stubKeeperBridge({
      ok: true,
      hashedSecretKey: HASHED_KEY,
      publicKeyBytes: PUBLIC_KEY_BYTES,
    })
    const sendResponse = vi.fn()

    _handleRotateKeypair(makeMessage(), mockSender, sendResponse)
    await new Promise((r) => setTimeout(r, 0))

    expect(captureKeeperMessage()?.type).toBe('KEEPER_ROTATE_KEYPAIR')
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      hashedSecretKey: HASHED_KEY,
      publicKeyBytes: PUBLIC_KEY_BYTES,
    })
  })

  it('returns error when vault is locked (keeper rejects rotation)', async () => {
    stubKeeperBridge({
      ok: false,
      error: 'Keeper: rotation denied',
    })
    const sendResponse = vi.fn()

    _handleRotateKeypair(makeMessage(), mockSender, sendResponse)
    await new Promise((r) => setTimeout(r, 0))

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'Keeper: rotation denied',
    })
  })

  it('returns fallback error when keeper fails with no message', async () => {
    stubKeeperBridge({ ok: false })
    const sendResponse = vi.fn()

    _handleRotateKeypair(makeMessage(), mockSender, sendResponse)
    await new Promise((r) => setTimeout(r, 0))

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'Vault must be unlocked again before rotating keypair',
    })
  })
})

describe('_handleGetPublicKey', () => {
  const PUBLIC_KEY_BYTES = [7, 8, 9]

  afterEach(() => vi.clearAllMocks())

  it('returns publicKeyBytes when keeper is unlocked', async () => {
    stubKeeperBridge({ ok: true, publicKeyBytes: PUBLIC_KEY_BYTES })
    const sendResponse = vi.fn()

    await _handleGetPublicKey(makeMessage(), mockSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      publicKeyBytes: PUBLIC_KEY_BYTES,
    })
  })

  it('returns LOCKED error when keeper has no key', async () => {
    stubKeeperBridge({ error: 'LOCKED' })
    const sendResponse = vi.fn()

    await _handleGetPublicKey(makeMessage(), mockSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({ error: 'LOCKED' })
  })

  it('returns fallback error when keeper ok but no publicKeyBytes', async () => {
    stubKeeperBridge({ ok: true })
    const sendResponse = vi.fn()

    await _handleGetPublicKey(makeMessage(), mockSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({
      error: 'EVE Vault is LOCKED',
    })
  })
})

describe('_handleZkEphSignBytes', () => {
  afterEach(() => vi.clearAllMocks())

  it('forwards msgBytes as array and returns bytes and userSignature', async () => {
    stubKeeperBridge({
      ok: true,
      bytes: 'b64bytes',
      userSignature: 'b64sig',
    })
    const sendResponse = vi.fn()

    await _handleZkEphSignBytes(
      makeMessage({
        msgBytes: [1, 2, 3],
        scope: 'TransactionData',
        sui_address: '0xabc',
      }),
      mockSender,
      sendResponse,
    )

    const msg = captureKeeperMessage()
    expect(msg?.msgBytes).toEqual([1, 2, 3])
    expect(msg?.scope).toBe('TransactionData')
    expect(msg?.sui_address).toBe('0xabc')
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      bytes: 'b64bytes',
      userSignature: 'b64sig',
    })
  })

  it('converts Uint8Array msgBytes to plain array', async () => {
    stubKeeperBridge({ ok: true, bytes: 'b', userSignature: 's' })

    await _handleZkEphSignBytes(
      makeMessage({
        msgBytes: new Uint8Array([10, 20, 30]) as unknown as number[],
        scope: 'TransactionData',
        sui_address: '0xabc',
      }),
      mockSender,
      vi.fn(),
    )

    expect(captureKeeperMessage()?.msgBytes).toEqual([10, 20, 30])
  })

  it('returns error when keeper signing fails', async () => {
    stubKeeperBridge({ ok: false, error: 'Vault locked' })
    const sendResponse = vi.fn()

    await _handleZkEphSignBytes(
      makeMessage({
        msgBytes: [1],
        scope: 'TransactionData',
        sui_address: '0x1',
      }),
      mockSender,
      sendResponse,
    )

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'Vault locked',
    })
  })
})

describe('_handleSetZkProof / _handleGetZkProof / _handleClearZkProof', () => {
  const zkProof = { data: { proofPoints: {} } }

  afterEach(() => vi.clearAllMocks())

  it('_handleSetZkProof forwards chain and zkProof to keeper', async () => {
    stubKeeperBridge({ ok: true })
    const sendResponse = vi.fn()

    await _handleSetZkProof(
      makeMessage({ chain: 'sui:testnet', zkProof }),
      mockSender,
      sendResponse,
    )

    const msg = captureKeeperMessage()
    expect(msg?.chain).toBe('sui:testnet')
    expect(msg?.zkProof).toEqual(zkProof)
    expect(sendResponse).toHaveBeenCalledWith({ ok: true })
  })

  it('_handleSetZkProof returns error when keeper rejects', async () => {
    stubKeeperBridge({ ok: false, error: 'No ephemeral key' })
    const sendResponse = vi.fn()

    await _handleSetZkProof(
      makeMessage({ chain: 'sui:testnet' }),
      mockSender,
      sendResponse,
    )

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'No ephemeral key',
    })
  })

  it('_handleGetZkProof returns zkProof from keeper', async () => {
    stubKeeperBridge({ ok: true, zkProof })
    const sendResponse = vi.fn()

    await _handleGetZkProof(
      makeMessage({ chain: 'sui:testnet' }),
      mockSender,
      sendResponse,
    )

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, zkProof })
  })

  it('_handleGetZkProof returns null zkProof when keeper is locked', async () => {
    stubKeeperBridge({ ok: false, error: 'LOCKED' })
    const sendResponse = vi.fn()

    await _handleGetZkProof(
      makeMessage({ chain: 'sui:testnet' }),
      mockSender,
      sendResponse,
    )

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'LOCKED',
      zkProof: null,
    })
  })

  it('_handleClearZkProof returns ok when keeper clears successfully', async () => {
    stubKeeperBridge({ ok: true })
    const sendResponse = vi.fn()

    await _handleClearZkProof(makeMessage(), mockSender, sendResponse)

    expect(captureKeeperMessage()?.type).toBe('KEEPER_CLEAR_ZKPROOF')
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, zkProof: undefined })
  })

  it('_handleClearZkProof returns error when keeper fails', async () => {
    stubKeeperBridge({ ok: false, error: 'Clear failed' })
    const sendResponse = vi.fn()

    await _handleClearZkProof(makeMessage(), mockSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'Clear failed',
      zkProof: null,
    })
  })
})
