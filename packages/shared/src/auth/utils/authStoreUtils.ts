import type { SuiChain } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import { User } from "oidc-client-ts";
import type { JwtResponse } from "../../types/authTypes";
import { createLogger } from "../../utils/logger";
import { getZkLoginAddress } from "../getZkLoginAddress";
import { getJwtForNetwork } from "../storageService";
import { getEnokiApiKey } from "../stores/authStore";

const log = createLogger();

export const isErrorWithMessage = (
  error: unknown,
): error is { message: string } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  );
};

export const resolveExpiresAt = (jwt: JwtResponse): number => {
  if (typeof jwt.expires_at === "number") {
    return jwt.expires_at;
  }
  if (typeof jwt.expires_in === "number") {
    return Math.floor(Date.now() / 1000) + jwt.expires_in;
  }
  return Math.floor(Date.now() / 1000);
};

/**
 * Gets the user for a specific network from the stored JWT.
 * Use this instead of the global OIDC user when you need user data
 * for a specific network (e.g., after network switching).
 */
export async function getUserForNetwork(chain: SuiChain): Promise<User | null> {
  const storedJwt = await getJwtForNetwork(chain);
  if (!storedJwt?.id_token) {
    return null;
  }

  const decodedJwt = decodeJwt(storedJwt.id_token);
  const zkLoginResponse = await getZkLoginAddress({
    jwt: storedJwt.id_token,
    enokiApiKey: getEnokiApiKey(),
  });

  if (zkLoginResponse.error || !zkLoginResponse.data) {
    log.error("Failed to get zkLogin address for network JWT", {
      chain,
      error: zkLoginResponse.error,
    });
    return null;
  }

  const { address, salt } = zkLoginResponse.data;

  return new User({
    id_token: storedJwt.id_token,
    access_token: storedJwt.access_token ?? "",
    token_type: storedJwt.token_type ?? "Bearer",
    scope: storedJwt.scope ?? "",
    profile: {
      ...decodedJwt,
      sui_address: address,
      salt,
    } as User["profile"],
    expires_at: storedJwt.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  });
}
