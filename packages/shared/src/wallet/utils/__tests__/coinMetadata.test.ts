import { beforeEach, describe, expect, it, vi } from "vitest";
import { SUI_COIN_TYPE } from "@/utils";
import {
  fetchCoinMetadata,
  invalidateCoinMetadataCache,
} from "@/wallet/utils/coinMetadata";

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("coinMetadata", () => {
  const graphqlClient = {
    query: vi.fn(),
  };

  beforeEach(() => {
    invalidateCoinMetadataCache();
    graphqlClient.query.mockReset();
  });

  it("invalidateCoinMetadataCache clears one coin type", async () => {
    graphqlClient.query.mockResolvedValue({
      data: {
        coinMetadata: {
          decimals: 6,
          symbol: "ABC",
          name: "Abc",
          description: null,
          iconUrl: null,
        },
      },
    });
    await fetchCoinMetadata(graphqlClient as never, "0x1::m::T");
    invalidateCoinMetadataCache("0x1::m::T");
    graphqlClient.query.mockClear();
    await fetchCoinMetadata(graphqlClient as never, "0x1::m::T");
    expect(graphqlClient.query).toHaveBeenCalledTimes(1);
  });

  it("invalidateCoinMetadataCache with no arg clears entire cache", async () => {
    graphqlClient.query.mockResolvedValue({
      data: {
        coinMetadata: {
          decimals: 6,
          symbol: "X",
          name: null,
          description: null,
          iconUrl: null,
        },
      },
    });
    await fetchCoinMetadata(graphqlClient as never, "0x1::a::A");
    await fetchCoinMetadata(graphqlClient as never, "0x1::b::B");
    graphqlClient.query.mockClear();
    invalidateCoinMetadataCache();
    await fetchCoinMetadata(graphqlClient as never, "0x1::a::A");
    expect(graphqlClient.query).toHaveBeenCalledTimes(1);
  });

  it("returns SUI metadata without calling GraphQL", async () => {
    const meta = await fetchCoinMetadata(graphqlClient as never, SUI_COIN_TYPE);
    expect(meta).toMatchObject({
      decimals: 9,
      symbol: "SUI",
      name: "Sui",
    });
    expect(graphqlClient.query).not.toHaveBeenCalled();
  });

  it("returns null when GraphQL returns errors", async () => {
    graphqlClient.query.mockResolvedValue({
      errors: [{ message: "bad" }],
    });
    await expect(
      fetchCoinMetadata(graphqlClient as never, "0x1::m::T"),
    ).resolves.toBeNull();
  });

  it("returns null when coinMetadata node is missing or incomplete", async () => {
    graphqlClient.query.mockResolvedValue({ data: { coinMetadata: null } });
    await expect(
      fetchCoinMetadata(graphqlClient as never, "0x1::m::T"),
    ).resolves.toBeNull();

    graphqlClient.query.mockResolvedValue({
      data: { coinMetadata: { decimals: null, symbol: "S" } },
    });
    await expect(
      fetchCoinMetadata(graphqlClient as never, "0x1::m::T"),
    ).resolves.toBeNull();
  });

  it("returns parsed metadata on success", async () => {
    graphqlClient.query.mockResolvedValue({
      data: {
        coinMetadata: {
          decimals: 8,
          symbol: "EVE",
          name: "Eve",
          description: "desc",
          iconUrl: "https://x",
        },
      },
    });
    const meta = await fetchCoinMetadata(
      graphqlClient as never,
      "0x1::eve::EVE",
    );
    expect(meta).toEqual({
      decimals: 8,
      symbol: "EVE",
      name: "Eve",
      description: "desc",
      iconUrl: "https://x",
    });
  });

  it("returns null when query throws", async () => {
    graphqlClient.query.mockRejectedValue(new Error("network"));
    await expect(
      fetchCoinMetadata(graphqlClient as never, "0x1::m::T"),
    ).resolves.toBeNull();
  });

  it("reuses cache within TTL", async () => {
    graphqlClient.query.mockResolvedValue({
      data: {
        coinMetadata: {
          decimals: 6,
          symbol: "C",
          name: null,
          description: null,
          iconUrl: null,
        },
      },
    });
    const t = "0x1::cached::C";
    const first = await fetchCoinMetadata(graphqlClient as never, t);
    const second = await fetchCoinMetadata(graphqlClient as never, t);
    expect(first).toEqual(second);
    expect(graphqlClient.query).toHaveBeenCalledTimes(1);
  });
});
