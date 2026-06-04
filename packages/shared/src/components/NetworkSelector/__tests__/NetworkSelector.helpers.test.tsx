import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from '@mysten/wallet-standard'
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkSelector } from '../NetworkSelector'
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

const mockContext = vi.hoisted(() => ({
  forceSetChain: vi.fn(),
  loading: false,
  setChain: vi.fn(async () => ({ success: true })),
  devMode: false,
}))

vi.mock('#/utils', () => ({
  createLogger: () => mockUtils.logger,
  isExtension: mockUtils.isExtension,
}))

vi.mock('#/hooks', () => ({
  useContext: () => mockContext,
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
    mockContext.loading = false
    mockContext.devMode = false
    mockContext.setChain.mockResolvedValue({ success: true })
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

describe('NetworkSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUtils.isExtension.mockReturnValue(false)
    mockContext.loading = false
    mockContext.devMode = false
    mockContext.setChain.mockResolvedValue({ success: true })
  })

  it('opens the full menu and switches to a selected network', async () => {
    render(<NetworkSelector chain={SUI_TESTNET_CHAIN} />)

    expect(screen.getByText('NETWORK')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: /network sui:testnet/i }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Devnet' }))

    await waitFor(() => {
      expect(mockContext.setChain).toHaveBeenCalledWith(SUI_DEVNET_CHAIN)
    })
    expect(
      screen.queryByRole('button', { name: 'Devnet' }),
    ).not.toBeInTheDocument()
  })

  it('renders the compact extension menu with localnet and runs its callback', async () => {
    const onLocalnetSelected = vi.fn()
    mockUtils.isExtension.mockReturnValue(true)
    mockContext.devMode = true

    const { container } = render(
      <NetworkSelector
        chain={SUI_TESTNET_CHAIN}
        compact
        onLocalnetSelected={onLocalnetSelected}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'TEST' }))

    expect(
      container.querySelector('.dropdown--placement-top'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Localnet' }))

    await waitFor(() => {
      expect(mockContext.setChain).toHaveBeenCalledWith(SUI_LOCALNET_CHAIN)
    })
    expect(onLocalnetSelected).toHaveBeenCalledTimes(1)
  })

  it('does not open while the context is loading', () => {
    mockContext.loading = true

    render(<NetworkSelector chain={SUI_TESTNET_CHAIN} />)

    fireEvent.click(
      screen.getByRole('button', { name: /network sui:testnet/i }),
    )

    expect(
      screen.queryByRole('button', { name: 'Devnet' }),
    ).not.toBeInTheDocument()
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
