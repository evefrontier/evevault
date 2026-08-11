import { browser } from '@wxt-dev/browser'
import { parseOAuthTokenResponse } from '#/auth/oauthTokenResponse'
import type { AuthMessage } from '#/types'
import type { OAuthTokenResponse } from '#/types/authTypes'

export function createExtensionAuthListener(
  id: string,
  resolve: (value: OAuthTokenResponse) => void,
  reject: (reason?: unknown) => void,
): (message: AuthMessage) => void {
  /*
   * Multiple auth requests can be in flight from different callers. Correlate
   * by id and remove the listener as soon as the matching response arrives.
   */
  const authSuccessListener = (message: AuthMessage) => {
    if (message.id !== id) {
      return
    }

    browser.runtime?.onMessage?.removeListener(authSuccessListener)

    if (message.type === 'auth_success') {
      if (!message.token) {
        reject(new Error('No token received from auth'))
        return
      }

      resolve(parseOAuthTokenResponse(message.token))
      return
    }

    if (message.type === 'auth_error') {
      reject(message.error)
    }
  }

  return authSuccessListener
}

export function launchExtensionLogout(logoutUrl: string): void {
  /*
   * Extensions must use chrome.identity for interactive logout. Once the browser
   * flow completes, notify dapps that this wallet currently exposes no accounts.
   */
  void browser.identity
    .launchWebAuthFlow({ url: logoutUrl, interactive: true })
    .then(() =>
      browser.runtime?.sendMessage?.({
        __from: 'Eve Vault',
        event: 'change',
        payload: { accounts: [] },
      }),
    )
    .catch(() => {})
}

export function getExtensionLogoutRedirectUri(): string {
  return browser.identity.getRedirectURL()
}
