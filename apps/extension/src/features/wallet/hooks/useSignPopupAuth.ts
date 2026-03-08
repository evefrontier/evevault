import { useAuth } from "@evevault/shared/auth";
import { useDevice } from "@evevault/shared/hooks/useDevice";
import { useEffect } from "react";

/**
 * Auth + device state for sign popups. Runs auth init on mount and returns
 * combined state for the gate (lock screen, login prompt) and for signing
 * (user, ephemeralPublicKey, getZkProof, maxEpoch).
 */
export function useSignPopupAuth() {
  const device = useDevice();
  const auth = useAuth();

  useEffect(() => {
    auth.initialize();
  }, [auth.initialize]);

  return {
    isLocked: device.isLocked,
    isPinSet: device.isPinSet,
    unlock: device.unlock,
    user: auth.user,
    loading: auth.loading,
    login: auth.login,
    maxEpoch: device.maxEpoch,
    getZkProof: device.getZkProof,
    ephemeralPublicKey: device.ephemeralPublicKey,
  };
}
