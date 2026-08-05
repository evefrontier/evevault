import { getApiContext as resolveApiContext } from '@evefrontier/wallet-core/jwt'

/** Gateway host pattern; `{tier}` is filled in from the token's resolved tier. */
const API_HOST_TEMPLATE = 'api.{tier}.pub.evefrontier.com'

/** Derives the Eve Frontier API base URL and tenant from a JWT id_token. */
export function getApiContext(token: string) {
  return resolveApiContext(token, { apiHostTemplate: API_HOST_TEMPLATE })
}
