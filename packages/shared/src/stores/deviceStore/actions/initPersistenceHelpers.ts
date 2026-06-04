import type { SuiChain } from '@mysten/wallet-standard'
import { ephKeyService } from '#/services/vaultService'
import { resolveStoredSecretKey } from '#/stores/deviceStore/keyHelpers'
import type {
  NetworkDataEntry,
  NetworkDataMap,
  PersistedDeviceStore,
  PersistedDeviceStoreState,
  StoredSecretKey,
} from '#/types'
import { isZkLoginSuiChain } from '#/types/networks'
import { createLogger } from '#/utils/logger'
import { DEVICE_STORAGE_KEY } from '#/utils/storageKeys'
import { setPublicKeyState } from './initStateHelpers'
import type { SetDeviceState } from './types'

type ExtensionRehydrationResult = {
  rehydrated: boolean
  storedSecretKey: StoredSecretKey
  jwtRandomness: string | null
}

const log = createLogger()

/** Reads the device store snapshot from chrome.storage.local; handles both legacy string-serialized and current object formats. */
export const readPersistedDeviceStoreState =
  async (): Promise<PersistedDeviceStoreState | null> => {
    const persistedDeviceStore = await new Promise<unknown>((resolve) => {
      chrome.storage.local.get([DEVICE_STORAGE_KEY], (result) => {
        resolve(result[DEVICE_STORAGE_KEY] || null)
      })
    })

    try {
      return parsePersistedDeviceStoreState(persistedDeviceStore)
    } catch (error) {
      log.error('Error parsing persisted device store', error)
      return null
    }
  }

const parsePersistedDeviceStoreState = (
  persistedDeviceStore: unknown,
): PersistedDeviceStoreState | null => {
  if (!persistedDeviceStore) {
    return null
  }

  if (typeof persistedDeviceStore === 'string') {
    return (
      (JSON.parse(persistedDeviceStore) as PersistedDeviceStore).state ?? null
    )
  }

  return typeof persistedDeviceStore === 'object' &&
    'state' in persistedDeviceStore
    ? ((persistedDeviceStore as PersistedDeviceStore).state ?? null)
    : null
}

/** Attempts to restore keypair and network data from chrome.storage; returns `rehydrated: false` if no persisted state exists so the caller can fall through to keypair creation. */
export const tryRehydrateExtensionDevice = async ({
  pin,
  currentChain,
  currentNetworkData,
  storedSecretKey,
  fallbackNetworkData,
  set,
}: {
  pin: string
  currentChain: SuiChain
  currentNetworkData: NetworkDataEntry
  storedSecretKey: StoredSecretKey
  fallbackNetworkData: NetworkDataMap
  set: SetDeviceState
}): Promise<ExtensionRehydrationResult> => {
  const emptyResult = createRehydrationResult(
    false,
    storedSecretKey,
    currentNetworkData.jwtRandomness,
  )

  const persistedDeviceStoreState = await readPersistedDeviceStoreState()
  if (!persistedDeviceStoreState) {
    return emptyResult
  }

  return resolvePersistedDeviceStoreState({
    persistedDeviceStoreState,
    pin,
    currentChain,
    currentNetworkData,
    storedSecretKey,
    fallbackNetworkData,
    set,
  }).catch((error) => {
    log.error('Error resolving persisted device store state', error)
    return emptyResult
  })
}

const resolvePersistedDeviceStoreState = async ({
  persistedDeviceStoreState,
  pin,
  currentChain,
  currentNetworkData,
  storedSecretKey,
  fallbackNetworkData,
  set,
}: {
  persistedDeviceStoreState: PersistedDeviceStoreState
  pin: string
  currentChain: SuiChain
  currentNetworkData: NetworkDataEntry
  storedSecretKey: StoredSecretKey
  fallbackNetworkData: NetworkDataMap
  set: SetDeviceState
}): Promise<ExtensionRehydrationResult> => {
  const jwtRandomness =
    getPersistedJwtRandomness(persistedDeviceStoreState, currentChain) ??
    currentNetworkData.jwtRandomness
  const resolvedSecretKey = await resolveStoredSecretKey(
    persistedDeviceStoreState.ephemeralKeyPairSecretKey ?? storedSecretKey,
    pin,
  )

  if (!jwtRandomness || !resolvedSecretKey) {
    return createRehydrationResult(false, resolvedSecretKey, jwtRandomness)
  }

  const publicKey = await ephKeyService.unlockVault(resolvedSecretKey, pin)
  if (!publicKey) {
    return createRehydrationResult(false, resolvedSecretKey, jwtRandomness)
  }

  log.debug('Rehydrating device store from persisted data')
  setPublicKeyState(set, publicKey, resolvedSecretKey)
  set({
    networkData: persistedDeviceStoreState.networkData ?? fallbackNetworkData,
    loading: false,
    isLocked: false,
    error: null,
  })
  return createRehydrationResult(true, resolvedSecretKey, jwtRandomness)
}

/** jwtRandomness is only meaningful for zkLogin chains; localnet has no JWT flow. */
const getPersistedJwtRandomness = (
  state: PersistedDeviceStoreState,
  chain: SuiChain,
): string | null | undefined => {
  return isZkLoginSuiChain(chain)
    ? state.networkData?.[chain]?.jwtRandomness
    : undefined
}

const createRehydrationResult = (
  rehydrated: boolean,
  storedSecretKey: StoredSecretKey,
  jwtRandomness: string | null,
): ExtensionRehydrationResult => ({
  rehydrated,
  storedSecretKey,
  jwtRandomness,
})
