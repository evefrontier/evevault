import type { SuiChain } from '@mysten/wallet-standard'
import { decodeJwt } from 'jose'
import { type IdTokenClaims, User } from 'oidc-client-ts'
import { getZkLoginAddress } from '#/auth/getZkLoginAddress'
import { getJwt } from '#/auth/storageService'
import { getEnokiApiKey } from '#/auth/stores/authStore'
import type { JwtResponse } from '#/types/authTypes'
import { createLogger } from '#/utils/logger'

const log = createLogger()

/** Decode a token once, tolerating opaque (non-JWT) and absent values. */
const decodeTokenSafely = (token?: string) => {
  if (!token) return null
  try {
    return decodeJwt(token)
  } catch {
    return null
  }
}

/** First value that is actually a number, else undefined. */
const firstNumber = (...values: unknown[]): number | undefined =>
  values.find((value): value is number => typeof value === 'number')

const nowInSeconds = () => Math.floor(Date.now() / 1000)

export const isErrorWithMessage = (
  error: unknown,
): error is { message: string } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

/**
 * Expiry for a **persisted** primary JWT. Prefer absolute `expires_at` (set at store time).
 */
export const resolveExpiresAt = (jwt: JwtResponse): number => {
  // Prefer an already-resolved absolute timestamp stored alongside the token
  if (typeof jwt.expires_at === 'number') {
    return jwt.expires_at
  }

  const fromAccess = decodeTokenSafely(jwt.access_token)
  const fromId = decodeTokenSafely(jwt.id_token)

  // Use the exp claim embedded in the access_token or id_token
  const exp = firstNumber(fromAccess?.exp, fromId?.exp)
  if (exp !== undefined) return exp

  // Compute absolute expiry from expires_in, anchoring to the token's own iat
  // claim so the result is independent of local clock at store time; fall back
  // to Date.now() if neither token carries iat
  if (typeof jwt.expires_in === 'number') {
    const iat = firstNumber(fromId?.iat, fromAccess?.iat)
    return (iat ?? nowInSeconds()) + jwt.expires_in
  }

  // No expiry information at all — use iat as a best-effort anchor, otherwise
  // treat the token as expiring right now
  return firstNumber(fromAccess?.iat, fromId?.iat) ?? nowInSeconds()
}

/**
 * Gets the user for a specific network from the stored JWT.
 * Use this instead of the global OIDC user when you need user data
 * for a specific network (e.g., after network switching).
 */
export async function getUserForNetwork(chain: SuiChain): Promise<User | null> {
  const storedJwt = await getJwt()
  if (!storedJwt?.id_token) {
    return null
  }

  const decodedJwt = decodeJwt(storedJwt.id_token) as IdTokenClaims & {
    sui_address?: string
    salt?: string
  }

  const suiClaim = decodedJwt.sui_address
  const suiFromClaims =
    typeof suiClaim === 'string' && suiClaim.trim().length > 0

  if (suiFromClaims) {
    const suiAddress = suiClaim.trim()
    return new User({
      ...storedJwt,
      profile: {
        ...decodedJwt,
        sui_address: suiAddress,
        ...(typeof decodedJwt.salt === 'string' && decodedJwt.salt.trim()
          ? { salt: decodedJwt.salt.trim() }
          : {}),
      } as User['profile'],
    })
  }

  const zkLoginResponse = await getZkLoginAddress({
    jwt: storedJwt.id_token,
    enokiApiKey: getEnokiApiKey(),
  })

  if (zkLoginResponse.error || !zkLoginResponse.data) {
    log.error('Failed to get zkLogin address for network JWT', {
      chain,
      error: zkLoginResponse.error,
    })
    return null
  }

  const { address, salt } = zkLoginResponse.data

  return new User({
    ...storedJwt,
    profile: {
      ...decodedJwt,
      sui_address: address,
      salt,
    } as User['profile'],
  })
}
