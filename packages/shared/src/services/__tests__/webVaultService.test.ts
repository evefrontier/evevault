import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Use string literals to avoid importing @mysten/wallet-standard
const SUI_DEVNET_CHAIN = 'sui:devnet' as const
const SUI_TESTNET_CHAIN = 'sui:testnet' as const

const mockStore = new Map<string, unknown>()
const mockSetFn = vi.fn((key: string, val: unknown) => {
  mockStore.set(key, val)
  return Promise.resolve()
})
const mockGetFn = vi.fn((key: string) => Promise.resolve(mockStore.get(key)))
const mockDelFn = vi.fn((key: string) => {
  mockStore.delete(key)
  return Promise.resolve()
})

Object.defineProperty(globalThis, 'indexedDB', {
  configurable: true,
  value: {
    open: vi.fn(() => {
      const database = {
        createObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            get: (key: string) => {
              const request = {
                error: null,
                result: undefined as unknown,
                onerror: null as null | (() => void),
                onsuccess: null as null | (() => void),
              }
              void mockGetFn(key).then((value) => {
                request.result = value
                request.onsuccess?.()
              })
              return request
            },
            put: (value: unknown, key: string) => {
              const request = {
                error: null,
                onerror: null as null | (() => void),
                onsuccess: null as null | (() => void),
              }
              void mockSetFn(key, value).then(() => {
                request.onsuccess?.()
              })
              return request
            },
            delete: (key: string) => {
              const request = {
                error: null,
                onerror: null as null | (() => void),
                onsuccess: null as null | (() => void),
              }
              void mockDelFn(key).then(() => {
                request.onsuccess?.()
              })
              return request
            },
          })),
        })),
      }

      const request = {
        error: null,
        result: database,
        onerror: null as null | (() => void),
        onupgradeneeded: null as null | (() => void),
        onsuccess: null as null | (() => void),
      }

      queueMicrotask(() => {
        request.onupgradeneeded?.()
        request.onsuccess?.()
      })

      return request
    }),
  },
})

// Mock @evefrontier/wallet-core/crypto — replace ZKWebCryptoSigner with a
// spy-able class so generate() and the constructor are fully controllable.
// export() returns the same shape that unlock() reads from IndexedDB, so the
// constructor mock intercepts reconstruction without touching real WebCrypto.
vi.mock('@evefrontier/wallet-core/crypto', () => {
  const mockPublicKey = new Uint8Array(33).fill(1)
  const mockSigner = {
    getPublicKey: vi.fn(() => ({
      toRawBytes: () => mockPublicKey,
    })),
    export: vi.fn(() => ({
      privateKey: 'mock-crypto-key' as unknown as CryptoKey,
      publicKey: mockPublicKey,
    })),
    sign: vi.fn(() => Promise.resolve(new Uint8Array(64))),
    signTransaction: vi.fn(() =>
      Promise.resolve({ bytes: 'mockBytes', signature: 'mockSig' }),
    ),
    signPersonalMessage: vi.fn(() =>
      Promise.resolve({ bytes: 'mockBytes', signature: 'mockSig' }),
    ),
    applyZKProof: vi.fn(),
  }
  // Regular function (not arrow) so it can be called with `new`. When a
  // constructor explicitly returns an object, `new` returns that object.
  // Object.assign lets TypeScript infer `generate` as part of the type.
  const MockZKWebCryptoSigner = Object.assign(
    // biome-ignore lint/complexity/useArrowFunction: arrow functions cannot be used as constructors with `new`
    vi.fn(function () {
      return mockSigner
    }),
    { generate: vi.fn(() => Promise.resolve(mockSigner)) },
  )
  return { ZKWebCryptoSigner: MockZKWebCryptoSigner }
})

// Mock logger to avoid console noise
vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Import after mocks are set up
import { ZKWebCryptoSigner } from '@evefrontier/wallet-core/crypto'
import { webVaultService } from '../webVaultService'

describe('WebVaultService', () => {
  beforeEach(() => {
    // Clear the mock store before each test
    mockStore.clear()
    // Reset mockSetFn call history
    mockSetFn.mockClear()
    mockGetFn.mockClear()
    mockDelFn.mockClear()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    // Clean up after each test
    await webVaultService.clear()
  })

  describe('initialize', () => {
    it('initializes only once', async () => {
      // First call should initialize
      await webVaultService.initialize()

      // Second call should be a no-op (idempotent)
      await webVaultService.initialize()

      // No errors thrown means success
      expect(true).toBe(true)
    })
  })

  describe('createEphemeralKeyPair', () => {
    it('creates keypair and stores in IndexedDB', async () => {
      const pin = '123456'
      const publicKey = await webVaultService.createEphemeralKeyPair(pin)

      // Verify ZKWebCryptoSigner.generate was called
      expect(ZKWebCryptoSigner.generate).toHaveBeenCalled()

      // Verify keypair was stored
      expect(mockSetFn).toHaveBeenCalledWith(
        'evevault:web-ephemeral-keypair',
        expect.anything(),
      )

      // Verify public key is returned
      expect(publicKey).toBeDefined()
      expect(publicKey.toRawBytes()).toBeInstanceOf(Uint8Array)
    })

    it('stores an Argon2id PIN verifier for verification', async () => {
      const pin = '123456'
      await webVaultService.createEphemeralKeyPair(pin)

      // Verify PIN verifier was stored
      expect(mockSetFn).toHaveBeenCalledWith(
        'evevault:web-pin-verifier',
        expect.any(String),
      )

      // Verify the stored value is an Argon2id encoded verifier (salt + params
      // embedded).
      const pinVerifierCall = mockSetFn.mock.calls.find(
        (call) => call[0] === 'evevault:web-pin-verifier',
      )
      expect(pinVerifierCall?.[1]).toMatch(/^\$argon2id\$/)
    })

    it('throws if PIN is empty', async () => {
      await expect(webVaultService.createEphemeralKeyPair('')).rejects.toThrow(
        'PIN is required to create keypair',
      )

      await expect(
        webVaultService.createEphemeralKeyPair('   '),
      ).rejects.toThrow('PIN is required to create keypair')
    })

    it('sets unlock expiry after creation', async () => {
      const pin = '123456'
      await webVaultService.createEphemeralKeyPair(pin)

      // After creation, vault should be unlocked
      expect(webVaultService.isUnlocked()).toBe(true)
    })
  })

  describe('unlock', () => {
    const testPin = '123456'

    beforeEach(async () => {
      // Set up a keypair first
      await webVaultService.createEphemeralKeyPair(testPin)
      // Lock it to test unlock
      webVaultService.lock()
    })

    it('verifies PIN verifier and recovers keypair', async () => {
      const result = await webVaultService.unlock(testPin)

      expect(result).toBe(true)
      expect(ZKWebCryptoSigner).toHaveBeenCalledOnce()
      expect(webVaultService.isUnlocked()).toBe(true)
    })

    it('extends expiry if already unlocked', async () => {
      // First unlock
      await webVaultService.unlock(testPin)
      expect(webVaultService.isUnlocked()).toBe(true)

      // Clear the constructor mock to check it's not called again
      vi.mocked(ZKWebCryptoSigner).mockClear()

      // Second unlock should just extend expiry, not reimport
      const result = await webVaultService.unlock(testPin)

      expect(result).toBe(true)
      // Constructor should NOT be called again since we're already unlocked
      expect(ZKWebCryptoSigner).not.toHaveBeenCalled()
    })

    it('throws on invalid PIN', async () => {
      await expect(webVaultService.unlock('wrongpin')).rejects.toThrow(
        'Invalid PIN',
      )
    })

    it('rejects a wrong PIN even when already unlocked', async () => {
      // Regression: unlock(wrongPin) must not succeed (nor extend the session)
      // just because a session is already active.
      await webVaultService.unlock(testPin)
      expect(webVaultService.isUnlocked()).toBe(true)

      await expect(webVaultService.unlock('wrongpin')).rejects.toThrow(
        'Invalid PIN',
      )
    })

    it('returns false if no PIN verifier exists', async () => {
      // Clear the store to simulate no PIN verifier
      mockStore.delete('evevault:web-pin-verifier')

      const result = await webVaultService.unlock(testPin)
      expect(result).toBe(false)
    })

    it('throws if PIN is empty', async () => {
      await expect(webVaultService.unlock('')).rejects.toThrow(
        'PIN is required to unlock',
      )
    })
  })

  describe('lock', () => {
    const testPin = '123456'

    beforeEach(async () => {
      await webVaultService.createEphemeralKeyPair(testPin)
    })

    it('clears signer and expiry from memory', () => {
      expect(webVaultService.isUnlocked()).toBe(true)

      webVaultService.lock()

      expect(webVaultService.isUnlocked()).toBe(false)
      expect(webVaultService.getSigner()).toBeNull()
      expect(webVaultService.getPublicKey()).toBeNull()
    })

    it('isUnlocked returns false after lock', () => {
      webVaultService.lock()
      expect(webVaultService.isUnlocked()).toBe(false)
    })

    it('requires unlock again before rotating after lock', async () => {
      webVaultService.lock()

      await expect(webVaultService.rotateEphemeralKeyPair()).rejects.toThrow(
        'Vault must be unlocked again before rotating keypair',
      )
    })
  })

  describe('rotateEphemeralKeyPair', () => {
    it('creates a fresh keypair while unlocked', async () => {
      await webVaultService.createEphemeralKeyPair('123456')

      const publicKey = await webVaultService.rotateEphemeralKeyPair()

      expect(ZKWebCryptoSigner.generate).toHaveBeenCalledTimes(2)
      expect(publicKey).toBeDefined()
      expect(mockSetFn).toHaveBeenCalledWith(
        'evevault:web-ephemeral-keypair',
        expect.anything(),
      )
    })
  })

  describe('auto-lock on expiry', () => {
    const testPin = '123456'

    it('locks automatically when expiry is reached', async () => {
      // Create with a very short expiry by unlocking with custom duration
      await webVaultService.createEphemeralKeyPair(testPin)
      webVaultService.lock()

      // Unlock with 1ms duration
      await webVaultService.unlock(testPin, 1)

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Should be locked now (isUnlocked checks expiry)
      expect(webVaultService.isUnlocked()).toBe(false)
    })
  })

  describe('hasKeypair', () => {
    it('returns true when keypair exists', async () => {
      await webVaultService.createEphemeralKeyPair('123456')
      webVaultService.lock()

      const hasKey = await webVaultService.hasKeypair()
      expect(hasKey).toBe(true)
    })

    it('returns false when no keypair exists', async () => {
      // Ensure store is empty
      mockStore.clear()

      const hasKey = await webVaultService.hasKeypair()
      expect(hasKey).toBe(false)
    })
  })

  describe('clear', () => {
    it('clears all stored data', async () => {
      await webVaultService.createEphemeralKeyPair('123456')

      await webVaultService.clear()

      expect(webVaultService.isUnlocked()).toBe(false)
      expect(webVaultService.getPublicKey()).toBeNull()

      // Verify IndexedDB items were deleted
      expect(mockStore.has('evevault:web-ephemeral-keypair')).toBe(false)
      expect(mockStore.has('evevault:web-pin-verifier')).toBe(false)
    })
  })

  describe('zkProof storage', () => {
    it('stores and retrieves zkProof by chain', async () => {
      const mockZkProof = {
        data: { addressSeed: '123', proofPoints: {} },
        error: undefined,
      }

      await webVaultService.setZkProof(
        SUI_DEVNET_CHAIN,
        mockZkProof as Parameters<typeof webVaultService.setZkProof>[1],
      )

      const retrieved = await webVaultService.getZkProof(SUI_DEVNET_CHAIN)
      expect(retrieved).toEqual(mockZkProof)
    })

    it('returns null for non-existent chain', async () => {
      const result = await webVaultService.getZkProof(SUI_TESTNET_CHAIN)
      expect(result).toBeNull()
    })

    it('stores zkProofs separately per chain', async () => {
      const devnetProof = { data: { chain: 'devnet' }, error: undefined }
      const testnetProof = { data: { chain: 'testnet' }, error: undefined }

      await webVaultService.setZkProof(
        SUI_DEVNET_CHAIN,
        devnetProof as unknown as Parameters<
          typeof webVaultService.setZkProof
        >[1],
      )
      await webVaultService.setZkProof(
        SUI_TESTNET_CHAIN,
        testnetProof as unknown as Parameters<
          typeof webVaultService.setZkProof
        >[1],
      )

      const retrievedDevnet = await webVaultService.getZkProof(SUI_DEVNET_CHAIN)
      const retrievedTestnet =
        await webVaultService.getZkProof(SUI_TESTNET_CHAIN)

      expect(retrievedDevnet).toEqual(devnetProof)
      expect(retrievedTestnet).toEqual(testnetProof)
    })

    it('clears zkProof for specific chain', async () => {
      const mockZkProof = { data: { test: true }, error: undefined }

      await webVaultService.setZkProof(
        SUI_DEVNET_CHAIN,
        mockZkProof as unknown as Parameters<
          typeof webVaultService.setZkProof
        >[1],
      )
      await webVaultService.clearZkProof(SUI_DEVNET_CHAIN)

      const result = await webVaultService.getZkProof(SUI_DEVNET_CHAIN)
      expect(result).toBeNull()
    })
  })

  describe('signing operations', () => {
    const testPin = '123456'

    beforeEach(async () => {
      await webVaultService.createEphemeralKeyPair(testPin)
    })

    it('signs transaction when unlocked', async () => {
      const txBytes = new Uint8Array([1, 2, 3, 4])
      const result = await webVaultService.signTransaction(txBytes)

      expect(result).toHaveProperty('bytes')
      expect(result).toHaveProperty('signature')
    })

    it('signs personal message when unlocked', async () => {
      const message = new Uint8Array([1, 2, 3, 4])
      const result = await webVaultService.signPersonalMessage(message)

      expect(result).toHaveProperty('bytes')
      expect(result).toHaveProperty('signature')
    })

    it('throws when signing while locked', async () => {
      webVaultService.lock()

      await expect(
        webVaultService.signTransaction(new Uint8Array([1, 2, 3])),
      ).rejects.toThrow('Vault is locked or no keypair exists')

      await expect(
        webVaultService.signPersonalMessage(new Uint8Array([1, 2, 3])),
      ).rejects.toThrow('Vault is locked or no keypair exists')
    })
  })

  describe('getPublicKeyBytes', () => {
    it('returns null when no signer', () => {
      const bytes = webVaultService.getPublicKeyBytes()
      expect(bytes).toBeNull()
    })

    it('returns byte array when signer exists', async () => {
      await webVaultService.createEphemeralKeyPair('123456')
      const bytes = webVaultService.getPublicKeyBytes()

      expect(bytes).toBeInstanceOf(Array)
      expect(bytes?.length).toBe(33)
    })
  })
})
