import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactionSimulation } from '@/features/wallet/hooks/useTransactionSimulation'

const {
  mockBuildTransactionBytes,
  mockSimulateTransactionOutcome,
  mockClassifyBuildFailure,
  mockCreateSuiGraphQLClient,
  mockCoinMetadataResolve,
  mockCreateGraphQLCoinMetadataResolver,
} = vi.hoisted(() => {
  const mockCoinMetadataResolve = vi.fn()
  return {
    mockBuildTransactionBytes: vi.fn(),
    mockSimulateTransactionOutcome: vi.fn(),
    mockClassifyBuildFailure: vi.fn(),
    mockCreateSuiGraphQLClient: vi.fn(() => ({})),
    mockCoinMetadataResolve,
    mockCreateGraphQLCoinMetadataResolver: vi.fn(() => ({
      resolve: mockCoinMetadataResolve,
    })),
  }
})

vi.mock('@evefrontier/wallet-core/crypto', () => ({
  buildTransactionBytes: mockBuildTransactionBytes,
}))

vi.mock('@mysten/sui/transactions', () => ({
  Transaction: { from: vi.fn((payload: string) => ({ payload })) },
}))

vi.mock('@evevault/shared/sui', () => ({
  createSuiGraphQLClient: mockCreateSuiGraphQLClient,
}))

vi.mock('@evevault/shared/wallet', () => ({
  simulateTransactionOutcome: mockSimulateTransactionOutcome,
  classifyBuildFailure: mockClassifyBuildFailure,
  createGraphQLCoinMetadataResolver: mockCreateGraphQLCoinMetadataResolver,
}))

vi.mock('@evevault/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evevault/shared/utils')>()
  return {
    ...actual,
    createLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  }
})

const SUCCESS_SIMULATION = {
  status: 'success' as const,
  digest: 'd1',
  gas: { computation: '0', storage: '0', rebate: '0', net: '0' },
  balanceChanges: [],
  changedObjects: [],
  events: [],
}

const FAILURE_SIMULATION = {
  status: 'failure' as const,
  error: 'MoveAbort',
  digest: 'd2',
  gas: { computation: '0', storage: '0', rebate: '0', net: '0' },
  balanceChanges: [],
  changedObjects: [],
  events: [],
}

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    payload: 'base64tx',
    mode: 'build' as const,
    suiClient: {} as never,
    chain: 'sui:testnet' as never,
    getSenderAddress: vi.fn(() => Promise.resolve('0xabc')),
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mockCreateSuiGraphQLClient.mockReturnValue({})
  mockCreateGraphQLCoinMetadataResolver.mockReturnValue({
    resolve: mockCoinMetadataResolve,
  })
})

describe('useTransactionSimulation', () => {
  it('resolves to a ready/success state on a normal simulation', async () => {
    mockBuildTransactionBytes.mockResolvedValue(new Uint8Array([1]))
    mockSimulateTransactionOutcome.mockResolvedValue(SUCCESS_SIMULATION)

    const { result } = renderHook((p) => useTransactionSimulation(p), {
      initialProps: makeParams(),
    })

    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'ready',
        simulation: SUCCESS_SIMULATION,
      }),
    )
  })

  it('resolves to a ready/failure state when the real simulate call predicts failure', async () => {
    mockBuildTransactionBytes.mockResolvedValue(new Uint8Array([1]))
    mockSimulateTransactionOutcome.mockResolvedValue(FAILURE_SIMULATION)

    const { result } = renderHook((p) => useTransactionSimulation(p), {
      initialProps: makeParams(),
    })

    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'ready',
        simulation: FAILURE_SIMULATION,
      }),
    )
    expect(mockClassifyBuildFailure).not.toHaveBeenCalled()
  })

  it('reclassifies a build-time SimulationError as a predicted failure', async () => {
    const buildError = new Error(
      'Transaction resolution failed: InsufficientCoinBalance',
    )
    mockBuildTransactionBytes.mockRejectedValue(buildError)
    mockClassifyBuildFailure.mockReturnValue(FAILURE_SIMULATION)

    const { result } = renderHook((p) => useTransactionSimulation(p), {
      initialProps: makeParams(),
    })

    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'ready',
        simulation: FAILURE_SIMULATION,
      }),
    )
    expect(mockClassifyBuildFailure).toHaveBeenCalledWith(buildError)
    expect(mockSimulateTransactionOutcome).not.toHaveBeenCalled()
  })

  it('reclassifies an insufficient-gas-coins error as a predicted failure', async () => {
    const gasError = new Error('No valid gas coins found for the transaction.')
    mockBuildTransactionBytes.mockRejectedValue(gasError)
    mockClassifyBuildFailure.mockReturnValue(FAILURE_SIMULATION)

    const { result } = renderHook((p) => useTransactionSimulation(p), {
      initialProps: makeParams(),
    })

    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'ready',
        simulation: FAILURE_SIMULATION,
      }),
    )
  })

  it('falls back to unavailable for an unrecognized error', async () => {
    const networkError = new Error('network timeout')
    mockBuildTransactionBytes.mockRejectedValue(networkError)
    mockClassifyBuildFailure.mockReturnValue(null)

    const { result } = renderHook((p) => useTransactionSimulation(p), {
      initialProps: makeParams(),
    })

    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'unavailable',
        reason: 'network timeout',
      }),
    )
  })

  it('delegates resolveCoinMetadata to the per-network cached resolver', async () => {
    mockBuildTransactionBytes.mockResolvedValue(new Uint8Array([1]))
    mockSimulateTransactionOutcome.mockResolvedValue(SUCCESS_SIMULATION)

    const { result } = renderHook((p) => useTransactionSimulation(p), {
      initialProps: makeParams(),
    })

    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'ready',
        simulation: SUCCESS_SIMULATION,
      }),
    )

    // Resolver built once from the network's GraphQL client.
    expect(mockCreateGraphQLCoinMetadataResolver).toHaveBeenCalledTimes(1)

    const { resolveCoinMetadata } =
      mockSimulateTransactionOutcome.mock.calls[0][0]

    const metadata = {
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
      description: 'USD Coin',
      iconUrl: 'https://x',
    }
    mockCoinMetadataResolve.mockResolvedValueOnce(metadata)
    expect(await resolveCoinMetadata('0x2::usdc::USDC')).toBe(metadata)
    expect(mockCoinMetadataResolve).toHaveBeenCalledWith('0x2::usdc::USDC')

    mockCoinMetadataResolve.mockResolvedValueOnce(null)
    expect(await resolveCoinMetadata('0x2::unknown::UNKNOWN')).toBeNull()
  })

  it('reports unavailable, not a misclassified failure, when no sender address resolves', async () => {
    mockClassifyBuildFailure.mockReturnValue(null)

    const { result } = renderHook((p) => useTransactionSimulation(p), {
      initialProps: makeParams({
        getSenderAddress: vi.fn(() => Promise.resolve(null)),
        fallbackSender: undefined,
      }),
    })

    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'unavailable',
        reason: 'No sender address available',
      }),
    )
    expect(mockBuildTransactionBytes).not.toHaveBeenCalled()
  })
})
