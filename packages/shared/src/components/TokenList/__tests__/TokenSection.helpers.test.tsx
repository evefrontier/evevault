import { getEveCoinType } from '@evefrontier/wallet-core/eve-token'
import { TenantId } from '@evefrontier/wallet-core/tenant'
import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SUI_COIN_TYPE } from '#/utils/constants'
import { useTokensForChain } from '../TokenSection.helpers'

vi.mock('#/hooks', () => ({
  useContext: () => ({ tenantId: TenantId.STILLNESS }),
}))

const EVE_COIN_TYPE = getEveCoinType(TenantId.STILLNESS)

describe('useTokensForChain', () => {
  it('re-adds EVE when it is missing from the stored testnet list', () => {
    const { result } = renderHook(() =>
      useTokensForChain(SUI_TESTNET_CHAIN, {
        [SUI_TESTNET_CHAIN]: [SUI_COIN_TYPE],
      }),
    )

    expect(result.current).toEqual([SUI_COIN_TYPE, EVE_COIN_TYPE])
  })

  it('does not duplicate EVE when it is already stored', () => {
    const { result } = renderHook(() =>
      useTokensForChain(SUI_TESTNET_CHAIN, {
        [SUI_TESTNET_CHAIN]: [SUI_COIN_TYPE, EVE_COIN_TYPE],
      }),
    )

    expect(result.current).toEqual([SUI_COIN_TYPE, EVE_COIN_TYPE])
  })

  it('does not add EVE on chains without it in their defaults', () => {
    const { result } = renderHook(() =>
      useTokensForChain(SUI_DEVNET_CHAIN, {
        [SUI_DEVNET_CHAIN]: [SUI_COIN_TYPE],
      }),
    )

    expect(result.current).toEqual([SUI_COIN_TYPE])
  })
})
