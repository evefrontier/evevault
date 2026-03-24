import { useAuthStore } from "../../../auth";
import {
  getJwtForNetwork,
  hasJwtForNetwork,
} from "../../../auth/storageService";
import { zkProofService } from "../../../services/vaultService";
import type { DeviceState, ZkProofResponse } from "../../../types";
import type { JwtResponse } from "../../../types/authTypes";
import { createLogger } from "../../../utils/logger";
import { fetchZkProof } from "../../../wallet/zkProof";
import { useNetworkStore } from "../../networkStore";
import { resolveVendedIdTokenForZkProof } from "../zkJwt";
import type { GetDeviceState, SetDeviceState } from "./types";

const log = createLogger();

export function createProofActions(set: SetDeviceState, get: GetDeviceState) {
  return {
    getZkProof: async () => {
      const currentChain = useNetworkStore.getState().chain;
      const maxEpochExpiry = get().getMaxEpochTimestampMs(currentChain);

      if (maxEpochExpiry && Date.now().valueOf() < maxEpochExpiry) {
        try {
          const zkProof = await zkProofService.getZkProof(currentChain);
          if (zkProof != null && zkProof.error === undefined) {
            log.info("Max epoch not yet expired, reusing ZK proof from keeper");
            log.debug("Using cached ZK proof", { zkProof });
            return zkProof;
          }
        } catch (error) {
          log.warn(
            "Failed to get zkProof from keeper, will generate new one:",
            error,
          );
        }

        log.info("No ZK proof found in keeper, proceeding to generate new one");
      }

      try {
        log.info("*********** Generating ZK proof ***********");

        const { user } = useAuthStore.getState();
        if (!user?.id_token) {
          throw new Error("User not authenticated");
        }

        const ephemeralPublicKey = get().ephemeralPublicKey;
        if (!ephemeralPublicKey) {
          throw new Error("Ephemeral public key not found");
        }

        const chain = useNetworkStore.getState().chain;
        const network = chain.replace("sui:", "") as string;

        let nonce = get().getNonce(chain);
        const maxEpochTimestampMs = get().getMaxEpochTimestampMs(chain);
        const isEpochExpired =
          maxEpochTimestampMs == null || Date.now() >= maxEpochTimestampMs;

        if (nonce == null || nonce === "" || isEpochExpired) {
          log.info(
            "Device nonce missing or epoch expired; initializing chain before ZK proof",
            { chain },
          );
          await get().initializeForChain(chain);
          nonce = get().getNonce(chain);
          if (nonce == null || nonce === "") {
            throw new Error(
              `Device nonce missing for ${network} after initialization.`,
            );
          }
        }

        const hasJwt = await hasJwtForNetwork(chain);
        if (!hasJwt) {
          throw new Error(
            `No valid JWT found for ${network}. Please sign in again.`,
          );
        }

        const primaryJwt = await getJwtForNetwork(chain);
        if (!primaryJwt?.id_token) {
          throw new Error(
            `No primary OAuth JWT for ${network}. Please sign in again.`,
          );
        }

        const vendedIdToken = await resolveVendedIdTokenForZkProof(
          chain,
          primaryJwt as JwtResponse,
          nonce,
          get().getMaxEpochTimestampMs,
        );

        log.debug("Generating ZK proof for network", { chain, network });

        const networkJwtRandomness = get().getJwtRandomness(chain);
        if (!networkJwtRandomness) {
          throw new Error(
            `JWT randomness not found for ${network}. Please sign in again.`,
          );
        }

        const maxEpoch = get().getMaxEpoch(chain);
        if (!maxEpoch) {
          throw new Error("Max epoch not found for current network");
        }

        const zkProofResponse: ZkProofResponse = await fetchZkProof({
          jwtRandomness: networkJwtRandomness,
          maxEpoch,
          ephemeralPublicKey,
          idToken: vendedIdToken,
          enokiApiKey: import.meta.env.VITE_ENOKI_API_KEY,
          network,
        });

        if (zkProofResponse.error === undefined) {
          try {
            await zkProofService.setZkProof(chain, zkProofResponse);
            log.debug("zkProof stored in keeper");
          } catch (error) {
            log.error("Failed to store zkProof in keeper:", error);
          }
          return zkProofResponse;
        }

        log.error("Error generating ZK proof", zkProofResponse.error);
        set({
          error: zkProofResponse.error?.message,
        });
        return zkProofResponse;
      } catch (error) {
        log.error("Error generating ZK proof", error);
        set({
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  } satisfies Pick<DeviceState, "getZkProof">;
}
