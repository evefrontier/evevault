import { toErrorMessage } from '@evevault/shared/utils'
import { trySettle } from '@/lib/util/timeoutGuard'
import { postToEveVaultBridge } from './bridgeTargetOrigin'

type VaultMessageOpts<T> = {
  id: string
  successType: string
  errorType: string
  outbound: Record<string, unknown>
  mapSuccess: (m: Record<string, unknown>) => T
  timeoutMessage: string
}

export const APPROVAL_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Sends a single wallet request through the injected-page bridge and resolves
 * only the matching response id so overlapping dApp requests cannot settle each
 * other.
 */
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
        reject(new Error(toErrorMessage(m.error, 'Request failed')))
      }
    }

    window.addEventListener('message', onMsg)
    timeoutId = setTimeout(() => {
      if (trySettle(state, onMsg)) reject(new Error(timeoutMessage))
    }, APPROVAL_TIMEOUT_MS)
    postToEveVaultBridge(outbound)
  })
}
