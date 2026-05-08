import type { Page } from "@playwright/test";

export const TEST_USER_ADDRESS =
  "0x5c8d5f5dcba872534f9b0ce3a20b708b8b47863d4a96e31c2f9556b6c8ddc8f9";

const createEmptyNetworkEntry = () => ({
  nonce: null,
  maxEpoch: null,
  maxEpochTimestampMs: null,
  zkProof: null,
});

export async function seedPersistedAppState(page: Page) {
  const authState = {
    version: 0,
    state: {
      user: {
        id_token: "test-id-token",
        access_token: "test-access-token",
        token_type: "Bearer",
        scope: "openid email profile offline_access",
        profile: {
          sub: "test-user",
          email: "test@example.com",
          preferred_username: "test-user",
          sui_address: TEST_USER_ADDRESS,
          salt: "0x1",
        },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
      loading: false,
      error: null,
    },
  };

  const deviceState = {
    version: 0,
    state: {
      isLocked: false,
      ephemeralPublicKey: null,
      ephemeralPublicKeyBytes: Array.from(
        { length: 32 },
        (_value, index) => index,
      ),
      ephemeralKeyPairSecretKey: {
        iv: "test-iv",
        data: "test-secret",
      },
      jwtRandomness: "123456789",
      networkData: {
        "sui:devnet": {
          nonce: "nonce-e2e",
          maxEpoch: "42",
          maxEpochTimestampMs: Date.now() + 60 * 60 * 1000,
          zkProof: null,
        },
        "sui:testnet": createEmptyNetworkEntry(),
        "sui:mainnet": createEmptyNetworkEntry(),
        "sui:localnet": createEmptyNetworkEntry(),
      },
      localnet: {
        encryptedKey: null,
        address: null,
        url: "http://127.0.0.1:9000",
        maxEpoch: null,
        maxEpochTimestampMs: null,
      },
      loading: false,
      error: null,
    },
  };

  const contextState = {
    version: 0,
    state: {
      tenantId: "stillness",
      devMode: false,
      chain: "sui:devnet",
    },
  };

  // Storage keys must match packages/shared/src/utils/storageKeys.ts
  await page.addInitScript(
    ({ auth, device, context }) => {
      window.localStorage.clear();
      window.localStorage.setItem("evevault:auth", JSON.stringify(auth));
      window.localStorage.setItem("evevault:device", JSON.stringify(device));
      window.localStorage.setItem("evevault:context", JSON.stringify(context));
    },
    {
      auth: authState,
      device: deviceState,
      context: contextState,
    },
  );
}
