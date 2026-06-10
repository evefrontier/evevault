export function getBridgeTargetOrigin(): string | null {
  const origin = window.location.origin
  return origin && origin !== 'null' ? origin : null
}

export function postToEveVaultBridge(message: Record<string, unknown>): void {
  const targetOrigin = getBridgeTargetOrigin()
  if (!targetOrigin) return

  window.postMessage(message, targetOrigin)
}
