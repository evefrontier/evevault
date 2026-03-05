import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("../../../sui/graphqlClient", () => ({
  createSuiGraphQLClient: vi.fn(() => ({ query: mockQuery })),
}));

vi.mock("@suiet/wallet-kit", () => ({
  formatSUI: vi.fn(),
}));

vi.mock("@evevault/shared/utils", () => ({
  formatSUI: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  isExtension: vi.fn(() => false),
  isWeb: vi.fn(() => true),
  isBrowser: vi.fn(() => true),
  SUI_COIN_TYPE: "0x2::sui::SUI",
  EVE_TESTNET_COIN_TYPE:
    "0x59d7bb2e0feffb90cb2446fb97c2ce7d4bd24d2fb98939d6cb6c3940110a0de0::EVE::EVE",
  formatByDecimals: vi.fn((balance: string) => balance),
}));

import { createMockUser } from "@evevault/shared/testing";
import { formatSUI } from "@suiet/wallet-kit";
import { useBalance } from "../useBalance";

const mockedFormatSUI = vi.mocked(formatSUI);

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useBalance hook", () => {
  it("returns a formatted SUI balance for the current user", async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        address: { balance: { totalBalance: "1000" } },
        coinMetadata: {
          decimals: 9,
          symbol: "SUI",
          name: "Sui",
          description: "Sui Native Token",
          iconUrl: null,
        },
      },
      errors: undefined,
    });
    mockedFormatSUI.mockReturnValueOnce("formatted-1000");
    const user = createMockUser();

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const wrapper = createWrapper(queryClient);
    const { result, unmount } = renderHook(
      () =>
        useBalance({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { address: "0x123", coinType: "0x2::sui::SUI" },
      }),
    );
    expect(result.current.data?.formattedBalance).toBe("formatted-1000");

    unmount();
    queryClient.clear();
  });
});
