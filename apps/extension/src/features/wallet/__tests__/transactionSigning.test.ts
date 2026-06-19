import { describe, expect, it, vi } from 'vitest'

const { mockBuildTxBytes, mockTransactionFrom } = vi.hoisted(() => ({
  mockBuildTxBytes: vi.fn(),
  mockTransactionFrom: vi.fn(),
}))

vi.mock('@evefrontier/wallet-core/utils', () => ({
  buildTransactionBytes: mockBuildTxBytes,
}))

vi.mock('@mysten/sui/transactions', () => ({
  Transaction: { from: mockTransactionFrom },
}))

import { assertCanSign, prepareAndSignTransaction } from '../transactionSigning'

function baseAuth(overrides: Record<string, unknown> = {}) {
  return {
    user: { id_token: 'tok' },
    ephemeralPublicKey: {},
    maxEpoch: 100,
    ...overrides,
  }
}

const BASE_PENDING = {
  windowId: 1,
  transaction: 'base64tx',
  requestId: 'r1',
  chain: 'sui:testnet',
  account: { address: '0xabc' },
} as Parameters<typeof prepareAndSignTransaction>[0]['pendingTransaction']

describe('assertCanSign', () => {
  it('throws when there is no user', () => {
    expect(() => assertCanSign(baseAuth({ user: undefined }), false)).toThrow(
      'No user found',
    )
  })

  it('passes without key/epoch when isLocalnet is true', () => {
    expect(() =>
      assertCanSign(
        baseAuth({ ephemeralPublicKey: undefined, maxEpoch: undefined }),
        true,
      ),
    ).not.toThrow()
  })

  it('throws when ephemeralPublicKey is missing (non-localnet)', () => {
    expect(() =>
      assertCanSign(baseAuth({ ephemeralPublicKey: undefined }), false),
    ).toThrow('Ephemeral public key not found')
  })

  it('throws when maxEpoch is missing (non-localnet)', () => {
    expect(() =>
      assertCanSign(baseAuth({ maxEpoch: undefined }), false),
    ).toThrow('Max epoch is not set')
  })

  it('does not throw with all required fields present', () => {
    expect(() => assertCanSign(baseAuth(), false)).not.toThrow()
  })
})

describe('prepareAndSignTransaction', () => {
  function baseArgs(overrides: Record<string, unknown> = {}) {
    return {
      pendingTransaction: BASE_PENDING,
      auth: baseAuth(),
      getSenderAddress: vi.fn(() => Promise.resolve('0xabc')),
      isLocalnet: false,
      sign: vi.fn(() =>
        Promise.resolve({ bytes: 'b64bytes', signature: 'sig' }),
      ),
      suiClient: {},
      ...overrides,
    } as Parameters<typeof prepareAndSignTransaction>[0]
  }

  it('throws when assertCanSign fails (no user)', async () => {
    const args = baseArgs({ auth: baseAuth({ user: undefined }) })
    await expect(prepareAndSignTransaction(args)).rejects.toThrow(
      'No user found',
    )
  })

  it('throws with localnet message when sender address is null (isLocalnet)', async () => {
    const args = baseArgs({
      getSenderAddress: vi.fn(() => Promise.resolve(null)),
      isLocalnet: true,
      auth: baseAuth({ ephemeralPublicKey: undefined, maxEpoch: undefined }),
    })
    await expect(prepareAndSignTransaction(args)).rejects.toThrow(
      'No localnet keypair loaded',
    )
  })

  it('throws with generic message when sender address is null (non-localnet)', async () => {
    const args = baseArgs({
      getSenderAddress: vi.fn(() => Promise.resolve(null)),
    })
    await expect(prepareAndSignTransaction(args)).rejects.toThrow(
      'User address not found',
    )
  })

  it('builds and signs the transaction, returning txb, bytes, signature and windowId', async () => {
    const fakeTxb = { mock: 'txb' }
    const fakeTxObject = { parsed: true }
    mockTransactionFrom.mockReturnValue(fakeTxObject)
    mockBuildTxBytes.mockResolvedValue(fakeTxb)

    const sign = vi.fn(() =>
      Promise.resolve({ bytes: 'b64bytes', signature: 'sig' }),
    )
    const getSenderAddress = vi.fn(() => Promise.resolve('0xsender'))

    const result = await prepareAndSignTransaction(
      baseArgs({ sign, getSenderAddress }),
    )

    expect(mockTransactionFrom).toHaveBeenCalledWith(BASE_PENDING.transaction)
    expect(mockBuildTxBytes).toHaveBeenCalledWith(
      fakeTxObject,
      '0xsender',
      expect.any(Object),
    )
    expect(sign).toHaveBeenCalledWith('TransactionData', fakeTxb)
    expect(result).toEqual({
      txb: fakeTxb,
      bytes: 'b64bytes',
      signature: 'sig',
      windowId: 1,
    })
  })
})
