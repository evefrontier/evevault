import type { TenantConfig, TenantId } from "../types";

export const FULLNODE_URL = "https://fullnode.devnet.sui.io";

export const SUI_DEVNET_FAUCET = "https://faucet.devnet.sui.io/gas";

export const SUI_PROVER_DEV_ENDPOINT = "https://prover-dev.mystenlabs.com/v1";

export const SUI_COIN_TYPE = "0x2::sui::SUI";

/** Default epoch duration (24h in ms) when endTimestamp is not yet set for current epoch */
export const DEFAULT_EPOCH_DURATION_MS = 86_400_000;

/** Message shown on every transfer screen: network fee is paid in SUI. */
export const GAS_FEE_WARNING_MESSAGE =
  "This transfer will incur a network fee (gas) paid in SUI.";

export const TENANT_KEYS: Record<TenantId, TenantConfig> = {
  stillness: {
    clientId: "583ebc6d-abd8-4057-8c77-78405628e42d",
    serverUrl: "https://auth.evefrontier.com",
    webOrigin: "https://evevault.evefrontier.com",
    clientSecret: import.meta.env.VITE_TENANT_STILLNESS_CLIENT_SECRET,
  },
  utopia: {
    clientId: "00d3ce5b-4cab-4970-a9dc-e122fc1d30ce",
    clientSecret: import.meta.env.VITE_TENANT_UTOPIA_CLIENT_SECRET,
    serverUrl: "https://test.auth.evefrontier.com",
    webOrigin: "https://uat.evevault.evefrontier.com",
  },
  testevenet: {
    clientId: "c8815001-f950-4147-905e-4833d904cd38",
    clientSecret: import.meta.env.VITE_TENANT_TESTEVENET_CLIENT_SECRET,
    serverUrl: "https://test.auth.evefrontier.com",
    webOrigin: "https://test.evevault.evefrontier.com",
    isDev: true,
  },
  nebula: {
    clientId: "c9671652-d906-4850-bd3c-b5e8351e62b4",
    clientSecret: import.meta.env.VITE_TENANT_NEBULA_CLIENT_SECRET,
    serverUrl: "https://test.auth.evefrontier.com",
    webOrigin: "https://test.evevault.evefrontier.com",
    isDev: true,
  },
} as const;
