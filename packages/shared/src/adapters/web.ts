import type { StorageAdapter } from "@evevault/shared/types";

// localStorage adapter for web
export const localStorageAdapter: StorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(key);
  },
};
