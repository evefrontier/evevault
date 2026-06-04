import { useMemo } from 'react'
import { useContextStore } from '#/stores/contextStore'
import { useDeviceStore } from '#/stores/deviceStore'
import {
  bindDeviceActions,
  getCurrentDeviceData,
  isPinConfigured,
  reconstructEphemeralPublicKey,
} from './useDevice.helpers'

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
    rotateEphemeralKey,
    getZkProof: getZkProofForChain,
    getJwtRandomness,
    unlock,
    lock,
  } = useDeviceStore()

  const isPinSet = useMemo(
    () => isPinConfigured(ephemeralKeyPairSecretKey),
    [ephemeralKeyPairSecretKey],
  )

  // Subscribe to chain changes reactively
  const { chain: currentChain } = useContextStore()

  // Subscribe to the entire networkData object to ensure we react to any changes
  // Using a selector that returns the whole networkData ensures we catch updates
  // even when a new chain's data is added
  const { networkData, localnet } = useDeviceStore()

  // Read device data directly from networkData instead of using getter functions
  // This ensures we react to changes in networkData and don't capture stale values
  const { maxEpoch, maxEpochTimestampMs, nonce } = useMemo(
    () => getCurrentDeviceData({ currentChain, networkData, localnet }),
    [currentChain, networkData, localnet],
  )

  // Reconstruct public key from bytes using the correct key type
  const ephemeralPublicKey = useMemo(
    () =>
      reconstructEphemeralPublicKey(
        ephemeralPublicKeyBytes,
        ephemeralPublicKeyFlag,
      ),
    [ephemeralPublicKeyBytes, ephemeralPublicKeyFlag],
  )
  const actions = useMemo(
    () =>
      bindDeviceActions(currentChain, {
        initialize,
        getZkProof: getZkProofForChain,
      }),
    [currentChain, initialize, getZkProofForChain],
  )

  return {
    isLocked,
    isPinSet,
    ephemeralPublicKey,
    ephemeralKeyPairSecretKey,
    getJwtRandomness,
    localnetUrl: localnet.url,
    maxEpoch,
    maxEpochTimestampMs,
    nonce,
    loading,
    error,
    initialize: actions.initialize,
    initializeForChain,
    rotateEphemeralKey,
    getZkProof: actions.getZkProof,
    unlock,
    lock,
  }
}
