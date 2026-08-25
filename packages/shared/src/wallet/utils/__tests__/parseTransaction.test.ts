import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetchCoinMetadata } = vi.hoisted(() => ({
  mockFetchCoinMetadata: vi.fn(),
}))

vi.mock('#/wallet/utils/coinMetadata', () => ({
  fetchCoinMetadata: mockFetchCoinMetadata,
}))

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import type { GraphQLTransactionNode } from '#/wallet/types/graphql'
import { parseGraphQLTransaction } from '#/wallet/utils/parseTransaction'

const SUI = '0x2::sui::SUI'
const EVE = '0xeve::eve::EVE'
const USER = '0xUser'

type Change = {
  amount: string | null
  coinType?: string | null
  owner?: string | null
}

const change = ({ amount, coinType = SUI, owner }: Change) => ({
  amount,
  coinType: coinType === null ? null : { repr: coinType },
  owner: owner === undefined ? null : { address: owner },
})

const txNode = (
  changes: ReturnType<typeof change>[],
  overrides: Partial<GraphQLTransactionNode> = {},
): GraphQLTransactionNode =>
  ({
    digest: 'digest-1',
    effects: {
      timestamp: '2024-01-01T00:00:00.000Z',
      balanceChanges: { nodes: changes },
    },
    ...overrides,
  }) as GraphQLTransactionNode

const metadata = (decimals: number, symbol: string, name?: string) => ({
  decimals,
  symbol,
  name: name ?? null,
})

const client = {} as never

describe('parseGraphQLTransaction — null contexts', () => {
  beforeEach(() => mockFetchCoinMetadata.mockReset())

  it('returns null when the digest is missing', async () => {
    const node = txNode([change({ amount: '100' })], {
      digest: null,
    } as Partial<GraphQLTransactionNode>)
    expect(await parseGraphQLTransaction(node, USER, client)).toBeNull()
  })

  it('returns null when there are no effects', async () => {
    const node = { digest: 'd', effects: null } as GraphQLTransactionNode
    expect(await parseGraphQLTransaction(node, USER, client)).toBeNull()
  })

  it('returns null when there are no balance changes', async () => {
    const node = txNode([])
    expect(await parseGraphQLTransaction(node, USER, client)).toBeNull()
  })
})

describe('parseGraphQLTransaction — received', () => {
  beforeEach(() => mockFetchCoinMetadata.mockReset())

  it('parses a received non-SUI transfer and finds the same-coin counterparty', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(6, 'EVE', 'Eve Token'))

    const result = await parseGraphQLTransaction(
      txNode([
        change({ amount: '100', coinType: EVE, owner: USER }),
        change({ amount: '-100', coinType: EVE, owner: '0xSender' }),
      ]),
      USER,
      client,
    )

    expect(result).toMatchObject({
      digest: 'digest-1',
      direction: 'received',
      counterparty: '0xSender',
    })
    expect(result?.balanceChanges[0]).toMatchObject({
      tokenSymbol: 'EVE',
      tokenName: 'Eve Token',
      coinType: EVE,
      isDebit: false,
    })
  })

  it('falls back to an opposite-sign change of a different coin for the counterparty', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(6, 'EVE'))

    const result = await parseGraphQLTransaction(
      txNode([
        change({ amount: '100', coinType: EVE, owner: USER }),
        // opposite sign but a different coin type → withOppositeSign[0] branch
        change({ amount: '-5', coinType: SUI, owner: '0xOther' }),
      ]),
      USER,
      client,
    )

    expect(result?.counterparty).toBe('0xOther')
  })

  it('returns "System" as counterparty when no opposite-sign change exists', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(6, 'EVE'))

    const result = await parseGraphQLTransaction(
      txNode([change({ amount: '100', coinType: EVE, owner: USER })]),
      USER,
      client,
    )

    expect(result?.direction).toBe('received')
    expect(result?.counterparty).toBe('System')
  })

  it('uses the SUI change when the user only has a SUI balance change', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(9, 'SUI', 'Sui'))

    const result = await parseGraphQLTransaction(
      txNode([
        change({ amount: '50', coinType: SUI, owner: USER }),
        change({ amount: '-50', coinType: SUI, owner: '0xOther' }),
      ]),
      USER,
      client,
    )

    expect(result?.direction).toBe('received')
    expect(result?.balanceChanges[0].coinType).toBe(SUI)
  })
})

describe('parseGraphQLTransaction — sent', () => {
  beforeEach(() => mockFetchCoinMetadata.mockReset())

  it('parses a sent transfer with EVE plus SUI gas, prioritizing the non-SUI coin', async () => {
    mockFetchCoinMetadata.mockImplementation((_c: unknown, coinType: string) =>
      Promise.resolve(
        coinType === EVE ? metadata(6, 'EVE') : metadata(9, 'SUI'),
      ),
    )

    const result = await parseGraphQLTransaction(
      txNode([
        change({ amount: '-100', coinType: EVE, owner: USER }),
        change({ amount: '-5', coinType: SUI, owner: USER }),
        change({ amount: '100', coinType: EVE, owner: '0xRecipient' }),
      ]),
      USER,
      client,
    )

    expect(result?.direction).toBe('sent')
    expect(result?.counterparty).toBe('0xRecipient')
    // Both user changes appear; the EVE debit is marked as a debit.
    expect(result?.balanceChanges).toHaveLength(2)
    expect(result?.balanceChanges[0]).toMatchObject({ isDebit: true })
  })
})

describe('parseGraphQLTransaction — outgoing fallback', () => {
  beforeEach(() => mockFetchCoinMetadata.mockReset())

  it('builds an outgoing transaction when the user owns no balance change', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(9, 'SUI'))

    const result = await parseGraphQLTransaction(
      txNode([
        change({ amount: '-100', coinType: SUI, owner: '0xOther' }),
        change({ amount: '100', coinType: SUI, owner: '0xRecipient' }),
      ]),
      USER,
      client,
    )

    expect(result).toMatchObject({
      direction: 'sent',
      counterparty: '0xRecipient',
    })
    expect(result?.balanceChanges).toHaveLength(1)
  })

  it('returns null when there is neither a user change nor an outgoing change', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(9, 'SUI'))

    const result = await parseGraphQLTransaction(
      txNode([change({ amount: '100', coinType: SUI, owner: '0xRecipient' })]),
      USER,
      client,
    )

    expect(result).toBeNull()
  })
})

describe('parseGraphQLTransaction — move-call counterparty label', () => {
  beforeEach(() => mockFetchCoinMetadata.mockReset())

  const moveCallKind = (moduleName: string, functionName: string) => ({
    kind: {
      __typename: 'ProgrammableTransaction',
      commands: {
        nodes: [
          {
            __typename: 'MoveCallCommand',
            function: { name: functionName, module: { name: moduleName } },
          },
        ],
      },
    },
  })

  it('labels a coin-less move call with module::function instead of System', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(9, 'SUI'))

    // Alias registration: user pays gas, no coin moves to another address.
    const result = await parseGraphQLTransaction(
      txNode(
        [change({ amount: '-5000', coinType: SUI, owner: USER })],
        moveCallKind('address_alias', 'add'),
      ),
      USER,
      client,
    )

    expect(result).toMatchObject({
      direction: 'sent',
      counterparty: 'address_alias::add',
    })
  })

  it('keeps a real counterparty address over the move-call label', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(9, 'SUI'))

    const result = await parseGraphQLTransaction(
      txNode(
        [
          change({ amount: '-100', coinType: SUI, owner: USER }),
          change({ amount: '100', coinType: SUI, owner: '0xRecipient' }),
        ],
        moveCallKind('address_alias', 'add'),
      ),
      USER,
      client,
    )

    expect(result?.counterparty).toBe('0xRecipient')
  })

  it('stays System when the tx has no move call', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(9, 'SUI'))

    const result = await parseGraphQLTransaction(
      txNode([change({ amount: '-5000', coinType: SUI, owner: USER })]),
      USER,
      client,
    )

    expect(result?.counterparty).toBe('System')
  })
})

describe('parseGraphQLTransaction — metadata fallbacks', () => {
  beforeEach(() => mockFetchCoinMetadata.mockReset())

  it('falls back to 9 decimals and a derived symbol when metadata is missing', async () => {
    mockFetchCoinMetadata.mockResolvedValue(null)

    const result = await parseGraphQLTransaction(
      txNode([
        change({ amount: '-100', coinType: EVE, owner: USER }),
        change({ amount: '100', coinType: EVE, owner: '0xRecipient' }),
      ]),
      USER,
      client,
    )

    // EVE coin type "0xeve::eve::EVE" → symbol derived from the struct name.
    expect(result?.balanceChanges[0].tokenSymbol).toBe('EVE')
    expect(result?.balanceChanges[0].tokenName).toBeUndefined()
  })

  it('defaults a null coin type repr to the SUI coin type', async () => {
    mockFetchCoinMetadata.mockResolvedValue(metadata(9, 'SUI'))

    const result = await parseGraphQLTransaction(
      txNode([
        change({ amount: '100', coinType: null, owner: USER }),
        change({ amount: '-100', coinType: null, owner: '0xSender' }),
      ]),
      USER,
      client,
    )

    expect(result?.balanceChanges[0].coinType).toBe(SUI)
  })
})
