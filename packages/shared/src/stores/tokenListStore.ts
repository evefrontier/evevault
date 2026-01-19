import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { chromeStorageAdapter, localStorageAdapter } from "../adapters";
import type { TokenListState } from "../types";
import { isWeb } from "../utils/environment";

const sanitizeCoinType = (coinType: string) => coinType.trim();

export const useTokenListStore = create<TokenListState>()(
  persist(
    (set, get) => ({
      tokens: ["0x2::sui::SUI"],
      addToken: (coinType: string) => {
        const normalized = sanitizeCoinType(coinType);
        if (!normalized) {
          return;
        }

        const currentTokens = get().tokens;
        if (currentTokens.includes(normalized)) {
          return;
        }

        set({ tokens: [...currentTokens, normalized] });
      },
      removeToken: (coinType: string) => {
        set({
          tokens: get().tokens.filter((token) => token !== coinType),
        });
      },
      clearTokens: () => set({ tokens: [] }),
    }),
    {
      name: "evevault:tokenlist",
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
    },
  ),
);
