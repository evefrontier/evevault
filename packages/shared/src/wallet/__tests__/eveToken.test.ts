import {
  EVE_PACKAGE_ID_BY_TENANT,
  getEveCoinType,
  TenantId,
} from "@evefrontier/dapp-kit";
import { describe, expect, it } from "vitest";
import { isEveCoinType } from "@/wallet/eveToken";

describe("eveToken", () => {
  describe("getEveCoinType", () => {
    it("returns coin type in format packageId::EVE::EVE for each tenant", () => {
      const tenants = [
        TenantId.TAUCETI,
        TenantId.TESSERACT,
        TenantId.TETRA,
        TenantId.TIAKI,
        TenantId.UTOPIA,
        TenantId.STILLNESS,
      ] as const;
      for (const tenantId of tenants) {
        const coinType = getEveCoinType(tenantId);
        expect(coinType).toMatch(/^0x[a-f0-9]+::EVE::EVE$/);
        expect(coinType).toBe(
          `${EVE_PACKAGE_ID_BY_TENANT[tenantId]}::EVE::EVE`,
        );
      }
    });

    it("returns same coin type for tauceti and tesseract (test tier)", () => {
      expect(getEveCoinType(TenantId.TAUCETI)).toBe(
        getEveCoinType(TenantId.TESSERACT),
      );
    });
  });

  describe("isEveCoinType", () => {
    it("returns true for each tenant EVE coin type", () => {
      expect(isEveCoinType(getEveCoinType(TenantId.TAUCETI))).toBe(true);
      expect(isEveCoinType(getEveCoinType(TenantId.TESSERACT))).toBe(true);
      expect(isEveCoinType(getEveCoinType(TenantId.TETRA))).toBe(true);
      expect(isEveCoinType(getEveCoinType(TenantId.TIAKI))).toBe(true);
      expect(isEveCoinType(getEveCoinType(TenantId.UTOPIA))).toBe(true);
      expect(isEveCoinType(getEveCoinType(TenantId.STILLNESS))).toBe(true);
    });

    it("returns true for the legacy EVE coin type", () => {
      expect(
        isEveCoinType(
          "0x59d7bb2e0feffb90cb2446fb97c2ce7d4bd24d2fb98939d6cb6c3940110a0de0::EVE::EVE",
        ),
      ).toBe(true);
    });

    it("returns false for SUI coin type", () => {
      expect(isEveCoinType("0x2::sui::SUI")).toBe(false);
    });

    it("returns false for arbitrary string", () => {
      expect(isEveCoinType("")).toBe(false);
      expect(isEveCoinType("0x2::other::TOKEN")).toBe(false);
      expect(
        isEveCoinType(
          "0x0000000000000000000000000000000000000000000000000000000000000001::EVE::EVE",
        ),
      ).toBe(false);
    });
  });
});
