import { ChromeOffscreenKeeperHost } from './chromeOffscreenKeeperHost'

/**
 * Transport seam between the background script and the keeper (which holds the
 * ephemeral key in RAM). Chrome runs the keeper in an offscreen document;
 * Firefox — which has no offscreen API — will host it elsewhere behind this
 * same interface. Isolating the offscreen path here keeps that later change
 * additive and Firefox-gated.
 */
export interface KeeperHost {
  /**
   * Ensure the keeper is running. When `waitForReady` is true, resolves only
   * once the keeper has signalled it is initialised (subject to a timeout).
   */
  ensureReady(waitForReady?: boolean): Promise<void>
  /**
   * Send a request to the keeper and return its response. Ensures the keeper is
   * ready first and retries transient "port closed" failures.
   */
  // biome-ignore lint/suspicious/noExplicitAny: keeper messages have dynamic types
  send(message: any, retries?: number): Promise<any>
}

// Selection between Chrome and a future Firefox host is deliberately not here
// yet — this PR only relocates the existing offscreen path behind the seam.
export const keeperHost: KeeperHost = new ChromeOffscreenKeeperHost()
