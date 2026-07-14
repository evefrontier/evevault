import type { SuiChain } from '@mysten/wallet-standard'
import { DEVICE_STORAGE_KEY } from './storageKeys'

export const getDeviceData = async (chain: SuiChain) => {
  // Lazy import to avoid circular dependency: utils → getters → deviceStore → auth → authStore → utils
  const { useDeviceStore } = await import('#/stores/deviceStore')
  const deviceStore = useDeviceStore.getState()

  const jwtRandomness = deviceStore.getJwtRandomness(chain)
  const nonce = deviceStore.getNonce(chain)
  const maxEpoch = deviceStore.getMaxEpoch(chain)

  // If store has all data, return it immediately (avoid storage read)
  if (jwtRandomness && nonce && maxEpoch) {
    return {
      jwtRandomness,
      nonce,
      maxEpoch,
    }
  }

  // Fallback: read from storage only if store is missing data
  const result = await chrome.storage.local.get([DEVICE_STORAGE_KEY])
  const persistedState = parsePersistedState(result[DEVICE_STORAGE_KEY])
  const networkData = persistedState?.networkData?.[chain]

  return {
    // Fallback order: use store value, then per-network storage value, then null if still missing.
    jwtRandomness: jwtRandomness ?? networkData?.jwtRandomness ?? null,
    nonce: nonce ?? networkData?.nonce,
    maxEpoch: maxEpoch ?? networkData?.maxEpoch,
  }
}

type PersistedNetworkData = {
  networkData?: Partial<
    Record<
      SuiChain,
      { jwtRandomness?: string; nonce?: string; maxEpoch?: string }
    >
  >
}

/**
 * Storage may be empty (fresh install), hold a string-serialized snapshot, or
 * hold an already-parsed object (see readPersistedDeviceStoreState). Malformed
 * data must degrade to "no persisted state", not throw.
 */
const parsePersistedState = (raw: unknown): PersistedNetworkData | null => {
  if (typeof raw === 'string') {
    try {
      return (JSON.parse(raw) as { state?: PersistedNetworkData }).state ?? null
    } catch {
      return null
    }
  }
  if (raw && typeof raw === 'object' && 'state' in raw) {
    return (raw as { state?: PersistedNetworkData }).state ?? null
  }
  return null
}
