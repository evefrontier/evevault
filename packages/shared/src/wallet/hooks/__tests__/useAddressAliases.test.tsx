import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSigningContext = vi.fn()
const mockQuery = vi.fn()
const mockExecuteAddressAliasTx = vi.fn()
const mockRefetch = vi.fn().mockResolvedValue(undefined)

vi.mock('#/wallet/hooks/useWalletSigningContext', () => ({
  useWalletSigningContext: () => mockSigningContext(),
}))
vi.mock('#/wallet/hooks/useAddressAliases.query', () => ({
  useAddressAliasesQuery: () => mockQuery(),
}))
vi.mock('#/components', () => ({
  useToast: () => ({ showToast: vi.fn(), showErrorToast: vi.fn() }),
}))
vi.mock('@evefrontier/wallet-core/address-alias', async (importActual) => {
  const actual =
    await importActual<
      typeof import('@evefrontier/wallet-core/address-alias')
    >()
  return {
    ...actual,
    executeAddressAliasTx: (args: unknown) => mockExecuteAddressAliasTx(args),
    enableAddressAliasTxBytes: vi.fn(),
    addAddressAliasTxBytes: vi.fn(),
    removeAddressAliasTxBytes: vi.fn(),
  }
})

import { useAddressAliases } from '#/wallet/hooks/useAddressAliases'

const OWNER = `0x${'a'.repeat(64)}`
const ALIAS_A = `0x${'b'.repeat(64)}`
const ALIAS_B = `0x${'c'.repeat(64)}`
const REMOVE_ERROR =
  'You can’t remove your last recovery alias. Add another personal access key before removing this one.'

function setContext(chain = 'sui:devnet') {
  mockSigningContext.mockReturnValue({
    chain,
    isAuthenticated: true,
    isWalletUnlocked: true,
    senderAddress: OWNER,
    suiClient: {
      core: { waitForTransaction: vi.fn().mockResolvedValue(undefined) },
    },
    sign: vi.fn().mockResolvedValue({ bytes: 'b', signature: 's' }),
  })
}

function setAliases(addressAliases: string[]) {
  mockQuery.mockReturnValue({
    data: { enabled: true, objectId: '0xobj', addressAliases },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  })
}

beforeEach(() => {
  vi.unstubAllEnvs()
  mockExecuteAddressAliasTx.mockReset().mockResolvedValue('0xdigest')
  mockRefetch.mockClear()
  setContext()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('useAddressAliases remove guard', () => {
  it('blocks removing the only non-self alias (owner not registered)', async () => {
    setAliases([ALIAS_A])
    const { result } = renderHook(() => useAddressAliases())

    let removed: boolean | undefined
    await act(async () => {
      removed = await result.current.removeAddressAlias(ALIAS_A)
    })

    expect(removed).toBe(false)
    expect(mockExecuteAddressAliasTx).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.error).toBe(REMOVE_ERROR))
  })

  it('blocks removing the last non-self alias when only the self-alias remains', async () => {
    setAliases([OWNER, ALIAS_A])
    const { result } = renderHook(() => useAddressAliases())

    let removed: boolean | undefined
    await act(async () => {
      removed = await result.current.removeAddressAlias(ALIAS_A)
    })

    expect(removed).toBe(false)
    expect(mockExecuteAddressAliasTx).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.error).toBe(REMOVE_ERROR))
  })

  it('allows removal when another non-self alias remains', async () => {
    setAliases([OWNER, ALIAS_A, ALIAS_B])
    const { result } = renderHook(() => useAddressAliases())

    let removed: boolean | undefined
    await act(async () => {
      removed = await result.current.removeAddressAlias(ALIAS_A)
    })

    expect(removed).toBe(true)
    expect(mockExecuteAddressAliasTx).toHaveBeenCalledTimes(1)
  })

  it('does not guard when enforcement feature is off', async () => {
    vi.stubEnv('VITE_ADDRESS_ALIAS_ENFORCEMENT', 'false')
    setAliases([OWNER, ALIAS_A])
    const { result } = renderHook(() => useAddressAliases())

    let removed: boolean | undefined
    await act(async () => {
      removed = await result.current.removeAddressAlias(ALIAS_A)
    })

    expect(removed).toBe(true)
    expect(mockExecuteAddressAliasTx).toHaveBeenCalledTimes(1)
  })

  it('does not guard on localnet', async () => {
    setContext('sui:localnet')
    setAliases([OWNER, ALIAS_A])
    const { result } = renderHook(() => useAddressAliases())

    let removed: boolean | undefined
    await act(async () => {
      removed = await result.current.removeAddressAlias(ALIAS_A)
    })

    expect(removed).toBe(true)
    expect(mockExecuteAddressAliasTx).toHaveBeenCalledTimes(1)
  })

  it('matches the removal target regardless of address form', async () => {
    setAliases([OWNER, ALIAS_A])
    const { result } = renderHook(() => useAddressAliases())

    let removed: boolean | undefined
    await act(async () => {
      removed = await result.current.removeAddressAlias(`0x${'B'.repeat(64)}`)
    })

    expect(removed).toBe(false)
    expect(mockExecuteAddressAliasTx).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.error).toBe(REMOVE_ERROR))
  })
})
