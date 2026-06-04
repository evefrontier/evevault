import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from '@mysten/wallet-standard'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useAvailableNetworks,
  useNetworkSelection,
  useValidNetwork,
} from '../NetworkSelector.helpers'

const mockUtils = vi.hoisted(() => ({
  isExtension: vi.fn(() => false),
  logger: {
    error: vi.fn(),
  },
}))

vi.mock('#/utils', () => ({
  createLogger: () => mockUtils.logger,
  isExtension: mockUtils.isExtension,
}))

type NetworkSelectionParams = Parameters<typeof useNetworkSelection>[0]

function createNetworkSelectionParams(
  overrides: Partial<NetworkSelectionParams> = {},
): NetworkSelectionParams {
  return {
    chain: SUI_TESTNET_CHAIN,
    isExtensionContext: false,
    onLocalnetSelected: vi.fn(),
    onNetworkSwitchStart: vi.fn(),
    onRequiresReauth: vi.fn(),
    setChain: vi.fn(async () => ({ success: true })),
    setIsOpen: vi.fn(),
    setIsProcessing: vi.fn(),
    ...overrides,
  }
}

describe('useAvailableNetworks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUtils.isExtension.mockReturnValue(false)
  })

  it('includes localnet only when dev mode is enabled in an extension context', () => {
    mockUtils.isExtension.mockReturnValue(true)

    const { result } = renderHook(() => useAvailableNetworks(true))

    expect(result.current.isExtensionContext).toBe(true)
    expect(
      result.current.availableNetworks.some(
        (network) => network.chain === SUI_LOCALNET_CHAIN,
      ),
    ).toBe(true)
  })

  it('omits localnet outside extension context', () => {
    const { result } = renderHook(() => useAvailableNetworks(true))

    expect(result.current.isExtensionContext).toBe(false)
    expect(
      result.current.availableNetworks.some(
        (network) => network.chain === SUI_LOCALNET_CHAIN,
      ),
    ).toBe(false)
  })
})

describe('useValidNetwork', () => {
  it('forces the first available network when the current chain is invalid', () => {
    const forceSetChain = vi.fn()
    const availableNetworks = [
      { chain: SUI_TESTNET_CHAIN, label: 'Testnet', shortLabel: 'TEST' },
      { chain: SUI_DEVNET_CHAIN, label: 'Devnet', shortLabel: 'DEV' },
    ]

    renderHook(() =>
      useValidNetwork({
        availableNetworks,
        chain: SUI_LOCALNET_CHAIN,
        forceSetChain,
      }),
    )

    expect(forceSetChain).toHaveBeenCalledWith(SUI_TESTNET_CHAIN)
  })

  it('leaves a valid current chain unchanged', () => {
    const forceSetChain = vi.fn()
    const availableNetworks = [
      { chain: SUI_TESTNET_CHAIN, label: 'Testnet', shortLabel: 'TEST' },
    ]

    renderHook(() =>
      useValidNetwork({
        availableNetworks,
        chain: SUI_TESTNET_CHAIN,
        forceSetChain,
      }),
    )

    expect(forceSetChain).not.toHaveBeenCalled()
  })
})

describe('useNetworkSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('closes the menu without switching when selecting the active chain', async () => {
    const params = createNetworkSelectionParams()
    const { result } = renderHook(() => useNetworkSelection(params))

    await act(async () => {
      await result.current(SUI_TESTNET_CHAIN)
    })

    expect(params.setIsOpen).toHaveBeenCalledWith(false)
    expect(params.setChain).not.toHaveBeenCalled()
    expect(params.setIsProcessing).not.toHaveBeenCalled()
  })

  it('switches networks without firing reauth callbacks on a normal success', async () => {
    const params = createNetworkSelectionParams()
    const { result } = renderHook(() => useNetworkSelection(params))

    await act(async () => {
      await result.current(SUI_DEVNET_CHAIN)
    })

    expect(params.setIsOpen).toHaveBeenCalledWith(false)
    expect(params.setIsProcessing).toHaveBeenNthCalledWith(1, true)
    expect(params.setIsProcessing).toHaveBeenNthCalledWith(2, false)
    expect(params.setChain).toHaveBeenCalledWith(SUI_DEVNET_CHAIN)
    expect(params.onNetworkSwitchStart).not.toHaveBeenCalled()
    expect(params.onRequiresReauth).not.toHaveBeenCalled()
    expect(params.onLocalnetSelected).not.toHaveBeenCalled()
  })

  it('notifies reauth callbacks when the switch requires authentication', async () => {
    const params = createNetworkSelectionParams({
      setChain: vi.fn(async () => ({ requiresReauth: true, success: true })),
    })
    const { result } = renderHook(() => useNetworkSelection(params))

    await act(async () => {
      await result.current(SUI_DEVNET_CHAIN)
    })

    expect(params.onNetworkSwitchStart).toHaveBeenCalledWith(
      SUI_TESTNET_CHAIN,
      SUI_DEVNET_CHAIN,
    )
    expect(params.onRequiresReauth).toHaveBeenCalledWith(SUI_DEVNET_CHAIN)
    expect(params.onLocalnetSelected).not.toHaveBeenCalled()
  })

  it('runs the extension localnet callback after a successful localnet switch', async () => {
    const params = createNetworkSelectionParams({
      isExtensionContext: true,
    })
    const { result } = renderHook(() => useNetworkSelection(params))

    await act(async () => {
      await result.current(SUI_LOCALNET_CHAIN)
    })

    expect(params.onLocalnetSelected).toHaveBeenCalledTimes(1)
  })

  it('logs failed switch results', async () => {
    const params = createNetworkSelectionParams({
      setChain: vi.fn(async () => ({ success: false })),
    })
    const { result } = renderHook(() => useNetworkSelection(params))

    await act(async () => {
      await result.current(SUI_DEVNET_CHAIN)
    })

    expect(mockUtils.logger.error).toHaveBeenCalledWith(
      'Failed to switch network',
    )
  })
})
