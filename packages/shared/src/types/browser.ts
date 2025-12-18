export type ChromeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => void;

export interface ChromeRuntime {
  id?: string;
  sendMessage?: (message: unknown) => void;
  onMessage?: {
    addListener: (listener: ChromeMessageListener) => void;
    removeListener: (listener: ChromeMessageListener) => void;
  };
}

export interface ChromeStorageArea {
  get: (
    keys: string | string[] | Record<string, unknown>,
    callback?: (items: Record<string, unknown>) => void,
  ) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>, callback?: () => void) => Promise<void>;
  remove: (keys: string | string[], callback?: () => void) => Promise<void>;
}

export interface ChromeStorage {
  local: ChromeStorageArea;
  session: ChromeStorageArea;
}

export interface ChromeInstance {
  runtime?: ChromeRuntime;
  storage: ChromeStorage;
}
