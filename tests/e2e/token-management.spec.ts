import { expect, test } from "@playwright/test";
import { seedPersistedAppState } from "./helpers/state";
import { mockSuiRpc } from "./helpers/suiRpc";

test.describe("Token Management", () => {
  test.beforeEach(async ({ page }) => {
    await seedPersistedAppState(page);
    await mockSuiRpc(page);
  });

  test("displays default SUI token in token list", async ({ page }) => {
    await page.goto("/wallet");

    // Default SUI token should be visible
    await expect(page.getByText(/0x2::sui/i)).toBeVisible();
  });

  test("user can add a custom token", async ({ page }) => {
    await page.goto("/wallet/add-token");

    // Fill in token type
    const tokenInput = page.getByPlaceholder(/coin type/i);
    await tokenInput.fill("0x123::custom::TOKEN");

    // Submit the form
    await page.getByRole("button", { name: /add token/i }).click();

    // Should redirect to wallet and show success
    await expect(page).toHaveURL(/\/wallet$/);
    await expect(page.getByText(/0x123::custom/i)).toBeVisible();
  });

  test("shows validation error for invalid token format", async ({ page }) => {
    await page.goto("/wallet/add-token");

    // Fill in invalid token type
    const tokenInput = page.getByPlaceholder(/coin type/i);
    await tokenInput.fill("invalid-token");

    // Submit the form
    await page.getByRole("button", { name: /add token/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid.*format/i)).toBeVisible();
  });

  test("prevents adding duplicate tokens", async ({ page }) => {
    await page.goto("/wallet/add-token");

    // Try to add SUI token (which is default)
    const tokenInput = page.getByPlaceholder(/coin type/i);
    await tokenInput.fill("0x2::sui::SUI");

    await page.getByRole("button", { name: /add token/i }).click();

    // Should show error about duplicate
    await expect(page.getByText(/already added/i)).toBeVisible();
  });

  test("can navigate to add token screen from wallet", async ({ page }) => {
    await page.goto("/wallet");

    // Click add token button
    await page.getByRole("button", { name: /add token/i }).click();

    // Should navigate to add token screen
    await expect(page).toHaveURL(/\/wallet\/add-token/);
    await expect(page.getByText(/add.*token/i)).toBeVisible();
  });

  test("can cancel adding token and return to wallet", async ({ page }) => {
    await page.goto("/wallet/add-token");

    // Click cancel button
    await page.getByRole("button", { name: /cancel/i }).click();

    // Should return to wallet
    await expect(page).toHaveURL(/\/wallet$/);
  });

  test("persists added tokens across page reloads", async ({ page }) => {
    await page.goto("/wallet/add-token");

    // Add custom token
    await page.getByPlaceholder(/coin type/i).fill("0x456::test::TEST");
    await page.getByRole("button", { name: /add token/i }).click();

    // Verify token is added
    await expect(page.getByText(/0x456::test/i)).toBeVisible();

    // Reload page
    await page.reload();

    // Token should still be visible
    await expect(page.getByText(/0x456::test/i)).toBeVisible();
  });
});
