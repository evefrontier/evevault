import type { SuiChain } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import { type IdTokenClaims, User } from "oidc-client-ts";
import type { JwtResponse } from "../../types/authTypes";
import { createLogger } from "../../utils/logger";
import { getZkLoginAddress } from "../getZkLoginAddress";
import { getJwt } from "../storageService";
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

/**
 * Expiry for a **persisted** primary JWT. Prefer absolute `expires_at` (set at store time).
 */
export const resolveExpiresAt = (jwt: JwtResponse): number => {
  // Prefer an already-resolved absolute timestamp stored alongside the token
  if (typeof jwt.expires_at === "number") {
    return jwt.expires_at;
  }

  // Decode each token once, tolerating opaque (non-JWT) values
  const decodeToken = (token: string) => {
    try {
      return decodeJwt(token);
    } catch {
      return null;
    }
  };

  const fromAccess = jwt.access_token ? decodeToken(jwt.access_token) : null;
  const fromId = jwt.id_token ? decodeToken(jwt.id_token) : null;

  // Use the exp claim embedded in the access_token or id_token
  if (typeof fromAccess?.exp === "number") return fromAccess.exp;
  if (typeof fromId?.exp === "number") return fromId.exp;

  // Compute absolute expiry from expires_in, anchoring to the token's own
  // iat claim so the result is independent of local clock at store time
  // Fall back to Date.now() if neither token carries iat
  if (typeof jwt.expires_in === "number") {
    const iat = fromId?.iat ?? fromAccess?.iat;
    if (typeof iat === "number") return iat + jwt.expires_in;
    return Math.floor(Date.now() / 1000) + jwt.expires_in;
  }

  // No expiry information at all — use iat as a best-effort anchor
  const iat = fromAccess?.iat ?? fromId?.iat;
  if (typeof iat === "number") return iat;

  // Last resort: treat the token as expiring right now
  return Math.floor(Date.now() / 1000);
};

/**
 * Gets the user for a specific network from the stored JWT.
 * Use this instead of the global OIDC user when you need user data
 * for a specific network (e.g., after network switching).
 */
export async function getUserForNetwork(chain: SuiChain): Promise<User | null> {
  const storedJwt = await getJwt();
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
