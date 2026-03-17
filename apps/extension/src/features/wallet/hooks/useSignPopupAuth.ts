import { useAuth } from "@evevault/shared/auth";
import { useToast } from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks/useDevice";
import { createLogger } from "@evevault/shared/utils";
import { useEffect } from "react";

const log = createLogger();

/**
 * Auth + device state for sign popups. Runs auth init on mount and returns
 * combined state for the gate (lock screen, login prompt) and for signing
 * (user, ephemeralPublicKey, getZkProof, maxEpoch).
 */
export function useSignPopupAuth() {
  const device = useDevice();
  const auth = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    auth.initialize();
  }, [auth.initialize]);

  const login = async () => {
    const user = await auth.login();
    if (!user) {
      log.error("Login failed in sign popup");
      showToast("Login failed. Please try again.");
    }
    return user;
  };

  return {
    isLocked: device.isLocked,
    isPinSet: device.isPinSet,
    unlock: device.unlock,
    user: auth.user,
    loading: auth.loading,
    login,
    maxEpoch: device.maxEpoch,
    getZkProof: device.getZkProof,
    ephemeralPublicKey: device.ephemeralPublicKey,
  };
}
