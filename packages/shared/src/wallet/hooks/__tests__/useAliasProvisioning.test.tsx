import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSigningContext = vi.fn()
const mockGenerateAliasKey = vi.fn()
const mockRegisterAcknowledgedAlias = vi.fn()

vi.mock('#/wallet/hooks/useWalletSigningContext', () => ({
  useWalletSigningContext: () => mockSigningContext(),
}))
vi.mock('#/wallet/aliasEnforcement', () => ({
  isAliasEnforcementError: () => false,
}))
vi.mock('@evefrontier/wallet-core/address-alias', () => ({
  generateAliasKey: () => mockGenerateAliasKey(),
  registerAcknowledgedAlias: (args: unknown) =>
    mockRegisterAcknowledgedAlias(args),
}))

import { useAliasProvisioning } from '#/wallet/hooks/useAliasProvisioning'

const OWNER = `0x${'a'.repeat(64)}`
const ALIAS = `0x${'c'.repeat(64)}`
const KEY = {
  mnemonic: 'word '.repeat(24).trim(),
  privateKey: 'suiprivkey1x',
  address: ALIAS,
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  mockGenerateAliasKey.mockReset().mockReturnValue(KEY)
  mockRegisterAcknowledgedAlias.mockReset()
  mockSigningContext.mockReturnValue({
    chain: 'sui:devnet',
    senderAddress: OWNER,
    suiClient: {
      core: { waitForTransaction: vi.fn().mockResolvedValue(undefined) },
    },
    sign: vi.fn().mockResolvedValue({ bytes: 'b', signature: 's' }),
  })
})

describe('useAliasProvisioning', () => {
  it('generates and holds a personal access key', () => {
    const { result } = renderHook(() => useAliasProvisioning(), { wrapper })
    act(() => {
      result.current.generate()
    })
    expect(result.current.aliasKey).toEqual(KEY)
  })

  it('surfaces the error and does not register when acknowledged is false', async () => {
    const { result } = renderHook(() => useAliasProvisioning(), { wrapper })
    act(() => {
      result.current.generate()
    })

    let ok = true
    await act(async () => {
      ok = await result.current.register(false)
    })

    expect(ok).toBe(false)
    expect(result.current.error).toContain('saved your personal access key')
    expect(mockRegisterAcknowledgedAlias).not.toHaveBeenCalled()
  })

  it('registers and records the tx digest when acknowledged', async () => {
    mockRegisterAcknowledgedAlias.mockResolvedValue({ addDigest: 'digest-1' })
    const { result } = renderHook(() => useAliasProvisioning(), { wrapper })
    act(() => {
      result.current.generate()
    })

    let ok = false
    await act(async () => {
      ok = await result.current.register(true)
    })

    expect(ok).toBe(true)
    expect(mockRegisterAcknowledgedAlias).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: OWNER,
        aliasAddress: ALIAS,
        acknowledged: true,
      }),
    )
    await waitFor(() => expect(result.current.txDigest).toBe('digest-1'))
  })
})
