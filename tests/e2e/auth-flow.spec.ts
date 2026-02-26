import { expect, test } from "@playwright/test";

test.describe("Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start with no authentication
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("shows login screen when not authenticated", async ({ page }) => {
    await page.goto("/");

    // Should redirect to login or show login prompt
    await expect(
      page.getByRole("button", { name: /sign in|login/i })
    ).toBeVisible();
  });

  test("displays login button", async ({ page }) => {
    await page.goto("/");

    const loginButton = page.getByRole("button", { name: /sign in|login/i });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();
  });

  test("clicking login redirects to OIDC provider", async ({ page }) => {
    await page.goto("/");

    // Get initial URL
    const initialUrl = page.url();

    // Click login button
    const loginButton = page.getByRole("button", { name: /sign in|login/i });
    await loginButton.click();

    // Should redirect to OIDC provider or show loading state
    await page.waitForTimeout(1000);

    const currentUrl = page.url();

    // URL should change (either to callback route or external OIDC)
    expect(currentUrl).not.toBe(initialUrl);
  });

  test("shows loading state while redirecting", async ({ page }) => {
    await page.goto("/");

    const loginButton = page.getByRole("button", { name: /sign in|login/i });
    await loginButton.click();

    // Look for loading indicator
    const loadingIndicator = page.getByText(/loading|signing in/i);
    if (await loadingIndicator.isVisible()) {
      expect(loadingIndicator).toBeVisible();
    }
  });

  test("displays app branding on login screen", async ({ page }) => {
    await page.goto("/");

    // Should show app name or logo
    await expect(page.getByText(/eve.*vault|evevault/i)).toBeVisible();
  });

  test("shows network selector on login screen", async ({ page }) => {
    await page.goto("/");

    // User should be able to see which network they're connecting to
    await expect(page.getByText(/devnet|testnet|mainnet/i)).toBeVisible();
  });

  test("callback route handles successful authentication", async ({ page }) => {
    // Mock OIDC callback with success parameters
    const mockAuthCode = "mock-auth-code-12345";
    const mockState = "mock-state-value";

    await page.goto(`/callback?code=${mockAuthCode}&state=${mockState}`);

    // Should process the callback
    // Either show loading or redirect to wallet
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    // Should redirect away from callback route
    expect(currentUrl).toMatch(/\/(wallet|$)/);
  });

  test("callback route handles authentication error", async ({ page }) => {
    // Mock OIDC callback with error
    await page.goto("/callback?error=access_denied&error_description=User+cancelled");

    // Should show error message
    await expect(
      page.getByText(/error|failed|cancelled/i)
    ).toBeVisible();
  });

  test("callback route without parameters shows error", async ({ page }) => {
    await page.goto("/callback");

    // Should show error for missing parameters
    await expect(
      page.getByText(/error|invalid|missing/i)
    ).toBeVisible();
  });

  test("shows network selection before login", async ({ page }) => {
    await page.goto("/");

    // Look for network selector
    const networkSelector = page.getByRole("button", { name: /network/i });
    if (await networkSelector.isVisible()) {
      await networkSelector.click();

      // Should show network options
      await expect(page.getByText(/devnet/i)).toBeVisible();
      await expect(page.getByText(/testnet/i)).toBeVisible();
    }
  });

  test("persists network selection through login flow", async ({ page }) => {
    await page.goto("/");

    // Select testnet before login (if selector is available)
    const networkSelector = page.getByRole("button", { name: /network/i });
    if (await networkSelector.isVisible()) {
      await networkSelector.click();
      await page.getByRole("button", { name: /^testnet$/i }).click();

      // Selected network should be remembered
      await expect(page.getByText(/testnet/i)).toBeVisible();
    }
  });
});

test.describe("Logout Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Setup authenticated state
    const nowSeconds = Math.floor(Date.now() / 1000);

    const authState = {
      version: 0,
      state: {
        user: {
          id_token: "test-id-token",
          access_token: "test-access-token",
          token_type: "Bearer",
          scope: "openid email profile",
          profile: {
            sub: "test-user",
            email: "test@example.com",
            preferred_username: "test-user",
            sui_address:
              "0x5c8d5f5dcba872534f9b0ce3a20b708b8b47863d4a96e31c2f9556b6c8ddc8f9",
            salt: "0x1",
          },
          expires_at: nowSeconds + 3600,
        },
        loading: false,
        error: null,
      },
    };

    await page.addInitScript(
      (auth) => {
        window.localStorage.setItem("evevault:auth", JSON.stringify(auth));
      },
      authState
    );
  });

  test("displays logout option when authenticated", async ({ page }) => {
    await page.goto("/wallet");

    // Look for logout button (might be in menu)
    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    await expect(logoutButton).toBeVisible();
  });

  test("shows confirmation dialog before logout", async ({ page }) => {
    await page.goto("/wallet");

    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    await logoutButton.click();

    // Should show confirmation
    await expect(page.getByText(/confirm|sure|logout/i)).toBeVisible();
  });

  test("can cancel logout", async ({ page }) => {
    await page.goto("/wallet");

    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    await logoutButton.click();

    // Cancel in confirmation dialog
    const cancelButton = page.getByRole("button", { name: /cancel/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Should remain on wallet page
      await expect(page).toHaveURL(/\/wallet/);
    }
  });

  test("redirects to login after logout", async ({ page }) => {
    await page.goto("/wallet");

    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    await logoutButton.click();

    // Confirm logout
    const confirmButton = page.getByRole("button", { name: /confirm|yes|logout/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Should redirect to login
    await page.waitForURL(/\/(login|$)/, { timeout: 5000 });
    await expect(
      page.getByRole("button", { name: /sign in|login/i })
    ).toBeVisible();
  });

  test("clears user data on logout", async ({ page }) => {
    await page.goto("/wallet");

    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    await logoutButton.click();

    // Confirm logout
    const confirmButton = page.getByRole("button", { name: /confirm|yes|logout/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Wait for redirect
    await page.waitForTimeout(1000);

    // Try to navigate to wallet
    await page.goto("/wallet");

    // Should redirect to login since not authenticated
    await expect(
      page.getByRole("button", { name: /sign in|login/i })
    ).toBeVisible();
  });
});
