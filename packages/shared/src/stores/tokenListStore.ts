import type { SuiChain } from "@mysten/wallet-standard";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { chromeStorageAdapter, localStorageAdapter } from "../adapters";
import type { TokenListState } from "../types";
import {
  DEFAULT_TOKENS_BY_CHAIN,
  getDefaultTokensForChain,
} from "../types/networks";
import { isWeb } from "../utils/environment";
import { TOKENLIST_STORAGE_KEY } from "../utils/storageKeys";

const sanitizeCoinType = (coinType: string) => coinType.trim();

const initialTokens: Partial<Record<SuiChain, string[]>> = {
  ...DEFAULT_TOKENS_BY_CHAIN,
};

export const useTokenListStore = create<TokenListState>()(
  persist(
    (set, get) => ({
      tokens: initialTokens,
      addToken: (chain: SuiChain, coinType: string) => {
        const normalized = sanitizeCoinType(coinType);
        if (!normalized) {
          return;
        }

        const current = get().tokens[chain] ?? getDefaultTokensForChain(chain);
        if (current.includes(normalized)) {
          return;
        }

        set({
          tokens: {
            ...get().tokens,
            [chain]: [...current, normalized],
          },
        });
      },
      removeToken: (chain: SuiChain, coinType: string) => {
        const current = get().tokens[chain] ?? getDefaultTokensForChain(chain);
        set({
          tokens: {
            ...get().tokens,
            [chain]: current.filter((token) => token !== coinType),
          },
        });
      },
      clearTokens: (chain?: SuiChain) => {
        if (chain !== undefined) {
          set({
            tokens: {
              ...get().tokens,
              [chain]: [],
            },
          });
        } else {
          set({ tokens: {} });
        }
      },
    }),
    {
      name: TOKENLIST_STORAGE_KEY,
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
      partialize: (state) => ({ tokens: state.tokens }),
      merge: (persistedState, currentState) => {
        const raw = persistedState as
          | { state?: { tokens?: unknown }; tokens?: unknown }
          | null
          | undefined;
        const tokens = raw?.state?.tokens ?? raw?.tokens;
        // Only use persisted tokens if it's the new format (per-chain record). Old array format is ignored; use defaults.
        if (
          typeof tokens === "object" &&
          tokens !== null &&
          !Array.isArray(tokens)
        ) {
          return {
            ...currentState,
            tokens: tokens as TokenListState["tokens"],
          };
        }
        return currentState;
      },
    },
  ),
);
