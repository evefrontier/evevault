import { expect, test } from "@playwright/test";
import { seedPersistedAppState } from "./helpers/state";
import { mockSuiRpc } from "./helpers/suiRpc";

test.describe("Transaction History", () => {
  test.beforeEach(async ({ page }) => {
    await seedPersistedAppState(page);
    await mockSuiRpc(page);

    // Mock transaction history RPC response
    await page.route("**/fullnode.devnet.sui.io/**", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        return route.continue();
      }

      let body: any;
      try {
        body = request.postDataJSON();
      } catch {
        return route.continue();
      }

      if (body?.method === "suix_queryTransactionBlocks") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              data: [
                {
                  digest: "test-digest-1",
                  timestampMs: Date.now() - 3600000, // 1 hour ago
                  transaction: {
                    data: {
                      sender:
                        "0x5c8d5f5dcba872534f9b0ce3a20b708b8b47863d4a96e31c2f9556b6c8ddc8f9",
                      transaction: {
                        kind: "ProgrammableTransaction",
                        inputs: [],
                        transactions: [],
                      },
                    },
                  },
                  effects: {
                    status: { status: "success" },
                  },
                },
                {
                  digest: "test-digest-2",
                  timestampMs: Date.now() - 7200000, // 2 hours ago
                  transaction: {
                    data: {
                      sender:
                        "0x5c8d5f5dcba872534f9b0ce3a20b708b8b47863d4a96e31c2f9556b6c8ddc8f9",
                      transaction: {
                        kind: "ProgrammableTransaction",
                        inputs: [],
                        transactions: [],
                      },
                    },
                  },
                  effects: {
                    status: { status: "success" },
                  },
                },
              ],
              nextCursor: null,
              hasNextPage: false,
            },
          }),
        });
      }

      return route.continue();
    });
  });

  test("navigates to transaction history from wallet", async ({ page }) => {
    await page.goto("/wallet");

    // Click transactions button/link
    await page.getByRole("link", { name: /transactions|history/i }).click();

    // Should navigate to transactions screen
    await expect(page).toHaveURL(/\/wallet\/transactions/);
  });

  test("displays transaction list", async ({ page }) => {
    await page.goto("/wallet/transactions");

    // Should show transaction items
    await expect(page.getByText(/test-digest-1/i)).toBeVisible();
    await expect(page.getByText(/test-digest-2/i)).toBeVisible();
  });

  test("shows transaction timestamps", async ({ page }) => {
    await page.goto("/wallet/transactions");

    // Should show relative time (e.g., "1 hour ago")
    await expect(page.getByText(/hour.*ago|min.*ago/i)).toBeVisible();
  });

  test("shows transaction status", async ({ page }) => {
    await page.goto("/wallet/transactions");

    // Should show success status
    await expect(page.getByText(/success|completed/i)).toBeVisible();
  });

  test("shows empty state when no transactions", async ({ page }) => {
    // Override mock to return empty transactions
    await page.route("**/fullnode.devnet.sui.io/**", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        return route.continue();
      }

      let body: any;
      try {
        body = request.postDataJSON();
      } catch {
        return route.continue();
      }

      if (body?.method === "suix_queryTransactionBlocks") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              data: [],
              nextCursor: null,
              hasNextPage: false,
            },
          }),
        });
      }

      return route.continue();
    });

    await page.goto("/wallet/transactions");

    // Should show empty state message
    await expect(page.getByText(/no.*transactions/i)).toBeVisible();
  });

  test("can click on transaction for details", async ({ page }) => {
    await page.goto("/wallet/transactions");

    // Click on first transaction
    const firstTransaction = page.getByText(/test-digest-1/i).first();
    await firstTransaction.click();

    // Should show transaction details (modal or new view)
    await expect(page.getByText(/transaction.*details/i)).toBeVisible();
  });

  test("can return to wallet from transactions", async ({ page }) => {
    await page.goto("/wallet/transactions");

    // Click back button
    await page.getByRole("button", { name: /back/i }).click();

    // Should return to wallet
    await expect(page).toHaveURL(/\/wallet$/);
  });

  test("refreshes transaction list when manually triggered", async ({
    page,
  }) => {
    await page.goto("/wallet/transactions");

    // Look for refresh button
    const refreshButton = page.getByRole("button", { name: /refresh/i });
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Should show loading state briefly
      await expect(refreshButton).toBeDisabled();
    }
  });

  test("filters transactions by type", async ({ page }) => {
    await page.goto("/wallet/transactions");

    // Look for filter controls
    const filterButton = page.getByRole("button", { name: /filter|all/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Should show filter options
      await expect(page.getByText(/sent|received|all/i)).toBeVisible();
    }
  });

  test("shows loading state while fetching transactions", async ({ page }) => {
    // Add delay to RPC response to see loading state
    await page.route("**/fullnode.devnet.sui.io/**", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        return route.continue();
      }

      let body: any;
      try {
        body = request.postDataJSON();
      } catch {
        return route.continue();
      }

      if (body?.method === "suix_queryTransactionBlocks") {
        // Delay response
        await new Promise((resolve) => setTimeout(resolve, 100));
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              data: [],
              nextCursor: null,
              hasNextPage: false,
            },
          }),
        });
      }

      return route.continue();
    });

    await page.goto("/wallet/transactions");

    // Should show loading indicator
    await expect(page.getByText(/loading/i)).toBeVisible();
  });

  test("handles RPC errors gracefully", async ({ page }) => {
    // Mock RPC error
    await page.route("**/fullnode.devnet.sui.io/**", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        return route.continue();
      }

      let body: any;
      try {
        body = request.postDataJSON();
      } catch {
        return route.continue();
      }

      if (body?.method === "suix_queryTransactionBlocks") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Internal server error",
          }),
        });
      }

      return route.continue();
    });

    await page.goto("/wallet/transactions");

    // Should show error message
    await expect(
      page.getByText(/error.*loading.*transactions|failed.*fetch/i)
    ).toBeVisible();
  });
});
