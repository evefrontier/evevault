import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mockGetBalance = vi.fn();
const mockGetCoinMetadata = vi.fn();

vi.mock("@evevault/shared/sui", () => ({
  createSuiClient: vi.fn(),
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
}));

import { createSuiClient } from "@evevault/shared/sui";
import { createMockUser } from "@evevault/shared/testing";
import { formatSUI } from "@suiet/wallet-kit";
// Import after mocks are declared
import { useBalance } from "../useBalance";

const mockedCreateSuiClient = vi.mocked(createSuiClient);
const mockedFormatSUI = vi.mocked(formatSUI);

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useBalance hook", () => {
  it("returns a formatted SUI balance for the current user", async () => {
    mockedCreateSuiClient.mockReturnValue({
      getBalance: mockGetBalance,
      getCoinMetadata: mockGetCoinMetadata,
    } as unknown as ReturnType<typeof createSuiClient>);

    mockGetBalance.mockResolvedValueOnce({ totalBalance: "1000" });
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

    expect(mockedCreateSuiClient).toHaveBeenCalledWith(SUI_DEVNET_CHAIN);
    expect(mockGetBalance).toHaveBeenCalledWith({
      owner: "0x123",
      coinType: "0x2::sui::SUI",
    });
    expect(result.current.data?.formattedBalance).toBe("formatted-1000");

    unmount();
    queryClient.clear();
  });
});
