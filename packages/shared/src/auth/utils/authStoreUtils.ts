import type { SuiChain } from '@mysten/wallet-standard'
import { type IdTokenClaims, User } from 'oidc-client-ts'
import { getZkLoginAddress } from '#/auth/getZkLoginAddress'
import { getJwt } from '#/auth/storageService'
import { decodeJwtSafely } from '#/auth/utils/jwtUtils'
import type { JwtResponse } from '#/types/authTypes'
import { createLogger } from '#/utils/logger'

const log = createLogger()

/** First value that is actually a number, else undefined. */
const firstNumber = (...values: unknown[]): number | undefined =>
  values.find((value): value is number => typeof value === 'number')

const nowInSeconds = () => Math.floor(Date.now() / 1000)

/**
 * Extracts the display identity (email + Sui address) used by header UIs from
 * an authenticated user. Any claim that is missing or not a string collapses
 * to an empty string, so presentational headers can render without null checks.
 */
export const getHeaderIdentity = (
  user: User,
): { email: string; address: string } => ({
  email: typeof user.profile?.email === 'string' ? user.profile.email : '',
  address:
    typeof user.profile?.sui_address === 'string'
      ? user.profile.sui_address
      : '',
})

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

  const fromAccess = decodeJwtSafely(jwt.access_token)
  const fromId = decodeJwtSafely(jwt.id_token)

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

  const decodedJwt = decodeJwtSafely<
    IdTokenClaims & { sui_address?: string; salt?: string }
  >(storedJwt.id_token)
  if (!decodedJwt) {
    log.error('Failed to decode stored id_token for network JWT', { chain })
    return null
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

  let address: string
  let salt: string
  try {
    ;({ address, salt } = await getZkLoginAddress({
      jwt: storedJwt.id_token,
    }))
  } catch (error) {
    log.error('Failed to get zkLogin address for network JWT', {
      chain,
      error,
    })
    return null
  }

  return new User({
    ...storedJwt,
    profile: {
      ...decodedJwt,
      sui_address: address,
      salt,
    } as User['profile'],
  })
}
