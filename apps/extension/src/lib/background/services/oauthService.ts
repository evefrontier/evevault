import type { TenantId } from '@evefrontier/dapp-kit'
import { getTenantConfig } from '@evevault/shared'

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of input) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function createPkcePair(): Promise<{
  codeVerifier: string
  codeChallenge: string
}> {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const codeVerifier = base64UrlEncode(randomBytes)
  const challengeBytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier),
  )

  return {
    codeVerifier,
    codeChallenge: base64UrlEncode(challengeBytes),
  }
}

function getAuthUrl(params: {
  tenantId: TenantId
  nonce: string
  codeChallenge?: string
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

  return url
}

async function getAuthRequest(params: { tenantId: TenantId; nonce: string }) {
  const { codeVerifier, codeChallenge } = await createPkcePair()
  return {
    authUrl: getAuthUrl({ ...params, codeChallenge }),
    codeVerifier,
  }
}

export { getAuthRequest, getAuthUrl }
