import { afterEach, describe, expect, it, vi } from 'vitest'
import { SUI_COIN_TYPE } from '#/utils'

type FakeCoin = { balance: string; objectId: string }

const { FakeTransaction, transactionInstances } = vi.hoisted(() => {
  const builtTransactionBytes = new Uint8Array([11, 22, 33])
  const transactionInstances: FakeTransaction[] = []

  class FakeTransaction {
    gas = 'gas'
    mergeCoins = vi.fn()
    object = vi.fn((id: string) => ({ objectId: id }))
    setSender = vi.fn()
    splitCoins = vi.fn((coin: unknown, amounts: bigint[]) => [
      { coin, amount: amounts[0] },
    ])
    transferObjects = vi.fn()
    build = vi.fn().mockResolvedValue(builtTransactionBytes)

    constructor() {
      transactionInstances.push(this)
    }
  }

  return { FakeTransaction, transactionInstances }
})

vi.mock('@mysten/sui/transactions', () => ({
  Transaction: FakeTransaction,
}))

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

import {
  buildTransferTransactionBytes,
  executeTokenTransfer,
} from '#/wallet/hooks/useSendToken.transaction'

function createSuiClient({
  coins = [],
  executeResult = { Transaction: { digest: 'tx-digest' } },
}: {
  coins?: FakeCoin[]
  executeResult?: unknown
} = {}) {
  return {
    core: {
      executeTransaction: vi.fn().mockResolvedValue(executeResult),
    },
    listCoins: vi.fn().mockResolvedValue({ objects: coins }),
  }
}

describe('useSendToken.transaction helpers', () => {
  afterEach(() => {
    transactionInstances.length = 0
    vi.clearAllMocks()
  })

  it('builds a SUI transfer transaction without loading coin objects', async () => {
    const suiClient = createSuiClient()

    const bytes = await buildTransferTransactionBytes(
      '0xsender',
      '0xrecipient',
      5n,
      SUI_COIN_TYPE,
      suiClient as never,
    )

    const tx = transactionInstances[0]
    expect(bytes).toEqual(new Uint8Array([11, 22, 33]))
    expect(tx.build).toHaveBeenCalledWith({ client: suiClient })
    expect(tx.setSender).toHaveBeenCalledWith('0xsender')
    expect(tx.splitCoins).toHaveBeenCalledWith(tx.gas, [5n])
    expect(tx.transferObjects).toHaveBeenCalledWith(
      [{ coin: tx.gas, amount: 5n }],
      '0xrecipient',
    )
    expect(suiClient.listCoins).not.toHaveBeenCalled()
  })

  it('builds a token transfer from a suitable coin without merging', async () => {
    const suiClient = createSuiClient({
      coins: [{ objectId: 'coin-1', balance: '1000' }],
    })

    await buildTransferTransactionBytes(
      '0xsender',
      '0xrecipient',
      500n,
      '0xtoken',
      suiClient as never,
    )

    const tx = transactionInstances[0]
    expect(suiClient.listCoins).toHaveBeenCalledWith({
      owner: '0xsender',
      coinType: '0xtoken',
    })
    expect(tx.mergeCoins).not.toHaveBeenCalled()
    expect(tx.object).toHaveBeenCalledWith('coin-1')
    expect(tx.transferObjects).toHaveBeenCalled()
  })

  it('uses the suitable coin directly without preparing the primary coin for merging', async () => {
    const suiClient = createSuiClient({
      coins: [
        { objectId: 'coin-1', balance: '100' },
        { objectId: 'coin-2', balance: '1000' },
      ],
    })

    await buildTransferTransactionBytes(
      '0xsender',
      '0xrecipient',
      500n,
      '0xtoken',
      suiClient as never,
    )

    const tx = transactionInstances[0]
    expect(tx.mergeCoins).not.toHaveBeenCalled()
    expect(tx.splitCoins).toHaveBeenCalledWith({ objectId: 'coin-2' }, [500n])
  })

  it('merges token coins when no single coin can cover the amount', async () => {
    const suiClient = createSuiClient({
      coins: [
        { objectId: 'coin-1', balance: '300' },
        { objectId: 'coin-2', balance: '300' },
      ],
    })

    await buildTransferTransactionBytes(
      '0xsender',
      '0xrecipient',
      500n,
      '0xtoken',
      suiClient as never,
    )

    const tx = transactionInstances[0]
    expect(tx.mergeCoins).toHaveBeenCalledWith({ objectId: 'coin-1' }, [
      { objectId: 'coin-2' },
    ])
    expect(tx.splitCoins).toHaveBeenCalledWith({ objectId: 'coin-1' }, [500n])
  })

  it('throws when token coin objects are missing or insufficient', async () => {
    await expect(
      buildTransferTransactionBytes(
        '0xsender',
        '0xrecipient',
        500n,
        '0xtoken',
        createSuiClient({ coins: [] }) as never,
      ),
    ).rejects.toThrow('No coins found for this token')

    await expect(
      buildTransferTransactionBytes(
        '0xsender',
        '0xrecipient',
        500n,
        '0xtoken',
        createSuiClient({
          coins: [{ objectId: 'coin-1', balance: '100' }],
        }) as never,
      ),
    ).rejects.toThrow('Token balance changed during transaction preparation')
  })

  it('executes a signed transfer and returns the digest', async () => {
    const suiClient = createSuiClient()
    const sign = vi.fn().mockResolvedValue({
      bytes: 'abc',
      signature: 'signature',
    })

    const digest = await executeTokenTransfer({
      amount: '1.5',
      coinType: SUI_COIN_TYPE,
      decimals: 1,
      recipientAddress: '0xrecipient',
      suiClient: suiClient as never,
      getSenderAddress: vi.fn().mockResolvedValue('0xsender'),
      sign,
    })

    expect(sign).toHaveBeenCalledWith(
      'TransactionData',
      new Uint8Array([11, 22, 33]),
    )
    expect(suiClient.core.executeTransaction).toHaveBeenCalledWith({
      transaction: new Uint8Array([11, 22, 33]),
      signatures: ['signature'],
    })
    expect(digest).toBe('tx-digest')
  })

  it('rejects when the sender is unavailable or execution fails', async () => {
    await expect(
      executeTokenTransfer({
        amount: '1',
        coinType: SUI_COIN_TYPE,
        decimals: 0,
        recipientAddress: '0xrecipient',
        suiClient: createSuiClient() as never,
        getSenderAddress: vi.fn().mockResolvedValue(null),
        sign: vi.fn(),
      }),
    ).rejects.toThrow('Wallet not ready to sign')

    await expect(
      executeTokenTransfer({
        amount: '1',
        coinType: SUI_COIN_TYPE,
        decimals: 0,
        recipientAddress: '0xrecipient',
        suiClient: createSuiClient({
          executeResult: { $kind: 'FailedTransaction' },
        }) as never,
        getSenderAddress: vi.fn().mockResolvedValue('0xsender'),
        sign: vi.fn().mockResolvedValue({
          bytes: 'abc',
          signature: 'signature',
        }),
      }),
    ).rejects.toThrow('Transaction failed')
  })
})
