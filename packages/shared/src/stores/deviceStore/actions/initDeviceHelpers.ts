import type { SuiChain } from '@mysten/wallet-standard'
import { ephKeyService } from '#/services/vaultService'
import { resolveStoredSecretKey } from '#/stores/deviceStore/keyHelpers'
import type { DeviceState, NetworkDataEntry, StoredSecretKey } from '#/types'
import { createWebCryptoPlaceholder } from '#/types/wallet'
import { isWeb } from '#/utils/environment'
import { createLogger } from '#/utils/logger'
import { initializeChainIfNeeded } from './initChainHelpers'
import { tryRehydrateExtensionDevice } from './initPersistenceHelpers'
import {
  getNetworkDataEntry,
  hasChainDeviceData,
  hasFreshNetworkData,
  isBlankPin,
  setPublicKeyState,
} from './initStateHelpers'
import type { GetDeviceState, SetDeviceState } from './types'

const log = createLogger()

type InitActionParams = {
  pin: string
  currentChain: SuiChain
  set: SetDeviceState
  get: GetDeviceState
}

export const initializeDeviceStore = async ({
  pin,
  currentChain,
  set,
  get,
}: InitActionParams) => {
  set({ loading: true })

  if (isBlankPin(pin)) {
    set({ error: 'PIN is required', loading: false })
    return
  }

  try {
    await ephKeyService.initialize()
    await initializePlatformDevice({ pin, currentChain, set, get })
  } catch (error) {
    log.error('Error handling private key', error)
    set({
      error: error instanceof Error ? error.message : 'Unknown error',
      loading: false,
    })
  }
}

const initializePlatformDevice = async (params: InitActionParams) => {
  if (isWeb()) {
    await initializeWebDevice({
      ...params,
      currentNetworkData: getNetworkDataEntry(
        params.get(),
        params.currentChain,
      ),
    })
    return
  }

  await initializeExtensionDevice(params)
}

export const initializeWebDevice = async ({
  pin,
  currentChain,
  currentNetworkData,
  set,
  get,
}: InitActionParams & {
  currentNetworkData: NetworkDataEntry
}): Promise<void> => {
  const publicKey = await unlockExistingWebKeypair(pin)

  if (publicKey) {
    setPublicKeyState(set, publicKey, createWebCryptoPlaceholder())
    await initializeWebChainIfNeeded(currentChain, currentNetworkData, get)
    set({ loading: false, isLocked: false })
    return
  }

  log.info('[web] Creating new Secp256r1 keypair (encrypted with PIN)')
  const { publicKey: newPublicKey } =
    await ephKeyService.createEphemeralKeyPair(pin)
  setPublicKeyState(set, newPublicKey, createWebCryptoPlaceholder())

  await get().initializeForChain(currentChain)
  set({ loading: false, isLocked: false })
}

export const initializeExtensionDevice = async ({
  pin,
  currentChain,
  set,
  get,
}: InitActionParams) => {
  const currentState = get()
  const networkDataEntry = getNetworkDataEntry(currentState, currentChain)
  const storedSecretKey = await resolveStoredSecretKey(
    currentState.ephemeralKeyPairSecretKey,
    pin,
  )

  if (hasFreshNetworkData(networkDataEntry, storedSecretKey)) {
    log.debug('Device store already initialized, skipping re-init')
    set({ loading: false })
    return
  }

  const rehydration = await tryRehydrateExtensionDevice({
    pin,
    currentChain,
    currentNetworkData: networkDataEntry,
    storedSecretKey,
    fallbackNetworkData: currentState.networkData,
    set,
  })

  if (rehydration.rehydrated) {
    return
  }

  await ensureExtensionKeypair({
    pin,
    currentState,
    storedSecretKey: rehydration.storedSecretKey,
    set,
  })

  if (!get().ephemeralPublicKey) {
    throw new Error('Ephemeral public key not available after initialization')
  }

  await initializeChainIfNeeded(currentChain, get)
  set({ loading: false, isLocked: false })
}

export const ensureExtensionKeypair = async ({
  pin,
  currentState,
  storedSecretKey,
  set,
}: {
  pin: string
  currentState: DeviceState
  storedSecretKey: StoredSecretKey
  set: SetDeviceState
}): Promise<void> => {
  const needsNewKeyPair =
    !storedSecretKey || !currentState.ephemeralKeyPairSecretKey

  if (needsNewKeyPair) {
    await createExtensionKeypair(pin, set)
    return
  }

  await unlockExtensionKeypair(pin, storedSecretKey, set)
}

const unlockExistingWebKeypair = async (pin: string) => {
  const hasExistingKeypair = await ephKeyService.hasKeypair()
  if (!hasExistingKeypair) {
    return null
  }

  log.info('[web] Found existing encrypted keypair in IndexedDB')
  return ephKeyService.unlockVault(null, pin)
}

const initializeWebChainIfNeeded = async (
  currentChain: SuiChain,
  currentNetworkData: NetworkDataEntry,
  get: GetDeviceState,
) => {
  if (!hasChainDeviceData(currentNetworkData)) {
    await get().initializeForChain(currentChain)
  }
}

const createExtensionKeypair = async (pin: string, set: SetDeviceState) => {
  log.info('No existing ephemeral key pair found, creating new one')
  const { hashedSecretKey, publicKey } =
    await ephKeyService.createEphemeralKeyPair(pin)

  if (!hashedSecretKey || !publicKey) {
    throw new Error('Failed to create ephemeral key pair')
  }

  log.debug('Created new ephemeral key pair')
  setPublicKeyState(set, publicKey, hashedSecretKey)
}

const unlockExtensionKeypair = async (
  pin: string,
  storedSecretKey: StoredSecretKey,
  set: SetDeviceState,
) => {
  log.info('Existing ephemeral key pair found, unlocking vault')
  await ephKeyService.unlockVault(storedSecretKey, pin)
  const refreshedPublicKey = await ephKeyService.getEphemeralPublicKey()

  if (refreshedPublicKey) {
    setPublicKeyState(set, refreshedPublicKey)
  }
}
