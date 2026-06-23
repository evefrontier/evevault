import { DEFAULT_TENANT, type TenantId } from '@evefrontier/wallet-core/tenant'
import { SUI_TESTNET_CHAIN, type SuiChain } from '@mysten/wallet-standard'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { chromeStorageAdapter, localStorageAdapter } from '#/adapters'
import type { ContextState } from '#/types'
import { isWeb } from '#/utils'
import { CONTEXT_STORAGE_KEY } from '#/utils/storageKeys'
import {
  getAvailableTenantIds,
  isAvailableTenantId,
} from '#/utils/tenantConfig'
import {
  checkNetworkSwitchRequirement,
  forceSetContextChain,
  setContextChain,
} from './contextStore.switching'

// Store dependency direction is intentional: contextStore may coordinate with
// deviceStore during network switches, but deviceStore must not import contextStore.

type PersistedContextState = Partial<{
  tenantId: TenantId
  devMode: boolean
  chain: SuiChain
}>

type PersistedStore<TState> = {
  state?: TState
  version?: number
}

function parsePersistedState<TState>(raw: string | null): TState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedStore<TState>
    return parsed?.state ?? null
  } catch {
    return null
  }
}

function getInitialStateFromLocalStorage(): PersistedContextState {
  if (!isWeb() || typeof window === 'undefined' || !window.localStorage) {
    return {}
  }

  const context = parsePersistedState<PersistedContextState>(
    window.localStorage.getItem(CONTEXT_STORAGE_KEY),
  )
  return context ?? {}
}

const initialState = getInitialStateFromLocalStorage()

export const useContextStore = create<ContextState>()(
  persist(
    (set, get) => ({
      tenantId: initialState.tenantId ?? DEFAULT_TENANT,
      devMode: initialState.devMode ?? false,
      setTenantId: async (id: TenantId) => {
        if (!getAvailableTenantIds(true).includes(id)) {
          return
        }
        set({ tenantId: id })
      },
      setDevMode: (value) => set({ devMode: value }),

      chain: initialState.chain ?? SUI_TESTNET_CHAIN,
      loading: false,

      checkNetworkSwitch: async (
        chain: SuiChain,
      ): Promise<{ requiresReauth: boolean }> => {
        return checkNetworkSwitchRequirement(get().chain, chain)
      },

      forceSetChain: (chain: SuiChain) => {
        forceSetContextChain(chain, set, get)
      },

      setChain: async (chain: SuiChain) => {
        return setContextChain(chain, set, get)
      },
    }),
    {
      name: CONTEXT_STORAGE_KEY,
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
      partialize: (state) => ({
        tenantId: state.tenantId,
        devMode: state.devMode,
        chain: state.chain,
      }),
    },
  ),
)

if (typeof chrome !== 'undefined' && chrome.storage && !isWeb()) {
  const storage = chrome.storage as {
    onChanged?: {
      addListener: (
        callback: (changes: Record<string, unknown>, areaName: string) => void,
      ) => void
    }
  }
  storage.onChanged?.addListener(
    (changes: Record<string, unknown>, areaName: string) => {
      if (areaName === 'local' && changes[CONTEXT_STORAGE_KEY]) {
        void useContextStore.persist.rehydrate()
      }
    },
  )
}

export function getCurrentContextTenantId(): TenantId {
  const state = useContextStore.getState()
  return isAvailableTenantId(state.tenantId, state.devMode)
    ? state.tenantId
    : DEFAULT_TENANT
}
