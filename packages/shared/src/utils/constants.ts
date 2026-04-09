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
  tauceti: {
    clientId: "139af6db-7e5c-46c2-a0d2-6dff25d1b1b1",
    clientSecret: import.meta.env.VITE_TENANT_TAUCETI_CLIENT_SECRET,
    serverUrl: "https://test.auth.evefrontier.com",
    webOrigin: "https://test.evevault.evefrontier.com",
    isDev: true,
  },
  tesseract: {
    clientId: "c5f061eb-850a-46f9-bf6f-ce4c3d3f11b3",
    clientSecret: import.meta.env.VITE_TENANT_TESSERACT_CLIENT_SECRET,
    serverUrl: "https://test.auth.evefrontier.com",
    webOrigin: "https://test.evevault.evefrontier.com",
    isDev: true,
  },
  tetra: {
    clientId: "b62e25b0-d372-4563-a899-8e2f57c343cb",
    clientSecret: import.meta.env.VITE_TENANT_TETRA_CLIENT_SECRET,
    serverUrl: "https://test.auth.evefrontier.com",
    webOrigin: "https://test.evevault.evefrontier.com",
    isDev: true,
  },
  tiaki: {
    clientId: "7b70cc89-4383-4cb7-8ba5-73154b06d7e1",
    clientSecret: import.meta.env.VITE_TENANT_TIAKI_CLIENT_SECRET,
    serverUrl: "https://test.auth.evefrontier.com",
    webOrigin: "https://test.evevault.evefrontier.com",
    isDev: true,
  },
} as const;
