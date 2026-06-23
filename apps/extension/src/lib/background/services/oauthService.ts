import type { TenantId } from '@evefrontier/wallet-core/tenant'
import { getTenantConfig } from '@evevault/shared'
import { sha256 } from '@evevault/shared/utils'
import { base64UrlEncode } from '@/lib/util/b64UrlEncode'

async function createPkcePair(): Promise<{
  codeVerifier: string
  codeChallenge: string
  state: string
}> {
  const verifierBytes = new Uint8Array(32)
  const stateBytes = new Uint8Array(16)
  crypto.getRandomValues(verifierBytes)
  crypto.getRandomValues(stateBytes)
  const codeVerifier = base64UrlEncode(verifierBytes)
  const challengeBytes = await sha256(codeVerifier)

  return {
    codeVerifier,
    codeChallenge: base64UrlEncode(challengeBytes),
    state: base64UrlEncode(stateBytes),
  }
}

function getAuthUrl(params: {
  tenantId: TenantId
  nonce: string
  codeChallenge?: string
  state?: string
}) {
  const tenantConfig = getTenantConfig(params.tenantId)

  const clientId = tenantConfig.clientId
  const redirectUri = chrome.identity.getRedirectURL()

  const url = new URL(
    `${tenantConfig.serverUrl.replace(/\/$/, '')}/oauth2/authorize`,
  )

  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'openid profile email offline_access')
  // Always include the caller-provided nonce (zkLogin-derived from `initializeForChain`).
  if (params.nonce) {
    url.searchParams.set('nonce', params.nonce)
  }
  if (params.codeChallenge) {
    url.searchParams.set('code_challenge', params.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
  }
  if (params.state) {
    url.searchParams.set('state', params.state)
  }

  return url
}

async function getAuthRequest(params: { tenantId: TenantId; nonce: string }) {
  const { codeVerifier, codeChallenge, state } = await createPkcePair()
  return {
    authUrl: getAuthUrl({ ...params, codeChallenge, state }),
    codeVerifier,
    state,
  }
}

export { getAuthRequest }
