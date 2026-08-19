import { afterEach, describe, expect, it, vi } from 'vitest'
import { invalidateCoinMetadataCache } from '#/wallet/utils/coinMetadata'
import { simulateTransactionOutcome } from '#/wallet/utils/simulateTransaction'

const SENDER =
  '0x1111111111111111111111111111111111111111111111111111111111111111'
const OTHER =
  '0x2222222222222222222222222222222222222222222222222222222222222222'
const EVE_COIN = '0xabc::eve::EVE'
const OBJ_A = '0xaaa'
const OBJ_B = '0xbbb'

const GAS_USED = {
  computationCost: '1000000',
  storageCost: '2000000',
  storageRebate: '500000',
  nonRefundableStorageFee: '0',
}
// net gas = 1_000_000 + 2_000_000 − 500_000 = 2_500_000 mist = 0.0025 SUI

function makeSuiClient(result: unknown) {
  return {
    simulateTransaction: vi.fn().mockResolvedValue(result),
  } as never
}

// Non-SUI coins resolve decimals/symbol via GraphQL; SUI is known and never queries.
function makeGraphqlClient(decimals: number, symbol: string) {
  return {
    query: vi.fn().mockResolvedValue({
      data: { coinMetadata: { decimals, symbol, name: symbol } },
    }),
  } as never
}

const bytes = new Uint8Array([1, 2, 3])

afterEach(() => {
  invalidateCoinMetadataCache()
  vi.restoreAllMocks()
})

describe('simulateTransactionOutcome', () => {
  it('reports digest, gas, balance changes and changed objects', async () => {
    const suiClient = makeSuiClient({
      $kind: 'Transaction',
      Transaction: {
        digest: 'DiGeSt123',
        objectTypes: { [OBJ_A]: '0x2::coin::Coin<0x2::sui::SUI>' },
        effects: {
          status: { success: true, error: null },
          gasUsed: GAS_USED,
          transactionDigest: 'DiGeSt123',
          changedObjects: [
            {
              objectId: OBJ_A,
              idOperation: 'None',
              outputState: 'ObjectWrite',
              inputOwner: { $kind: 'AddressOwner', AddressOwner: SENDER },
              outputOwner: { $kind: 'AddressOwner', AddressOwner: OTHER },
            },
            {
              objectId: OBJ_B,
              idOperation: 'Created',
              outputState: 'ObjectWrite',
              outputOwner: {
                $kind: 'Shared',
                Shared: { initialSharedVersion: '1' },
              },
            },
          ],
        },
        events: [
          {
            eventType: '0xpkg::market::Sale',
            json: { price: '12500000000', buyer: OTHER },
          },
        ],
        balanceChanges: [
          { address: SENDER, coinType: EVE_COIN, amount: '12500000000' },
          { address: SENDER, coinType: '0x2::sui::SUI', amount: '-2500000' },
          // Another account's change must be filtered out.
          { address: OTHER, coinType: EVE_COIN, amount: '-12500000000' },
        ],
      },
    })

    const outcome = await simulateTransactionOutcome({
      transactionBytes: bytes,
      sender: SENDER,
      suiClient,
      graphqlClient: makeGraphqlClient(9, 'EVE'),
    })

    expect(outcome.status).toBe('success')
    expect(outcome.digest).toBe('DiGeSt123')
    expect(outcome.gas).toEqual({
      computation: '0.001',
      storage: '0.002',
      rebate: '0.0005',
      net: '0.0025',
    })
    expect(outcome.balanceChanges).toEqual([
      {
        coinType: EVE_COIN,
        symbol: 'EVE',
        name: 'EVE',
        amount: '12.5',
        isDebit: false,
      },
      {
        coinType: '0x2::sui::SUI',
        symbol: 'SUI',
        name: 'Sui',
        amount: '0.0025',
        isDebit: true,
      },
    ])
    expect(outcome.changedObjects).toEqual([
      {
        objectId: OBJ_A,
        kind: 'mutated',
        objectType: '0x2::coin::Coin<0x2::sui::SUI>',
        ownerBefore: SENDER,
        ownerAfter: OTHER,
      },
      {
        objectId: OBJ_B,
        kind: 'created',
        objectType: undefined,
        ownerAfter: 'shared',
      },
    ])
    expect(outcome.events).toEqual([
      {
        type: '0xpkg::market::Sale',
        label: 'market::Sale',
        json: { price: '12500000000', buyer: OTHER },
      },
    ])
  })

  it('surfaces the abort reason when the transaction would fail', async () => {
    const suiClient = makeSuiClient({
      $kind: 'FailedTransaction',
      FailedTransaction: {
        effects: {
          status: {
            success: false,
            error: { message: 'MoveAbort in 0xdead::mod::fn: 7' },
          },
          gasUsed: GAS_USED,
          transactionDigest: 'FailDigest',
          changedObjects: [],
        },
        balanceChanges: [],
      },
    })

    const outcome = await simulateTransactionOutcome({
      transactionBytes: bytes,
      sender: SENDER,
      suiClient,
      graphqlClient: makeGraphqlClient(9, 'EVE'),
    })

    expect(outcome.status).toBe('failure')
    expect(outcome.error).toBe('MoveAbort in 0xdead::mod::fn: 7')
    expect(outcome.digest).toBe('FailDigest')
    expect(outcome.gas.net).toBe('0.0025')
    expect(outcome.balanceChanges).toEqual([])
  })

  it('returns an empty change set when nothing touches the sender', async () => {
    const suiClient = makeSuiClient({
      $kind: 'Transaction',
      Transaction: {
        effects: {
          status: { success: true, error: null },
          gasUsed: GAS_USED,
          changedObjects: [],
        },
        balanceChanges: [{ address: OTHER, coinType: EVE_COIN, amount: '5' }],
      },
    })

    const outcome = await simulateTransactionOutcome({
      transactionBytes: bytes,
      sender: SENDER,
      suiClient,
      graphqlClient: makeGraphqlClient(9, 'EVE'),
    })

    expect(outcome.status).toBe('success')
    expect(outcome.balanceChanges).toEqual([])
  })
})
