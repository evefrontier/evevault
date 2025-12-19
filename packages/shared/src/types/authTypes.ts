import type { User } from "oidc-client-ts";

/** JWT authentication response from OAuth/OIDC provider */
export interface JwtResponse extends Partial<User> {
  access_token: string;
  id_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  userId?: string;
}
