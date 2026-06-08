import {
  getEveCoinType,
  isEveCoinType,
  TenantId,
} from '@evefrontier/wallet-core/definitions'
import { describe, expect, it } from 'vitest'

// Hardcoded to catch unexpected upstream changes to package IDs in wallet-core.
// If wallet-core intentionally changes a package ID, update these values here too.
const expectedEveCoinTypes = {
  [TenantId.TAUCETI]:
    '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9::EVE::EVE',
  [TenantId.TESSERACT]:
    '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9::EVE::EVE',
  [TenantId.TETRA]:
    '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9::EVE::EVE',
  [TenantId.TIAKI]:
    '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9::EVE::EVE',
  [TenantId.UTOPIA]:
    '0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE',
  [TenantId.STILLNESS]:
    '0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE',
} satisfies Record<TenantId, string>

describe('eveToken', () => {
  describe('getEveCoinType', () => {
    it('returns the expected coin type for each tenant', () => {
      for (const [tenantId, expectedCoinType] of Object.entries(
        expectedEveCoinTypes,
      ) as [TenantId, string][]) {
        const coinType = getEveCoinType(tenantId)
        expect(coinType).toMatch(/^0x[a-f0-9]+::EVE::EVE$/)
        expect(coinType).toBe(expectedCoinType)
      }
    })

    it('returns same coin type for tauceti and tesseract (test tier)', () => {
      expect(getEveCoinType(TenantId.TAUCETI)).toBe(
        getEveCoinType(TenantId.TESSERACT),
      )
    })
  })

  describe('isEveCoinType', () => {
    it('returns true for each known tenant EVE coin type', () => {
      for (const coinType of Object.values(expectedEveCoinTypes)) {
        expect(isEveCoinType(coinType)).toBe(true)
      }
    })

    it('returns false for SUI coin type', () => {
      expect(isEveCoinType('0x2::sui::SUI')).toBe(false)
    })

    it('returns false for empty string and arbitrary coin types', () => {
      expect(isEveCoinType('')).toBe(false)
      expect(isEveCoinType('0x2::other::TOKEN')).toBe(false)
    })

    // wallet-core no longer includes the pre-per-tenant-package legacy EVE address
    // (0x59d7bb2e0feffb90cb2446fb97c2ce7d4bd24d2fb98939d6cb6c3940110a0de0::EVE::EVE).
    // If legacy token support is still needed, wallet-core must be updated to include it.
  })
})
