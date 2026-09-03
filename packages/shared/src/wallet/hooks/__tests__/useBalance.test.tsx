import { SUI_DEVNET_CHAIN, SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()
const mockGetBalance = vi.fn()

vi.mock('#/sui/graphqlClient', () => ({
  createSuiGraphQLClient: vi.fn(() => ({ query: mockQuery })),
}))

vi.mock('#/sui', () => ({
  createSuiClient: vi.fn(() => ({ getBalance: mockGetBalance })),
}))

vi.mock('#/utils/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('#/utils', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  isExtension: vi.fn(() => false),
  isWeb: vi.fn(() => true),
  isBrowser: vi.fn(() => true),
  SUI_COIN_TYPE: '0x2::sui::SUI',
  isSuiCoinType: vi.fn((coinType: string) => coinType === '0x2::sui::SUI'),
}))

vi.mock('@evefrontier/wallet-core/utils', () => ({
  formatByDecimals: vi.fn(
    (balance: string, _decimals: number) => `formatted-${balance}`,
  ),
  formatMistToSui: vi.fn(),
}))

import { formatMistToSui } from '@evefrontier/wallet-core/utils'
import { createMockUser } from '#/testing'
import { useBalance } from '#/wallet/hooks/useBalance'

const mockedFormatSUI = vi.mocked(formatMistToSui)

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useBalance hook', () => {
  beforeEach(() => {
    mockQuery.mockClear()
    mockGetBalance.mockClear()
  })

  it('returns a formatted SUI balance for the current user', async () => {
    mockQuery
      .mockResolvedValueOnce({
        data: { checkpoint: { sequenceNumber: 12345 } },
        errors: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          address: { balance: { totalBalance: '1000' } },
          coinMetadata: {
            decimals: 9,
            symbol: 'SUI',
            name: 'Sui',
            description: 'Sui Native Token',
            iconUrl: null,
          },
        },
        errors: undefined,
      })
    mockedFormatSUI.mockReturnValueOnce('formatted-1000')
    const user = createMockUser()

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const wrapper = createWrapper(queryClient)
    const { result, unmount } = renderHook(
      () =>
        useBalance({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        variables: {
          address: '0x123',
          coinType: '0x2::sui::SUI',
          atCheckpoint: 12345,
        },
      }),
    )
    expect(result.current.data?.formattedBalance).toBe('formatted-1000')

    unmount()
    queryClient.clear()
  })

  it('retries with fresh checkpoint when balance query returns outside consistent range', async () => {
    const successBalanceData = {
      data: {
        address: { balance: { totalBalance: '500' } },
        coinMetadata: {
          decimals: 9,
          symbol: 'SUI',
          name: 'Sui',
          description: 'Sui Native Token',
          iconUrl: null,
        },
      },
      errors: undefined,
    }
    const checkpointData = (seq: number) => ({
      data: { checkpoint: { sequenceNumber: seq } },
      errors: undefined,
    })

    mockQuery
      .mockResolvedValueOnce(checkpointData(100))
      .mockRejectedValueOnce(new Error('Request is outside consistent range'))
      .mockResolvedValueOnce(checkpointData(101))
      .mockResolvedValueOnce(successBalanceData)
    mockedFormatSUI.mockReturnValue('formatted-500')
    const user = createMockUser()

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const wrapper = createWrapper(queryClient)
    const { result, unmount } = renderHook(
      () =>
        useBalance({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockQuery).toHaveBeenCalledTimes(4)
    const balanceCalls = mockQuery.mock.calls.filter(
      (call) =>
        call[0]?.variables?.address !== undefined &&
        call[0]?.variables?.coinType !== undefined,
    )
    expect(balanceCalls).toHaveLength(2)
    const firstAtCheckpoint = balanceCalls[0][0].variables?.atCheckpoint
    const retryAtCheckpoint = balanceCalls[1][0].variables?.atCheckpoint
    expect(firstAtCheckpoint).toBe(100)
    expect(retryAtCheckpoint).toBe(101)
    expect(retryAtCheckpoint).not.toBe(firstAtCheckpoint)
    expect(result.current.data?.formattedBalance).toBe('formatted-500')

    unmount()
    queryClient.clear()
  })
})

describe('useBalance hook — localnet gRPC path', () => {
  beforeEach(() => {
    mockGetBalance.mockClear()
    mockQuery.mockClear()
  })

  const createWrapper =
    (queryClient: QueryClient) =>
    ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

  it('returns formatted SUI balance via gRPC on localnet', async () => {
    mockGetBalance.mockResolvedValue({ balance: { balance: '2000000000' } })
    const { formatMistToSui } = await import('@evefrontier/wallet-core/utils')
    vi.mocked(formatMistToSui).mockReturnValueOnce('2')

    const user = (await import('#/testing')).createMockUser()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result, unmount } = renderHook(
      () =>
        useBalance({
          user,
          chain: SUI_LOCALNET_CHAIN,
          localnetUrl: 'http://localhost:9000',
        }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.formattedBalance).toBe('2')
    expect(result.current.data?.rawBalance).toBe('2000000000')
    unmount()
    queryClient.clear()
  })

  it('uses 9-decimal fallback and warns for unknown localnet tokens', async () => {
    mockGetBalance.mockResolvedValue({ balance: { balance: '5000000000' } })
    const { createLogger } = await import('#/utils/logger')
    const logInstance = vi.mocked(createLogger).mock.results[0]?.value

    const user = (await import('#/testing')).createMockUser()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result, unmount } = renderHook(
      () =>
        useBalance({
          user,
          chain: SUI_LOCALNET_CHAIN,
          coinType: '0xdeadbeef::token::TOKEN',
          localnetUrl: 'http://localhost:9000',
        }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.formattedBalance).toBe('formatted-5000000000')
    expect(logInstance.warn).toHaveBeenCalledWith(
      expect.stringContaining('no metadata for coin type'),
      expect.objectContaining({ coinType: '0xdeadbeef::token::TOKEN' }),
    )
    unmount()
    queryClient.clear()
  })

  it('stays idle when localnet but localnetUrl is missing', async () => {
    const user = (await import('#/testing')).createMockUser()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result, unmount } = renderHook(
      () =>
        useBalance({ user, chain: SUI_LOCALNET_CHAIN, localnetUrl: undefined }),
      { wrapper: createWrapper(queryClient) },
    )

    // Query should be disabled — never fetching
    expect(result.current.isFetching).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(mockGetBalance).not.toHaveBeenCalled()
    unmount()
    queryClient.clear()
  })

  it('stays idle when address is missing', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result, unmount } = renderHook(
      () =>
        useBalance({
          user: null,
          chain: SUI_LOCALNET_CHAIN,
          localnetUrl: 'http://localhost:9000',
        }),
      { wrapper: createWrapper(queryClient) },
    )

    expect(result.current.isFetching).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(mockGetBalance).not.toHaveBeenCalled()
    unmount()
    queryClient.clear()
  })
})
