import type { BackgroundMessage } from '@/lib/background/types'

export type KeeperSendResponse = (response?: unknown) => void
export type KeeperHandler = (
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
) => boolean
