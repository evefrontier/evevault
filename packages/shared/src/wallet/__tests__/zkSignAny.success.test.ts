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

vi.mock('#/wallet/signWithIntent', () => ({
  signWithIntent: vi.fn(),
}))

const mockApplyZKProof = vi.fn()
const mockProcessSignature = vi.fn()

vi.mock('@evefrontier/wallet-core/crypto', () => {
  return {
    isPartialZKLoginSignature: vi.fn(() => true),
    ZKProofHandler: function MockZKProofHandler() {
      this.applyZKProof = mockApplyZKProof
      this.processSignature = mockProcessSignature
    },
  }
})

import { isPartialZKLoginSignature } from '@evefrontier/wallet-core/crypto'
import { ephKeyService } from '#/services/vaultService'
import { useContextStore } from '#/stores/contextStore'
import { useDeviceStore } from '#/stores/deviceStore'
import { isWeb } from '#/utils/environment'
import { signWithIntent } from '#/wallet/signWithIntent'
import { zkSignAny } from '#/wallet/zkSignAny'

const validProofData = {
  proofPoints: {},
  issBase64Details: {},
  headerBase64: '',
}

const minimalUser = {
  profile: {
    sui_address: '0xabc',
    salt: 'user-salt',
    sub: 'user-sub',
    aud: 'user-aud',
  },
} as unknown as User

describe('zkSignAny success path', () => {
  beforeEach(() => {
    vi.mocked(isWeb).mockReturnValue(true)
    vi.mocked(useDeviceStore.getState).mockReturnValue({
      ephemeralPublicKey: { toRawBytes: () => new Uint8Array([1]) },
      getMaxEpoch: () => '5',
    } as never)
    vi.mocked(useContextStore.getState).mockReturnValue({
      chain: 'sui:testnet',
    } as never)
    vi.mocked(ephKeyService.getSigner).mockReturnValue({} as never)
    vi.mocked(signWithIntent).mockResolvedValue({
      bytes: 'b64bytes',
      userSignature: 'ephSig',
    } as never)
    vi.mocked(isPartialZKLoginSignature).mockReturnValue(true)
    mockApplyZKProof.mockReset()
    mockProcessSignature.mockReturnValue({ signature: 'zkSig123' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns zkSignature and bytes on success', async () => {
    const result = await zkSignAny('PersonalMessage', new Uint8Array([1]), {
      user: minimalUser,
      getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
    })

    expect(result).toEqual({ bytes: 'b64bytes', zkSignature: 'zkSig123' })
  })

  it('calls applyZKProof with correct inputs including parsed maxEpoch', async () => {
    await zkSignAny('PersonalMessage', new Uint8Array([1]), {
      user: minimalUser,
      getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
    })

    expect(mockApplyZKProof).toHaveBeenCalledWith({
      maxEpoch: 5,
      partialZkLoginSignature: validProofData,
      userSalt: 'user-salt',
      tokenClaimSub: 'user-sub',
      tokenClaimAud: 'user-aud',
    })
  })

  it('calls processSignature with ephemeral signature and bytes', async () => {
    await zkSignAny('PersonalMessage', new Uint8Array([1]), {
      user: minimalUser,
      getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
    })

    expect(mockProcessSignature).toHaveBeenCalledWith({
      signature: 'ephSig',
      bytes: 'b64bytes',
    })
  })

  it('throws when zkProof.data fails isPartialZKLoginSignature check', async () => {
    vi.mocked(isPartialZKLoginSignature).mockReturnValue(false)

    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ data: { bad: 'data' } }),
      }),
    ).rejects.toThrow('ZK proof data not found or invalid')
  })

  it('throws when zkProof has no data property', async () => {
    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ someOtherField: 'x' }),
      }),
    ).rejects.toThrow('ZK proof data not found or invalid')
  })

  it('throws when salt is missing from user profile', async () => {
    const userNoSalt = {
      profile: { sui_address: '0xabc', sub: 'sub', aud: 'aud' },
    } as unknown as User

    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: userNoSalt,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      }),
    ).rejects.toThrow('Missing required zkLogin profile fields: salt')
  })

  it('throws when sub and aud are missing from user profile', async () => {
    const userNoSubAud = {
      profile: { sui_address: '0xabc', salt: 'salt' },
    } as unknown as User

    await expect(
      zkSignAny('PersonalMessage', new Uint8Array([1]), {
        user: userNoSubAud,
        getZkProof: vi.fn().mockResolvedValue({ data: validProofData }),
      }),
    ).rejects.toThrow('Missing required zkLogin profile fields: sub, aud')
  })
})
