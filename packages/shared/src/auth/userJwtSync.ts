import { decodeJwt } from 'jose'
import { type IdTokenClaims, User } from 'oidc-client-ts'
import type { OAuthTokenResponse } from '#/types/authTypes'
import { createLogger } from '#/utils/logger'
import { getZkLoginAddress } from './getZkLoginAddress'
import { storeJwt } from './storageService'
import { userToJwtResponse } from './userToJwtResponse'

const log = createLogger()

/**
 * Ensures `profile.sui_address` (and Enoki `salt`) exist by calling Enoki only when
 * `sui_address` is missing on the user profile.
 */
export async function enrichUserWithZkLoginIfNeeded(
  user: User,
  getEnokiApiKey: () => string,
): Promise<User> {
  const idToken = user.id_token
  if (!idToken) {
    return user
  }

  const sui = user.profile?.sui_address
  const existingSalt = (user.profile as Record<string, unknown> | undefined)
    ?.salt
  // Require both address and salt — salt is stripped from sessionStorage
  // so a user loaded from storage may have sui_address but no salt.
  if (
    typeof sui === 'string' &&
    sui.trim() &&
    typeof existingSalt === 'string' &&
    existingSalt.trim()
  ) {
    return user
  }

  const zkLoginResponse = await getZkLoginAddress({
    jwt: idToken,
    enokiApiKey: getEnokiApiKey(),
  })

  if (zkLoginResponse.error) {
    throw new Error(zkLoginResponse.error.message)
  }

  if (!zkLoginResponse.data) {
    throw new Error('No zkLogin address data received')
  }

  const { salt, address } = zkLoginResponse.data
  const decodedJwt = decodeJwt(idToken) as IdTokenClaims

  return new User({
    ...user,
    profile: {
      ...(typeof user.profile === 'object' && user.profile !== null
        ? user.profile
        : {}),
      ...decodedJwt,
      sui_address: address,
      salt,
    } as User['profile'],
  })
}

/** Mirrors the canonical OIDC `User` into persisted JWT storage. */
export async function syncPrimaryJwtFromUser(user: User): Promise<void> {
  const jwt = userToJwtResponse(user)
  if (!jwt?.refresh_token?.trim()) {
    log.warn(
      '[syncPrimaryJwtFromUser] no refresh token, skipping evevault:jwt mirror',
    )
    return
  }
  await storeJwt(jwt as OAuthTokenResponse)
}
