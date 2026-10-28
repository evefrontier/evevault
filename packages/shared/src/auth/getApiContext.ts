import { getApiContext as resolveApiContext } from '@evefrontier/wallet-core/jwt'
import { LOCAL_DEV, LOCAL_DEV_API_URL } from '#/utils/localDev'

/** Gateway host pattern; `{tier}` is filled in from the token's resolved tier. */
const API_HOST_TEMPLATE = 'api.{tier}.pub.evefrontier.com'

/** Derives the Eve Frontier API base URL and tenant from a JWT id_token. */
export function getApiContext(token: string) {
  const context = resolveApiContext(token, {
    apiHostTemplate: API_HOST_TEMPLATE,
  })
  return LOCAL_DEV ? { ...context, apiBaseUrl: LOCAL_DEV_API_URL } : context
}
