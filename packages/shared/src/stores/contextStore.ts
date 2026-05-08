import type { TenantId } from "@evefrontier/dapp-kit/utils";
import { SUI_TESTNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { chromeStorageAdapter, localStorageAdapter } from "#/adapters";
import type { ContextState, NetworkSwitchResult } from "#/types";
import { isLocalnetChain } from "#/types/networks";
import {
  createLogger,
  DEFAULT_LOCALNET_URL,
  isExtension,
  isWeb,
} from "#/utils";
import { CONTEXT_STORAGE_KEY } from "#/utils/storageKeys";
import {
  getAvailableTenantIds,
  isAvailableTenantId,
} from "#/utils/tenantConfig";

const log = createLogger();

const INITIAL_TENANT_ID = "stillness" as TenantId;

type PersistedContextState = Partial<{
  tenantId: TenantId;
  devMode: boolean;
  chain: SuiChain;
  localnetUrl: string;
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
  if (!isWeb() || typeof window === "undefined" || !window.localStorage) {
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
          log.error("[ContextStore] Invalid tenant ID", { id });
          return;
        }
        log.debug("[ContextStore] Setting tenant ID", { id });
        set({ tenantId: id });
      },
      setDevMode: (value) => {
        log.debug("[ContextStore] Setting dev mode", { to: value });
        set({ devMode: value });
      },

      chain: initialState.chain ?? SUI_TESTNET_CHAIN,
      loading: false,
      localnetUrl: initialState.localnetUrl ?? DEFAULT_LOCALNET_URL,
      setLocalnetUrl: (url: string) => {
        log.debug("[ContextStore] Setting localnet URL", { to: url });
        set({ localnetUrl: url });
      },

      initialize: async () => {
        return set({ loading: false });
      },

      checkNetworkSwitch: async (
        chain: SuiChain,
      ): Promise<{ requiresReauth: boolean }> => {
        const currentChain = get().chain;

        if (currentChain === chain || isLocalnetChain(chain)) {
          log.debug("[ContextStore] Network switch check bypassed", {
            currentChain,
            targetChain: chain,
            reason: currentChain === chain ? "same-chain" : "localnet",
          });
          return { requiresReauth: false };
        }

        const { hasJwt } = await import("#/auth");
        const jwtExists = await hasJwt();
        log.debug("[ContextStore] Network switch check evaluated", {
          currentChain,
          targetChain: chain,
          jwtExists,
          requiresReauth: !jwtExists,
        });
        return { requiresReauth: !jwtExists };
      },

      forceSetChain: (chain: SuiChain) => {
        const currentChain = get().chain;
        if (currentChain !== chain) {
          log.info(
            "[ContextStore] Force setting chain (for logout-based switch)",
            {
              from: currentChain,
              to: chain,
            },
          );
          set({ chain });
        }
      },

      setChain: async (chain: SuiChain): Promise<NetworkSwitchResult> => {
        const currentChain = get().chain;

        const switchToLocalnetChain = (): NetworkSwitchResult => {
          set({ chain, loading: false });

          if (isExtension()) {
            chrome.runtime?.sendMessage?.({
              __from: "Eve Vault",
              event: "change",
              payload: { chains: [chain] },
            });
          }

          log.info("[ContextStore] Switched to localnet", { chain });
          return { success: true, requiresReauth: false };
        };

        const switchToZkLoginChain = async (): Promise<NetworkSwitchResult> => {
          const { hasJwt, useAuthStore } = await import("#/auth");
          const { useDeviceStore } = await import("#/stores/deviceStore");
          const jwtExists = await hasJwt();
          log.debug("[ContextStore] Switching to zkLogin chain", {
            from: currentChain,
            to: chain,
            jwtExists,
          });

          set({ chain, loading: true });

          if (!jwtExists) {
            try {
              await useAuthStore.getState().initialize();
            } catch (error) {
              log.error(
                "Failed to initialize auth store after network switch",
                error,
              );
            }

            try {
              await useDeviceStore.getState().initializeForChain(chain);
            } catch (error) {
              log.warn(
                "Could not pre-initialize device data for chain during network switch",
                { chain, error },
              );
            }

            set({ loading: false });
            log.info(
              "[ContextStore] Switched to zkLogin chain (re-authentication required)",
              {
                chain,
              },
            );
            return { success: true, requiresReauth: true };
          }

          try {
            if (isExtension()) {
              chrome.runtime?.sendMessage?.({
                __from: "Eve Vault",
                event: "change",
                payload: { chains: [chain] },
              });
            }

            const deviceStore = useDeviceStore.getState();
            const networkData = deviceStore.networkData[chain];
            const isExpired =
              networkData?.maxEpochTimestampMs != null &&
              Date.now() >= networkData.maxEpochTimestampMs;
            const needsInit =
              !networkData?.maxEpoch || isExpired || !networkData?.nonce;
            log.debug(
              "[ContextStore] Evaluated device initialization requirements",
              {
                chain,
                hasNetworkData: Boolean(networkData),
                isExpired,
                needsInit,
              },
            );
            if (needsInit) {
              log.info(
                "[ContextStore] Initializing device data for switched chain",
                { chain },
              );
              await deviceStore.initializeForChain(chain);
            }

            set({ loading: false });
            log.info("[ContextStore] Successfully switched to zkLogin chain", {
              chain,
            });
            return { success: true, requiresReauth: false };
          } catch (error) {
            log.error(
              "[ContextStore] Failed to complete network switch",
              error,
            );
            set({ loading: false });
            set({ chain: currentChain });
            return { success: false, requiresReauth: false };
          }
        };

        if (currentChain === chain) {
          log.debug(
            "[ContextStore] Chain switch skipped because chain is unchanged",
            { chain },
          );
          return { success: true, requiresReauth: false };
        }

        log.info("[ContextStore] Setting chain", {
          from: currentChain,
          to: chain,
        });

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
        localnetUrl: state.localnetUrl,
      }),
    },
  ),
);

if (typeof chrome !== "undefined" && chrome.storage && !isWeb()) {
  const storage = chrome.storage as {
    onChanged?: {
      addListener: (
        callback: (changes: Record<string, unknown>, areaName: string) => void,
      ) => void;
    };
  };
  storage.onChanged?.addListener(
    (changes: Record<string, unknown>, areaName: string) => {
      if (areaName === "local" && changes[CONTEXT_STORAGE_KEY]) {
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
