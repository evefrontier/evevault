import type { User } from "oidc-client-ts";

export interface TokenResponse extends Partial<User> {
  access_token: string;
  id_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  userId?: string;
}
