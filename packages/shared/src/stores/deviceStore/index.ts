import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { chromeStorageAdapter, localStorageAdapter } from '#/adapters'
import type { DeviceState } from '#/types'
import { isWeb } from '#/utils/environment'
import { DEVICE_STORAGE_KEY } from '#/utils/storageKeys'
import { createInitActions } from './actions/initActions'
import { createLockActions } from './actions/lockActions'
import { createProofActions } from './actions/proofActions'
import {
  createEmptyLocalnetDeviceData,
  createInitialNetworkData,
} from './constants'
import {
  handleDeviceStoreRehydration,
  refreshExtensionLockState,
} from './rehydrationHelpers'
import { createDeviceSelectors } from './selectors'

export {
  createEmptyLocalnetDeviceData,
  createEmptyNetworkDataEntry,
} from './constants'

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      isLocked: true,
      ephemeralPublicKey: null,
      ephemeralPublicKeyBytes: null,
      ephemeralPublicKeyFlag: null,
      ephemeralKeyPairSecretKey: null,
      networkData: createInitialNetworkData(),
      localnet: createEmptyLocalnetDeviceData(),
      setLocalnetUrl: (url: string) =>
        set((state) => ({
          localnet: {
            ...state.localnet,
            url,
          },
        })),
      loading: false,
      error: null,

      ...createDeviceSelectors(get),
      ...createInitActions(set, get),
      ...createProofActions(set, get),
      ...createLockActions(set, get),
    }),
    {
      name: DEVICE_STORAGE_KEY,
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
      partialize: (state) => {
        return {
          ...state,
          ephemeralPublicKey: undefined,
          loading: undefined,
          error: undefined,
        }
      },
      onRehydrateStorage: () => {
        return (state, error) => {
          handleDeviceStoreRehydration(state, error)
          if (!error) {
            void refreshExtensionLockState(useDeviceStore.setState)
          }
        }
      },
    },
  ),
)

export const waitForDeviceHydration = async () => {
  if (useDeviceStore.persist.hasHydrated()) {
    return
  }

  await new Promise<void>((resolve) => {
    const unsub = useDeviceStore.persist.onFinishHydration(() => {
      unsub()
      resolve()
    })
    useDeviceStore.persist.rehydrate()
  })
}

export const rehydrateDeviceStore = async () => {
  await new Promise<void>((resolve) => {
    const unsub = useDeviceStore.persist.onFinishHydration(() => {
      unsub()
      resolve()
    })
    useDeviceStore.persist.rehydrate()
  })
}
