import type { vi } from 'vitest'

export function captureKeeperMessage(): Record<string, unknown> | undefined {
  const calls = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mock
    .calls
  return calls[0]?.[0] as Record<string, unknown> | undefined
}
