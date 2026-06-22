import { SUI_DEVNET_CHAIN } from '@mysten/wallet-standard'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before imports
// Using workspace aliases in test files due to Vite resolution limitations with relative imports
vi.mock('#/auth', () => ({
  useAuth: vi.fn(),
  getUserForNetwork: vi.fn(),
}))

vi.mock('#/hooks', () => ({
  useDevice: vi.fn(),
}))

vi.mock('#/hooks/useDevice', () => ({
  useDevice: vi.fn(),
}))

vi.mock('#/stores/contextStore', () => ({
  useContextStore: vi.fn(),
}))

vi.mock('#/sui', () => ({
  createSuiClient: vi.fn(),
}))

vi.mock('#/utils', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  toSmallestUnit: vi.fn((amount: string, decimals: number) => {
    if (!amount || amount === '.') return 0n
    const [whole = '0', fraction = ''] = amount.split('.')
    if (fraction.length > decimals) {
      throw new Error(`Amount has too many decimal places.`)
    }
    const paddedFraction = fraction.padEnd(decimals, '0')
    const combined =
      (whole === '0' || whole === '' ? '' : whole) + paddedFraction
    return BigInt(combined === '' ? '0' : combined)
  }),
  SUI_COIN_TYPE: '0x2::sui::SUI',
  GAS_FEE_WARNING_MESSAGE:
    'This transfer will incur a network fee (gas) paid in SUI.',
  formatMistToSui: vi.fn((mist: string | bigint) => {
    const s = typeof mist === 'bigint' ? mist.toString() : mist
    const n = Number(BigInt(s) / 10n ** 9n)
    return n.toFixed(9).replace(/0+$/, '').replace(/\.$/, '') || '0'
  }),
}))

vi.mock('#/wallet/hooks/useBalance', () => ({
  useBalance: vi.fn(),
}))

vi.mock('#/wallet/zkSignAny', () => ({
  zkSignAny: vi.fn(),
}))

vi.mock('#/wallet/hooks/useWalletSigningContext', () => ({
  useWalletSigningContext: vi.fn(),
}))

vi.mock('@mysten/sui/transactions', () => {
  const mockCoin = {}
  return {
    Transaction: class MockTransaction {
      setSender = vi.fn().mockReturnThis()
      splitCoins = vi.fn().mockReturnValue([mockCoin])
      transferObjects = vi.fn().mockReturnThis()
      get gas() {
        return {}
      }
      build = vi.fn().mockResolvedValue(new Uint8Array(64))
    },
  }
})

import { getEveCoinType } from '@evefrontier/wallet-core/eve-token'
import { TenantId } from '@evefrontier/wallet-core/tenant'
// Import after mocks
// Using workspace aliases in test files due to Vite resolution limitations with relative imports
import { getUserForNetwork, useAuth } from '#/auth'
import { useDevice } from '#/hooks/useDevice'
import { useContextStore } from '#/stores/contextStore'
import { createSuiClient } from '#/sui'
import { createMockUser } from '#/testing'
import { useBalance } from '#/wallet/hooks/useBalance'
import { useSendToken } from '#/wallet/hooks/useSendToken'
import { useWalletSigningContext } from '#/wallet/hooks/useWalletSigningContext'
import type { UseBalanceParams } from '#/wallet/types/hooks'
import { zkSignAny } from '#/wallet/zkSignAny'

const mockUseAuth = vi.mocked(useAuth)
const mockGetUserForNetwork = vi.mocked(getUserForNetwork)
const mockZkSignAny = vi.mocked(zkSignAny)
const mockUseDevice = vi.mocked(useDevice)
const mockUsecontextStore = vi.mocked(useContextStore)
const mockUseBalance = vi.mocked(useBalance)
const mockCreateSuiClient = vi.mocked(createSuiClient)
const mockUseWalletSigningContext = vi.mocked(useWalletSigningContext)

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useSendToken', () => {
  const VALID_SUI_ADDRESS =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const mockUser = createMockUser({ suiAddress: VALID_SUI_ADDRESS })

  beforeEach(() => {
    mockGetUserForNetwork.mockResolvedValue(mockUser)

    // Default mock implementations
    mockUseAuth.mockReturnValue({
      user: mockUser,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    } as any)

    mockUseDevice.mockReturnValue({
      ephemeralPublicKey: { toRawBytes: () => new Uint8Array(32) },
      getZkProof: vi.fn(),
      maxEpoch: '100',
      isLocked: false,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    } as any)

    mockUsecontextStore.mockReturnValue({
      chain: SUI_DEVNET_CHAIN,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    } as any)

    mockUseBalance.mockReturnValue({
      data: {
        formattedBalance: '10',
        rawBalance: '10000000000',
        metadata: {
          symbol: 'SUI',
          name: 'Sui',
          decimals: 9,
        },
      },
      isLoading: false,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    } as any)

    const mockSuiClient = {
      listCoins: vi.fn().mockResolvedValue({ objects: [] }),
      simulateTransaction: vi.fn().mockResolvedValue({
        $kind: 'Transaction',
        Transaction: {
          effects: {
            gasUsed: {
              computationCost: '1000000',
              storageCost: '0',
              storageRebate: '0',
              nonRefundableStorageFee: '0',
            },
          },
        },
      }),
      core: {
        executeTransaction: vi.fn().mockResolvedValue({
          Transaction: { digest: 'mock-digest' },
        }),
        resolveTransactionPlugin: vi.fn(),
      },
    }

    mockCreateSuiClient.mockReturnValue({
      ...mockSuiClient,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    } as any)

    mockUseWalletSigningContext.mockReturnValue({
      chain: SUI_DEVNET_CHAIN,
      localnetUrl: undefined,
      isAuthenticated: true,
      isWalletUnlocked: true,
      senderAddress: VALID_SUI_ADDRESS,
      localnetAddress: null,
      networkUser: mockUser,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
      suiClient: mockSuiClient as any,
      getSenderAddress: vi.fn().mockResolvedValue(VALID_SUI_ADDRESS),
      sign: vi.fn().mockResolvedValue({
        bytes: 'mock-bytes',
        signature: 'mock-signature',
      }),
      mode: 'zklogin',
      isLocalnet: false,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('address validation', () => {
    it('validates correct Sui address format (0x + 64 hex chars)', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.isValidRecipient).toBe(true)
      queryClient.clear()
    })

    it('rejects address with invalid characters', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress:
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg', // Invalid character 'g'
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.isValidRecipient).toBe(false)
      queryClient.clear()
    })

    it('rejects address with wrong length', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: '0x1234', // Too short
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.isValidRecipient).toBe(false)
      queryClient.clear()
    })

    it('rejects empty address', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: '',
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.isValidRecipient).toBe(false)
      queryClient.clear()
    })
  })

  describe('amount validation', () => {
    it('validates amount within balance', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '5', // Have 10, sending 5
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.isValidAmount).toBe(true)
      queryClient.clear()
    })

    it('rejects amount exceeding balance', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '15', // Have 10, trying to send 15
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.isValidAmount).toBe(false)
      queryClient.clear()
    })

    it('rejects zero amount', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '0',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.isValidAmount).toBe(false)
      queryClient.clear()
    })

    it('rejects empty amount', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.isValidAmount).toBe(false)
      queryClient.clear()
    })
  })

  describe('canSend validation', () => {
    it('returns true when all conditions are met', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.canSend).toBe(true)
      expect(result.current.validationErrors).toHaveLength(0)
      queryClient.clear()
    })

    it('returns false when wallet is locked', () => {
      mockUseWalletSigningContext.mockReturnValue({
        ...mockUseWalletSigningContext.mock.results[0]?.value,
        isWalletUnlocked: false,
        // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
      } as any)

      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.canSend).toBe(false)
      expect(result.current.validationErrors).toContain('Wallet not ready')
      queryClient.clear()
    })

    it('returns false when not authenticated', () => {
      mockUseWalletSigningContext.mockReturnValue({
        ...mockUseWalletSigningContext.mock.results[0]?.value,
        isAuthenticated: false,
        networkUser: null,
        // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
      } as any)

      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.canSend).toBe(false)
      expect(result.current.validationErrors).toContain('Not authenticated')
      queryClient.clear()
    })

    it('returns false when no balance', () => {
      mockUseBalance.mockReturnValue({
        data: {
          formattedBalance: '0',
          rawBalance: '0',
          metadata: { symbol: 'SUI', name: 'Sui', decimals: 9 },
        },
        isLoading: false,
        // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
      } as any)

      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.canSend).toBe(false)
      expect(result.current.validationErrors).toContain('Insufficient balance')
      queryClient.clear()
    })

    it('returns false when no network selected', () => {
      mockUseWalletSigningContext.mockReturnValue({
        ...mockUseWalletSigningContext.mock.results[0]?.value,
        chain: null,
        // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
      } as any)

      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.canSend).toBe(false)
      expect(result.current.validationErrors).toContain('No network selected')
      queryClient.clear()
    })
  })

  describe('gas fee warning', () => {
    it('returns gasFeeWarning message for all transfers', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.gasFeeWarning).toBe(
        'This transfer will incur a network fee (gas) paid in SUI.',
      )
      queryClient.clear()
    })

    it('exposes estimatedGasFee and estimatedGasFeeLoading', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(typeof result.current.estimatedGasFeeLoading).toBe('boolean')
      expect(
        result.current.estimatedGasFee === null ||
          typeof result.current.estimatedGasFee === 'string',
      ).toBe(true)
      queryClient.clear()
    })
  })

  describe('balance info', () => {
    it('returns balance data from useBalance hook', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.currentBalance).toBe('10')
      expect(result.current.tokenSymbol).toBe('SUI')
      expect(result.current.tokenName).toBe('Sui')
      expect(result.current.decimals).toBe(9)
      queryClient.clear()
    })
  })

  describe('initial state', () => {
    it('starts with no loading, error, or txDigest', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.txDigest).toBeNull()
      queryClient.clear()
    })
  })

  describe('SUI for gas warning', () => {
    const SUI_COIN_TYPE = '0x2::sui::SUI'
    const EVE_COIN_TYPE = getEveCoinType(TenantId.STILLNESS)

    it('returns suiForGasWarning when sending non-SUI token and SUI balance is zero', () => {
      mockUseBalance.mockImplementation(
        (params: UseBalanceParams) =>
          ({
            data:
              params.coinType === SUI_COIN_TYPE
                ? { formattedBalance: '0', rawBalance: '0', metadata: null }
                : {
                    formattedBalance: '10',
                    rawBalance: '10000000000',
                    metadata: {
                      symbol: 'EVE',
                      name: 'EVE test token',
                      decimals: 9,
                    },
                  },
            isLoading: false,
            // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
          }) as any,
      )

      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: EVE_COIN_TYPE,
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.suiForGasWarning).toBe(
        'You have no SUI balance. SUI is required to pay for transaction fees.',
      )
      expect(result.current.showFaucetTestSui).toBe(true)
      expect(result.current.canSend).toBe(false)
      expect(result.current.validationErrors).toContain(
        'No SUI for gas (required for transaction fees)',
      )
      queryClient.clear()
    })

    it('returns null suiForGasWarning when sending SUI token', () => {
      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: SUI_COIN_TYPE,
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.suiForGasWarning).toBeNull()
      queryClient.clear()
    })

    it('returns showFaucetTestSui true when SUI balance is zero (sending SUI)', () => {
      mockUseBalance.mockImplementation(
        (params: UseBalanceParams) =>
          ({
            data:
              params.coinType === SUI_COIN_TYPE
                ? { formattedBalance: '0', rawBalance: '0', metadata: null }
                : {
                    formattedBalance: '10',
                    rawBalance: '10000000000',
                    metadata: { symbol: 'SUI', name: 'Sui', decimals: 9 },
                  },
            isLoading: false,
            // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
          }) as any,
      )

      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: SUI_COIN_TYPE,
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.showFaucetTestSui).toBe(true)
      queryClient.clear()
    })

    it('returns null suiForGasWarning when sending non-SUI token but SUI balance is non-zero', () => {
      mockUseBalance.mockImplementation(
        (params: UseBalanceParams) =>
          ({
            data:
              params.coinType === SUI_COIN_TYPE
                ? {
                    formattedBalance: '0.1',
                    rawBalance: '100000000',
                    metadata: { symbol: 'SUI', name: 'Sui', decimals: 9 },
                  }
                : {
                    formattedBalance: '10',
                    rawBalance: '10000000000',
                    metadata: {
                      symbol: 'EVE',
                      name: 'EVE test token',
                      decimals: 9,
                    },
                  },
            isLoading: false,
            // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
          }) as any,
      )

      const queryClient = new QueryClient()
      const { result } = renderHook(
        () =>
          useSendToken({
            coinType: EVE_COIN_TYPE,
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      expect(result.current.suiForGasWarning).toBeNull()
      queryClient.clear()
    })
  })

  describe('post-transfer refresh', () => {
    beforeEach(() => {
      // sign is already set up in the outer beforeEach via mockUseWalletSigningContext;
      // keep zkSignAny mock for any residual reference but useSendToken goes through sign()
      mockZkSignAny.mockResolvedValue({
        bytes: 'mock-bytes',
        zkSignature: 'mock-signature',
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('invalidates and refetches balance and transaction queries after successful send', async () => {
      vi.useFakeTimers()
      const queryClient = new QueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries')

      const { result, unmount } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      await act(async () => {
        await result.current.send()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.txDigest).toBe('mock-digest')

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['coin-balance'],
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['transactions'],
      })
      expect(invalidateSpy).toHaveBeenCalledTimes(2)

      expect(refetchSpy).toHaveBeenCalledWith({
        queryKey: ['coin-balance'],
        type: 'all',
      })
      expect(refetchSpy).toHaveBeenCalledWith({
        queryKey: ['transactions'],
        type: 'all',
      })
      expect(refetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2)

      unmount()
      vi.clearAllTimers()
      queryClient.clear()
      vi.useRealTimers()
    })

    it('schedules delayed refetch after successful send', async () => {
      vi.useFakeTimers()
      const queryClient = new QueryClient()
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries')

      const { result, unmount } = renderHook(
        () =>
          useSendToken({
            coinType: '0x2::sui::SUI',
            recipientAddress: VALID_SUI_ADDRESS,
            amount: '1',
          }),
        { wrapper: createWrapper(queryClient) },
      )

      await act(async () => {
        await result.current.send()
      })

      const callsAfterSend = refetchSpy.mock.calls.length
      expect(callsAfterSend).toBeGreaterThanOrEqual(2)

      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      expect(refetchSpy).toHaveBeenCalledTimes(callsAfterSend + 2)

      unmount()
      vi.clearAllTimers()
      queryClient.clear()
      vi.useRealTimers()
    })
  })
})
