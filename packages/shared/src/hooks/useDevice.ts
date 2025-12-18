import type { PublicKey } from "@mysten/sui/cryptography";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { Secp256r1PublicKey } from "@mysten/sui/keypairs/secp256r1";
import { useMemo } from "react";
import { useDeviceStore } from "../stores/deviceStore";
import { useNetworkStore } from "../stores/networkStore";
import { KEY_FLAG_SECP256R1 } from "../types/stores";

export const useDevice = () => {
  const {
    isLocked,
    ephemeralPublicKeyBytes,
    ephemeralPublicKeyFlag,
    ephemeralKeyPairSecretKey,
    jwtRandomness,
    loading,
    error,
    getMaxEpoch,
    getMaxEpochTimestampMs,
    getNonce,
    initialize,
    initializeForChain,
    getZkProof,
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

  const currentChain = useNetworkStore.getState().chain;

  const maxEpoch = useMemo(() => {
    return getMaxEpoch(currentChain);
  }, [currentChain, getMaxEpoch]);
  const maxEpochTimestampMs = useMemo(() => {
    return getMaxEpochTimestampMs(currentChain);
  }, [currentChain, getMaxEpochTimestampMs]);
  const nonce = useMemo(() => {
    return getNonce(currentChain);
  }, [currentChain, getNonce]);

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
      console.error("Failed to reconstruct public key:", error);
      return null;
    }
  }, [ephemeralPublicKeyBytes, ephemeralPublicKeyFlag]);

  return {
    isLocked,
    isPinSet,
    ephemeralPublicKey,
    ephemeralKeyPairSecretKey,
    jwtRandomness,
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
