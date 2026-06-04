import type { PublicKey } from '@mysten/sui/cryptography'
import { ephKeyService } from '#/services/vaultService'
import {
  createEmptyLocalnetDeviceData,
  createInitialNetworkData,
} from '#/stores/deviceStore/constants'
import { isWeb } from '#/utils/environment'
import { createLogger } from '#/utils/logger'
import type { GetDeviceState, SetDeviceState } from './types'

const log = createLogger()

/** Flushes the in-memory vault so the private key is no longer accessible without re-entering the PIN. */
export const lockDevice = async (set: SetDeviceState) => {
  await ephKeyService.lock()
  set({ isLocked: true })
}

export const unlockDevice = async (
  pin: string,
  set: SetDeviceState,
  get: GetDeviceState,
) => {
  try {
    await unlockDeviceForPlatform(pin, set, get)
  } catch (error) {
    log.error('Error decrypting secret key', error)
    set({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

/** Wipes all ephemeral key state in-memory; does NOT remove the encrypted keypair from storage (requires re-init with PIN). */
export const resetDevice = (set: SetDeviceState) => {
  set({
    isLocked: true,
    ephemeralPublicKey: null,
    ephemeralPublicKeyBytes: null,
    ephemeralPublicKeyFlag: null,
    ephemeralKeyPairSecretKey: null,
    networkData: createInitialNetworkData(),
    localnet: createEmptyLocalnetDeviceData(),
    loading: false,
    error: null,
  })
}

const unlockDeviceForPlatform = async (
  pin: string,
  set: SetDeviceState,
  get: GetDeviceState,
) => {
  if (!pin.trim()) {
    set({ error: 'PIN is required' })
    return
  }

  const publicKey = isWeb()
    ? await unlockWebDevice(pin, set)
    : await unlockExtensionDevice(pin, set, get)
  if (publicKey === undefined) return

  setUnlockedState(set, publicKey)
}

const unlockWebDevice = async (
  pin: string,
  set: SetDeviceState,
): Promise<PublicKey | null | undefined> => {
  const hasKeypair = await ephKeyService.hasKeypair()
  if (!hasKeypair) {
    set({ error: 'No keypair available' })
    return undefined
  }

  return ephKeyService.unlockVault(null, pin)
}

const unlockExtensionDevice = async (
  pin: string,
  set: SetDeviceState,
  get: GetDeviceState,
): Promise<PublicKey | null | undefined> => {
  const storedKey = get().ephemeralKeyPairSecretKey
  if (!storedKey) {
    set({ error: 'No secret key available' })
    return undefined
  }

  return ephKeyService.unlockVault(storedKey, pin)
}

/** `publicKey` can be null on extension unlock if key refresh fails — still marks as unlocked so the vault state is consistent. */
const setUnlockedState = (set: SetDeviceState, publicKey: PublicKey | null) => {
  set(
    publicKey
      ? {
          isLocked: false,
          error: null,
          ephemeralPublicKey: publicKey,
          ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
          ephemeralPublicKeyFlag: publicKey.flag(),
        }
      : { isLocked: false, error: null },
  )
}
