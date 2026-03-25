import type { SuiChain } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import { type IdTokenClaims, User } from "oidc-client-ts";
import type { JwtResponse, OAuthTokenResponse } from "../../types/authTypes";
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

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Expiry for a **persisted** primary JWT. Prefer absolute `expires_at` (set at store time).
 */
export const resolveExpiresAt = (jwt: JwtResponse): number => {
  if (typeof jwt.expires_at === "number") {
    return jwt.expires_at;
  }
  if (jwt.access_token) {
    try {
      const decoded = decodeJwt(jwt.access_token);
      if (typeof decoded.exp === "number") {
        return decoded.exp;
      }
    } catch {
      /* opaque access token */
    }
  }
  if (jwt.id_token) {
    try {
      const decoded = decodeJwt(jwt.id_token);
      if (typeof decoded.exp === "number") {
        return decoded.exp;
      }
    } catch {
      /* ignore */
    }
  }
  return nowSeconds();
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

  const decodedJwt = decodeJwt(storedJwt.id_token) as IdTokenClaims & {
    sui_address?: string;
    salt?: string;
  };

  const suiClaim = decodedJwt.sui_address;
  const suiFromClaims =
    typeof suiClaim === "string" && suiClaim.trim().length > 0;

  if (suiFromClaims) {
    const suiAddress = suiClaim.trim();
    return new User({
      ...storedJwt,
      profile: {
        ...decodedJwt,
        sui_address: suiAddress,
        ...(typeof decodedJwt.salt === "string" && decodedJwt.salt.trim()
          ? { salt: decodedJwt.salt.trim() }
          : {}),
      } as User["profile"],
    });
  }

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
    ...storedJwt,
    profile: {
      ...decodedJwt,
      sui_address: address,
      salt,
    } as User["profile"],
  });
}
