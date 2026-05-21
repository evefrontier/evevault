const DB_NAME = 'evevault-web-vault'
const STORE_NAME = 'keyval'

const getStore = async (): Promise<IDBObjectStore> => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
  })

  return db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
}

export const get = async <T>(key: string): Promise<T | undefined> => {
  const store = await getStore()
  return new Promise<T | undefined>((resolve, reject) => {
    const request = store.get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T | undefined)
  })
}

export const set = async (key: string, value: unknown): Promise<void> => {
  const store = await getStore()
  await new Promise<void>((resolve, reject) => {
    const request = store.put(value, key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export const del = async (key: string): Promise<void> => {
  const store = await getStore()
  await new Promise<void>((resolve, reject) => {
    const request = store.delete(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
