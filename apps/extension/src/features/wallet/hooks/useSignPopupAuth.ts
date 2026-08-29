import { useAuth } from '@evevault/shared/auth'
import { useContext, useDevice, useVaultAutoLock } from '@evevault/shared/hooks'
import { ephKeyService } from '@evevault/shared/services/vaultService'
import { createLogger } from '@evevault/shared/utils'
import { useEffect, useState } from 'react'

const log = createLogger()

/**
 * Auth + device state for sign popups. Runs auth init on mount and returns
 * combined state for the gate (lock screen, login prompt) and for signing
 * (user, ephemeralPublicKey, getZkProof, maxEpoch).
 */
export function useSignPopupAuth() {
  const device = useDevice()
  const auth = useAuth()
  const { chain } = useContext()

  // Sign popups are standalone entrypoints, so they must arm auto-lock
  // themselves — otherwise a keeper that expires while the approval screen sits
  // open never flips this popup to the lock screen.
  useVaultAutoLock()

  // The persisted `isLocked` flag can still read false on this popup's first
  // render while the keeper has already expired (its async refresh hasn't landed
  // yet). Confirm the authoritative lock state before Approve is enabled so the
  // popup shows the PIN screen instead of a doomed sign attempt.
  const [lockChecked, setLockChecked] = useState(false)
  useEffect(() => {
    let cancelled = false
    ephKeyService
      .getUnlockRemainingMs()
      .then((remainingMs) => {
        if (cancelled) return
        if (remainingMs <= 0) return device.lock()
      })
      .catch((error) => {
        log.warn('Failed to confirm keeper lock state for sign popup', {
          error,
        })
      })
      .finally(() => {
        if (!cancelled) setLockChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [device.lock])

  useEffect(() => {
    auth.initialize()
  }, [auth.initialize])

  useEffect(() => {
    const hasDeviceData = !!device.maxEpoch && !!device.nonce
    const canInitializeForChain =
      !device.isLocked && !!device.ephemeralPublicKey && !hasDeviceData
    if (!canInitializeForChain) return

    void device.initializeForChain(chain).catch((error) => {
      log.warn('Failed to initialize device data for sign popup', {
        chain,
        error,
      })
    })
  }, [
    chain,
    device.ephemeralPublicKey,
    device.initializeForChain,
    device.isLocked,
    device.maxEpoch,
    device.nonce,
  ])

  return {
    isLocked: device.isLocked,
    lockChecked,
    isPinSet: device.isPinSet,
    unlock: device.unlock,
    lock: device.lock,
    user: auth.user,
    loading: auth.loading,
    login: auth.login,
    maxEpoch: device.maxEpoch,
    getZkProof: device.getZkProof,
    ephemeralPublicKey: device.ephemeralPublicKey,
  }
}
