import { SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_EPOCH_DURATION_MS } from '#/utils/constants'

const mockGetCurrentSystemState = vi.fn()
const mockCreateSuiClient = vi.fn((..._args: unknown[]) => ({
  core: {
    getCurrentSystemState: mockGetCurrentSystemState,
  },
}))

vi.mock('#/sui/suiClient', () => ({
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

import { getCurrentEpochFromRpc } from '#/sui/rpcEpoch'

describe('getCurrentEpochFromRpc', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a localnet SUI client with the provided URL', async () => {
    mockGetCurrentSystemState.mockResolvedValue({
      systemState: {
        epoch: '3',
        epochStartTimestampMs: '1000',
        parameters: { epochDurationMs: String(DEFAULT_EPOCH_DURATION_MS) },
      },
    })

    await getCurrentEpochFromRpc('http://127.0.0.1:9000')

    expect(mockCreateSuiClient).toHaveBeenCalledWith(
      SUI_LOCALNET_CHAIN,
      'http://127.0.0.1:9000',
    )
  })

  it('derives numericMaxEpoch and maxEpochTimestampMs from system state', async () => {
    mockGetCurrentSystemState.mockResolvedValue({
      systemState: {
        epoch: '11',
        epochStartTimestampMs: '5000',
        parameters: { epochDurationMs: '60000' },
      },
    })

    await expect(
      getCurrentEpochFromRpc('http://127.0.0.1:9000'),
    ).resolves.toEqual({
      numericMaxEpoch: 11,
      maxEpochTimestampMs: 5000 + 60000,
    })
  })

  it('throws when system state returns non-numeric epoch fields', async () => {
    mockGetCurrentSystemState.mockResolvedValue({
      systemState: {
        epoch: 'not-a-number',
        epochStartTimestampMs: '5000',
        parameters: { epochDurationMs: '60000' },
      },
    })

    await expect(
      getCurrentEpochFromRpc('http://127.0.0.1:9000'),
    ).rejects.toThrow(/non-numeric epoch fields/)
  })

  it('propagates gRPC errors to the caller', async () => {
    const error = new Error('grpc unavailable')
    mockGetCurrentSystemState.mockRejectedValue(error)

    await expect(getCurrentEpochFromRpc('http://127.0.0.1:9000')).rejects.toBe(
      error,
    )
  })
})
