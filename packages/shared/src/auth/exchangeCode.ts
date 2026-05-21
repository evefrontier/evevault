import type { TenantId } from '@evefrontier/dapp-kit/utils';
import type { OAuthTokenResponse } from '#/types';
import { getTenantConfig } from '#/utils/tenantConfig';
import { parseOAuthTokenResponse } from './oauthTokenResponse';

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  tenantId: TenantId,
): Promise<OAuthTokenResponse> {
  const { clientId, clientSecret, serverUrl } = getTenantConfig(tenantId);
  const tokenUrl = `${serverUrl.replace(/\/$/, '')}/oauth2/token`;

  const requestBody = {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  };

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  return parseOAuthTokenResponse(await response.json());
}
