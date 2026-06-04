import { ephKeyService } from '#/services/vaultService'
import type { DeviceState } from '#/types'
import { isWeb } from '#/utils/environment'
import { createLogger } from '#/utils/logger'
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
    log.debug(
      `Reconstructed ${isWeb() ? 'Secp256r1' : 'Ed25519'} public key from storage`,
    )
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

/** Web vault lock state is always derived from the in-memory ephKeyService, never from persisted state, since the WebCrypto key is not stored. */
const updateWebLockState = (state: DeviceState | undefined) => {
  if (isWeb() && state) {
    state.isLocked = !ephKeyService.isUnlocked()
    state.loading = false
  }
}

const isValidStoredSecretKey = (key: object): boolean => {
  return 'iv' in key && 'data' in key
}

const clearPublicKeyState = (state: DeviceState) => {
  state.ephemeralPublicKey = null
  state.ephemeralPublicKeyBytes = null
  state.ephemeralPublicKeyFlag = null
}
