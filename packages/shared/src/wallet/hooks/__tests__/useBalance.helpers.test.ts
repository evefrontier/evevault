import { getEveCoinType, TenantId } from '@evefrontier/wallet-core/definitions'
import { SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetBalance = vi.fn()
const mockCreateSuiClient = vi.fn(() => ({ getBalance: mockGetBalance }))

vi.mock('#/sui', () => ({
  createSuiClient: (...args: unknown[]) => mockCreateSuiClient(...args),
}))

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { SUI_COIN_TYPE } from '#/utils'
import { fetchBalanceForChain } from '#/wallet/hooks/useBalance.helpers'
import {
  BALANCE_AND_METADATA_QUERY,
  LATEST_CHECKPOINT_QUERY,
} from '#/wallet/queries/balance'

const ADDRESS = '0xabc'
const EVE_COIN_TYPE = getEveCoinType(TenantId.STILLNESS)
const UNKNOWN_COIN_TYPE = '0x123::foo::FOO'

type QueryResponses = {
  checkpoint?: unknown
  balance?: unknown
}

/** Routes the two GraphQL queries (checkpoint, then balance) to per-query mock responses. */
const createGraphqlClient = ({ checkpoint, balance }: QueryResponses) => {
  const query = vi.fn(({ query: q }: { query: string }) => {
    if (q === LATEST_CHECKPOINT_QUERY) {
      if (checkpoint instanceof Error) return Promise.reject(checkpoint)
      return Promise.resolve(checkpoint ?? { data: null })
    }
    if (q === BALANCE_AND_METADATA_QUERY) {
      if (balance instanceof Error) return Promise.reject(balance)
      return Promise.resolve(balance ?? { data: null })
    }
    throw new Error(`unexpected query: ${q}`)
  })
  return { query } as never
}

const balanceData = (totalBalance: string, coinMetadata: unknown = null) => ({
  data: {
    address: { balance: { totalBalance } },
    coinMetadata,
  },
})

describe('fetchBalanceForChain — localnet', () => {
  beforeEach(() => {
    mockGetBalance.mockReset()
    mockCreateSuiClient.mockClear()
  })

  it('throws when localnetUrl is missing', async () => {
    await expect(
      fetchBalanceForChain({
        activeAddress: ADDRESS,
        coinType: SUI_COIN_TYPE,
        isLocalnet: true,
        graphqlClient: null,
      }),
    ).rejects.toThrow('localnetUrl required for localnet balance')
  })

  it('returns SUI metadata and formats as SUI for the SUI coin type', async () => {
    mockGetBalance.mockResolvedValue({ balance: { balance: '1000000000' } })

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: SUI_COIN_TYPE,
      isLocalnet: true,
      localnetUrl: 'http://localhost:9000',
      graphqlClient: null,
    })

    expect(mockCreateSuiClient).toHaveBeenCalledWith(
      SUI_LOCALNET_CHAIN,
      'http://localhost:9000',
    )
    expect(result.metadata?.symbol).toBe('SUI')
    expect(result.rawBalance).toBe('1000000000')
    expect(result.coinType).toBe(SUI_COIN_TYPE)
  })

  it('returns null metadata and defaults to 9 decimals for a non-SUI coin type', async () => {
    mockGetBalance.mockResolvedValue({ balance: { balance: '5000000000' } })

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: UNKNOWN_COIN_TYPE,
      isLocalnet: true,
      localnetUrl: 'http://localhost:9000',
      graphqlClient: null,
    })

    expect(result.metadata).toBeNull()
    expect(result.rawBalance).toBe('5000000000')
  })

  it('defaults the raw balance to 0 when the client returns no balance', async () => {
    mockGetBalance.mockResolvedValue({})

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: SUI_COIN_TYPE,
      isLocalnet: true,
      localnetUrl: 'http://localhost:9000',
      graphqlClient: null,
    })

    expect(result.rawBalance).toBe('0')
  })
})

describe('fetchBalanceForChain — zkLogin (GraphQL)', () => {
  it('throws when no GraphQL client is provided', async () => {
    await expect(
      fetchBalanceForChain({
        activeAddress: ADDRESS,
        coinType: SUI_COIN_TYPE,
        isLocalnet: false,
        graphqlClient: null,
      }),
    ).rejects.toThrow('Missing GraphQL client')
  })

  it('returns SUI metadata for the SUI coin type', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: { sequenceNumber: 42 } } },
      balance: balanceData('2000000000'),
    })

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: SUI_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    expect(result.metadata?.symbol).toBe('SUI')
    expect(result.rawBalance).toBe('2000000000')
  })

  it('returns EVE metadata for a known EVE coin type', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: { sequenceNumber: 1 } } },
      balance: balanceData('3000000'),
    })

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: EVE_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    expect(result.metadata?.symbol).toBe('EVE')
  })

  it('builds metadata from the response for an unknown coin type', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: { sequenceNumber: 1 } } },
      balance: balanceData('100', {
        decimals: 6,
        symbol: 'FOO',
        name: null,
        description: null,
        iconUrl: null,
      }),
    })

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: UNKNOWN_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    expect(result.metadata).toEqual({
      decimals: 6,
      symbol: 'FOO',
      name: '',
      description: null,
      iconUrl: null,
    })
  })

  it('returns null metadata when the response metadata is incomplete', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: { sequenceNumber: 1 } } },
      balance: balanceData('100', { decimals: null, symbol: null }),
    })

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: UNKNOWN_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    expect(result.metadata).toBeNull()
    // No metadata decimals → raw balance is returned unformatted.
    expect(result.formattedBalance).toBe('100')
  })

  it('defaults the balance to 0 when the response has no data', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: { sequenceNumber: 1 } } },
      balance: {},
    })

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: UNKNOWN_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    expect(result.rawBalance).toBe('0')
  })

  it('defaults the balance to 0 when the response has no address', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: { sequenceNumber: 1 } } },
      balance: { data: { address: null, coinMetadata: null } },
    })

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: UNKNOWN_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    expect(result.rawBalance).toBe('0')
  })

  it('proceeds without atCheckpoint when the checkpoint query errors', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: null, errors: [{ message: 'boom' }] },
      balance: balanceData('500000000'),
    })

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: SUI_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    expect(result.rawBalance).toBe('500000000')
  })

  it('throws when the balance query returns errors', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: { sequenceNumber: 1 } } },
      balance: {
        data: null,
        errors: [{ message: 'bad' }, { message: 'worse' }],
      },
    })

    await expect(
      fetchBalanceForChain({
        activeAddress: ADDRESS,
        coinType: SUI_COIN_TYPE,
        isLocalnet: false,
        graphqlClient: client,
      }),
    ).rejects.toThrow('GraphQL balance query failed: bad, worse')
  })
})

describe('fetchBalanceForChain — checkpoint resolution', () => {
  it('parses a string checkpoint sequence number', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: { sequenceNumber: '7' } } },
      balance: balanceData('1'),
    })

    await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: SUI_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    const balanceCall = client.query.mock.calls.find(
      ([arg]: [{ query: string }]) => arg.query === BALANCE_AND_METADATA_QUERY,
    )
    expect(balanceCall?.[0].variables.atCheckpoint).toBe(7)
  })

  it('omits atCheckpoint for an out-of-safe-range sequence number', async () => {
    const client = createGraphqlClient({
      checkpoint: {
        data: { checkpoint: { sequenceNumber: '99999999999999999999' } },
      },
      balance: balanceData('1'),
    })

    await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: SUI_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    const balanceCall = client.query.mock.calls.find(
      ([arg]: [{ query: string }]) => arg.query === BALANCE_AND_METADATA_QUERY,
    )
    expect(balanceCall?.[0].variables.atCheckpoint).toBeUndefined()
  })

  it('omits atCheckpoint when the checkpoint is unavailable', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: null } },
      balance: balanceData('1'),
    })

    await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: SUI_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    const balanceCall = client.query.mock.calls.find(
      ([arg]: [{ query: string }]) => arg.query === BALANCE_AND_METADATA_QUERY,
    )
    expect(balanceCall?.[0].variables.atCheckpoint).toBeUndefined()
  })
})

describe('fetchBalanceForChain — outside-consistent-range retry', () => {
  it('retries the balance fetch once when the checkpoint advanced mid-query', async () => {
    let balanceAttempts = 0
    const query = vi.fn(({ query: q }: { query: string }) => {
      if (q === LATEST_CHECKPOINT_QUERY) {
        return Promise.resolve({ data: { checkpoint: { sequenceNumber: 5 } } })
      }
      balanceAttempts += 1
      if (balanceAttempts === 1) {
        return Promise.reject(new Error('Data is outside consistent range'))
      }
      return Promise.resolve(balanceData('999'))
    })
    const client = { query } as never

    const result = await fetchBalanceForChain({
      activeAddress: ADDRESS,
      coinType: SUI_COIN_TYPE,
      isLocalnet: false,
      graphqlClient: client,
    })

    expect(balanceAttempts).toBe(2)
    expect(result.rawBalance).toBe('999')
  })

  it('rethrows a non-Error rejection that is not outside-consistent-range', async () => {
    const query = vi.fn(({ query: q }: { query: string }) => {
      if (q === LATEST_CHECKPOINT_QUERY) {
        return Promise.resolve({ data: { checkpoint: { sequenceNumber: 5 } } })
      }
      return Promise.reject('plain string failure')
    })
    const client = { query } as never

    await expect(
      fetchBalanceForChain({
        activeAddress: ADDRESS,
        coinType: SUI_COIN_TYPE,
        isLocalnet: false,
        graphqlClient: client,
      }),
    ).rejects.toBe('plain string failure')
  })

  it('rethrows errors that are not outside-consistent-range', async () => {
    const client = createGraphqlClient({
      checkpoint: { data: { checkpoint: { sequenceNumber: 5 } } },
      balance: new Error('network down'),
    })

    await expect(
      fetchBalanceForChain({
        activeAddress: ADDRESS,
        coinType: SUI_COIN_TYPE,
        isLocalnet: false,
        graphqlClient: client,
      }),
    ).rejects.toThrow('network down')
  })
})
