import type { SuiChain } from '@mysten/wallet-standard'
import { decodeJwt } from 'jose'
import type { IdTokenClaims } from 'oidc-client-ts'
import {
  getZkLoginJwtForNetwork,
  storeZkLoginJwtForNetwork,
} from '#/auth/storageService'
import { vendJwt } from '#/auth/vendToken'
import type { JwtResponse } from '#/types/authTypes'
import { createLogger } from '#/utils/logger'

const log = createLogger()

/**
 * Returns a vended zkLogin JWT matching current device nonce, reusing stored token when valid
 * and max epoch has not expired.
 */
export async function resolveVendedIdTokenForZkProof(
  chain: SuiChain,
  primaryJwt: JwtResponse,
  deviceNonce: string,
  maxEpochTimestampMs: number | null,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const stored = await getZkLoginJwtForNetwork(chain)
  const isEpochValid =
    maxEpochTimestampMs != null && Date.now() < maxEpochTimestampMs

  if (stored?.id_token) {
    try {
      const expAt = stored.expires_at
      const isJwtValid = now < expAt
      const decoded = decodeJwt(stored.id_token)
      const jwtNonce = decoded.nonce as string | undefined
      const nonceMatches = jwtNonce === deviceNonce

      if (isJwtValid && nonceMatches && isEpochValid) {
        return stored.id_token as string
      }

      const reasons: string[] = []
      if (!isJwtValid) reasons.push('jwt_expired')
      if (!nonceMatches) reasons.push('nonce_mismatch')
      if (!isEpochValid) reasons.push('epoch_expired_or_missing')
      log.info('Re-vending zkLogin JWT due to stale reuse candidate', {
        chain,
        reasons,
        maxEpochTimestampMs,
      })
    } catch {
      log.info('Re-vending zkLogin JWT due to decode failure', { chain })
    }
  }

  const newIdToken = await vendJwt(primaryJwt.id_token as string, {
    nonce: deviceNonce,
  })
  const decodedNew = decodeJwt<IdTokenClaims>(newIdToken)
  const epochExpirySeconds =
    maxEpochTimestampMs != null ? Math.floor(maxEpochTimestampMs / 1000) : null
  const jwtExpirySeconds = decodedNew.exp ?? null
  const expiresAt =
    epochExpirySeconds != null && jwtExpirySeconds != null
      ? Math.min(epochExpirySeconds, jwtExpirySeconds)
      : (epochExpirySeconds ?? jwtExpirySeconds ?? now + 3600)
  const newJwt = {
    id_token: newIdToken,
    expires_at: expiresAt,
  }
  await storeZkLoginJwtForNetwork(newJwt, chain)
  return newIdToken
}
