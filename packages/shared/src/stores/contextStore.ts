import type { TenantId } from '@evefrontier/dapp-kit/utils';
import { SUI_TESTNET_CHAIN, type SuiChain } from '@mysten/wallet-standard';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeStorageAdapter, localStorageAdapter } from '#/adapters';
import type { ContextState, NetworkSwitchResult } from '#/types';
import { isLocalnetChain, isZkLoginSuiChain } from '#/types/networks';
import { createLogger, isExtension, isWeb } from '#/utils';
import { CONTEXT_STORAGE_KEY } from '#/utils/storageKeys';
import {
  getAvailableTenantIds,
  isAvailableTenantId,
} from '#/utils/tenantConfig';

// Store dependency direction is intentional: contextStore may coordinate with
// deviceStore during network switches, but deviceStore must not import contextStore.
const log = createLogger();

const INITIAL_TENANT_ID = 'stillness' as TenantId;

type PersistedContextState = Partial<{
  tenantId: TenantId;
  devMode: boolean;
  chain: SuiChain;
}>;

type PersistedStore<TState> = {
  state?: TState;
  version?: number;
};

function parsePersistedState<TState>(raw: string | null): TState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedStore<TState>;
    return parsed?.state ?? null;
  } catch {
    return null;
  }
}

function getInitialStateFromLocalStorage(): PersistedContextState {
  if (!isWeb() || typeof window === 'undefined' || !window.localStorage) {
    return {};
  }

  const context = parsePersistedState<PersistedContextState>(
    window.localStorage.getItem(CONTEXT_STORAGE_KEY),
  );
  return context ?? {};
}

const initialState = getInitialStateFromLocalStorage();

export const useContextStore = create<ContextState>()(
  persist(
    (set, get) => ({
      tenantId: initialState.tenantId ?? INITIAL_TENANT_ID,
      devMode: initialState.devMode ?? false,
      setTenantId: async (id: TenantId) => {
        if (!getAvailableTenantIds(true).includes(id)) {
          return;
        }
        set({ tenantId: id });
      },
      setDevMode: (value) => set({ devMode: value }),

      chain: initialState.chain ?? SUI_TESTNET_CHAIN,
      loading: false,

      checkNetworkSwitch: async (
        chain: SuiChain,
      ): Promise<{ requiresReauth: boolean }> => {
        const currentChain = get().chain;

        if (currentChain === chain || isLocalnetChain(chain)) {
          return { requiresReauth: false };
        }

        const { hasJwt } = await import('#/auth');
        const jwtExists = await hasJwt();
        return { requiresReauth: !jwtExists };
      },

      forceSetChain: (chain: SuiChain) => {
        const currentChain = get().chain;
        if (currentChain !== chain) {
          log.info('Force setting chain (for logout-based switch)', {
            from: currentChain,
            to: chain,
          });
          set({ chain });
        }
      },

      setChain: async (chain: SuiChain): Promise<NetworkSwitchResult> => {
        const currentChain = get().chain;

        const switchToLocalnetChain = (): NetworkSwitchResult => {
          set({ chain, loading: false });

          if (isExtension()) {
            chrome.runtime?.sendMessage?.({
              __from: 'Eve Vault',
              event: 'change',
              payload: { chains: [chain] },
            });
          }

          log.info('Switched to localnet');
          return { success: true, requiresReauth: false };
        };

        const switchToZkLoginChain = async (): Promise<NetworkSwitchResult> => {
          const { hasJwt, useAuthStore } = await import('#/auth');
          const { useDeviceStore } = await import('#/stores/deviceStore');
          const jwtExists = await hasJwt();

          set({ chain, loading: true });

          if (!jwtExists) {
            try {
              await useAuthStore.getState().initialize();
            } catch (error) {
              log.error(
                'Failed to initialize auth store after network switch',
                error,
              );
            }

            try {
              await useDeviceStore.getState().initializeForChain(chain);
            } catch (error) {
              log.warn(
                'Could not pre-initialize device data for chain during network switch',
                { chain, error },
              );
            }

            set({ loading: false });
            log.info('Switched to zkLogin chain (re-authentication required)', {
              chain,
            });
            return { success: true, requiresReauth: true };
          }

          try {
            if (isExtension()) {
              chrome.runtime?.sendMessage?.({
                __from: 'Eve Vault',
                event: 'change',
                payload: { chains: [chain] },
              });
            }

            const deviceStore = useDeviceStore.getState();
            const networkData = isZkLoginSuiChain(chain)
              ? deviceStore.networkData[chain]
              : undefined;
            const isExpired =
              networkData?.maxEpochTimestampMs != null &&
              Date.now() >= networkData.maxEpochTimestampMs;
            const needsInit =
              !networkData?.maxEpoch || isExpired || !networkData?.nonce;
            if (needsInit) {
              await deviceStore.initializeForChain(chain);
            }

            set({ loading: false });
            log.info('Successfully switched to zkLogin chain', { chain });
            return { success: true, requiresReauth: false };
          } catch (error) {
            log.error('Failed to complete network switch', error);
            set({ loading: false });
            set({ chain: currentChain });
            return { success: false, requiresReauth: false };
          }
        };

        if (currentChain === chain) {
          return { success: true, requiresReauth: false };
        }

        log.info('Setting chain', { from: currentChain, to: chain });

        if (isLocalnetChain(chain)) {
          return switchToLocalnetChain();
        }

        return switchToZkLoginChain();
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
);

if (typeof chrome !== 'undefined' && chrome.storage && !isWeb()) {
  const storage = chrome.storage as {
    onChanged?: {
      addListener: (
        callback: (changes: Record<string, unknown>, areaName: string) => void,
      ) => void;
    };
  };
  storage.onChanged?.addListener(
    (changes: Record<string, unknown>, areaName: string) => {
      if (areaName === 'local' && changes[CONTEXT_STORAGE_KEY]) {
        void useContextStore.persist.rehydrate();
      }
    },
  );
}

export function getCurrentContextTenantId(): TenantId {
  const state = useContextStore.getState();
  return isAvailableTenantId(state.tenantId, state.devMode)
    ? state.tenantId
    : INITIAL_TENANT_ID;
}
