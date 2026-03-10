import type { JwtResponse, TenantId } from "../types";
import { getTenantConfig } from "../utils/tenantConfig";

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  tenantId: TenantId,
): Promise<JwtResponse> {
  const { clientId, clientSecret, serverUrl } = getTenantConfig(tenantId);
  const tokenUrl = `${serverUrl.replace(/\/$/, "")}/oauth2/token`;

  const requestBody = {
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  };

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const data: JwtResponse = await response.json();

  return data;
}
