import type { TenantId } from "@evefrontier/dapp-kit";
import { getTenantConfig } from "@evevault/shared";

function getAuthUrl(params: { tenantId: TenantId; nonce: string }) {
  const tenantConfig = getTenantConfig(params.tenantId);

  const clientId = tenantConfig.clientId;
  const redirectUri = chrome.identity.getRedirectURL();

  const url = new URL(
    `${tenantConfig.serverUrl.replace(/\/$/, "")}/oauth2/authorize`,
  );

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email offline_access");
  // Always include the caller-provided nonce (zkLogin-derived from `initializeForChain`).
  if (params.nonce) {
    url.searchParams.set("nonce", params.nonce);
  }

  return url;
}

export { getAuthUrl };
