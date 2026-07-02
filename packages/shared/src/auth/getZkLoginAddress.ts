import type { ZkLoginAddressData } from '#/types/enoki'
import { getApiContext } from './getApiContext'
import type { GetZkLoginAddressParams } from './types'

const cache = new Map<string, ZkLoginAddressData>()

function cacheKey(params: GetZkLoginAddressParams): string {
  return `${params.jwt}`
}

/**
 * Clear the in-memory cache of zkLogin address lookups.
 * Call on logout so a new login gets a fresh API call.
 */
export function clearZkLoginAddressCache(): void {
  cache.clear()
}

export async function getZkLoginAddress(
  params: GetZkLoginAddressParams,
): Promise<ZkLoginAddressData> {
  const key = cacheKey(params)
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const { jwt } = params

  const { apiBaseUrl, tenant } = getApiContext(jwt)

  const response = await fetch(`${apiBaseUrl}/auth/zklogin`, {
    method: 'GET',
    headers: {
      'X-Tenant': tenant,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
  })

  if (!response.ok) {
    // The endpoint returns errors in more than one shape (`{ error: string }`
    // for proxy/tenant failures, RFC-7807 `{ title, status, detail }` from the
    // handler). Surface the raw body so the real cause isn't masked by a
    // generic "no data" error downstream.
    const body = await response.text()
    throw new Error(
      `zkLogin address request failed (${response.status}): ${body}`,
    )
  }

  const responseJson = (await response.json()) as unknown as ZkLoginAddressData

  if (!responseJson.salt || !responseJson.address || !responseJson.publicKey) {
    throw new Error(
      `zkLogin address response missing salt/address/publicKey: ${JSON.stringify(responseJson)}`,
    )
  }

  cache.set(key, responseJson)

  return responseJson
}
