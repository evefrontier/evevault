import { getExtendedEphemeralPublicKey } from '@mysten/sui/zklogin'
import { getApiContext } from '#/auth'
import type { ZkProofParams } from '#/types/wallet'
import type { ZkProofData } from '#/types/zkLogin'
import { createLogger } from '#/utils/logger'

const log = createLogger()

export type { ZkProofParams }

export const fetchZkProof = async (
  params: ZkProofParams,
): Promise<ZkProofData> => {
  const { jwtRandomness, maxEpoch, ephemeralPublicKey, idToken, network } =
    params

  const extendedEphemeralPublicKey =
    getExtendedEphemeralPublicKey(ephemeralPublicKey)

  const body = JSON.stringify({
    extendedEphemeralPublicKey: extendedEphemeralPublicKey,
    maxEpoch: Number(maxEpoch),
    network: network,
    randomness: jwtRandomness,
  })

  log.debug('Requesting ZK proof')

  const { apiBaseUrl, tenant } = getApiContext(idToken)

  const response = await fetch(`${apiBaseUrl}/auth/zklogin/zkp`, {
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

  const responseText = await response.text()
  let responseJson: ZkProofData
  try {
    responseJson = JSON.parse(responseText) as ZkProofData
  } catch {
    throw new Error(`zk proof response was not valid JSON: ${responseText}`)
  }

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
