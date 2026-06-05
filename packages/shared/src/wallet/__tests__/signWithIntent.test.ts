import type { SignatureWithBytes, Signer } from '@mysten/sui/cryptography'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signWithIntent } from '#/wallet/signWithIntent'

function makeMockKeypair(overrides?: Partial<Signer>): Signer {
  return {
    signTransaction: vi.fn().mockResolvedValue({
      bytes: 'base64bytes',
      signature: 'base64sig',
    } satisfies SignatureWithBytes),
    signPersonalMessage: vi.fn().mockResolvedValue({
      bytes: 'base64bytes',
      signature: 'base64sig',
    } satisfies SignatureWithBytes),
    ...overrides,
  } as unknown as Signer
}

const MSG = new Uint8Array([1, 2, 3])
const ADDR = '0xabc'

describe('signWithIntent', () => {
  let keypair: ReturnType<typeof makeMockKeypair>

  beforeEach(() => {
    keypair = makeMockKeypair()
  })

  it('throws when sui_address is missing', async () => {
    await expect(
      signWithIntent(MSG, 'PersonalMessage', {
        sui_address: '',
        keypair,
      }),
    ).rejects.toThrow('[signWithIntent] User address not found')
  })

  it('throws when keypair is null', async () => {
    await expect(
      signWithIntent(MSG, 'PersonalMessage', {
        sui_address: ADDR,
        keypair: null as unknown as Signer,
      }),
    ).rejects.toThrow('[signWithIntent] Key pair not found')
  })

  it('calls signTransaction for TransactionData scope', async () => {
    const result = await signWithIntent(MSG, 'TransactionData', {
      sui_address: ADDR,
      keypair,
    })

    expect(keypair.signTransaction).toHaveBeenCalledWith(MSG)
    expect(keypair.signPersonalMessage).not.toHaveBeenCalled()
    expect(result).toEqual({
      bytes: 'base64bytes',
      userSignature: 'base64sig',
    })
  })

  it('calls signPersonalMessage for non-TransactionData scope', async () => {
    const result = await signWithIntent(MSG, 'PersonalMessage', {
      sui_address: ADDR,
      keypair,
    })

    expect(keypair.signPersonalMessage).toHaveBeenCalledWith(MSG)
    expect(keypair.signTransaction).not.toHaveBeenCalled()
    expect(result).toEqual({
      bytes: 'base64bytes',
      userSignature: 'base64sig',
    })
  })

  it('propagates keypair signing errors', async () => {
    keypair = makeMockKeypair({
      signPersonalMessage: vi.fn().mockRejectedValue(new Error('crypto fail')),
    })

    await expect(
      signWithIntent(MSG, 'PersonalMessage', { sui_address: ADDR, keypair }),
    ).rejects.toThrow('crypto fail')
  })

  it('routes RawBytes scope to signPersonalMessage', async () => {
    await signWithIntent(MSG, 'RawBytes' as never, {
      sui_address: ADDR,
      keypair,
    })
    expect(keypair.signPersonalMessage).toHaveBeenCalled()
  })

  it('produces a real signature with Ed25519Keypair', async () => {
    const realKeypair = Ed25519Keypair.generate()
    const result = await signWithIntent(MSG, 'PersonalMessage', {
      sui_address: realKeypair.toSuiAddress(),
      keypair: realKeypair,
    })
    expect(typeof result.bytes).toBe('string')
    expect(result.bytes.length).toBeGreaterThan(0)
    expect(typeof result.userSignature).toBe('string')
    expect(result.userSignature.length).toBeGreaterThan(0)
  })
})
