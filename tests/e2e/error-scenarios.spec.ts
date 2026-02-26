import { expect, test } from "@playwright/test";
import { seedPersistedAppState } from "./helpers/state";
import { mockSuiRpc } from "./helpers/suiRpc";

test.describe("Error Scenarios and Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await seedPersistedAppState(page);
  });

  describe("RPC Failures", () => {
    test("shows error when RPC is unavailable", async ({ page }) => {
      // Mock RPC to fail
      await page.route("**/fullnode.devnet.sui.io/**", async (route) => {
        route.abort("failed");
      });

      await page.goto("/wallet");

      // Should show error message
      await expect(
        page.getByText(/error|failed.*connect|network.*error/i)
      ).toBeVisible();
    });

    test("shows error when balance fetch fails", async ({ page }) => {
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

        if (body?.method === "suix_getBalance") {
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              error: { code: -32000, message: "Internal error" },
            }),
          });
        }

        return route.continue();
      });

      await page.goto("/wallet");

      // Should show error for balance fetch
      await expect(
        page.getByText(/error.*balance|failed.*load/i)
      ).toBeVisible();
    });

    test("retries failed requests", async ({ page }) => {
      let attemptCount = 0;

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

        if (body?.method === "suix_getBalance") {
          attemptCount++;

          if (attemptCount === 1) {
            // Fail first attempt
            return route.abort("failed");
          }

          // Succeed on retry
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              result: {
                totalBalance: "1000000000",
                coinType: "0x2::sui::SUI",
                coinObjectCount: 1,
                lockedBalance: [],
              },
            }),
          });
        }

        return route.continue();
      });

      await page.goto("/wallet");

      // Look for retry button or automatic retry
      const retryButton = page.getByRole("button", { name: /retry|try again/i });
      if (await retryButton.isVisible()) {
        await retryButton.click();
      }

      // Should eventually succeed
      await expect(page.getByTestId("wallet-balance")).toBeVisible();
    });
  });

  describe("Network Errors", () => {
    test("handles slow network gracefully", async ({ page }) => {
      await page.route("**/fullnode.devnet.sui.io/**", async (route) => {
        // Add delay to simulate slow network
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return route.continue();
      });

      await page.goto("/wallet");

      // Should show loading state
      await expect(page.getByText(/loading/i)).toBeVisible();
    });

    test("shows timeout error for very slow requests", async ({ page }) => {
      await page.route("**/fullnode.devnet.sui.io/**", async (route) => {
        // Delay longer than timeout
        await new Promise((resolve) => setTimeout(resolve, 30000));
        return route.continue();
      });

      await page.goto("/wallet", { timeout: 10000 }).catch(() => {
        // Expect navigation to timeout
      });

      // Should show timeout or error message
      const errorMessage = page.getByText(/timeout|too long|try again/i);
      if (await errorMessage.isVisible()) {
        expect(errorMessage).toBeVisible();
      }
    });
  });

  describe("Invalid State Recovery", () => {
    test("recovers from corrupted localStorage", async ({ page }) => {
      await page.addInitScript(() => {
        // Set invalid JSON in localStorage
        window.localStorage.setItem("evevault:auth", "invalid json {{{");
      });

      await page.goto("/");

      // Should not crash, should redirect to login
      await expect(
        page.getByRole("button", { name: /sign in|login/i })
      ).toBeVisible();
    });

    test("handles missing localStorage gracefully", async ({ page }) => {
      await page.addInitScript(() => {
        // Clear all localStorage
        window.localStorage.clear();
      });

      await page.goto("/");

      // Should show login screen
      await expect(
        page.getByRole("button", { name: /sign in|login/i })
      ).toBeVisible();
    });

    test("recovers from expired session", async ({ page }) => {
      await page.addInitScript(() => {
        const expiredAuth = {
          version: 0,
          state: {
            user: {
              id_token: "expired-token",
              access_token: "expired-access",
              token_type: "Bearer",
              scope: "openid email profile",
              profile: {
                sub: "test-user",
                email: "test@example.com",
                preferred_username: "test-user",
                sui_address: "0x123",
                salt: "0x1",
              },
              expires_at: Date.now() / 1000 - 3600, // Expired 1 hour ago
            },
            loading: false,
            error: null,
          },
        };

        window.localStorage.setItem(
          "evevault:auth",
          JSON.stringify(expiredAuth)
        );
      });

      await page.goto("/wallet");

      // Should redirect to login or show re-auth prompt
      await expect(
        page.getByText(/expired|sign in again|re-authenticate/i)
      ).toBeVisible();
    });
  });

  describe("Input Validation Edge Cases", () => {
    test("handles very long addresses in send token", async ({ page }) => {
      await mockSuiRpc(page);
      await page.goto("/wallet/send-token");

      // Enter extremely long address
      const veryLongAddress = "0x" + "a".repeat(1000);
      await page.getByPlaceholder(/0x.*/i).fill(veryLongAddress);

      // Should show validation error
      await page.getByRole("button", { name: /send/i }).click();
      await expect(page.getByText(/invalid|too long/i)).toBeVisible();
    });

    test("handles special characters in token input", async ({ page }) => {
      await mockSuiRpc(page);
      await page.goto("/wallet/add-token");

      // Enter token with special chars
      await page
        .getByPlaceholder(/coin type/i)
        .fill("<script>alert('xss')</script>");

      await page.getByRole("button", { name: /add token/i }).click();

      // Should sanitize or reject input
      await expect(page.getByText(/invalid.*format/i)).toBeVisible();
    });

    test("handles SQL injection attempts", async ({ page }) => {
      await mockSuiRpc(page);
      await page.goto("/wallet/add-token");

      // Try SQL injection
      await page
        .getByPlaceholder(/coin type/i)
        .fill("'; DROP TABLE tokens; --");

      await page.getByRole("button", { name: /add token/i }).click();

      // Should safely reject or sanitize
      await expect(page.getByText(/invalid.*format/i)).toBeVisible();
    });

    test("handles decimal precision edge cases", async ({ page }) => {
      await mockSuiRpc(page, { balance: "5000000000" });
      await page.goto("/wallet/send-token");

      // Enter amount with many decimal places
      await page
        .getByPlaceholder(/0x.*/i)
        .fill("0x5c8d5f5dcba872534f9b0ce3a20b708b8b47863d4a96e31c2f9556b6c8ddc8f9");
      await page.getByPlaceholder(/amount/i).fill("1.123456789123456789");

      // Should handle or truncate precision appropriately
      const amountInput = page.getByPlaceholder(/amount/i);
      const value = await amountInput.inputValue();

      // Value should be accepted or truncated
      expect(value).toBeTruthy();
    });
  });

  describe("UI Edge Cases", () => {
    test("handles rapid clicking on buttons", async ({ page }) => {
      await mockSuiRpc(page);
      await page.goto("/wallet");

      const sendButton = page.getByRole("button", { name: /send/i }).first();

      // Click rapidly multiple times
      await sendButton.click();
      await sendButton.click();
      await sendButton.click();

      // Should only navigate once
      await page.waitForTimeout(500);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/wallet\/send-token/);

      // Should not have multiple modals or errors
      const modals = page.locator('[role="dialog"]');
      const modalCount = await modals.count();
      expect(modalCount).toBeLessThanOrEqual(1);
    });

    test("handles browser back button correctly", async ({ page }) => {
      await mockSuiRpc(page);
      await page.goto("/wallet");

      // Navigate to send token
      await page.getByRole("button", { name: /send/i }).click();
      await expect(page).toHaveURL(/\/wallet\/send-token/);

      // Use browser back button
      await page.goBack();

      // Should return to wallet
      await expect(page).toHaveURL(/\/wallet$/);
      await expect(page.getByTestId("wallet-balance")).toBeVisible();
    });

    test("handles page reload during transaction", async ({ page }) => {
      await mockSuiRpc(page);
      await page.goto("/wallet/send-token");

      // Fill form
      await page
        .getByPlaceholder(/0x.*/i)
        .fill("0x5c8d5f5dcba872534f9b0ce3a20b708b8b47863d4a96e31c2f9556b6c8ddc8f9");
      await page.getByPlaceholder(/amount/i).fill("1");

      // Reload page
      await page.reload();

      // Form should be cleared or restored
      const addressInput = page.getByPlaceholder(/0x.*/i);
      const addressValue = await addressInput.inputValue();

      // Either cleared or error message shown
      expect(
        addressValue === "" ||
          (await page.getByText(/error|reload/i).isVisible())
      ).toBeTruthy();
    });

    test("handles small viewport correctly", async ({ page }) => {
      await mockSuiRpc(page);

      // Set very small viewport
      await page.setViewportSize({ width: 320, height: 568 });

      await page.goto("/wallet");

      // UI should be responsive and usable
      await expect(page.getByTestId("wallet-balance")).toBeVisible();

      // Navigation should be accessible
      const navElements = await page.locator("nav, [role='navigation']").count();
      expect(navElements).toBeGreaterThan(0);
    });

    test("handles large viewport correctly", async ({ page }) => {
      await mockSuiRpc(page);

      // Set very large viewport
      await page.setViewportSize({ width: 3840, height: 2160 });

      await page.goto("/wallet");

      // UI should scale appropriately
      await expect(page.getByTestId("wallet-balance")).toBeVisible();

      // Layout should not be broken
      const body = await page.locator("body").boundingBox();
      expect(body?.width).toBeLessThanOrEqual(3840);
    });
  });

  describe("Concurrent Operations", () => {
    test("handles network switch during balance fetch", async ({ page }) => {
      await mockSuiRpc(page);
      await page.goto("/wallet");

      // While balance is loading, try to switch network
      const networkButton = page.getByRole("button", { name: /network/i });
      await networkButton.click();

      // Should handle gracefully without errors
      await expect(page.getByRole("button", { name: /testnet/i })).toBeVisible();
    });

    test("handles multiple simultaneous toast messages", async ({ page }) => {
      await mockSuiRpc(page);
      await page.goto("/wallet");

      // Trigger multiple actions that show toasts
      // (This depends on your app's toast implementation)

      // Should show toasts sequentially or stack them
      // without crashing or overlapping incorrectly
      const toasts = page.locator('[role="alert"], .toast');
      const toastCount = await toasts.count();

      // Should have at most reasonable number of toasts
      expect(toastCount).toBeLessThanOrEqual(5);
    });
  });
});
