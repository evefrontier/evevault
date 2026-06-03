import type { SuiChain } from '@mysten/wallet-standard'
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
import type { SetDeviceState } from './types'

const log = createLogger()

type ExtensionRehydrationResult = {
  rehydrated: boolean
  storedSecretKey: StoredSecretKey
  jwtRandomness: string | null
}

export const readPersistedDeviceStoreState =
  async (): Promise<PersistedDeviceStoreState | null> => {
    const persistedDeviceStore = await new Promise<unknown>((resolve) => {
      chrome.storage.local.get([DEVICE_STORAGE_KEY], (result) => {
        resolve(result[DEVICE_STORAGE_KEY] || null)
      })
    })

    return parsePersistedDeviceStoreState(persistedDeviceStore)
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

  try {
    const persistedDeviceStoreState = await readPersistedDeviceStoreState()
    return persistedDeviceStoreState
      ? resolvePersistedDeviceStoreState({
          persistedDeviceStoreState,
          pin,
          currentChain,
          currentNetworkData,
          storedSecretKey,
          fallbackNetworkData,
          set,
        })
      : emptyResult
  } catch (parseError) {
    log.error('Error parsing persisted device store', parseError)
    return emptyResult
  }
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

  log.debug('Rehydrating device store from persisted data')
  set({
    ephemeralKeyPairSecretKey: resolvedSecretKey,
    networkData: persistedDeviceStoreState.networkData ?? fallbackNetworkData,
    loading: false,
    error: null,
  })
  return createRehydrationResult(true, resolvedSecretKey, jwtRandomness)
}

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
