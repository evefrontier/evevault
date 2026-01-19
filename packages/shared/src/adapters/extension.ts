import type { StorageAdapter } from "../types";

// Chrome storage adapter for extensions
export const chromeStorageAdapter: StorageAdapter = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage) {
        resolve(null);
        return;
      }
      chrome.storage.local.get(name, (result) => {
        const value = result[name];
        resolve(typeof value === "string" ? value : null);
      });
    });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage) {
        resolve();
        return;
      }
      chrome.storage.local.set({ [name]: value }, () => {
        resolve();
      });
    });
  },
  removeItem: async (name: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage) {
        resolve();
        return;
      }
      chrome.storage.local.remove(name, () => {
        resolve();
      });
    });
  },
};
