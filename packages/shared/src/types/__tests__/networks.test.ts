import { getEveCoinType } from '@evefrontier/wallet-core/eve-token'
import { TenantId } from '@evefrontier/wallet-core/tenant'
import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from '@mysten/wallet-standard'
import { describe, expect, it } from 'vitest'
import {
  AVAILABLE_NETWORKS,
  DEFAULT_TOKENS_BY_CHAIN,
  getAvailableNetworks,
  getDefaultTokensForChain,
  getNetworkLabel,
  getNetworkOption,
  isLocalnetChain,
  isZkLoginChain,
  isZkLoginSuiChain,
} from '#/types/networks'
import { SUI_COIN_TYPE } from '#/utils/constants'

describe('isLocalnetChain', () => {
  it('returns true for the localnet chain', () => {
    expect(isLocalnetChain(SUI_LOCALNET_CHAIN)).toBe(true)
  })

  it('returns false for a non-localnet chain', () => {
    expect(isLocalnetChain(SUI_TESTNET_CHAIN)).toBe(false)
  })

  it('returns false for null and undefined', () => {
    expect(isLocalnetChain(null)).toBe(false)
    expect(isLocalnetChain(undefined)).toBe(false)
  })
})

describe('isZkLoginChain', () => {
  it('returns true for a non-localnet chain', () => {
    expect(isZkLoginChain(SUI_TESTNET_CHAIN)).toBe(true)
    expect(isZkLoginChain(SUI_MAINNET_CHAIN)).toBe(true)
  })

  it('returns false for the localnet chain', () => {
    expect(isZkLoginChain(SUI_LOCALNET_CHAIN)).toBe(false)
  })

  it('returns false for null and undefined', () => {
    expect(isZkLoginChain(null)).toBe(false)
    expect(isZkLoginChain(undefined)).toBe(false)
  })
})

describe('isZkLoginSuiChain', () => {
  it('returns true for devnet, testnet, and mainnet', () => {
    expect(isZkLoginSuiChain(SUI_DEVNET_CHAIN)).toBe(true)
    expect(isZkLoginSuiChain(SUI_TESTNET_CHAIN)).toBe(true)
    expect(isZkLoginSuiChain(SUI_MAINNET_CHAIN)).toBe(true)
  })

  it('returns false for the localnet chain', () => {
    expect(isZkLoginSuiChain(SUI_LOCALNET_CHAIN)).toBe(false)
  })

  it('returns false for an unknown chain, null, and undefined', () => {
    expect(isZkLoginSuiChain('sui:unknown')).toBe(false)
    expect(isZkLoginSuiChain(null)).toBe(false)
    expect(isZkLoginSuiChain(undefined)).toBe(false)
  })
})

describe('getAvailableNetworks', () => {
  it('appends localnet when dev mode is enabled in the extension', () => {
    const networks = getAvailableNetworks(true, true)
    expect(networks).toHaveLength(AVAILABLE_NETWORKS.length + 1)
    expect(networks.at(-1)?.chain).toBe(SUI_LOCALNET_CHAIN)
  })

  it('does not append localnet when dev mode is off', () => {
    expect(getAvailableNetworks(false, true)).toEqual(AVAILABLE_NETWORKS)
  })

  it('does not append localnet outside the extension', () => {
    expect(getAvailableNetworks(true, false)).toEqual(AVAILABLE_NETWORKS)
    expect(getAvailableNetworks(false, false)).toEqual(AVAILABLE_NETWORKS)
  })
})

describe('getNetworkLabel', () => {
  it('returns the label for a known chain', () => {
    expect(getNetworkLabel(SUI_TESTNET_CHAIN)).toBe('Testnet')
    expect(getNetworkLabel(SUI_DEVNET_CHAIN)).toBe('Devnet')
  })

  it('falls back to the chain string for an unknown chain', () => {
    expect(getNetworkLabel('sui:unknown' as SuiChain)).toBe('sui:unknown')
  })
})

describe('getNetworkOption', () => {
  it('returns the option for a known chain', () => {
    expect(getNetworkOption(SUI_TESTNET_CHAIN)).toEqual({
      chain: SUI_TESTNET_CHAIN,
      label: 'Testnet',
      shortLabel: 'TEST',
    })
  })

  it('returns undefined for an unknown chain', () => {
    expect(getNetworkOption('sui:unknown' as SuiChain)).toBeUndefined()
  })
})

describe('getDefaultTokensForChain', () => {
  it('uses the provided tenant EVE coin type on testnet', () => {
    const tokens = getDefaultTokensForChain(SUI_TESTNET_CHAIN, TenantId.UTOPIA)
    expect(tokens).toEqual([SUI_COIN_TYPE, getEveCoinType(TenantId.UTOPIA)])
  })

  it('falls back to the static testnet tokens when no tenant is given', () => {
    expect(getDefaultTokensForChain(SUI_TESTNET_CHAIN)).toEqual(
      DEFAULT_TOKENS_BY_CHAIN[SUI_TESTNET_CHAIN],
    )
  })

  it('ignores the tenant for non-testnet chains', () => {
    expect(getDefaultTokensForChain(SUI_DEVNET_CHAIN, TenantId.UTOPIA)).toEqual(
      [SUI_COIN_TYPE],
    )
  })

  it('defaults to SUI only for an unknown chain', () => {
    expect(getDefaultTokensForChain('sui:unknown')).toEqual([SUI_COIN_TYPE])
  })

  it('returns a fresh copy that callers can mutate safely', () => {
    const tokens = getDefaultTokensForChain(SUI_DEVNET_CHAIN)
    tokens.push('mutated')
    expect(getDefaultTokensForChain(SUI_DEVNET_CHAIN)).toEqual([SUI_COIN_TYPE])
  })
})
