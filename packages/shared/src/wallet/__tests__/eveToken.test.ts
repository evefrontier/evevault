import {
  EVE_PACKAGE_ID_BY_TENANT,
  getEveCoinType,
} from "@evefrontier/dapp-kit";
import { describe, expect, it } from "vitest";
import { isEveCoinType } from "../eveToken";

describe("eveToken", () => {
  describe("getEveCoinType", () => {
    it("returns coin type in format packageId::EVE::EVE for each tenant", () => {
      const tenants = ["nebula", "testevenet", "utopia", "stillness"] as const;
      for (const tenantId of tenants) {
        const coinType = getEveCoinType(tenantId);
        expect(coinType).toMatch(/^0x[a-f0-9]+::EVE::EVE$/);
        expect(coinType).toBe(
          `${EVE_PACKAGE_ID_BY_TENANT[tenantId]}::EVE::EVE`,
        );
      }
    });

    it("returns same coin type for nebula and testevenet (test tier)", () => {
      expect(getEveCoinType("nebula")).toBe(getEveCoinType("testevenet"));
    });
  });

  describe("isEveCoinType", () => {
    it("returns true for each tenant EVE coin type", () => {
      expect(isEveCoinType(getEveCoinType("nebula"))).toBe(true);
      expect(isEveCoinType(getEveCoinType("testevenet"))).toBe(true);
      expect(isEveCoinType(getEveCoinType("utopia"))).toBe(true);
      expect(isEveCoinType(getEveCoinType("stillness"))).toBe(true);
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
