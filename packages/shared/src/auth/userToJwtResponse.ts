import type { User } from "oidc-client-ts";
import type { OAuthTokenResponse } from "@/types";

const DEFAULT_SCOPE = "openid email profile offline_access";

/**
 * Maps the OIDC UserManager session to our OAuthTokenResponse shape.
 * Used as the web primary-token source of truth (in-memory + UserManager storage).
 */
export function userToJwtResponse(
  user: User | null,
): OAuthTokenResponse | null {
  if (!user?.id_token) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = user.expires_at ?? now;
  const expires_in = Math.max(0, expiresAt - now);
  return {
    id_token: user.id_token,
    access_token: user.access_token ?? "",
    token_type: user.token_type ?? "Bearer",
    scope: user.scope ?? DEFAULT_SCOPE,
    refresh_token: user.refresh_token ?? "",
    expires_in,
    expires_at: expiresAt,
  };
}
