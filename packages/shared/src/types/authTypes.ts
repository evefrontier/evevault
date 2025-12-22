import type { User } from "oidc-client-ts";

export interface TokenResponse extends Partial<User> {
  access_token: string;
  id_token: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
  refresh_token_id?: string;
  token_type: string;
  userId?: string;
}
