import { User } from "oidc-client-ts";

/**
 * Options for creating a mock oidc-client-ts User.
 */
interface CreateMockUserOptions {
  /** Sui address to set in the profile. Defaults to "0x123". */
  suiAddress?: string;
  /** Token expiry in seconds from now. Defaults to 3600 (1 hour). */
  expiresInSeconds?: number;
  /** Additional profile fields to merge into the mock profile. */
  profileOverrides?: Record<string, unknown>;
  /** Override default token values. */
  tokens?: {
    idToken?: string;
    accessToken?: string;
    refreshToken?: string;
    scope?: string;
    tokenType?: string;
  };
}

/**
 * Factory to create a mock oidc-client-ts User for tests.
 * Import from `@evevault/shared/testing` (not the main barrel).
 *
 * @param options - Override defaults (suiAddress, tokens, profile fields).
 * @returns A fully-formed User instance suitable for hook and component tests.
 */
export const createMockUser = (options: CreateMockUserOptions = {}): User => {
  const {
    suiAddress = "0x123",
    expiresInSeconds = 3600,
    profileOverrides = {},
    tokens = {},
  } = options;

  const issuedAt = Math.floor(Date.now() / 1000);

  return new User({
    id_token: tokens.idToken ?? "mock-id-token",
    access_token: tokens.accessToken ?? "mock-access-token",
    refresh_token: tokens.refreshToken,
    token_type: tokens.tokenType ?? "Bearer",
    scope: tokens.scope ?? "openid profile",
    profile: {
      sub: "mock-subject",
      aud: "mock-audience",
      iss: "https://auth.example.com",
      exp: issuedAt + expiresInSeconds,
      iat: issuedAt,
      sui_address: suiAddress,
      ...profileOverrides,
    },
    expires_at: issuedAt + expiresInSeconds,
  });
};
