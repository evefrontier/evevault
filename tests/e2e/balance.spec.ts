import { expect, test } from "@playwright/test";
import { seedPersistedAppState, TEST_USER_ADDRESS } from "./helpers/state";
import { mockSuiRpc } from "./helpers/suiRpc";

const FORMATTED_ADDRESS = "0x5c8d...ddc8f9";
// 1234567890 MIST = 1.23456789 SUI, formatted to 3 decimals = "1.235"
const TEST_BALANCE = "1234567890";
const EXPECTED_FORMATTED_BALANCE = "1.235";

test.describe("Wallet balance", () => {
  test.beforeEach(async ({ page }) => {
    await seedPersistedAppState(page);
    await mockSuiRpc(page, { balance: TEST_BALANCE });
  });

  test("renders the formatted SUI balance for the active chain", async ({
    page,
  }) => {
    await page.goto("/wallet");

    await expect(page.getByTestId("wallet-balance")).toHaveText(
      new RegExp(
        `Sui token balance on sui:devnet:\\s+${EXPECTED_FORMATTED_BALANCE}`,
      ),
    );

    await expect(page.getByText(FORMATTED_ADDRESS)).toBeVisible();
    await expect(
      page.getByText(TEST_USER_ADDRESS.slice(-4), { exact: false }),
    ).toBeVisible();
  });
});
