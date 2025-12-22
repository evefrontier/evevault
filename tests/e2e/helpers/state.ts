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
  const nowSeconds = Math.floor(Date.now() / 1000);

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
        expires_at: nowSeconds + 3600,
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
      loading: false,
      error: null,
    },
  };

  const networkState = {
    version: 0,
    state: {
      chain: "sui:devnet",
      loading: false,
    },
  };

  await page.addInitScript(
    ({ auth, device, network }) => {
      window.localStorage.clear();
      window.localStorage.setItem("evevault:auth", JSON.stringify(auth));
      window.localStorage.setItem("evevault:device", JSON.stringify(device));
      window.localStorage.setItem("evevault:network", JSON.stringify(network));
    },
    {
      auth: authState,
      device: deviceState,
      network: networkState,
    },
  );
}
