import '@testing-library/jest-dom/vitest'

// Node >= 22 ships built-in `localStorage`/`sessionStorage` globals that are
// non-functional unless the process runs with --localstorage-file: the object
// exists but getItem/setItem/removeItem are undefined. They shadow jsdom's
// working implementation, so any test touching storage throws
// "localStorage.getItem is not a function". Replace broken ones with a
// functional in-memory Storage.
const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(String(key)) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(String(key))
    },
    setItem: (key: string, value: string) => {
      store.set(String(key), String(value))
    },
  }
}

const STORAGE_METHODS = [
  'clear',
  'getItem',
  'key',
  'removeItem',
  'setItem',
] as const

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const existing = (globalThis as Record<string, unknown>)[name] as
    | Storage
    | undefined
  const isBroken =
    existing &&
    STORAGE_METHODS.some((method) => typeof existing[method] !== 'function')
  if (isBroken) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: createMemoryStorage(),
    })
  }
}
