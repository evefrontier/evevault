import { describe, expect, it } from "vitest";
import { getSuiscanUrl } from "../suiscan";

describe("getSuiscanUrl", () => {
  it("generates correct URL for devnet", () => {
    const url = getSuiscanUrl("sui:devnet", "0xabc123");
    expect(url).toBe("https://suiscan.xyz/devnet/tx/0xabc123");
  });

  it("generates correct URL for testnet", () => {
    const url = getSuiscanUrl("sui:testnet", "0xdef456");
    expect(url).toBe("https://suiscan.xyz/testnet/tx/0xdef456");
  });

  it("generates correct URL for mainnet", () => {
    const url = getSuiscanUrl("sui:mainnet", "0x789ghi");
    expect(url).toBe("https://suiscan.xyz/mainnet/tx/0x789ghi");
  });

  it("handles full transaction digest", () => {
    const digest = "8GmJh2Nf4p3YrTqK5XsL9WbVc1AdZe6HxQi7RuMo0JkC";
    const url = getSuiscanUrl("sui:devnet", digest);
    expect(url).toBe(`https://suiscan.xyz/devnet/tx/${digest}`);
  });
});
