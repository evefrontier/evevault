import { getEveCoinType } from '@evefrontier/wallet-core/eve-token'
import { TenantId } from '@evefrontier/wallet-core/tenant'
import { describe, expect, it } from 'vitest'
import { SUI_COIN_TYPE } from '#/utils'
import {
  DEFAULT_EVE_TESTNET_METADATA,
  DEFAULT_SUI_METADATA,
  getKnownTokenDisplay,
} from '#/wallet/utils/balanceMetadata'

describe('getKnownTokenDisplay', () => {
  it('returns the default SUI name and symbol for the SUI coin type', () => {
    expect(getKnownTokenDisplay(SUI_COIN_TYPE)).toEqual({
      name: DEFAULT_SUI_METADATA.name,
      symbol: DEFAULT_SUI_METADATA.symbol,
    })
  })

  it('returns the default EVE name and symbol for a known EVE coin type', () => {
    const eveCoinType = getEveCoinType(TenantId.STILLNESS)
    expect(getKnownTokenDisplay(eveCoinType)).toEqual({
      name: DEFAULT_EVE_TESTNET_METADATA.name,
      symbol: DEFAULT_EVE_TESTNET_METADATA.symbol,
    })
  })

  it('recognizes EVE coin types for non-default tenants', () => {
    const eveCoinType = getEveCoinType(TenantId.UTOPIA)
    expect(getKnownTokenDisplay(eveCoinType)).toEqual({
      name: DEFAULT_EVE_TESTNET_METADATA.name,
      symbol: DEFAULT_EVE_TESTNET_METADATA.symbol,
    })
  })

  it('returns null for an unknown coin type', () => {
    expect(getKnownTokenDisplay('0x123::foo::FOO')).toBeNull()
  })

  it('returns null for an empty coin type', () => {
    expect(getKnownTokenDisplay('')).toBeNull()
  })
})
