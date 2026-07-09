import type { TenantId } from '@evefrontier/wallet-core/tenant'
import type { OAuthTokenResponse } from '#/types'
import { getTenantConfig } from '#/utils/tenantConfig'
import { parseOAuthTokenResponse } from './oauthTokenResponse'
import { verifyIdTokenForTenant } from './verifyJwt'

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  tenantId: TenantId,
  options: { codeVerifier: string; nonce: string },
): Promise<OAuthTokenResponse> {
  const { clientId, serverUrl } = getTenantConfig(tenantId)
  const tokenUrl = `${serverUrl.replace(/\/$/, '')}/oauth2/token`

  const requestBody: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: options.codeVerifier,
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${errorText}`)
  }

  const jwtResponse = parseOAuthTokenResponse(await response.json())

  const { nonce: verifiedNonce } = await verifyIdTokenForTenant(
    jwtResponse.id_token,
    tenantId,
  )
  if (verifiedNonce !== options.nonce) {
    throw new Error(
      'id_token nonce does not match the nonce sent to FusionAuth',
    )
  }

  return jwtResponse
}
