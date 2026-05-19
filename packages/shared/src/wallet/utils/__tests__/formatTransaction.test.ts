import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFetchCoinMetadata,
  mockFormatByDecimals,
  mockParseStructTag,
  mockWarn,
} = vi.hoisted(() => ({
  mockFetchCoinMetadata: vi.fn(),
  mockFormatByDecimals: vi.fn(),
  mockParseStructTag: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock("@mysten/sui/utils", () => ({
  parseStructTag: (...args: unknown[]) => mockParseStructTag(...args),
}));

vi.mock("#/utils/format", () => ({
  formatByDecimals: (...args: unknown[]) => mockFormatByDecimals(...args),
}));

vi.mock("#/utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockWarn,
    error: vi.fn(),
  }),
}));

vi.mock("#/wallet/utils/coinMetadata", () => ({
  fetchCoinMetadata: (...args: unknown[]) => mockFetchCoinMetadata(...args),
}));

import {
  extractSymbolFromCoinType,
  formatTransactionAmount,
} from "#/wallet/utils/formatTransaction";

describe("extractSymbolFromCoinType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseStructTag.mockReturnValue({ name: "TOKEN" });
  });

  it("extracts symbol using parseStructTag", () => {
    expect(extractSymbolFromCoinType("0x1::module::TOKEN")).toBe("TOKEN");
    expect(mockParseStructTag).toHaveBeenCalledWith("0x1::module::TOKEN");
  });

  it("falls back to the original coin type when parseStructTag returns no name", () => {
    mockParseStructTag.mockReturnValue({ name: "" });

    expect(extractSymbolFromCoinType("0x1::module::TOKEN")).toBe(
      "0x1::module::TOKEN",
    );
  });

  it("falls back to simple parsing when parseStructTag throws", () => {
    mockParseStructTag.mockImplementation(() => {
      throw new Error("invalid struct tag");
    });

    expect(extractSymbolFromCoinType("0x1::module::TOKEN")).toBe("TOKEN");
  });

  it("returns the original input when fallback parsing has no usable suffix", () => {
    mockParseStructTag.mockImplementation(() => {
      throw new Error("invalid struct tag");
    });

    expect(extractSymbolFromCoinType("not-a-struct-tag")).toBe(
      "not-a-struct-tag",
    );
  });
});

describe("formatTransactionAmount", () => {
  const graphqlClient = { query: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFormatByDecimals.mockImplementation(
      (rawAmount: string, decimals: number) => `${rawAmount}:${decimals}`,
    );
  });

  it("formats using decimals from fetched coin metadata", async () => {
    mockFetchCoinMetadata.mockResolvedValue({
      decimals: 6,
      symbol: "EVE",
      name: "Eve",
    });

    await expect(
      formatTransactionAmount(
        "1234567",
        "0x1::eve::EVE",
        graphqlClient as never,
      ),
    ).resolves.toBe("1234567:6");

    expect(mockFetchCoinMetadata).toHaveBeenCalledWith(
      graphqlClient,
      "0x1::eve::EVE",
    );
    expect(mockFormatByDecimals).toHaveBeenCalledWith("1234567", 6);
  });

  it("falls back to 9 decimals when metadata is unavailable", async () => {
    mockFetchCoinMetadata.mockResolvedValue(null);

    await expect(
      formatTransactionAmount(
        "1000000000",
        "0x1::unknown::COIN",
        graphqlClient as never,
      ),
    ).resolves.toBe("1000000000:9");

    expect(mockFormatByDecimals).toHaveBeenCalledWith("1000000000", 9);
    expect(mockWarn).toHaveBeenCalledWith(
      "Falling back to default decimals for coin type",
      {
        coinType: "0x1::unknown::COIN",
        rawAmount: "1000000000",
        defaultDecimals: 9,
      },
    );
  });

  it("propagates metadata fetch errors", async () => {
    mockFetchCoinMetadata.mockRejectedValue(new Error("metadata failed"));

    await expect(
      formatTransactionAmount("100", "0x1::bad::BAD", graphqlClient as never),
    ).rejects.toThrow("metadata failed");
  });
});
