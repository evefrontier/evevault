import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSigningContext = vi.fn()
const mockGetAddressAliases = vi.fn()
const mockExecuteAddressAliasTx = vi.fn()
const mockWaitForTransaction = vi.fn()

vi.mock('#/wallet/hooks/useWalletSigningContext', () => ({
  useWalletSigningContext: () => mockSigningContext(),
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
    getAddressAliases: (client: unknown, owner: unknown) =>
      mockGetAddressAliases(client, owner),
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
    suiClient: { core: { waitForTransaction: mockWaitForTransaction } },
    sign: vi.fn().mockResolvedValue({ bytes: 'b', signature: 's' }),
  })
}

// The chain read keeps returning this list after writes, like a lagging
// owned-object index.
function setAliases(addressAliases: string[]) {
  mockGetAddressAliases.mockResolvedValue({
    enabled: true,
    objectId: '0xobj',
    addressAliases,
  })
}

async function renderAliases() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const rendered = renderHook(() => useAddressAliases(), { wrapper })
  await waitFor(() => expect(rendered.result.current.isReading).toBe(false))
  return rendered
}

beforeEach(() => {
  vi.unstubAllEnvs()
  mockExecuteAddressAliasTx.mockReset().mockResolvedValue('0xdigest')
  mockWaitForTransaction.mockReset().mockResolvedValue({
    $kind: 'Transaction',
    Transaction: {},
  })
  setContext()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('useAddressAliases remove guard', () => {
  it('blocks removing the only non-self alias (owner not registered)', async () => {
    setAliases([ALIAS_A])
    const { result } = await renderAliases()

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
    const { result } = await renderAliases()

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
    const { result } = await renderAliases()

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
    const { result } = await renderAliases()

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
    const { result } = await renderAliases()

    let removed: boolean | undefined
    await act(async () => {
      removed = await result.current.removeAddressAlias(ALIAS_A)
    })

    expect(removed).toBe(true)
    expect(mockExecuteAddressAliasTx).toHaveBeenCalledTimes(1)
  })

  it('matches the removal target regardless of address form', async () => {
    setAliases([OWNER, ALIAS_A])
    const { result } = await renderAliases()

    let removed: boolean | undefined
    await act(async () => {
      removed = await result.current.removeAddressAlias(`0x${'B'.repeat(64)}`)
    })

    expect(removed).toBe(false)
    expect(mockExecuteAddressAliasTx).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.error).toBe(REMOVE_ERROR))
  })
})

describe('useAddressAliases cache updates', () => {
  it('shows an added alias while the chain read is still stale', async () => {
    setAliases([OWNER])
    const { result } = await renderAliases()

    await act(async () => {
      await result.current.addAddressAlias(` ${ALIAS_A} `)
    })

    expect(result.current.addressAliases).toEqual([OWNER, ALIAS_A])
  })

  it('drops a removed alias while the chain read is still stale', async () => {
    setAliases([OWNER, ALIAS_A, ALIAS_B])
    const { result } = await renderAliases()

    await act(async () => {
      await result.current.removeAddressAlias(`0x${'B'.repeat(64)}`)
    })

    expect(result.current.addressAliases).toEqual([OWNER, ALIAS_B])
  })

  it('rejects re-adding an alias it just added without executing', async () => {
    setAliases([OWNER])
    const { result } = await renderAliases()
    await act(async () => {
      await result.current.addAddressAlias(ALIAS_A)
    })

    let added: boolean | undefined
    await act(async () => {
      added = await result.current.addAddressAlias(ALIAS_A)
    })

    expect(added).toBe(false)
    expect(mockExecuteAddressAliasTx).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(result.current.error).toBe('Address is already an address alias'),
    )
  })

  it('marks aliasing enabled from the created object in the effects', async () => {
    mockGetAddressAliases.mockResolvedValue({
      enabled: false,
      addressAliases: [],
    })
    mockWaitForTransaction.mockResolvedValue({
      $kind: 'Transaction',
      Transaction: {
        effects: {
          changedObjects: [
            { objectId: '0xgas', idOperation: 'None' },
            { objectId: '0xnew', idOperation: 'Created' },
          ],
        },
        objectTypes: {
          '0xgas': '0x2::coin::Coin<0x2::sui::SUI>',
          '0xnew': '0x2::address_alias::AddressAliases',
        },
      },
    })
    const { result } = await renderAliases()

    await act(async () => {
      await result.current.enable()
    })

    expect(result.current.enabled).toBe(true)
    expect(result.current.addressAliases).toEqual([OWNER])
    await act(async () => {
      await result.current.addAddressAlias(ALIAS_A)
    })
    expect(mockExecuteAddressAliasTx).toHaveBeenCalledTimes(2)
  })
})
