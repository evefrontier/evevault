import { expect, test } from "@playwright/test";
import { seedPersistedAppState, TEST_USER_ADDRESS } from "./helpers/state";
import { mockSuiRpc } from "./helpers/suiRpc";

test.describe("Send Token Flow", () => {
  test.beforeEach(async ({ page }) => {
    await seedPersistedAppState(page);
    await mockSuiRpc(page, { balance: "5000000000" }); // 5 SUI
  });

  test("navigates to send token screen", async ({ page }) => {
    await page.goto("/wallet");

    // Click send button
    await page.getByRole("button", { name: /send/i }).click();

    // Should navigate to send screen
    await expect(page).toHaveURL(/\/wallet\/send-token/);
    await expect(page.getByText(/send.*token/i)).toBeVisible();
  });

  test("displays current balance on send screen", async ({ page }) => {
    await page.goto("/wallet/send-token");

    // Should show balance
    await expect(page.getByText(/balance/i)).toBeVisible();
    await expect(page.getByText(/5\.0/)).toBeVisible(); // 5 SUI formatted
  });

  test("validates recipient address format", async ({ page }) => {
    await page.goto("/wallet/send-token");

    // Enter invalid address
    await page.getByPlaceholder(/0x.*/i).fill("invalid-address");
    await page.getByPlaceholder(/amount/i).fill("1");

    // Try to send
    await page.getByRole("button", { name: /send/i }).click();

    // Should show validation error
    await expect(page.getByText(/invalid.*address/i)).toBeVisible();
  });

  test("validates amount is positive", async ({ page }) => {
    await page.goto("/wallet/send-token");

    // Enter valid address but zero amount
    await page.getByPlaceholder(/0x.*/i).fill(TEST_USER_ADDRESS);
    await page.getByPlaceholder(/amount/i).fill("0");

    // Try to send
    await page.getByRole("button", { name: /send/i }).click();

    // Should show validation error
    await expect(
      page.getByText(/amount.*greater than.*zero/i)
    ).toBeVisible();
  });

  test("validates amount does not exceed balance", async ({ page }) => {
    await page.goto("/wallet/send-token");

    // Enter amount greater than balance
    await page.getByPlaceholder(/0x.*/i).fill(TEST_USER_ADDRESS);
    await page.getByPlaceholder(/amount/i).fill("10"); // More than 5 SUI balance

    // Try to send
    await page.getByRole("button", { name: /send/i }).click();

    // Should show validation error
    await expect(page.getByText(/insufficient.*balance/i)).toBeVisible();
  });

  test("shows confirmation dialog before sending", async ({ page }) => {
    await page.goto("/wallet/send-token");

    // Fill in valid details
    await page.getByPlaceholder(/0x.*/i).fill(TEST_USER_ADDRESS);
    await page.getByPlaceholder(/amount/i).fill("1");

    // Click send
    await page.getByRole("button", { name: /send/i }).click();

    // Should show confirmation dialog
    await expect(page.getByText(/confirm.*transaction/i)).toBeVisible();
    await expect(page.getByText(/1.*sui/i)).toBeVisible();
  });

  test("can cancel send transaction", async ({ page }) => {
    await page.goto("/wallet/send-token");

    // Fill in details
    await page.getByPlaceholder(/0x.*/i).fill(TEST_USER_ADDRESS);
    await page.getByPlaceholder(/amount/i).fill("1");

    // Click send to show confirmation
    await page.getByRole("button", { name: /send/i }).click();

    // Click cancel in confirmation dialog
    await page.getByRole("button", { name: /cancel/i }).click();

    // Should return to send screen
    await expect(page.getByText(/confirm.*transaction/i)).not.toBeVisible();
    await expect(page).toHaveURL(/\/wallet\/send-token/);
  });

  test("can return to wallet from send screen", async ({ page }) => {
    await page.goto("/wallet/send-token");

    // Click back/cancel button
    await page.getByRole("button", { name: /back|cancel/i }).first().click();

    // Should return to wallet
    await expect(page).toHaveURL(/\/wallet$/);
  });

  test("disables send button while transaction is processing", async ({
    page,
  }) => {
    await page.goto("/wallet/send-token");

    // Fill in details
    await page.getByPlaceholder(/0x.*/i).fill(TEST_USER_ADDRESS);
    await page.getByPlaceholder(/amount/i).fill("1");

    const sendButton = page.getByRole("button", { name: /send/i });

    // Click send
    await sendButton.click();

    // Confirm in dialog
    await page.getByRole("button", { name: /confirm/i }).click();

    // Send button should be disabled during processing
    await expect(sendButton).toBeDisabled();
  });

  test("supports decimal amounts", async ({ page }) => {
    await page.goto("/wallet/send-token");

    // Enter decimal amount
    await page.getByPlaceholder(/0x.*/i).fill(TEST_USER_ADDRESS);
    await page.getByPlaceholder(/amount/i).fill("1.5");

    // Should accept decimal input
    await expect(page.getByPlaceholder(/amount/i)).toHaveValue("1.5");
  });

  test("trims whitespace from address input", async ({ page }) => {
    await page.goto("/wallet/send-token");

    // Enter address with whitespace
    await page
      .getByPlaceholder(/0x.*/i)
      .fill(`  ${TEST_USER_ADDRESS}  `);
    await page.getByPlaceholder(/amount/i).fill("1");

    // Should accept and trim the address
    await page.getByRole("button", { name: /send/i }).click();

    // Should not show invalid address error
    await expect(
      page.getByText(/invalid.*address/i)
    ).not.toBeVisible();
  });
});
