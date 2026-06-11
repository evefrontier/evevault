import type { SuiChain } from '@mysten/wallet-standard'
import { decodeJwt } from 'jose'
import type { IdTokenClaims } from 'oidc-client-ts'
import {
  getZkLoginJwtForNetwork,
  storeZkLoginJwtForNetwork,
} from '#/auth/storageService'
import { decodeJwtSafely } from '#/auth/utils/jwtUtils'
import { vendJwt } from '#/auth/vendToken'
import type { JwtResponse } from '#/types/authTypes'
import { createLogger } from '#/utils/logger'

const log = createLogger()

type StoredZkLoginJwt = {
  expires_at: number
  id_token: string
}

const getStaleReuseReasons = ({
  isEpochValid,
  isJwtValid,
  nonceMatches,
}: {
  isEpochValid: boolean
  isJwtValid: boolean
  nonceMatches: boolean
}) =>
  [
    !isJwtValid ? 'jwt_expired' : null,
    !nonceMatches ? 'nonce_mismatch' : null,
    !isEpochValid ? 'epoch_expired_or_missing' : null,
  ].filter((reason): reason is string => reason !== null)

const getReusableStoredIdToken = ({
  chain,
  deviceNonce,
  isEpochValid,
  maxEpochTimestampMs,
  now,
  stored,
}: {
  chain: SuiChain
  deviceNonce: string
  isEpochValid: boolean
  maxEpochTimestampMs: number | null
  now: number
  stored: StoredZkLoginJwt | null
}) => {
  if (!stored?.id_token) return null

  const decoded = decodeJwtSafely(stored.id_token)
  if (!decoded) {
    log.info('Re-vending zkLogin JWT due to decode failure', { chain })
    return null
  }

  const isJwtValid = now < stored.expires_at
  const nonceMatches = decoded.nonce === deviceNonce
  if (isJwtValid && nonceMatches && isEpochValid) return stored.id_token

  log.info('Re-vending zkLogin JWT due to stale reuse candidate', {
    chain,
    reasons: getStaleReuseReasons({
      isEpochValid,
      isJwtValid,
      nonceMatches,
    }),
    maxEpochTimestampMs,
  })
  return null
}

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

  const reusableToken = getReusableStoredIdToken({
    chain,
    deviceNonce,
    isEpochValid,
    maxEpochTimestampMs,
    now,
    stored,
  })
  if (reusableToken) return reusableToken

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
