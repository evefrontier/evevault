import type { SuiChain } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import type { IdTokenClaims } from "oidc-client-ts";
import {
  getZkLoginJwtForNetwork,
  storeZkLoginJwtForNetwork,
} from "../../auth/storageService";
import { resolveExpiresAt } from "../../auth/utils/authStoreUtils";
import { vendJwt } from "../../auth/vendToken";
import type { JwtResponse } from "../../types/authTypes";
import { createLogger } from "../../utils/logger";

const log = createLogger();

/**
 * Returns a vended zkLogin JWT matching current device nonce, reusing stored token when valid
 * and max epoch has not expired.
 */
export async function resolveVendedIdTokenForZkProof(
  chain: SuiChain,
  primaryJwt: JwtResponse,
  deviceNonce: string,
  getMaxEpochTimestampMs: (chain: SuiChain) => number | null,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const stored = await getZkLoginJwtForNetwork(chain);
  const maxEpochTimestampMs = getMaxEpochTimestampMs(chain);
  const isEpochValid =
    maxEpochTimestampMs != null && Date.now() < maxEpochTimestampMs;

  if (stored?.id_token) {
    try {
      const expAt = resolveExpiresAt(stored);
      const isJwtValid = now < expAt;
      const decoded = decodeJwt(stored.id_token);
      const jwtNonce = decoded.nonce as string | undefined;
      const nonceMatches = jwtNonce === deviceNonce;

      if (isJwtValid && nonceMatches && isEpochValid) {
        return stored.id_token as string;
      }

      const reasons: string[] = [];
      if (!isJwtValid) reasons.push("jwt_expired");
      if (!nonceMatches) reasons.push("nonce_mismatch");
      if (!isEpochValid) reasons.push("epoch_expired_or_missing");
      log.info("Re-vending zkLogin JWT due to stale reuse candidate", {
        chain,
        reasons,
        maxEpochTimestampMs,
      });
    } catch {
      log.info("Re-vending zkLogin JWT due to decode failure", { chain });
    }
  }

  const newIdToken = await vendJwt(primaryJwt.id_token as string, {
    nonce: deviceNonce,
  });
  const decodedNew = decodeJwt<IdTokenClaims>(newIdToken);
  const exp = decodedNew.exp ?? now + 3600;
  const newJwt: JwtResponse = {
    id_token: newIdToken,
    access_token: newIdToken,
    token_type: "Bearer",
    expires_in: exp - now,
    scope: primaryJwt.scope ?? "openid email profile offline_access",
    refresh_token: primaryJwt.refresh_token,
  };
  await storeZkLoginJwtForNetwork(newJwt, chain);
  return newIdToken;
}
