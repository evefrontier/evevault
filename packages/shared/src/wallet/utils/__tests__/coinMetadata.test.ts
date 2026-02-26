import { describe, expect, it, vi } from "vitest";
import {
  fetchCoinMetadata,
  invalidateCoinMetadataCache,
} from "../coinMetadata";

describe("coinMetadata", () => {
  const mockSuiClient = {
    getCoinMetadata: vi.fn(),
  } as unknown as ReturnType<typeof import("../../../sui").createSuiClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCoinMetadataCache(); // Clear cache before each test
  });

  describe("fetchCoinMetadata", () => {
    describe("SUI coin type", () => {
      it("returns hardcoded metadata for SUI", async () => {
        const result = await fetchCoinMetadata(mockSuiClient, "0x2::sui::SUI");

        expect(result).toEqual({
          decimals: 9,
          symbol: "SUI",
        });
        expect(mockSuiClient.getCoinMetadata).not.toHaveBeenCalled();
      });

      it("caches SUI metadata", async () => {
        const result1 = await fetchCoinMetadata(
          mockSuiClient,
          "0x2::sui::SUI"
        );
        const result2 = await fetchCoinMetadata(
          mockSuiClient,
          "0x2::sui::SUI"
        );

        expect(result1).toEqual(result2);
        expect(mockSuiClient.getCoinMetadata).not.toHaveBeenCalled();
      });
    });

    describe("custom coin types", () => {
      it("fetches and returns metadata for custom token", async () => {
        const mockMetadata = {
          coinMetadata: {
            decimals: 6,
            symbol: "USDC",
          },
        };
        vi.mocked(mockSuiClient.getCoinMetadata).mockResolvedValue(
          mockMetadata
        );

        const result = await fetchCoinMetadata(
          mockSuiClient,
          "0x123::usdc::USDC"
        );

        expect(result).toEqual({
          decimals: 6,
          symbol: "USDC",
        });
        expect(mockSuiClient.getCoinMetadata).toHaveBeenCalledWith({
          coinType: "0x123::usdc::USDC",
        });
      });

      it("fetches metadata with different decimals", async () => {
        const mockMetadata = {
          coinMetadata: {
            decimals: 18,
            symbol: "WETH",
          },
        };
        vi.mocked(mockSuiClient.getCoinMetadata).mockResolvedValue(
          mockMetadata
        );

        const result = await fetchCoinMetadata(
          mockSuiClient,
          "0xabc::weth::WETH"
        );

        expect(result).toEqual({
          decimals: 18,
          symbol: "WETH",
        });
      });
    });

    describe("caching", () => {
      it("caches fetched metadata", async () => {
        const mockMetadata = {
          coinMetadata: {
            decimals: 6,
            symbol: "USDC",
          },
        };
        vi.mocked(mockSuiClient.getCoinMetadata).mockResolvedValue(
          mockMetadata
        );

        const result1 = await fetchCoinMetadata(
          mockSuiClient,
          "0x123::usdc::USDC"
        );
        const result2 = await fetchCoinMetadata(
          mockSuiClient,
          "0x123::usdc::USDC"
        );

        expect(result1).toEqual(result2);
        expect(mockSuiClient.getCoinMetadata).toHaveBeenCalledTimes(1);
      });

      it("caches different coin types separately", async () => {
        const usdcMetadata = {
          coinMetadata: { decimals: 6, symbol: "USDC" },
        };
        const usdtMetadata = {
          coinMetadata: { decimals: 6, symbol: "USDT" },
        };

        vi.mocked(mockSuiClient.getCoinMetadata)
          .mockResolvedValueOnce(usdcMetadata)
          .mockResolvedValueOnce(usdtMetadata);

        const result1 = await fetchCoinMetadata(
          mockSuiClient,
          "0x1::usdc::USDC"
        );
        const result2 = await fetchCoinMetadata(
          mockSuiClient,
          "0x2::usdt::USDT"
        );

        expect(result1?.symbol).toBe("USDC");
        expect(result2?.symbol).toBe("USDT");
        expect(mockSuiClient.getCoinMetadata).toHaveBeenCalledTimes(2);
      });

      it("respects cache TTL (30 minutes)", async () => {
        const mockMetadata = {
          coinMetadata: {
            decimals: 6,
            symbol: "USDC",
          },
        };
        vi.mocked(mockSuiClient.getCoinMetadata).mockResolvedValue(
          mockMetadata
        );

        // First fetch
        await fetchCoinMetadata(mockSuiClient, "0x123::usdc::USDC");

        // Mock time passing (31 minutes)
        vi.useFakeTimers();
        vi.advanceTimersByTime(31 * 60 * 1000);

        // Second fetch should hit the API again
        await fetchCoinMetadata(mockSuiClient, "0x123::usdc::USDC");

        expect(mockSuiClient.getCoinMetadata).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
      });
    });

    describe("error handling", () => {
      it("returns null when getCoinMetadata returns no metadata", async () => {
        vi.mocked(mockSuiClient.getCoinMetadata).mockResolvedValue({
          coinMetadata: null,
        });

        const result = await fetchCoinMetadata(
          mockSuiClient,
          "0x123::invalid::TOKEN"
        );

        expect(result).toBeNull();
      });

      it("returns null when getCoinMetadata throws error", async () => {
        vi.mocked(mockSuiClient.getCoinMetadata).mockRejectedValue(
          new Error("Network error")
        );

        const result = await fetchCoinMetadata(
          mockSuiClient,
          "0x123::error::TOKEN"
        );

        expect(result).toBeNull();
      });

      it("returns null when coinMetadata is undefined", async () => {
        vi.mocked(mockSuiClient.getCoinMetadata).mockResolvedValue({});

        const result = await fetchCoinMetadata(
          mockSuiClient,
          "0x123::undefined::TOKEN"
        );

        expect(result).toBeNull();
      });
    });
  });

  describe("invalidateCoinMetadataCache", () => {
    it("clears specific coin type from cache", async () => {
      const mockMetadata = {
        coinMetadata: {
          decimals: 6,
          symbol: "USDC",
        },
      };
      vi.mocked(mockSuiClient.getCoinMetadata).mockResolvedValue(mockMetadata);

      // Fetch and cache
      await fetchCoinMetadata(mockSuiClient, "0x123::usdc::USDC");
      expect(mockSuiClient.getCoinMetadata).toHaveBeenCalledTimes(1);

      // Invalidate cache for this coin type
      invalidateCoinMetadataCache("0x123::usdc::USDC");

      // Fetch again should hit API
      await fetchCoinMetadata(mockSuiClient, "0x123::usdc::USDC");
      expect(mockSuiClient.getCoinMetadata).toHaveBeenCalledTimes(2);
    });

    it("clears entire cache when no coin type specified", async () => {
      const usdcMetadata = {
        coinMetadata: { decimals: 6, symbol: "USDC" },
      };
      const usdtMetadata = {
        coinMetadata: { decimals: 6, symbol: "USDT" },
      };

      vi.mocked(mockSuiClient.getCoinMetadata)
        .mockResolvedValueOnce(usdcMetadata)
        .mockResolvedValueOnce(usdtMetadata)
        .mockResolvedValueOnce(usdcMetadata)
        .mockResolvedValueOnce(usdtMetadata);

      // Fetch and cache both
      await fetchCoinMetadata(mockSuiClient, "0x1::usdc::USDC");
      await fetchCoinMetadata(mockSuiClient, "0x2::usdt::USDT");

      // Clear entire cache
      invalidateCoinMetadataCache();

      // Both should hit API again
      await fetchCoinMetadata(mockSuiClient, "0x1::usdc::USDC");
      await fetchCoinMetadata(mockSuiClient, "0x2::usdt::USDT");

      expect(mockSuiClient.getCoinMetadata).toHaveBeenCalledTimes(4);
    });

    it("does nothing for non-existent coin type", () => {
      // Should not throw
      expect(() =>
        invalidateCoinMetadataCache("0x999::nonexistent::TOKEN")
      ).not.toThrow();
    });

    it("preserves other cached entries when invalidating specific one", async () => {
      const usdcMetadata = {
        coinMetadata: { decimals: 6, symbol: "USDC" },
      };
      const usdtMetadata = {
        coinMetadata: { decimals: 6, symbol: "USDT" },
      };

      vi.mocked(mockSuiClient.getCoinMetadata)
        .mockResolvedValueOnce(usdcMetadata)
        .mockResolvedValueOnce(usdtMetadata)
        .mockResolvedValueOnce(usdcMetadata);

      // Cache both
      await fetchCoinMetadata(mockSuiClient, "0x1::usdc::USDC");
      await fetchCoinMetadata(mockSuiClient, "0x2::usdt::USDT");

      // Invalidate only USDC
      invalidateCoinMetadataCache("0x1::usdc::USDC");

      // USDC should hit API again
      await fetchCoinMetadata(mockSuiClient, "0x1::usdc::USDC");
      // USDT should use cache
      await fetchCoinMetadata(mockSuiClient, "0x2::usdt::USDT");

      expect(mockSuiClient.getCoinMetadata).toHaveBeenCalledTimes(3);
    });
  });
});
