import type { PublicKey } from "@mysten/sui/cryptography";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { Secp256r1PublicKey } from "@mysten/sui/keypairs/secp256r1";
import { useMemo } from "react";
import { useDeviceStore } from "../stores/deviceStore";
import { useNetworkStore } from "../stores/networkStore";
import { KEY_FLAG_SECP256R1 } from "../types/stores";
import { createLogger } from "../utils/logger";

const log = createLogger();

export const useDevice = () => {
  const {
    isLocked,
    ephemeralPublicKeyBytes,
    ephemeralPublicKeyFlag,
    ephemeralKeyPairSecretKey,
    loading,
    error,
    initialize,
    initializeForChain,
    getZkProof,
    getJwtRandomness,
    unlock,
    lock,
  } = useDeviceStore();

  const isPinSet = useMemo(() => {
    return (
      !!ephemeralKeyPairSecretKey &&
      typeof ephemeralKeyPairSecretKey === "object" &&
      "iv" in ephemeralKeyPairSecretKey &&
      "data" in ephemeralKeyPairSecretKey
    );
  }, [ephemeralKeyPairSecretKey]);

  // Subscribe to chain changes reactively
  const { chain: currentChain } = useNetworkStore();

  // Subscribe to the entire networkData object to ensure we react to any changes
  // Using a selector that returns the whole networkData ensures we catch updates
  // even when a new chain's data is added
  const networkData = useDeviceStore((state) => state.networkData);

  // Read device data directly from networkData instead of using getter functions
  // This ensures we react to changes in networkData and don't capture stale values
  const maxEpoch = useMemo(() => {
    if (!currentChain || !networkData) return null;
    return networkData[currentChain]?.maxEpoch ?? null;
  }, [currentChain, networkData]);
  const maxEpochTimestampMs = useMemo(() => {
    if (!currentChain || !networkData) return null;
    return networkData[currentChain]?.maxEpochTimestampMs ?? null;
  }, [currentChain, networkData]);
  const nonce = useMemo(() => {
    if (!currentChain || !networkData) return null;
    return networkData[currentChain]?.nonce ?? null;
  }, [currentChain, networkData]);

  // Reconstruct public key from bytes using the correct key type
  const ephemeralPublicKey = useMemo((): PublicKey | null => {
    if (!ephemeralPublicKeyBytes) return null;

    try {
      const keyBytes = new Uint8Array(ephemeralPublicKeyBytes);

      // Use the flag to determine key type, default to Ed25519 for extension
      if (ephemeralPublicKeyFlag === KEY_FLAG_SECP256R1) {
        return new Secp256r1PublicKey(keyBytes);
      } else {
        return new Ed25519PublicKey(keyBytes);
      }
    } catch (error) {
      log.error("Failed to reconstruct public key:", error);
      return null;
    }
  }, [ephemeralPublicKeyBytes, ephemeralPublicKeyFlag]);

  return {
    isLocked,
    isPinSet,
    ephemeralPublicKey,
    ephemeralKeyPairSecretKey,
    getJwtRandomness,
    maxEpoch,
    maxEpochTimestampMs,
    nonce,
    loading,
    error,
    initialize,
    initializeForChain,
    getZkProof,
    unlock,
    lock,
  };
};
