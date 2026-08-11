import type { User } from 'oidc-client-ts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#/stores/deviceStore', () => ({
  useDeviceStore: {
    getState: vi.fn(),
  },
}))

vi.mock('#/stores/contextStore', () => ({
  useContextStore: {
    getState: vi.fn(),
  },
}))

vi.mock('#/utils/environment', () => ({
  isWeb: vi.fn(() => true),
  isExtension: vi.fn(() => false),
}))

vi.mock('#/services/vaultService', () => ({
  ephKeyService: {
    getSigner: vi.fn(),
  },
}))

const { mockApplyZKProof, mockSignTransaction, mockSignPersonalMessage } =
  vi.hoisted(() => ({
    mockApplyZKProof: vi.fn(),
    mockSignTransaction: vi.fn(),
    mockSignPersonalMessage: vi.fn(),
  }))

vi.mock('@evefrontier/wallet-core/crypto', async (importActual) =>
  importActual(),
)

import { ephKeyService } from '#/services/vaultService'
import { useContextStore } from '#/stores/contextStore'
import { useDeviceStore } from '#/stores/deviceStore'
import type { DeviceState } from '#/types'
import { isWeb } from '#/utils/environment'
import { zkSignAny } from '#/wallet/zkSignAny'

const validProofData = {
  proofPoints: {
    a: ['1', '2', '3'],
    b: [
      ['1', '2'],
      ['3', '4'],
      ['5', '6'],
    ],
    c: ['1', '2', '3'],
  },
  issBase64Details: { value: 'test-issuer', indexMod4: 1 },
  headerBase64: 'test-header-base64',
}

const minimalUser = {
  profile: {
    sui_address: '0xabc',
    salt: 'user-salt',
    sub: 'user-sub',
    aud: 'user-aud',
  },
} as unknown as User

const makeDeviceState = (
  overrides?: Partial<Pick<DeviceState, 'ephemeralPublicKey' | 'getMaxEpoch'>>,
) =>
  ({
    ephemeralPublicKey: { toRawBytes: () => new Uint8Array([1]) },
    getMaxEpoch: () => '5',
    ...overrides,
  }) as unknown as DeviceState

/** Guards that fire before the isWeb() branch — verified in both path contexts. */
const earlyGuardTests = () => {
  it('throws when user is null', async () => {
    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: null as never,
        getZkProof: vi.fn(),
      }),
    ).rejects.toThrow('User not found')
  })

  it('throws when user is undefined at runtime', async () => {
    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: undefined,
        getZkProof: vi.fn(),
      } as never),
    ).rejects.toThrow('User not found')
  })

  it('throws when ephemeralPublicKey is null', async () => {
    vi.mocked(useDeviceStore.getState).mockReturnValue(
      makeDeviceState({ ephemeralPublicKey: null }),
    )

    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn(),
      }),
    ).rejects.toThrow('Ephemeral key pair not found')
  })

  it('throws when getZkProof returns null', async () => {
    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue(null),
      }),
    ).rejects.toThrow('Failed to get ZK proof')
  })

  it('throws when getZkProof rejects', async () => {
    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockRejectedValue(new Error('network error')),
      }),
    ).rejects.toThrow('network error')
  })

  it('throws with string error message from getZkProof', async () => {
    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi
          .fn()
          .mockResolvedValue({ error: 'proof generation failed' }),
      }),
    ).rejects.toThrow('proof generation failed')
  })

  it('throws with error object message from getZkProof', async () => {
    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi
          .fn()
          .mockResolvedValue({ error: { message: 'upstream failure' } }),
      }),
    ).rejects.toThrow('upstream failure')
  })

  it('throws when maxEpoch is null', async () => {
    vi.mocked(useDeviceStore.getState).mockReturnValue(
      makeDeviceState({ getMaxEpoch: () => null }),
    )

    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      }),
    ).rejects.toThrow('Max epoch is not set')
  })

  it('throws when maxEpoch is an empty string', async () => {
    vi.mocked(useDeviceStore.getState).mockReturnValue(
      makeDeviceState({ getMaxEpoch: () => '' }),
    )

    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      }),
    ).rejects.toThrow('Max epoch is not set')
  })
}

/** Guards that fire after signing but before returning — verified in both path contexts. */
const postSigningGuardTests = () => {
  it('throws when zkProof has no data property', async () => {
    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ someOtherField: 'x' }),
      }),
    ).rejects.toThrow('ZK proof data not found or invalid')
  })

  it('throws when zkProof.data fails isPartialZKLoginSignature check', async () => {
    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ data: { bad: 'data' } }),
      }),
    ).rejects.toThrow('ZK proof data not found or invalid')
  })

  it('throws when salt is missing from user profile', async () => {
    const user = {
      profile: { sui_address: '0xabc', sub: 'sub', aud: 'aud' },
    } as unknown as User

    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      }),
    ).rejects.toThrow('Missing required zkLogin profile field: salt')
  })

  it('throws when sub is missing from user profile', async () => {
    const user = {
      profile: { sui_address: '0xabc', salt: 'salt', aud: 'aud' },
    } as unknown as User

    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      }),
    ).rejects.toThrow('Missing required zkLogin profile field: sub')
  })

  it('throws when aud is missing from user profile', async () => {
    const user = {
      profile: { sui_address: '0xabc', salt: 'salt', sub: 'sub' },
    } as unknown as User

    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      }),
    ).rejects.toThrow('Missing required zkLogin profile field: aud')
  })
}

describe('zkSignAny', () => {
  beforeEach(() => {
    vi.mocked(useDeviceStore.getState).mockReturnValue(makeDeviceState())
    vi.mocked(useContextStore.getState).mockReturnValue({
      chain: 'sui:testnet',
    } as unknown as ReturnType<typeof useContextStore.getState>)
    vi.mocked(ephKeyService.getSigner).mockReturnValue({
      applyZKProof: mockApplyZKProof,
      signTransaction: mockSignTransaction,
      signPersonalMessage: mockSignPersonalMessage,
    } as unknown as ReturnType<typeof ephKeyService.getSigner>)
    mockSignTransaction.mockResolvedValue({
      bytes: 'b64bytes',
      signature: 'zkSig123',
    })
    mockSignPersonalMessage.mockResolvedValue({
      bytes: 'b64bytes',
      signature: 'zkSig123',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('web path', () => {
    beforeEach(() => {
      vi.mocked(isWeb).mockReturnValue(true)
    })

    earlyGuardTests()

    it('applies the ZK proof and calls signPersonalMessage for PersonalMessage scope', async () => {
      const result = await zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      })

      expect(mockApplyZKProof).toHaveBeenCalledWith({
        maxEpoch: 5,
        partialZkLoginSignature: validProofData,
        userSalt: 'user-salt',
        keyClaimName: 'sub',
        keyClaimValue: 'user-sub',
        aud: 'user-aud',
      })
      expect(mockSignPersonalMessage).toHaveBeenCalledWith(new Uint8Array([1]))
      expect(result).toEqual({ bytes: 'b64bytes', zkSignature: 'zkSig123' })
    })

    it('calls signTransaction for TransactionData scope', async () => {
      const result = await zkSignAny('TransactionData', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      })

      expect(mockSignTransaction).toHaveBeenCalledWith(new Uint8Array([1]))
      expect(result).toEqual({ bytes: 'b64bytes', zkSignature: 'zkSig123' })
    })

    it('throws when vault is locked (no signer)', async () => {
      vi.mocked(ephKeyService.getSigner).mockReturnValue(null)

      await expect(
        zkSignAny('PersonalMessage', new Uint8Array([1]), {
          user: minimalUser,
          getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
        }),
      ).rejects.toThrow('Vault is locked or no keypair exists')
    })

    postSigningGuardTests()
  })

  describe('extension path', () => {
    const mockSendMessage = vi.fn()

    beforeEach(() => {
      vi.mocked(isWeb).mockReturnValue(false)
      vi.stubGlobal('browser', {
        runtime: { sendMessage: mockSendMessage },
      })
      // Default happy-path response so post-signing guard tests can reach the validation code
      mockSendMessage.mockResolvedValue({
        ok: true,
        bytes: 'extBytes',
        userSignature: 'extSig',
      })
    })

    earlyGuardTests()

    postSigningGuardTests()

    it('applies the ZK proof and returns the combined signature and bytes', async () => {
      mockSendMessage.mockResolvedValue({
        ok: true,
        bytes: 'extBytes',
        userSignature: 'extSig',
      })

      const result = await zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      })

      expect(result).toEqual({ bytes: 'extBytes', zkSignature: 'extSig' })
    })

    it('throws when background script returns no response', async () => {
      mockSendMessage.mockResolvedValue(undefined)

      await expect(
        zkSignAny('PersonalMessage', new Uint8Array([1]), {
          user: minimalUser,
          getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
        }),
      ).rejects.toThrow('No response from background script')
    })

    it('throws when response.ok is false', async () => {
      mockSendMessage.mockResolvedValue({ ok: false, error: 'signing failed' })

      await expect(
        zkSignAny('PersonalMessage', new Uint8Array([1]), {
          user: minimalUser,
          getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
        }),
      ).rejects.toThrow('signing failed')
    })

    it('unwraps structured background errors instead of stringifying objects', async () => {
      mockSendMessage.mockResolvedValue({
        ok: false,
        error: { message: 'background object failure' },
      })

      await expect(
        zkSignAny('PersonalMessage', new Uint8Array([1]), {
          user: minimalUser,
          getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
        }),
      ).rejects.toThrow('background object failure')
    })

    it('throws with default message when response.ok is false and no error provided', async () => {
      mockSendMessage.mockResolvedValue({ ok: false })

      await expect(
        zkSignAny('PersonalMessage', new Uint8Array([1]), {
          user: minimalUser,
          getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
        }),
      ).rejects.toThrow('Failed to sign bytes')
    })

    it('throws when response is missing bytes', async () => {
      mockSendMessage.mockResolvedValue({ ok: true, userSignature: 'extSig' })

      await expect(
        zkSignAny('PersonalMessage', new Uint8Array([1]), {
          user: minimalUser,
          getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
        }),
      ).rejects.toThrow()
    })

    it('throws when response is missing userSignature', async () => {
      mockSendMessage.mockResolvedValue({ ok: true, bytes: 'extBytes' })

      await expect(
        zkSignAny('PersonalMessage', new Uint8Array([1]), {
          user: minimalUser,
          getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
        }),
      ).rejects.toThrow()
    })
  })
})
