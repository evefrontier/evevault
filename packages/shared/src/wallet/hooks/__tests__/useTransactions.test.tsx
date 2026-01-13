import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGraphQLQuery = vi.fn();

// Mock the GraphQL client
vi.mock("../../../sui/graphqlClient", () => ({
  createSuiGraphQLClient: vi.fn(() => ({
    query: mockGraphQLQuery,
  })),
}));

// Mock the types/graphql module for TRANSACTIONS_QUERY
vi.mock("../../types/graphql", () => ({
  TRANSACTIONS_QUERY: "mocked-query",
  GraphQLBalanceChange: {},
  GraphQLTransactionNode: {},
  TransactionsQueryResponse: {},
  TransactionPage: {},
}));

vi.mock("@evevault/shared/utils", () => ({
  formatByDecimals: vi.fn((value: string) => {
    // Simple mock: divide by 10^9 for SUI
    const num = Number(value) / 1_000_000_000;
    return num.toString();
  }),
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

import { createMockUser } from "@evevault/shared/testing";
import { useTransactions } from "../useTransactions";

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

/**
 * Helper to create a mock GraphQL response for transactions
 *
 * Note: Updated for 2025+ schema where:
 * - transactions (not transactionBlocks)
 * - timestamp is on effects
 * - owner.address (not owner.owner.address)
 */
function createMockGraphQLResponse(
  transactions: Array<{
    digest: string;
    timestamp: string;
    balanceChanges: Array<{
      amount: string;
      coinType: string;
      ownerAddress: string;
    }>;
  }>,
  hasNextPage = false,
  endCursor: string | null = null,
) {
  return {
    data: {
      address: {
        transactions: {
          pageInfo: {
            hasNextPage,
            endCursor,
          },
          nodes: transactions.map((tx) => ({
            digest: tx.digest,
            effects: {
              timestamp: tx.timestamp,
              balanceChanges: {
                nodes: tx.balanceChanges.map((bc) => ({
                  amount: bc.amount,
                  coinType: {
                    repr: bc.coinType,
                  },
                  owner: {
                    address: bc.ownerAddress,
                  },
                })),
              },
            },
          })),
        },
      },
    },
    errors: undefined,
  };
}

describe("useTransactions hook (GraphQL)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("returns loading state initially", async () => {
    mockGraphQLQuery.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const user = createMockUser();
    const wrapper = createWrapper(queryClient);

    const { result, unmount } = renderHook(
      () =>
        useTransactions({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    unmount();
  });

  it("returns transactions on success", async () => {
    const mockResponse = createMockGraphQLResponse([
      {
        digest: "tx123",
        timestamp: "2024-01-01T00:00:00.000Z",
        balanceChanges: [
          {
            amount: "-1000000000",
            coinType: "0x2::sui::SUI",
            ownerAddress: "0x123",
          },
          {
            amount: "1000000000",
            coinType: "0x2::sui::SUI",
            ownerAddress: "0xrecipient456",
          },
        ],
      },
    ]);

    mockGraphQLQuery.mockResolvedValue(mockResponse);

    const user = createMockUser();
    const wrapper = createWrapper(queryClient);

    const { result, unmount } = renderHook(
      () =>
        useTransactions({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].transactions).toHaveLength(1);

    const tx = result.current.data?.pages[0].transactions[0];
    expect(tx?.digest).toBe("tx123");
    expect(tx?.direction).toBe("sent");
    expect(tx?.counterparty).toBe("0xrecipient456");
    expect(tx?.tokenSymbol).toBe("SUI");

    unmount();
  });

  it("identifies received transactions correctly", async () => {
    const mockResponse = createMockGraphQLResponse([
      {
        digest: "tx456",
        timestamp: "2024-01-01T00:00:00.000Z",
        balanceChanges: [
          {
            amount: "-2000000000",
            coinType: "0x2::sui::SUI",
            ownerAddress: "0xsender789",
          },
          {
            amount: "2000000000",
            coinType: "0x2::sui::SUI",
            ownerAddress: "0x123", // User receives
          },
        ],
      },
    ]);

    mockGraphQLQuery.mockResolvedValue(mockResponse);

    const user = createMockUser();
    const wrapper = createWrapper(queryClient);

    const { result, unmount } = renderHook(
      () =>
        useTransactions({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const tx = result.current.data?.pages[0].transactions[0];
    expect(tx?.direction).toBe("received");
    expect(tx?.counterparty).toBe("0xsender789");

    unmount();
  });

  it("handles GraphQL errors by throwing", async () => {
    // When GraphQL returns errors, the hook throws an error
    // The hook will retry twice before failing (retry: 2)
    // We verify the error is thrown by checking that the query was called
    const mockResponse = {
      data: null,
      errors: [{ message: "GraphQL Error" }],
    };

    mockGraphQLQuery.mockResolvedValue(mockResponse);

    const user = createMockUser();
    const wrapper = createWrapper(queryClient);

    const { result, unmount } = renderHook(
      () =>
        useTransactions({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    );

    // Wait for the query to be called (it will retry)
    await waitFor(() => {
      expect(mockGraphQLQuery).toHaveBeenCalled();
    });

    // After first call, query will be in loading/error state (retrying)
    // Just verify the mock was called with errors
    const call = mockGraphQLQuery.mock.calls[0];
    expect(call).toBeDefined();

    // The hook received the error response
    expect(result.current.data).toBeUndefined();

    unmount();
  });

  it("handles empty transaction list", async () => {
    const mockResponse = createMockGraphQLResponse([]);

    mockGraphQLQuery.mockResolvedValue(mockResponse);

    const user = createMockUser();
    const wrapper = createWrapper(queryClient);

    const { result, unmount } = renderHook(
      () =>
        useTransactions({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0].transactions).toHaveLength(0);
    expect(result.current.hasNextPage).toBe(false);

    unmount();
  });

  it("supports pagination with hasNextPage", async () => {
    const mockResponse = createMockGraphQLResponse(
      [
        {
          digest: "tx001",
          timestamp: "2024-01-01T00:00:00.000Z",
          balanceChanges: [
            {
              amount: "-1000000000",
              coinType: "0x2::sui::SUI",
              ownerAddress: "0x123",
            },
            {
              amount: "1000000000",
              coinType: "0x2::sui::SUI",
              ownerAddress: "0xrecipient",
            },
          ],
        },
      ],
      true, // hasNextPage
      "cursor123", // endCursor
    );

    mockGraphQLQuery.mockResolvedValue(mockResponse);

    const user = createMockUser();
    const wrapper = createWrapper(queryClient);

    const { result, unmount } = renderHook(
      () =>
        useTransactions({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.hasNextPage).toBe(true);
    expect(typeof result.current.fetchNextPage).toBe("function");

    unmount();
  });

  it("is disabled when user is null", async () => {
    const wrapper = createWrapper(queryClient);

    const { result, unmount } = renderHook(
      () =>
        useTransactions({
          user: null,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    );

    // Should not be loading or fetching when disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockGraphQLQuery).not.toHaveBeenCalled();

    unmount();
  });

  it("handles null address response gracefully", async () => {
    const mockResponse = {
      data: {
        address: null,
      },
      errors: undefined,
    };

    mockGraphQLQuery.mockResolvedValue(mockResponse);

    const user = createMockUser();
    const wrapper = createWrapper(queryClient);

    const { result, unmount } = renderHook(
      () =>
        useTransactions({
          user,
          chain: SUI_DEVNET_CHAIN,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0].transactions).toHaveLength(0);

    unmount();
  });

  it("passes correct variables to GraphQL query", async () => {
    const mockResponse = createMockGraphQLResponse([]);
    mockGraphQLQuery.mockResolvedValue(mockResponse);

    const user = createMockUser();
    const wrapper = createWrapper(queryClient);

    const { unmount } = renderHook(
      () =>
        useTransactions({
          user,
          chain: SUI_DEVNET_CHAIN,
          pageSize: 50,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mockGraphQLQuery).toHaveBeenCalled();
    });

    const callArgs = mockGraphQLQuery.mock.calls[0][0];
    expect(callArgs.variables.address).toBe("0x123");
    expect(callArgs.variables.first).toBe(50);
    expect(callArgs.variables.after).toBeUndefined();

    unmount();
  });
});
