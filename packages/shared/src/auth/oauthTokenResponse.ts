import type { OAuthTokenResponse } from "../types/authTypes";

/**
 * Minimal parser for FusionAuth `/oauth2/token` JSON (snake_case body).
 * Requires non-empty `access_token`, `id_token`, and `refresh_token`, `refresh_token_id`, `expires_at` and `userId`.
 */
export function parseOAuthTokenResponse(raw: unknown): OAuthTokenResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid OAuth token response body");
  }
  const o = raw as Record<string, unknown>;

  const requireNonEmptyString = (key: string): string => {
    const v = o[key];
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`OAuth token response missing or empty ${key}`);
    }
    return v.trim();
  };

  const access_token = requireNonEmptyString("access_token");
  const id_token = requireNonEmptyString("id_token");
  const refresh_token = requireNonEmptyString("refresh_token");
  const refresh_token_id = requireNonEmptyString("refresh_token_id");
  const userId = requireNonEmptyString("userId");

  const expires_at =
    typeof o.expires_at === "number" && Number.isFinite(o.expires_at)
      ? o.expires_at
      : Math.floor(Date.now() / 1000);

  const expires_in =
    typeof o.expires_in === "number" && Number.isFinite(o.expires_in)
      ? o.expires_in
      : 3600;

  const token_type =
    typeof o.token_type === "string" && o.token_type.trim()
      ? o.token_type.trim()
      : "Bearer";

  const scope =
    typeof o.scope === "string" && o.scope.trim()
      ? o.scope.trim()
      : "openid profile email offline_access";

  const out: OAuthTokenResponse = {
    access_token,
    id_token,
    refresh_token,
    token_type,
    scope,
    expires_in,
    refresh_token_id,
    expires_at,
    userId,
  };

  if (typeof o.refresh_token_id === "string" && o.refresh_token_id.trim()) {
    out.refresh_token_id = o.refresh_token_id.trim();
  }
  if (typeof o.userId === "string" && o.userId.trim()) {
    out.userId = o.userId.trim();
  }

  return out;
}
