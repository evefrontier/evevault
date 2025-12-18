import { getExtendedEphemeralPublicKey } from "@mysten/sui/zklogin";
import type { ZkProofResponse } from "../types/enoki";
import type { ZkProofParams } from "../types/wallet";
import { createLogger } from "../utils/logger";

const log = createLogger();

export type { ZkProofParams };

export const fetchZkProof = async (
  params: ZkProofParams,
): Promise<ZkProofResponse> => {
  const { jwtRandomness, maxEpoch, ephemeralPublicKey, idToken, enokiApiKey } =
    params;

  const extendedEphemeralPublicKey =
    getExtendedEphemeralPublicKey(ephemeralPublicKey);

  // Network can be passed as parameter for dynamic network support
  const network = params.network || "devnet";

  const body = JSON.stringify({
    network,
    ephemeralPublicKey: extendedEphemeralPublicKey,
    maxEpoch: Number(maxEpoch),
    randomness: jwtRandomness,
  });

  log.debug("Requesting ZK proof", { network });

  const response = await fetch(
    "https://api.enoki.mystenlabs.com/v1/zklogin/zkp",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: enokiApiKey,
        "zklogin-jwt": idToken,
      },
      body,
    },
  );

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = undefined;
    }
    log.error("Failed to fetch ZK proof", {
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
    });
    throw new Error("Failed to fetch ZK proof");
  }

  const responseJson = await response.json();
  return responseJson as unknown as ZkProofResponse;
};
