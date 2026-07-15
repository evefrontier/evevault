import { ephKeyService } from '#/services/vaultService'
import { type DeviceState, KEY_FLAG_SECP256R1 } from '#/types'
import { isWebCryptoMarker } from '#/types/wallet'
import { isWeb } from '#/utils/environment'
import { createLogger } from '#/utils/logger'
import type { SetDeviceState } from './actions/types'
import { createEmptyLocalnetDeviceData } from './constants'
import { reconstructPublicKey } from './keyHelpers'

const log = createLogger()

/** Called by the zustand persist middleware immediately after loading state from storage; mutates state in place. */
export const handleDeviceStoreRehydration = (
  state: DeviceState | undefined,
  error?: unknown,
) => {
  if (error) {
    log.error('Error rehydrating device store', error)
    return
  }

  normalizeLocalnetState(state)
  validatePersistedSecretKey(state)
  reconstructPersistedPublicKey(state)
  clearInconsistentKeyState(state)
  updateWebLockState(state)
}

const normalizeLocalnetState = (state: DeviceState | undefined) => {
  if (!state) return
  state.localnet = {
    ...createEmptyLocalnetDeviceData(),
    ...(state.localnet ?? {}),
  }
}

const validatePersistedSecretKey = (state: DeviceState | undefined) => {
  const key = state?.ephemeralKeyPairSecretKey
  if (!key || typeof key !== 'object' || isValidStoredSecretKey(key)) {
    return
  }

  log.warn(
    'Invalid ephemeralKeyPairSecretKey structure on rehydration, setting to null',
    {
      hasIv: 'iv' in key,
      hasData: 'data' in key,
      keys: Object.keys(key),
    },
  )
  state.ephemeralKeyPairSecretKey = null
}

const reconstructPersistedPublicKey = (state: DeviceState | undefined) => {
  if (!state?.ephemeralPublicKeyBytes) {
    return
  }

  const publicKey = reconstructPublicKey(
    state.ephemeralPublicKeyBytes,
    state.ephemeralPublicKeyFlag ?? null,
  )

  if (publicKey) {
    state.ephemeralPublicKey = publicKey
    const schemeName =
      publicKey.flag() === KEY_FLAG_SECP256R1 ? 'Secp256r1' : 'Ed25519'
    log.debug(`Reconstructed ${schemeName} public key from storage`)
    return
  }

  clearPublicKeyState(state)
}

/** Public key bytes without a matching secret key means the encrypted key was lost from storage (e.g. extension data cleared); device must be re-initialized. */
const clearInconsistentKeyState = (state: DeviceState | undefined) => {
  if (!state?.ephemeralPublicKeyBytes || state.ephemeralKeyPairSecretKey) {
    return
  }

  log.warn(
    'Inconsistent state on rehydration: have ephemeralPublicKeyBytes but ephemeralKeyPairSecretKey is null/missing. This indicates the secret key was lost from storage.',
    {
      hasEphemeralPublicKeyBytes: Boolean(state.ephemeralPublicKeyBytes),
      hasEphemeralKeyPairSecretKey: Boolean(state.ephemeralKeyPairSecretKey),
    },
  )
  clearPublicKeyState(state)
  state.isLocked = true
}

/**
 * Web vault lock state is always derived from the live ephKeyService, never
 * from persisted state. This sync pass sees the not-yet-initialized service
 * (locked); refreshVaultLockState then corrects it after the service has had
 * the chance to restore a still-open unlock window.
 */
const updateWebLockState = (state: DeviceState | undefined) => {
  if (isWeb() && state) {
    state.isLocked = !ephKeyService.isUnlocked()
    state.loading = false
  }
}

/**
 * The persisted `isLocked` flag can be stale on both surfaces, so correct it
 * against the live vault status once rehydration completes.
 *
 * Extension: the keeper's key material lives only in the offscreen document's
 * memory — a persisted `false` saved before the keeper was torn down is wrong.
 * Web: the reverse — the signer died with the previous page, but the unlock
 * window is persisted per-tab, and initialize() restores the signer when that
 * window is still open (so an OAuth redirect doesn't re-prompt for the PIN).
 */
export const refreshVaultLockState = async (
  setState: SetDeviceState,
): Promise<void> => {
  if (isWeb()) {
    await ephKeyService.initialize()
    setState({ isLocked: !ephKeyService.isUnlocked() })
    return
  }
  const remainingMs = await ephKeyService.getUnlockRemainingMs()
  setState({ isLocked: remainingMs <= 0 })
}

const isValidStoredSecretKey = (key: object): boolean => {
  return isWebCryptoMarker(key) || ('iv' in key && 'data' in key)
}

const clearPublicKeyState = (state: DeviceState) => {
  state.ephemeralPublicKey = null
  state.ephemeralPublicKeyBytes = null
  state.ephemeralPublicKeyFlag = null
}
