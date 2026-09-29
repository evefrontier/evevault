import { getEveCoinType } from '@evefrontier/wallet-core/eve-token'
import { TENANT_CONFIG, TenantId } from '@evefrontier/wallet-core/tenant'
import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from '@mysten/wallet-standard'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSuiGraphQLClient } from '#/sui/graphqlClient'
import { getMvrClientOptions, getMvrTypeName } from '#/sui/mvr'
import { createSuiClient } from '#/sui/suiClient'

const EVE_MVR_TYPE = '@evefrontier/currency::EVE::EVE'

describe('getMvrClientOptions', () => {
  it.each([
    'devnet',
    'localnet',
    'unknown',
  ])('returns no options for %s', (network) => {
    expect(getMvrClientOptions(network)).toEqual({})
  })
})

describe('MVR resolution on real clients', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['grpc', () => createSuiClient(SUI_TESTNET_CHAIN)],
    ['graphql', () => createSuiGraphQLClient(SUI_TESTNET_CHAIN)],
  ])('%s client resolves @evefrontier names without fetching', async (_, create) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const client = create()

    await expect(
      client.core.mvr.resolveType({ type: EVE_MVR_TYPE }),
    ).resolves.toEqual({ type: getEveCoinType(TenantId.STILLNESS) })
    await expect(
      client.core.mvr.resolvePackage({ package: '@evefrontier/world' }),
    ).resolves.toEqual({ package: TENANT_CONFIG.stillness.packageId })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('getMvrTypeName', () => {
  it.each([
    TenantId.STILLNESS,
    TenantId.LIMINALITY,
  ])('names the %s EVE coin type', (tenant) => {
    expect(getMvrTypeName(getEveCoinType(tenant), SUI_TESTNET_CHAIN)).toBe(
      EVE_MVR_TYPE,
    )
  })

  it('names the utopia EVE coin type by its tier', () => {
    expect(
      getMvrTypeName(getEveCoinType(TenantId.UTOPIA), SUI_TESTNET_CHAIN),
    ).toBe('@evefrontier/currency-uat::EVE::EVE')
  })

  it('matches a non-canonical address against the cache entry', () => {
    const [address, ...rest] = getEveCoinType(TenantId.STILLNESS).split('::')
    const upperCased = [`0x${address.slice(2).toUpperCase()}`, ...rest].join(
      '::',
    )
    expect(getMvrTypeName(upperCased, SUI_TESTNET_CHAIN)).toBe(EVE_MVR_TYPE)
  })

  it('returns null for uncached types', () => {
    expect(getMvrTypeName('0x2::sui::SUI', SUI_TESTNET_CHAIN)).toBeNull()
  })

  it('returns null for malformed types', () => {
    expect(getMvrTypeName('not a type', SUI_TESTNET_CHAIN)).toBeNull()
  })

  it.each<SuiChain | null>([
    SUI_DEVNET_CHAIN,
    SUI_LOCALNET_CHAIN,
    null,
  ])('returns null on %s', (chain) => {
    expect(getMvrTypeName(getEveCoinType(TenantId.STILLNESS), chain)).toBeNull()
  })
})
