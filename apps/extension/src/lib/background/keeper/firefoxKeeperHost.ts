import { type Browser, browser } from 'wxt/browser'
import type { BackgroundMessage } from '@/lib/background/types'
import { handleKeeperMessage } from '../../../../entrypoints/keeper/keeperHandlers'
import type { KeeperHost } from './keeperHost'

type MsgSender = Browser.runtime.MessageSender

/**
 * Firefox keeper host: Firefox has no offscreen API, so the keeper runs in the
 * background context itself. `send` dispatches straight to the keeper router
 * that Chrome reaches over `runtime.sendMessage`, so there is no document to
 * create and `ensureReady` is a no-op. handleKeeperMessage is reused unchanged
 * — routing, target-gating, and the sender guard stay identical to Chrome.
 */
export class FirefoxKeeperHost implements KeeperHost {
  // The keeper already lives in this context; nothing to spin up.
  async ensureReady(_waitForReady = false): Promise<void> {}

  // biome-ignore lint/suspicious/noExplicitAny: keeper messages have dynamic types
  send(message: any, _retries = 3): Promise<any> {
    return new Promise((resolve) => {
      let settled = false
      const respond = (response?: unknown) => {
        if (settled) return
        settled = true
        resolve(response)
      }
      // Present this in-process call as our own origin so it passes the same
      // isExtensionSender guard Chrome's offscreen path relies on.
      const keepOpen = handleKeeperMessage(
        { ...message, target: 'KEEPER' } as BackgroundMessage,
        this.#ownSender(),
        respond,
      )
      // A false return means no async reply is coming (matches runtime.sendMessage
      // resolving undefined); guard against a handler that returned false without
      // responding so the caller can't hang.
      if (!keepOpen) respond(undefined)
    })
  }

  #ownSender(): MsgSender {
    const getURL = browser.runtime?.getURL as
      | ((path: string) => string)
      | undefined
    return { url: getURL?.('/') } as MsgSender
  }
}
