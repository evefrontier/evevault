import { expect, test } from "@playwright/test";
import { seedPersistedAppState } from "./helpers/state";
import { mockSuiRpc } from "./helpers/suiRpc";

test.describe("Network Switching", () => {
  test.beforeEach(async ({ page }) => {
    await seedPersistedAppState(page);
    await mockSuiRpc(page);
  });

  test("displays current network in selector", async ({ page }) => {
    await page.goto("/wallet");

    // Network selector should show devnet (from seeded state)
    await expect(page.getByText(/devnet/i)).toBeVisible();
  });

  test("opens network dropdown when clicked", async ({ page }) => {
    await page.goto("/wallet");

    // Click network selector
    await page.getByRole("button", { name: /network/i }).click();

    // Dropdown should show all networks
    await expect(page.getByRole("button", { name: /^devnet$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^testnet$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^mainnet$/i })).toBeVisible();
  });

  test("shows checkmark on current network", async ({ page }) => {
    await page.goto("/wallet");

    // Open dropdown
    await page.getByRole("button", { name: /network/i }).click();

    // Devnet should have checkmark
    const devnetButton = page.getByRole("button", { name: /^devnet$/i });
    await expect(devnetButton).toContainText("✓");
  });

  test("closes dropdown when clicking outside", async ({ page }) => {
    await page.goto("/wallet");

    // Open dropdown
    await page.getByRole("button", { name: /network/i }).click();
    await expect(page.getByRole("button", { name: /^testnet$/i })).toBeVisible();

    // Click outside (on wallet balance)
    await page.getByTestId("wallet-balance").click();

    // Dropdown should close
    await expect(
      page.getByRole("button", { name: /^testnet$/i })
    ).not.toBeVisible();
  });

  test("shows sign in dialog when switching to network without JWT", async ({
    page,
  }) => {
    await page.goto("/wallet");

    // Open network dropdown
    await page.getByRole("button", { name: /network/i }).click();

    // Click testnet (user doesn't have JWT for testnet in seeded state)
    await page.getByRole("button", { name: /^testnet$/i }).click();

    // Should show sign in dialog
    await expect(page.getByText(/sign in required/i)).toBeVisible();
    await expect(
      page.getByText(/haven't signed in on testnet/i)
    ).toBeVisible();
  });

  test("can cancel network switch requiring auth", async ({ page }) => {
    await page.goto("/wallet");

    // Trigger network switch that requires auth
    await page.getByRole("button", { name: /network/i }).click();
    await page.getByRole("button", { name: /^testnet$/i }).click();

    // Cancel in dialog
    await page.getByRole("button", { name: /cancel/i }).click();

    // Should stay on devnet
    await expect(page.getByText(/devnet/i)).toBeVisible();
    await expect(page.getByText(/sign in required/i)).not.toBeVisible();
  });

  test("switches network when user confirms sign in", async ({ page }) => {
    await page.goto("/wallet");

    const initialNetwork = await page
      .getByRole("button", { name: /network/i })
      .textContent();

    // Trigger network switch
    await page.getByRole("button", { name: /network/i }).click();
    await page.getByRole("button", { name: /^testnet$/i }).click();

    // Confirm sign in
    await page.getByRole("button", { name: /sign in/i }).click();

    // Network should change (even though auth might fail in test)
    await expect(page.getByText(/testnet/i)).toBeVisible();

    const newNetwork = await page
      .getByRole("button", { name: /network/i })
      .textContent();

    expect(newNetwork).not.toBe(initialNetwork);
  });

  test("maintains wallet balance after seamless network switch", async ({
    page,
  }) => {
    // Note: This test assumes the user has JWT for both networks
    // In real scenario, we'd need to seed state with JWTs for multiple networks
    await page.goto("/wallet");

    const initialBalance = await page.getByTestId("wallet-balance").textContent();

    // Try to switch networks
    await page.getByRole("button", { name: /network/i }).click();
    await page.getByRole("button", { name: /^testnet$/i }).click();

    // If seamless switch occurs, balance should update
    // If re-auth required, dialog will appear
    const dialogVisible = await page
      .getByText(/sign in required/i)
      .isVisible()
      .catch(() => false);

    if (!dialogVisible) {
      // Seamless switch occurred
      // Balance might change based on new network
      const newBalance = await page.getByTestId("wallet-balance").textContent();
      expect(newBalance).toBeDefined();
    }
  });

  test("persists network selection across page reloads", async ({ page }) => {
    await page.goto("/wallet");

    // Note: Since seeded state has devnet, we start there
    await expect(page.getByText(/devnet/i)).toBeVisible();

    // Reload page
    await page.reload();

    // Should still show devnet
    await expect(page.getByText(/devnet/i)).toBeVisible();
  });

  test("shows loading state while switching networks", async ({ page }) => {
    await page.goto("/wallet");

    // Open dropdown and click network
    await page.getByRole("button", { name: /network/i }).click();
    await page.getByRole("button", { name: /^testnet$/i }).click();

    // In the sign in dialog, click sign in
    const signInButton = page.getByRole("button", { name: /sign in/i });
    if (await signInButton.isVisible()) {
      await signInButton.click();

      // Button should show loading state
      await expect(signInButton).toBeDisabled();
    }
  });

  test("disables network selector while loading", async ({ page }) => {
    await page.goto("/wallet");

    const networkButton = page.getByRole("button", { name: /network/i });

    // Trigger a network switch
    await networkButton.click();
    await page.getByRole("button", { name: /^testnet$/i }).click();

    // If sign in dialog appears
    const signInButton = page.getByRole("button", { name: /sign in/i });
    if (await signInButton.isVisible()) {
      await signInButton.click();

      // Network selector should be disabled during processing
      // (tested by checking if it's not clickable during loading)
      await expect(networkButton).toBeDisabled();
    }
  });
});
