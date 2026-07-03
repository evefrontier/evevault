import { decodeJwt } from 'jose'
import { type IdTokenClaims, User, type UserManager } from 'oidc-client-ts'
import {
  enrichUserWithZkLoginIfNeeded,
  syncPrimaryJwtFromUser,
} from '#/auth/userJwtSync'
import { userToJwtResponse } from '#/auth/userToJwtResponse'
import { resolveExpiresAt } from '#/auth/utils/authStoreUtils'
import type { JwtResponse, OAuthTokenResponse } from '#/types/authTypes'

export function buildUserFromJwt(jwt: JwtResponse): User {
  // Stored JWTs do not include the full oidc-client-ts User shape.
  const decodedJwt = decodeJwt<IdTokenClaims>(jwt.id_token)

  return new User({
    id_token: jwt.id_token,
    access_token: jwt.access_token,
    token_type: jwt.token_type ?? 'Bearer',
    scope: jwt.scope ?? '',
    refresh_token: jwt.refresh_token,
    profile: { ...decodedJwt } as User['profile'],
    expires_at: jwt.expires_at,
  })
}

export function buildUserFromOAuthResponse(
  jwtResponse: OAuthTokenResponse,
): User {
  // Extension login returns raw OAuth tokens; normalize them into an OIDC User.
  const decodedJwt = decodeJwt<IdTokenClaims>(jwtResponse.id_token)

  return new User({
    id_token: jwtResponse.id_token,
    access_token: jwtResponse.access_token,
    token_type: jwtResponse.token_type,
    scope: jwtResponse.scope,
    refresh_token: jwtResponse.refresh_token,
    profile: { ...(decodedJwt as IdTokenClaims) } as User['profile'],
    expires_at: decodedJwt.iat + jwtResponse.expires_in,
  })
}

export function jwtTiming(
  user: User,
): { expiresAt: number; now: number } | null {
  const jwtSnapshot = userToJwtResponse(user)

  if (!jwtSnapshot) {
    return null
  }

  return {
    expiresAt: resolveExpiresAt(jwtSnapshot),
    now: Math.floor(Date.now() / 1000),
  }
}

export async function persistEnrichedUser(
  user: User,
  userManager: UserManager,
): Promise<User> {
  /*
   * Enrichment may add zkLogin address/salt claims. Persist the enriched user in
   * OIDC storage and mirror its primary JWT so extension and web call sites read
   * the same session snapshot.
   *
   * Salt is stripped before storage: on web the userStore is sessionStorage, and
   * salt must not sit in browser-accessible storage. Signing always re-derives
   * salt on demand via getUserForNetwork so nothing breaks at runtime.
   */
  const enrichedUser = await enrichUserWithZkLoginIfNeeded(user)
  const { salt: _stripped, ...profileWithoutSalt } = (enrichedUser.profile ??
    {}) as Record<string, unknown>
  const userToStore = new User({
    ...enrichedUser,
    profile: profileWithoutSalt as User['profile'],
  })
  await userManager.storeUser(userToStore)
  await syncPrimaryJwtFromUser(enrichedUser)
  return enrichedUser
}
