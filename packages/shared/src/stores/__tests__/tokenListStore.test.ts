import { describe, expect, it, vi } from "vitest";
import { useTokenListStore } from "../tokenListStore";

// Mock environment detection
vi.mock("../../utils/environment", () => ({
  isWeb: vi.fn().mockReturnValue(true),
}));

// Mock storage adapters
vi.mock("../../adapters", () => ({
  localStorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  chromeStorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("tokenListStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useTokenListStore.setState({
      tokens: ["0x2::sui::SUI"],
    });
  });

  describe("initial state", () => {
    it("has SUI token by default", () => {
      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(["0x2::sui::SUI"]);
    });
  });

  describe("addToken", () => {
    it("adds a new token to the list", () => {
      const { addToken } = useTokenListStore.getState();

      addToken("0x123::usdc::USDC");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(["0x2::sui::SUI", "0x123::usdc::USDC"]);
    });

    it("trims whitespace from coin type", () => {
      const { addToken } = useTokenListStore.getState();

      addToken("  0x123::usdc::USDC  ");

      const state = useTokenListStore.getState();
      expect(state.tokens).toContain("0x123::usdc::USDC");
    });

    it("does not add duplicate tokens", () => {
      const { addToken } = useTokenListStore.getState();

      addToken("0x123::usdc::USDC");
      addToken("0x123::usdc::USDC");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(["0x2::sui::SUI", "0x123::usdc::USDC"]);
    });

    it("does not add empty string", () => {
      const { addToken } = useTokenListStore.getState();
      const initialTokens = useTokenListStore.getState().tokens;

      addToken("");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(initialTokens);
    });

    it("does not add whitespace-only string", () => {
      const { addToken } = useTokenListStore.getState();
      const initialTokens = useTokenListStore.getState().tokens;

      addToken("   ");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(initialTokens);
    });

    it("adds multiple different tokens", () => {
      const { addToken } = useTokenListStore.getState();

      addToken("0x123::usdc::USDC");
      addToken("0x456::usdt::USDT");
      addToken("0x789::dai::DAI");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual([
        "0x2::sui::SUI",
        "0x123::usdc::USDC",
        "0x456::usdt::USDT",
        "0x789::dai::DAI",
      ]);
    });

    it("preserves order of added tokens", () => {
      const { addToken } = useTokenListStore.getState();

      addToken("0x1::token1::T1");
      addToken("0x2::token2::T2");
      addToken("0x3::token3::T3");

      const state = useTokenListStore.getState();
      const addedTokens = state.tokens.slice(1); // Skip SUI
      expect(addedTokens).toEqual([
        "0x1::token1::T1",
        "0x2::token2::T2",
        "0x3::token3::T3",
      ]);
    });
  });

  describe("removeToken", () => {
    it("removes a token from the list", () => {
      const { addToken, removeToken } = useTokenListStore.getState();

      addToken("0x123::usdc::USDC");
      removeToken("0x123::usdc::USDC");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(["0x2::sui::SUI"]);
    });

    it("removes correct token when multiple exist", () => {
      const { addToken, removeToken } = useTokenListStore.getState();

      addToken("0x123::usdc::USDC");
      addToken("0x456::usdt::USDT");
      removeToken("0x123::usdc::USDC");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(["0x2::sui::SUI", "0x456::usdt::USDT"]);
    });

    it("does nothing when removing non-existent token", () => {
      const initialState = useTokenListStore.getState().tokens;
      const { removeToken } = useTokenListStore.getState();

      removeToken("0x999::nonexistent::TOKEN");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(initialState);
    });

    it("can remove SUI token", () => {
      const { removeToken } = useTokenListStore.getState();

      removeToken("0x2::sui::SUI");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual([]);
    });

    it("removes all occurrences of a token", () => {
      // Manually add duplicate (bypassing validation)
      useTokenListStore.setState({
        tokens: ["0x2::sui::SUI", "0x123::usdc::USDC", "0x123::usdc::USDC"],
      });

      const { removeToken } = useTokenListStore.getState();
      removeToken("0x123::usdc::USDC");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(["0x2::sui::SUI"]);
    });
  });

  describe("clearTokens", () => {
    it("removes all tokens", () => {
      const { addToken, clearTokens } = useTokenListStore.getState();

      addToken("0x123::usdc::USDC");
      addToken("0x456::usdt::USDT");
      clearTokens();

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual([]);
    });

    it("can be called when already empty", () => {
      const { clearTokens } = useTokenListStore.getState();

      useTokenListStore.setState({ tokens: [] });
      clearTokens();

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual([]);
    });

    it("clears including SUI token", () => {
      const { clearTokens } = useTokenListStore.getState();

      clearTokens();

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual([]);
      expect(state.tokens).not.toContain("0x2::sui::SUI");
    });
  });

  describe("edge cases", () => {
    it("handles very long coin type strings", () => {
      const { addToken } = useTokenListStore.getState();
      const longCoinType = `0x${"a".repeat(100)}::token::TOKEN`;

      addToken(longCoinType);

      const state = useTokenListStore.getState();
      expect(state.tokens).toContain(longCoinType);
    });

    it("handles special characters in coin type", () => {
      const { addToken } = useTokenListStore.getState();

      addToken("0x123::token::TOKEN_123");

      const state = useTokenListStore.getState();
      expect(state.tokens).toContain("0x123::token::TOKEN_123");
    });

    it("handles case-sensitive duplicates as different tokens", () => {
      const { addToken } = useTokenListStore.getState();

      addToken("0x123::token::TOKEN");
      addToken("0x123::token::token");

      const state = useTokenListStore.getState();
      expect(state.tokens).toContain("0x123::token::TOKEN");
      expect(state.tokens).toContain("0x123::token::token");
    });
  });

  describe("complex workflows", () => {
    it("handles add, remove, add sequence", () => {
      const { addToken, removeToken } = useTokenListStore.getState();

      addToken("0x123::usdc::USDC");
      removeToken("0x123::usdc::USDC");
      addToken("0x123::usdc::USDC");

      const state = useTokenListStore.getState();
      expect(state.tokens).toContain("0x123::usdc::USDC");
    });

    it("handles multiple operations in sequence", () => {
      const { addToken, removeToken, clearTokens } = useTokenListStore.getState();

      addToken("0x1::token1::T1");
      addToken("0x2::token2::T2");
      removeToken("0x1::token1::T1");
      addToken("0x3::token3::T3");
      clearTokens();
      addToken("0x4::token4::T4");

      const state = useTokenListStore.getState();
      expect(state.tokens).toEqual(["0x4::token4::T4"]);
    });
  });
});
