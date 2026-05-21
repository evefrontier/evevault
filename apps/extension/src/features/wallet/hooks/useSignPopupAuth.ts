import { useAuth } from '@evevault/shared/auth';
import { useContext, useDevice } from '@evevault/shared/hooks';
import { createLogger } from '@evevault/shared/utils';
import { useEffect } from 'react';

const log = createLogger();

/**
 * Auth + device state for sign popups. Runs auth init on mount and returns
 * combined state for the gate (lock screen, login prompt) and for signing
 * (user, ephemeralPublicKey, getZkProof, maxEpoch).
 */
export function useSignPopupAuth() {
  const device = useDevice();
  const auth = useAuth();
  const { chain } = useContext();

  useEffect(() => {
    auth.initialize();
  }, [auth.initialize]);

  useEffect(() => {
    const hasDeviceData = !!device.maxEpoch && !!device.nonce;
    const canInitializeForChain =
      !device.isLocked && !!device.ephemeralPublicKey && !hasDeviceData;
    if (!canInitializeForChain) return;

    void device.initializeForChain(chain).catch((error) => {
      log.warn('Failed to initialize device data for sign popup', {
        chain,
        error,
      });
    });
  }, [
    chain,
    device.ephemeralPublicKey,
    device.initializeForChain,
    device.isLocked,
    device.maxEpoch,
    device.nonce,
  ]);

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
