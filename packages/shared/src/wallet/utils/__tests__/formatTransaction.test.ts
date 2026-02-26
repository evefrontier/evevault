import { describe, expect, it, vi } from "vitest";
import {
  extractSymbolFromCoinType,
  formatTransactionAmount,
} from "../formatTransaction";

// Mock dependencies
vi.mock("../coinMetadata", () => ({
  fetchCoinMetadata: vi.fn(),
}));

import { fetchCoinMetadata } from "../coinMetadata";

describe("extractSymbolFromCoinType", () => {
  describe("successful extraction", () => {
    it("extracts symbol from standard coin type", () => {
      const result = extractSymbolFromCoinType("0x2::sui::SUI");
      expect(result).toBe("SUI");
    });

    it("extracts symbol from custom token", () => {
      const result = extractSymbolFromCoinType(
        "0x123::mytoken::CUSTOM"
      );
      expect(result).toBe("CUSTOM");
    });

    it("extracts symbol from long address", () => {
      const result = extractSymbolFromCoinType(
        "0x1234567890abcdef::token::TOKEN"
      );
      expect(result).toBe("TOKEN");
    });

    it("handles different namespace formats", () => {
      const result1 = extractSymbolFromCoinType("0x1::coin::USD");
      const result2 = extractSymbolFromCoinType("0xabc::token::EUR");

      expect(result1).toBe("USD");
      expect(result2).toBe("EUR");
    });
  });

  describe("edge cases", () => {
    it("handles malformed coin type gracefully", () => {
      const result = extractSymbolFromCoinType("malformed-coin-type");
      // Should fallback to returning the whole string or last part
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles empty string", () => {
      const result = extractSymbolFromCoinType("");
      expect(typeof result).toBe("string");
    });

    it("handles coin type with single segment", () => {
      const result = extractSymbolFromCoinType("TOKEN");
      expect(result).toBe("TOKEN");
    });

    it("handles coin type with extra segments", () => {
      const result = extractSymbolFromCoinType(
        "0x2::sui::extra::segment::SUI"
      );
      expect(result).toBe("SUI");
    });
  });

  describe("special characters", () => {
    it("handles symbols with underscores", () => {
      const result = extractSymbolFromCoinType("0x2::token::MY_TOKEN");
      expect(result).toBe("MY_TOKEN");
    });

    it("handles symbols with numbers", () => {
      const result = extractSymbolFromCoinType("0x2::token::TOKEN123");
      expect(result).toBe("TOKEN123");
    });

    it("handles lowercase symbols", () => {
      const result = extractSymbolFromCoinType("0x2::token::token");
      expect(result).toBe("token");
    });
  });
});

describe("formatTransactionAmount", () => {
  const mockSuiClient = {} as ReturnType<
    typeof import("../../../sui").createSuiClient
  >;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful formatting with metadata", () => {
    it("formats amount with fetched decimals", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 9,
        symbol: "SUI",
      });

      const result = await formatTransactionAmount(
        "1000000000",
        "0x2::sui::SUI",
        mockSuiClient
      );

      expect(result).toBe("1");
      expect(fetchCoinMetadata).toHaveBeenCalledWith(
        mockSuiClient,
        "0x2::sui::SUI"
      );
    });

    it("formats amount with 6 decimals (USDC-like)", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 6,
        symbol: "USDC",
      });

      const result = await formatTransactionAmount(
        "1000000",
        "0x123::usdc::USDC",
        mockSuiClient
      );

      expect(result).toBe("1");
    });

    it("formats decimal amount", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 9,
        symbol: "SUI",
      });

      const result = await formatTransactionAmount(
        "1500000000",
        "0x2::sui::SUI",
        mockSuiClient
      );

      expect(result).toBe("1.5");
    });

    it("formats small amount", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 9,
        symbol: "SUI",
      });

      const result = await formatTransactionAmount(
        "100000000",
        "0x2::sui::SUI",
        mockSuiClient
      );

      expect(result).toBe("0.1");
    });

    it("formats zero amount", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 9,
        symbol: "SUI",
      });

      const result = await formatTransactionAmount(
        "0",
        "0x2::sui::SUI",
        mockSuiClient
      );

      expect(result).toBe("0");
    });
  });

  describe("fallback behavior when metadata unavailable", () => {
    it("uses default 9 decimals when metadata is null", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue(null);

      const result = await formatTransactionAmount(
        "1000000000",
        "0x123::unknown::TOKEN",
        mockSuiClient
      );

      // Should use default 9 decimals
      expect(result).toBe("1");
    });

    it("formats correctly with fallback decimals", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue(null);

      const result = await formatTransactionAmount(
        "500000000",
        "0x123::unknown::TOKEN",
        mockSuiClient
      );

      // With 9 decimals default
      expect(result).toBe("0.5");
    });
  });

  describe("different coin types", () => {
    it("handles SUI coin type", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 9,
        symbol: "SUI",
      });

      const result = await formatTransactionAmount(
        "2000000000",
        "0x2::sui::SUI",
        mockSuiClient
      );

      expect(result).toBe("2");
    });

    it("handles custom token coin type", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 18,
        symbol: "CUSTOM",
      });

      const result = await formatTransactionAmount(
        "1000000000000000000",
        "0xabc::custom::CUSTOM",
        mockSuiClient
      );

      expect(result).toBe("1");
    });

    it("handles different decimals correctly", async () => {
      // Test with 6 decimals
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 6,
        symbol: "TOKEN",
      });

      const result1 = await formatTransactionAmount(
        "1000000",
        "0x1::token::TOKEN",
        mockSuiClient
      );
      expect(result1).toBe("1");

      // Test with 18 decimals
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 18,
        symbol: "TOKEN",
      });

      const result2 = await formatTransactionAmount(
        "1000000000000000000",
        "0x2::token::TOKEN",
        mockSuiClient
      );
      expect(result2).toBe("1");
    });
  });

  describe("edge cases", () => {
    it("handles very large amounts", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 9,
        symbol: "SUI",
      });

      const result = await formatTransactionAmount(
        "1000000000000000000",
        "0x2::sui::SUI",
        mockSuiClient
      );

      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("handles very small amounts", async () => {
      vi.mocked(fetchCoinMetadata).mockResolvedValue({
        decimals: 9,
        symbol: "SUI",
      });

      const result = await formatTransactionAmount(
        "1",
        "0x2::sui::SUI",
        mockSuiClient
      );

      expect(result).toBe("0.000000001");
    });
  });
});
