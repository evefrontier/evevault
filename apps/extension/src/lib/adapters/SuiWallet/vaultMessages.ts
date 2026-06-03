import { trySettle } from '@/lib/util/timeoutGuard'

export const APPROVAL_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes

type VaultMessageOpts<T> = {
  id: string
  successType: string
  errorType: string
  outbound: Record<string, unknown>
  mapSuccess: (m: Record<string, unknown>) => T
  timeoutMessage: string
}

export function waitForVaultMessage<T>({
  id,
  successType,
  errorType,
  outbound,
  mapSuccess,
  timeoutMessage,
}: VaultMessageOpts<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const state = { settled: false }
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    function onMsg(e: MessageEvent) {
      const m: Record<string, unknown> = e.data || {}
      if (m.__from !== 'Eve Vault' || m.id !== id) return
      if (m.type === successType && trySettle(state, onMsg, timeoutId)) {
        resolve(mapSuccess(m))
        return
      }
      if (m.type === errorType && trySettle(state, onMsg, timeoutId)) {
        reject(new Error(m.error as string))
      }
    }

    window.addEventListener('message', onMsg)
    timeoutId = setTimeout(() => {
      if (trySettle(state, onMsg)) reject(new Error(timeoutMessage))
    }, APPROVAL_TIMEOUT_MS)
    window.postMessage(outbound, '*')
  })
}
