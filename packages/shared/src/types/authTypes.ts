import type { User } from "oidc-client-ts";

/** JWT and user authentication response from OAuth/OIDC provider (includes OIDC user profile fields via Partial<User>) */
export interface JwtResponse extends Partial<User> {
  access_token: string;
  id_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  userId?: string;
}
