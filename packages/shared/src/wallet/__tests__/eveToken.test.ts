import { getEveCoinType, TenantId } from '@evefrontier/wallet-core/definitions'
import { describe, expect, it } from 'vitest'

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
})
