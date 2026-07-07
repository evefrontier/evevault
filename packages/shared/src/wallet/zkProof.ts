import { getExtendedEphemeralPublicKey } from '@mysten/sui/zklogin'
import { getApiContext } from '#/auth'
import type { ZkProofData } from '#/types/enoki'
import type { ZkProofParams } from '#/types/wallet'
import { createLogger } from '#/utils/logger'

const log = createLogger()

export type { ZkProofParams }

export const fetchZkProof = async (
  params: ZkProofParams,
): Promise<ZkProofData> => {
  const { jwtRandomness, maxEpoch, ephemeralPublicKey, idToken } = params

  const extendedEphemeralPublicKey =
    getExtendedEphemeralPublicKey(ephemeralPublicKey)

  // Network can be passed as parameter for dynamic network support
  const network = params.network || 'devnet'

  const body = JSON.stringify({
    network,
    ephemeralPublicKey: extendedEphemeralPublicKey,
    maxEpoch: Number(maxEpoch),
    randomness: jwtRandomness,
  })

  log.debug('Requesting ZK proof', { network })

  const { apiBaseUrl, tenant } = getApiContext(idToken)

  const response = await fetch(`${apiBaseUrl}/zklogin/zkp`, {
    method: 'POST',
    headers: {
      'X-Tenant': tenant,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body,
  })

  if (!response.ok) {
    const responseBody = await response.text()
    log.error('Failed to fetch ZK proof', {
      status: response.status,
      statusText: response.statusText,
      body: responseBody,
    })
    throw new Error(
      `zk proof request failed (${response.status}): ${responseBody}`,
    )
  }

  const responseJson = (await response.json()) as unknown as ZkProofData

  if (
    !responseJson?.proofPoints ||
    !responseJson?.issBase64Details ||
    !responseJson?.headerBase64 ||
    !responseJson?.addressSeed
  ) {
    throw new Error(
      `zk proof response missing required fields: ${JSON.stringify(responseJson)}`,
    )
  }

  return responseJson
}
