import { getTenantConfig, type TenantId } from "@evevault/shared";

function getAuthUrl(params: {
  tenantId: TenantId;
  nonce: string;
  jwtRandomness: string;
  maxEpoch: string;
}) {
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
  url.searchParams.set("nonce", params.nonce);

  return url;
}

export { getAuthUrl };
