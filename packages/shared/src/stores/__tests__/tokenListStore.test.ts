import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/environment", () => ({
  isWeb: vi.fn(() => true),
  isExtension: vi.fn(() => false),
}));

vi.mock("@/wallet/eveToken", () => ({
  getEveCoinType: vi.fn(() => "0xmock::EVE::EVE"),
}));

import { useTokenListStore } from "@/stores/tokenListStore";
import { DEFAULT_TOKENS_BY_CHAIN } from "@/types/networks";

describe("tokenListStore", () => {
  beforeEach(() => {
    useTokenListStore.setState({
      tokens: structuredClone(DEFAULT_TOKENS_BY_CHAIN) as Record<
        string,
        string[]
      >,
    });
  });

  it("addToken ignores empty or whitespace-only coin types", () => {
    const before =
      useTokenListStore.getState().tokens[SUI_DEVNET_CHAIN]?.length;
    useTokenListStore.getState().addToken(SUI_DEVNET_CHAIN, "   ");
    useTokenListStore.getState().addToken(SUI_DEVNET_CHAIN, "");
    expect(useTokenListStore.getState().tokens[SUI_DEVNET_CHAIN]?.length).toBe(
      before,
    );
  });

  it("addToken ignores duplicate coin types", () => {
    const list = useTokenListStore.getState().tokens[SUI_TESTNET_CHAIN] ?? [];
    const first = list[0];
    expect(first).toBeTruthy();
    useTokenListStore.getState().addToken(SUI_TESTNET_CHAIN, first);
    expect(useTokenListStore.getState().tokens[SUI_TESTNET_CHAIN]).toEqual(
      list,
    );
  });

  it("addToken appends a new coin type", () => {
    useTokenListStore.getState().addToken(SUI_DEVNET_CHAIN, "0x9::m::NEW");
    expect(
      useTokenListStore.getState().tokens[SUI_DEVNET_CHAIN],
    ).toContainEqual("0x9::m::NEW");
  });

  it("removeToken filters out the coin type", () => {
    useTokenListStore.getState().addToken(SUI_DEVNET_CHAIN, "0x9::m::X");
    useTokenListStore.getState().removeToken(SUI_DEVNET_CHAIN, "0x9::m::X");
    expect(useTokenListStore.getState().tokens[SUI_DEVNET_CHAIN]).not.toContain(
      "0x9::m::X",
    );
  });

  it("clearTokens(chain) empties only that chain", () => {
    useTokenListStore.getState().clearTokens(SUI_DEVNET_CHAIN);
    expect(useTokenListStore.getState().tokens[SUI_DEVNET_CHAIN]).toEqual([]);
    expect(
      (useTokenListStore.getState().tokens[SUI_TESTNET_CHAIN] ?? []).length,
    ).toBeGreaterThan(0);
  });

  it("clearTokens() with no arg clears all chains", () => {
    useTokenListStore.getState().clearTokens();
    expect(useTokenListStore.getState().tokens).toEqual({});
  });
});
