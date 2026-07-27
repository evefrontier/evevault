import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockBuildBytes } = vi.hoisted(() => ({
  mockBuildBytes: vi.fn(),
}))

vi.mock('#/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  formatMistToSui: (mist: string | bigint) => `sui-${mist}`,
  toSmallestUnit: (amount: string, _decimals: number) => BigInt(amount),
}))

vi.mock('#/wallet/hooks/useSendToken.transaction', () => ({
  buildTransferTransactionBytes: mockBuildBytes,
}))

import {
  parseGasUsedFromSimulation,
  useEstimatedGasFee,
} from '#/wallet/hooks/useSendToken.gas'

const txResult = (gasUsed: Record<string, string> | undefined) => ({
  $kind: 'Transaction',
  Transaction: { effects: { gasUsed } },
})

describe('parseGasUsedFromSimulation', () => {
  it('sums gas components for a successful Transaction', () => {
    // 1000 + 500 - 200 = 1300; nonRefundableStorageFee is already part of
    // storageRebate and must not be added again.
    expect(
      parseGasUsedFromSimulation(
        txResult({
          computationCost: '1000',
          storageCost: '500',
          storageRebate: '200',
          nonRefundableStorageFee: '50',
        }),
      ),
    ).toBe('1300')
  })

  it('reads gas from a FailedTransaction result', () => {
    expect(
      parseGasUsedFromSimulation({
        $kind: 'FailedTransaction',
        FailedTransaction: { effects: { gasUsed: { computationCost: '700' } } },
      }),
    ).toBe('700')
  })

  it('defaults missing gas components to zero', () => {
    // only storageCost present → 300
    expect(parseGasUsedFromSimulation(txResult({ storageCost: '300' }))).toBe(
      '300',
    )
  })

  it('returns null for an unknown result kind', () => {
    expect(parseGasUsedFromSimulation({ $kind: 'Other' })).toBeNull()
    expect(parseGasUsedFromSimulation(null)).toBeNull()
  })

  it('returns null when there is no gasUsed', () => {
    expect(parseGasUsedFromSimulation(txResult(undefined))).toBeNull()
  })

  it('returns null when the total gas is zero or negative', () => {
    // rebate cancels out the cost → 0
    expect(
      parseGasUsedFromSimulation(
        txResult({ computationCost: '100', storageRebate: '100' }),
      ),
    ).toBeNull()
  })

  it('returns null when a gas component is not a valid bigint (throws)', () => {
    expect(
      parseGasUsedFromSimulation(txResult({ computationCost: 'not-a-number' })),
    ).toBeNull()
  })
})

describe('useEstimatedGasFee', () => {
  const baseParams = {
    suiClient: {
      simulateTransaction: vi.fn(),
    } as never,
    getSenderAddress: vi.fn(),
    amount: '1',
    decimals: 9,
    recipientAddress: '0xrecipient',
    coinType: '0x2::sui::SUI',
  }

  beforeEach(() => {
    mockBuildBytes.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('resets state and does not estimate when the form is invalid', async () => {
    const { result } = renderHook(() =>
      useEstimatedGasFee({ ...baseParams, formValidForEstimate: false }),
    )

    // The reset is synchronous in the effect; the debounce never schedules work.
    expect(result.current.estimatedGasFee).toBeNull()
    expect(result.current.estimatedGasFeeLoading).toBe(false)
    expect(baseParams.getSenderAddress).not.toHaveBeenCalled()
  })

  it('estimates and formats the fee after the debounce window', async () => {
    const getSenderAddress = vi.fn().mockResolvedValue('0xsender')
    const simulateTransaction = vi
      .fn()
      .mockResolvedValue(txResult({ computationCost: '2000' }))

    const { result } = renderHook(() =>
      useEstimatedGasFee({
        ...baseParams,
        getSenderAddress,
        suiClient: { simulateTransaction } as never,
        formValidForEstimate: true,
      }),
    )

    await waitFor(
      () => {
        expect(result.current.estimatedGasFee).toBe('sui-2000')
      },
      { timeout: 2000 },
    )
    expect(result.current.estimatedGasFeeLoading).toBe(false)
    expect(simulateTransaction).toHaveBeenCalledOnce()
  })

  it('yields a null fee when the sender address cannot be resolved', async () => {
    const getSenderAddress = vi.fn().mockResolvedValue(null)

    const { result } = renderHook(() =>
      useEstimatedGasFee({
        ...baseParams,
        getSenderAddress,
        formValidForEstimate: true,
      }),
    )

    await waitFor(() => expect(getSenderAddress).toHaveBeenCalled(), {
      timeout: 2000,
    })
    await waitFor(() =>
      expect(result.current.estimatedGasFeeLoading).toBe(false),
    )
    expect(result.current.estimatedGasFee).toBeNull()
    expect(mockBuildBytes).not.toHaveBeenCalled()
  })

  it('falls back to a null fee when estimation throws', async () => {
    const getSenderAddress = vi.fn().mockResolvedValue('0xsender')
    const simulateTransaction = vi.fn().mockRejectedValue(new Error('rpc down'))

    const { result } = renderHook(() =>
      useEstimatedGasFee({
        ...baseParams,
        getSenderAddress,
        suiClient: { simulateTransaction } as never,
        formValidForEstimate: true,
      }),
    )

    await waitFor(() => expect(simulateTransaction).toHaveBeenCalled(), {
      timeout: 2000,
    })
    await waitFor(() =>
      expect(result.current.estimatedGasFeeLoading).toBe(false),
    )
    expect(result.current.estimatedGasFee).toBeNull()
  })
})
