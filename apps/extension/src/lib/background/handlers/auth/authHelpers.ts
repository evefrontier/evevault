import { useContextStore } from '@evevault/shared/stores'
import {
  AuthMessageTypes,
  type AuthSuccessToken,
  type DappConnectSuccessMessage,
  type ExtensionAuthSuccessMessage,
  type JwtResponse,
} from '@evevault/shared/types'
import { CONTEXT_STORAGE_KEY, createLogger } from '@evevault/shared/utils'
import type { SuiChain } from '@mysten/wallet-standard'
import { decodeJwt } from 'jose'
import type { IdTokenClaims } from 'oidc-client-ts'
import { browser } from 'wxt/browser'
import { sendToTab } from '@/lib/background/messaging/tabMessaging'
import type { MessageWithId } from '@/lib/background/types'

const log = createLogger()

export function buildExtensionAuthSuccessToken(
  jwt: JwtResponse,
): AuthSuccessToken {
  const token: AuthSuccessToken = {
    access_token: jwt.access_token,
    id_token: jwt.id_token,
    expires_in: jwt.expires_in,
    scope: jwt.scope,
    token_type: jwt.token_type,
    refresh_token: jwt.refresh_token,
    refresh_token_id: jwt.refresh_token_id,
    expires_at: jwt.expires_at,
    email: extractEmailFromJwt(jwt),
    userId: jwt.userId ?? extractUserIdFromJwt(jwt),
  }

  return token
}

export function ensureMessageId(message: MessageWithId): string {
  if (!message.id) {
    throw new Error('Message id is required')
  }
  return message.id
}

export function getCurrentChain(): SuiChain {
  return useContextStore.getState().chain
}

/**
 * Reads the current chain directly from chrome.storage to avoid Zustand sync issues
 * between popup and background script. This ensures we get the most up-to-date network
 * state when storing JWTs during OAuth callbacks.
 */
export async function getCurrentChainFromStorage(): Promise<SuiChain> {
  try {
    const result = await browser.storage.local.get([CONTEXT_STORAGE_KEY])
    const stored = result[CONTEXT_STORAGE_KEY]
    if (stored) {
      const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored
      if (parsed?.state?.chain) {
        log.debug('Read chain from storage', {
          chain: parsed.state.chain,
        })
        return parsed.state.chain
      }
    }
  } catch (error) {
    log.error('Error reading chain from storage', error)
  }
  const fallbackChain = getCurrentChain()
  log.debug('Using fallback chain from Zustand', {
    chain: fallbackChain,
  })
  return fallbackChain
}

export function extractAuthCode(responseUrl: string): string | null {
  return new URL(responseUrl).searchParams.get('code')
}

export function extractState(responseUrl: string): string | null {
  return new URL(responseUrl).searchParams.get('state')
}

export function sendExtensionAuthSuccess(id: string, jwt: JwtResponse): void {
  const token = buildExtensionAuthSuccessToken(jwt)
  const message: ExtensionAuthSuccessMessage = {
    id,
    type: AuthMessageTypes.AUTH_SUCCESS,
    token,
  }
  browser.runtime.sendMessage(message)
}

export function sendDappConnectSuccessToTab(
  tabId: number,
  ids: string[],
  opts: {
    chain: SuiChain
    address: string
    publicKey?: string
  },
): void {
  const { chain, address, publicKey } = opts
  for (const id of ids) {
    const message: DappConnectSuccessMessage = {
      id,
      type: AuthMessageTypes.AUTH_SUCCESS,
      chain,
      address,
      ...(publicKey && { publicKey }),
    }

    sendToTab(tabId, message)
  }
}

export function sendAuthError(id: string, error: unknown): void {
  browser.runtime.sendMessage({
    id,
    type: 'auth_error',
    error,
  })
}

export function extractEmailFromJwt(jwt: JwtResponse): string {
  const decoded = decodeJwt<IdTokenClaims>(jwt.id_token as string)
  return decoded.email as string
}

export function extractUserIdFromJwt(jwt: JwtResponse): string {
  const decoded = decodeJwt<IdTokenClaims>(jwt.id_token as string)
  return decoded.sub as string
}
