import type { Page } from "@playwright/test";

interface SuiRpcMockOptions {
  balance?: string;
}

export async function mockSuiRpc(page: Page, options?: SuiRpcMockOptions) {
  const { balance = "1234567890" } = options ?? {};

  await page.route("**/fullnode.devnet.sui.io/**", async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }

    let body: any;
    try {
      body = route.request().postDataJSON();
    } catch {
      return route.continue();
    }

    if (!body?.method) {
      return route.continue();
    }

    if (body.method === "sui_getLatestSuiSystemState") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            epoch: "1000",
            epochDurationMs: "60000",
            epochStartTimestampMs: "0",
            storageFundTotal: "0",
            referenceGasPrice: "1",
            safeMode: false,
            protocolVersion: "1",
          },
        }),
      });
    }

    if (body.method === "suix_getBalance") {
      const responseCoinType = body.params?.[1]?.coinType ?? "0x2::sui::SUI";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            totalBalance: balance,
            coinType: responseCoinType,
            coinObjectCount: 1,
            lockedBalance: [],
          },
        }),
      });
    }

    return route.continue();
  });
}
