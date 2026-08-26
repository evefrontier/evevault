import { afterEach, describe, expect, it, vi } from 'vitest'
import { invalidateCoinMetadataCache } from '#/wallet/utils/coinMetadata'
import {
  classifyBuildFailure,
  simulateTransactionOutcome,
} from '#/wallet/utils/simulateTransaction'

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

  it('labels a published package as `published`, not `created`', async () => {
    const PKG = '0xpkg'
    const suiClient = makeSuiClient({
      $kind: 'Transaction',
      Transaction: {
        effects: {
          status: { success: true, error: null },
          gasUsed: GAS_USED,
          // A package publish reports Created + PackageWrite.
          changedObjects: [
            {
              objectId: PKG,
              idOperation: 'Created',
              outputState: 'PackageWrite',
            },
          ],
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

    expect(outcome.changedObjects).toEqual([
      {
        objectId: PKG,
        kind: 'published',
        objectType: undefined,
        ownerAfter: undefined,
      },
    ])
  })

  it('throws on an unrecognized response so the caller treats it as unavailable', async () => {
    const suiClient = makeSuiClient({ $kind: 'SomethingElse' })

    await expect(
      simulateTransactionOutcome({
        transactionBytes: bytes,
        sender: SENDER,
        suiClient,
        graphqlClient: makeGraphqlClient(9, 'EVE'),
      }),
    ).rejects.toThrow(/Unrecognized simulation response/)
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

describe('classifyBuildFailure', () => {
  it('reclassifies a gas-budget-probe SimulationError as a predicted failure', () => {
    const err = Object.assign(
      new Error(
        'Transaction resolution failed: InsufficientCoinBalance in command 0',
      ),
      {
        cause: {
          $kind: 'FailedTransaction',
          FailedTransaction: {
            effects: {
              status: {
                success: false,
                error: { message: 'InsufficientCoinBalance in command 0' },
              },
              gasUsed: GAS_USED,
              transactionDigest: 'ProbeDigest',
              changedObjects: [],
            },
          },
        },
      },
    )

    const outcome = classifyBuildFailure(err)

    expect(outcome).toEqual({
      status: 'failure',
      error: 'InsufficientCoinBalance in command 0',
      digest: 'ProbeDigest',
      gas: {
        computation: '0.001',
        storage: '0.002',
        rebate: '0.0005',
        net: '0.0025',
      },
      balanceChanges: [],
      changedObjects: [],
      events: [],
    })
  })

  it('reclassifies a SimulationError via executionError when cause was dropped', () => {
    // The extension's transpilation of `super(message, { cause })` drops the
    // cause value, but `.executionError` survives (message + kind).
    const err = Object.assign(
      new Error(
        'Transaction resolution failed: InsufficientCoinBalance in command 0',
      ),
      { executionError: { message: 'InsufficientCoinBalance in command 0' } },
    )

    const outcome = classifyBuildFailure(err)

    expect(outcome).toEqual({
      status: 'failure',
      error: 'InsufficientCoinBalance in command 0',
      digest: '',
      gas: { computation: '0', storage: '0', rebate: '0', net: '0' },
      balanceChanges: [],
      changedObjects: [],
      events: [],
    })
  })

  it('reclassifies a gas-selection insufficient-balance error as a predicted failure', () => {
    // grpc resolver wraps the RPC failure as a SimulationError with an RpcError
    // cause and no executionError (@mysten/sui grpc/core.ts:925).
    const err = Object.assign(
      new Error(
        'Unable to perform gas selection due to insufficient SUI balance (in address balance or coins) for account 0xabc to satisfy required budget 2988000.',
      ),
      {
        cause: Object.assign(new Error('rpc'), {
          name: 'RpcError',
          code: 'UNKNOWN',
        }),
      },
    )

    const outcome = classifyBuildFailure(err)

    expect(outcome?.status).toBe('failure')
    expect(outcome?.error).toContain('insufficient SUI balance')
  })

  it('reclassifies "no valid gas coins" as a predicted failure', () => {
    const err = new Error('No valid gas coins found for the transaction.')

    expect(classifyBuildFailure(err)?.status).toBe('failure')
  })

  it('reclassifies invalid transaction inputs (-32002) as a predicted failure', () => {
    const err = new Error(
      'Failed to submit transaction: Transaction validator signing failed due to issues with transaction inputs, code: -32002',
    )

    expect(classifyBuildFailure(err)?.status).toBe('failure')
  })

  it('reclassifies a VMVerification error as a predicted failure', () => {
    const err = new Error(
      'Error executing transaction: VMVerificationOrDeserializationError in command 0',
    )

    expect(classifyBuildFailure(err)?.status).toBe('failure')
  })

  it('reclassifies a deterministic gRPC status code as a predicted failure', () => {
    const err = Object.assign(new Error('rejected'), {
      cause: Object.assign(new Error('bad'), {
        name: 'RpcError',
        code: 'INVALID_ARGUMENT',
      }),
    })

    expect(classifyBuildFailure(err)?.status).toBe('failure')
  })

  it('returns null for a transport error with no deterministic-failure signal', () => {
    const err = Object.assign(new Error('Service unavailable'), {
      cause: Object.assign(new Error('unavailable'), {
        name: 'RpcError',
        code: 'UNAVAILABLE',
      }),
    })

    expect(classifyBuildFailure(err)).toBeNull()
  })

  it('returns null for object contention (reserved / equivocated)', () => {
    const reserved = new Error(
      'Failed to sign transaction by a quorum of validators because one or more of its objects is reserved for another transaction',
    )
    const equivocated = new Error(
      'one or more of its objects is equivocated until the next epoch',
    )

    expect(classifyBuildFailure(reserved)).toBeNull()
    expect(classifyBuildFailure(equivocated)).toBeNull()
  })

  it('returns null for an error whose cause is not a failed simulation', () => {
    const err = Object.assign(new Error('boom'), {
      cause: { $kind: 'Transaction' },
    })

    expect(classifyBuildFailure(err)).toBeNull()
  })

  it('returns null for an unrelated network error', () => {
    expect(classifyBuildFailure(new Error('network timeout'))).toBeNull()
  })

  it('returns null for a non-Error throw', () => {
    expect(classifyBuildFailure('some string')).toBeNull()
  })
})
